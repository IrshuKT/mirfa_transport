from datetime import datetime, timedelta, timezone
from typing import Any

import pyotp
from jose import jwt

from app.core.config import settings

# ── Password hashing — use bcrypt directly, bypass passlib ───────────────────
# Reason: passlib 1.7.4 is incompatible with bcrypt 4.x in some environments.
# Using bcrypt directly is simpler, faster and has no compatibility issues.
import bcrypt as _bcrypt


def hash_password(plain: str) -> str:
    """Hash a password using bcrypt. Truncates to 72 bytes (bcrypt hard limit)."""
    password_bytes = plain.encode("utf-8")[:72]
    salt = _bcrypt.gensalt(rounds=12)
    return _bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    try:
        password_bytes = plain.encode("utf-8")[:72]
        hashed_bytes   = hashed.encode("utf-8")
        return _bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────
def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(
    subject: int | str, role: str, company_id: int | None = None
) -> str:
    return _create_token(
        {"sub": str(subject), "role": role, "company_id": company_id, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: int | str) -> str:
    return _create_token(
        {"sub": str(subject), "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── TOTP (2FA) ────────────────────────────────────────────────────────────────
def generate_totp_secret() -> str:
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email, issuer_name=settings.TOTP_ISSUER
    )


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)