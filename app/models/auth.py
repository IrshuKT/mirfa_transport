"""
Auth models: User, Role, Permission, RefreshToken, AuditLog
"""
import enum
from typing import List, Optional
from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer, String, Text,
    UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.core.database import Base


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"          # email not yet verified


class RoleName(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    COMPANY_ADMIN = "company_admin"
    ACCOUNTANT = "accountant"
    DISPATCHER = "dispatcher"
    STAFF = "staff"
    DRIVER = "driver"
    CUSTOMER_PORTAL = "customer_portal"
    VENDOR_PORTAL = "vendor_portal"


# ── Company ─────────────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    trade_license_no: Mapped[Optional[str]] = mapped_column(String(100))
    trn: Mapped[Optional[str]] = mapped_column(String(50))          # UAE Tax Reg No
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), default="Dubai")
    country: Mapped[str] = mapped_column(String(10), default="AE")
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    email: Mapped[Optional[str]] = mapped_column(String(200))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    vat_rate: Mapped[float] = mapped_column(default=0.05)

    users: Mapped[List["User"]] = relationship("User", back_populates="company")


# ── Role / Permission ────────────────────────────────────────────────────────

class Permission(Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(300))

    roles: Mapped[List["Role"]] = relationship(
        "Role", secondary="role_permissions", back_populates="permissions"
    )


class RolePermission(Base):
    """Association table — role ↔ permission."""
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"))
    permission_id: Mapped[int] = mapped_column(ForeignKey("permissions.id", ondelete="CASCADE"))

    __table_args__ = (UniqueConstraint("role_id", "permission_id"),)


class Role(Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(
        Enum(RoleName, name="role_name_enum"), unique=True, nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(String(300))
    is_system: Mapped[bool] = mapped_column(Boolean, default=True)  # cannot delete system roles

    users: Mapped[List["User"]] = relationship("User", back_populates="role")
    permissions: Mapped[List["Permission"]] = relationship(
        "Permission", secondary="role_permissions", back_populates="roles"
    )


# ── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    company_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)

    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status_enum"), default=UserStatus.PENDING
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))

    # 2FA
    totp_secret: Mapped[Optional[str]] = mapped_column(String(64))
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # Tracking
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    password_changed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relations
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="users")
    role: Mapped["Role"] = relationship("Role", back_populates="users")
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")
    force_password_change: Mapped[bool] = mapped_column(default=False)


# ── Refresh Token ─────────────────────────────────────────────────────────────

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(300))
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))

    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")


# ── Audit Log ────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    company_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100))
    detail: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(String(300))

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")
