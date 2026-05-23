from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.models.auth import User, UserStatus

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise credentials_exception

    # ── Load user WITH role eagerly ──────────────────────────────────────────
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception
    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive or suspended",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: str):
    """Dependency factory — restrict endpoint to specific roles."""
    async def _check(current_user: CurrentUser) -> User:
        if current_user.role.name not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role.name}' is not permitted for this action.",
            )
        return current_user
    return Depends(_check)


# Convenience shortcuts
SuperAdminRequired  = require_roles("super_admin")
AdminRequired       = require_roles("super_admin", "company_admin")
AccountantRequired  = require_roles("super_admin", "company_admin", "accountant")
DispatcherRequired  = require_roles("super_admin", "company_admin", "dispatcher", "staff")
StaffRequired       = require_roles("super_admin", "company_admin", "accountant", "dispatcher", "staff")
DriverRequired      = require_roles("driver")