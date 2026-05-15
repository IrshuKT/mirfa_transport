from typing import Annotated
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.schemas.auth import (
    LoginRequest, LogoutRequest, PasswordChange,
    RefreshRequest, TOTPSetupResponse, TOTPVerifyRequest, TokenResponse, UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: DB):
    """Authenticate with email + password (+ optional TOTP code)."""
    return await auth_service.login(payload, db, request)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: DB):
    """Exchange a valid refresh token for a new token pair (rotation)."""
    return await auth_service.refresh_tokens(payload.refresh_token, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: DB):
    """Revoke the supplied refresh token."""
    await auth_service.logout(payload.refresh_token, db)


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    """Return the authenticated user's profile."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phone=current_user.phone,
        role=current_user.role.name,
        company_id=current_user.company_id,
        status=current_user.status,
        totp_enabled=current_user.totp_enabled,
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
    )


@router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(payload: PasswordChange, current_user: CurrentUser, db: DB):
    """Change own password — revokes all refresh tokens."""
    await auth_service.change_password(
        current_user, payload.current_password, payload.new_password, db
    )


# ── TOTP / 2FA ────────────────────────────────────────────────────────────────

@router.post("/totp/setup", response_model=TOTPSetupResponse)
async def totp_setup(current_user: CurrentUser, db: DB):
    """Generate a TOTP secret — returns secret + otpauth URI for QR code."""
    return await auth_service.setup_totp(current_user, db)


@router.post("/totp/confirm", status_code=status.HTTP_204_NO_CONTENT)
async def totp_confirm(payload: TOTPVerifyRequest, current_user: CurrentUser, db: DB):
    """Verify first TOTP code and enable 2FA on the account."""
    await auth_service.confirm_totp(current_user, payload.code, db)


@router.post("/totp/disable", status_code=status.HTTP_204_NO_CONTENT)
async def totp_disable(payload: PasswordChange, current_user: CurrentUser, db: DB):
    """Disable 2FA — requires current password confirmation."""
    await auth_service.disable_totp(current_user, payload.current_password, db)
