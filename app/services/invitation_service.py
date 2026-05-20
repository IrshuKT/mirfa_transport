"""
User invitation service.
Handles:
  1. Super Admin creates Company + Company Admin → welcome email
  2. Staff creates Customer → auto portal login → welcome email
  3. Staff creates Vendor  → auto portal login → welcome email
  4. Admin creates any staff user → welcome email
"""
import secrets
import string
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import hash_password
from app.models.auth import Company, Role, User, UserStatus
from app.models.entities import Customer, Vendor
from app.services.notification_service import send_email


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = ''.join(secrets.choice(alphabet) for _ in range(length))
        # Ensure it meets requirements
        if (any(c.isupper() for c in pwd) and
            any(c.isdigit() for c in pwd) and
            any(c in "!@#$%" for c in pwd)):
            return pwd


async def _get_role_by_name(db: AsyncSession, role_name: str) -> Optional[Role]:
    result = await db.execute(select(Role).where(Role.name == role_name))
    return result.scalar_one_or_none()


async def _send_welcome_email(
    to_email: str,
    full_name: str,
    role_label: str,
    company_name: str,
    temp_password: str,
    login_url: str = "http://localhost:3000/login",
) -> None:
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0ea5e9; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Mirfa Transport</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
        <p style="color: #334155; font-size: 16px;">Hello <strong>{full_name}</strong>,</p>
        <p style="color: #64748b;">Your <strong>{role_label}</strong> account has been created for <strong>{company_name}</strong>.</p>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">Your login credentials:</p>
          <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
          <p style="margin: 4px 0;"><strong>Temporary Password:</strong>
            <code style="background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-size: 15px; color: #0f172a;">
              {temp_password}
            </code>
          </p>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="{login_url}"
            style="background: #0ea5e9; color: white; padding: 12px 32px; border-radius: 8px;
                   text-decoration: none; font-weight: bold; font-size: 15px;">
            Login Now →
          </a>
        </div>

        <p style="color: #ef4444; font-size: 13px;">
          ⚠️ Please change your password immediately after first login.
        </p>
        <p style="color: #94a3b8; font-size: 12px;">
          If you did not expect this email, please contact your administrator.
        </p>
      </div>
    </div>
    """
    await send_email(
        to_email=to_email,
        subject=f"Welcome to Mirfa Transport — Your {role_label} Account",
        html_body=html,
    )


# ── 1. Super Admin: Register Company + Company Admin ─────────────────────────

async def register_company_with_admin(
    db: AsyncSession,
    created_by_id: int,
    # Company details
    company_name: str,
    trade_license_no: Optional[str],
    trn: Optional[str],
    address: Optional[str],
    city: str,
    phone: Optional[str],
    company_email: Optional[str],
    vat_rate: float,
    currency: str,
    # Admin details
    admin_full_name: str,
    admin_email: str,
    admin_phone: Optional[str],
    send_welcome: bool = True,
) -> dict:
    """
    1. Create company
    2. Create company_admin user with temp password
    3. Send welcome email
    """
    # Check email not taken
    existing = await db.scalar(select(User).where(User.email == admin_email))
    if existing:
        raise ValueError(f"Email {admin_email} is already registered")

    # Create company
    company = Company(
        name=company_name,
        trade_license_no=trade_license_no,
        trn=trn,
        address=address,
        city=city,
        phone=phone,
        email=company_email,
        vat_rate=vat_rate,
        currency=currency,
        is_active=True,
    )
    db.add(company)
    await db.flush()

    # Get company_admin role
    role = await _get_role_by_name(db, "company_admin")
    if not role:
        raise ValueError("company_admin role not found. Run seed_roles first.")

    # Generate temp password
    temp_password = _generate_temp_password()

    # Create admin user
    admin_user = User(
        company_id=company.id,
        role_id=role.id,
        email=admin_email,
        full_name=admin_full_name,
        phone=admin_phone,
        hashed_password=hash_password(temp_password),
        status=UserStatus.ACTIVE,
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(admin_user)

    # Send welcome email
    if send_welcome and admin_email:
        try:
            await _send_welcome_email(
                to_email=admin_email,
                full_name=admin_full_name,
                role_label="Company Administrator",
                company_name=company_name,
                temp_password=temp_password,
            )
        except Exception as e:
            # Don't fail if email fails — log and continue
            print(f"Warning: Welcome email failed: {e}")

    return {
        "company_id": company.id,
        "company_name": company.name,
        "admin_user_id": admin_user.id,
        "admin_email": admin_email,
        "temp_password": temp_password,   # returned so super admin can share manually
        "email_sent": send_welcome,
    }


# ── 2. Create any staff user with welcome email ───────────────────────────────

async def create_staff_user(
    db: AsyncSession,
    company_id: int,
    role_name: str,
    full_name: str,
    email: str,
    phone: Optional[str],
    created_by_id: int,
    send_welcome: bool = True,
) -> dict:
    """
    Create a staff/accountant/dispatcher/driver user and send welcome email.
    """
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise ValueError(f"Email {email} is already registered")

    role = await _get_role_by_name(db, role_name)
    if not role:
        raise ValueError(f"Role '{role_name}' not found")

    # Get company name for email
    company = await db.get(Company, company_id)
    company_name = company.name if company else "Mirfa Transport"

    temp_password = _generate_temp_password()

    user = User(
        company_id=company_id,
        role_id=role.id,
        email=email,
        full_name=full_name,
        phone=phone,
        hashed_password=hash_password(temp_password),
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    role_labels = {
        "company_admin":   "Company Administrator",
        "accountant":      "Accountant",
        "dispatcher":      "Dispatcher",
        "staff":           "Staff",
        "driver":          "Driver",
        "customer_portal": "Customer Portal User",
        "vendor_portal":   "Vendor Portal User",
    }

    if send_welcome and email:
        try:
            await _send_welcome_email(
                to_email=email,
                full_name=full_name,
                role_label=role_labels.get(role_name, role_name),
                company_name=company_name,
                temp_password=temp_password,
            )
        except Exception as e:
            print(f"Warning: Welcome email failed: {e}")

    return {
        "user_id": user.id,
        "email": email,
        "temp_password": temp_password,
        "email_sent": send_welcome,
    }


# ── 3. Create Customer portal login ──────────────────────────────────────────

async def create_customer_portal_user(
    db: AsyncSession,
    customer_id: int,
    company_id: int,
    created_by_id: int,
    send_welcome: bool = True,
) -> dict:
    """
    Auto-create portal login for a customer and link to customer record.
    Called when staff adds a customer with an email address.
    """
    from sqlalchemy.orm import selectinload as sl
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise ValueError("Customer not found")
    if not customer.email:
        raise ValueError("Customer has no email address")
    if customer.portal_user_id:
        raise ValueError("Customer already has a portal login")

    result = await create_staff_user(
        db=db,
        company_id=company_id,
        role_name="customer_portal",
        full_name=customer.name,
        email=customer.email,
        phone=customer.phone,
        created_by_id=created_by_id,
        send_welcome=send_welcome,
    )

    # Link portal user to customer
    customer.portal_user_id = result["user_id"]
    await db.commit()

    return result


# ── 4. Create Vendor portal login ─────────────────────────────────────────────

async def create_vendor_portal_user(
    db: AsyncSession,
    vendor_id: int,
    company_id: int,
    created_by_id: int,
    send_welcome: bool = True,
) -> dict:
    """Auto-create portal login for a vendor."""
    result_q = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.company_id == company_id)
    )
    vendor = result_q.scalar_one_or_none()
    if not vendor:
        raise ValueError("Vendor not found")
    if not vendor.email:
        raise ValueError("Vendor has no email address")
    if vendor.portal_user_id:
        raise ValueError("Vendor already has a portal login")

    result = await create_staff_user(
        db=db,
        company_id=company_id,
        role_name="vendor_portal",
        full_name=vendor.name,
        email=vendor.email,
        phone=vendor.phone,
        created_by_id=created_by_id,
        send_welcome=send_welcome,
    )

    vendor.portal_user_id = result["user_id"]
    await db.commit()

    return result
