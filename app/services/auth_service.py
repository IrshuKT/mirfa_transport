"""
Auth service: login, token refresh, 2FA, password operations.
All DB operations are async; tokens are signed JWTs.
"""
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    generate_totp_secret, get_totp_uri, hash_password,
    verify_password, verify_totp,
)
from app.models.auth import AuditLog, RefreshToken, User, UserStatus
from app.schemas.auth import LoginRequest, TokenResponse


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def login(
    payload: LoginRequest,
    db: AsyncSession,
    request: Optional[Request] = None,
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user: Optional[User] = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.status == UserStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive or suspended.",
        )

    # 2FA check
    if user.totp_enabled:
        if not payload.totp_code:
            # Signal frontend to collect TOTP
            return TokenResponse(
                access_token="",
                refresh_token="",
                expires_in=0,
                user_id=user.id,
                role=user.role.name,
                company_id=user.company_id,
                totp_required=True,
            )
        if not verify_totp(user.totp_secret, payload.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code",
            )

    access_token = create_access_token(user.id, user.role.name, user.company_id)
    refresh_raw = create_refresh_token(user.id)

    # Persist hashed refresh token
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_hash_token(refresh_raw),
            expires_at=expires_at,
            ip_address=request.client.host if request else None,
            user_agent=request.headers.get("user-agent") if request else None,
        )
    )

    # Update last login
    await db.execute(
        update(User).where(User.id == user.id).values(last_login_at=datetime.now(timezone.utc))
    )

    # Audit
    db.add(AuditLog(
        user_id=user.id,
        company_id=user.company_id,
        action="login",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=request.client.host if request else None,
    ))

    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_raw,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.id,
        role=user.role.name,
        company_id=user.company_id,
    )


async def refresh_tokens(raw_refresh: str, db: AsyncSession) -> TokenResponse:
    try:
        payload = decode_token(raw_refresh)
        assert payload.get("type") == "refresh"
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = _hash_token(raw_refresh)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    stored: Optional[RefreshToken] = result.scalar_one_or_none()
    if not stored or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    # Rotate: revoke old, issue new
    stored.revoked = True

    result2 = await db.execute(select(User).where(User.id == user_id))
    user: User = result2.scalar_one()

    new_access = create_access_token(user.id, user.role.name, user.company_id)
    new_refresh_raw = create_refresh_token(user.id)

    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(new_refresh_raw),
        expires_at=expires_at,
    ))

    await db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh_raw,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.id,
        role=user.role.name,
        company_id=user.company_id,
    )


async def logout(raw_refresh: str, db: AsyncSession) -> None:
    token_hash = _hash_token(raw_refresh)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()
    if stored:
        stored.revoked = True
        await db.commit()


async def setup_totp(user: User, db: AsyncSession):
    secret = generate_totp_secret()
    user.totp_secret = secret
    await db.commit()
    return {"secret": secret, "uri": get_totp_uri(secret, user.email)}


async def confirm_totp(user: User, code: str, db: AsyncSession) -> bool:
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="TOTP not initialized")
    if not verify_totp(user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    user.totp_enabled = True
    await db.commit()
    return True


async def disable_totp(user: User, password: str, db: AsyncSession) -> bool:
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()
    return True


async def change_password(user: User, current: str, new: str, db: AsyncSession) -> None:
    if not verify_password(current, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(new)
    user.password_changed_at = datetime.now(timezone.utc)
    # Revoke all refresh tokens on password change
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id)
        .values(revoked=True)
    )
    await db.commit()
