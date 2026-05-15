from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


# ── Login / Token ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None        # required if user has 2FA enabled


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int                        # seconds
    user_id: int
    role: str
    company_id: Optional[int]
    totp_required: bool = False            # signals frontend to show TOTP prompt


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    role_id: int
    company_id: Optional[int] = None

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordChange":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class PasswordReset(BaseModel):
    token: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    role: str
    company_id: Optional[int]
    status: str
    totp_enabled: bool
    last_login_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── TOTP ──────────────────────────────────────────────────────────────────────

class TOTPSetupResponse(BaseModel):
    secret: str
    uri: str              # otpauth:// URI for QR code generation


class TOTPVerifyRequest(BaseModel):
    code: str


# ── Company ───────────────────────────────────────────────────────────────────

class CompanyCreate(BaseModel):
    name: str
    trade_license_no: Optional[str] = None
    trn: Optional[str] = None
    address: Optional[str] = None
    city: str = "Dubai"
    country: str = "AE"
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    currency: str = "AED"
    vat_rate: float = 0.05


class CompanyResponse(BaseModel):
    id: int
    name: str
    trn: Optional[str]
    city: str
    country: str
    is_active: bool
    currency: str
    vat_rate: float
    created_at: datetime

    model_config = {"from_attributes": True}
