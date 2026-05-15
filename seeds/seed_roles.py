"""
Run once to seed:
  - All system roles
  - Default permissions
  - Super admin user

Usage:
  python -m seeds.seed_roles
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.auth import Role, RoleName, Permission, RolePermission, User, UserStatus, Company


ROLES = [
    {"name": RoleName.SUPER_ADMIN,      "description": "Full platform access across all companies"},
    {"name": RoleName.COMPANY_ADMIN,    "description": "Full access within own company"},
    {"name": RoleName.ACCOUNTANT,       "description": "Accounting + read-only ops"},
    {"name": RoleName.DISPATCHER,       "description": "Jobs, drivers, fleet management"},
    {"name": RoleName.STAFF,            "description": "Quotations, customers, job read"},
    {"name": RoleName.DRIVER,           "description": "Own jobs only via mobile app"},
    {"name": RoleName.CUSTOMER_PORTAL,  "description": "Customer self-service portal"},
    {"name": RoleName.VENDOR_PORTAL,    "description": "Vendor/subcontractor portal"},
]

PERMISSIONS = [
    "jobs:read", "jobs:write", "jobs:delete",
    "quotations:read", "quotations:write", "quotations:delete",
    "customers:read", "customers:write", "customers:delete",
    "vendors:read", "vendors:write", "vendors:delete",
    "employees:read", "employees:write",
    "drivers:read", "drivers:write",
    "fleet:read", "fleet:write",
    "documents:read", "documents:write",
    "invoices:read", "invoices:write",
    "receipts:read", "receipts:write",
    "payments:read", "payments:write",
    "journals:read", "journals:write",
    "reports:read",
    "banks:read", "banks:write",
    "coa:read", "coa:write",
    "users:read", "users:write",
    "companies:read", "companies:write",
    "settings:read", "settings:write",
]

# Which permissions each role gets
ROLE_PERMISSIONS = {
    RoleName.SUPER_ADMIN:     PERMISSIONS,                          # everything
    RoleName.COMPANY_ADMIN:   [p for p in PERMISSIONS if not p.startswith("companies:")],
    RoleName.ACCOUNTANT:      ["jobs:read", "quotations:read", "customers:read",
                               "invoices:read", "invoices:write", "receipts:read", "receipts:write",
                               "payments:read", "payments:write", "journals:read", "journals:write",
                               "reports:read", "banks:read", "banks:write", "coa:read", "coa:write",
                               "documents:read", "vendors:read"],
    RoleName.DISPATCHER:      ["jobs:read", "jobs:write", "quotations:read",
                               "customers:read", "drivers:read", "drivers:write",
                               "fleet:read", "fleet:write", "documents:read", "documents:write"],
    RoleName.STAFF:           ["jobs:read", "quotations:read", "quotations:write",
                               "customers:read", "customers:write", "vendors:read", "documents:read"],
    RoleName.DRIVER:          ["jobs:read"],
    RoleName.CUSTOMER_PORTAL: ["jobs:read", "quotations:read", "invoices:read", "documents:read"],
    RoleName.VENDOR_PORTAL:   ["jobs:read", "payments:read", "documents:read"],
}


async def seed():
    async with AsyncSessionLocal() as db:
        print("Seeding roles and permissions...")

        # Create permissions
        perm_map = {}
        for code in PERMISSIONS:
            from sqlalchemy import select
            existing = await db.scalar(select(Permission).where(Permission.code == code))
            if not existing:
                perm = Permission(code=code, description=code.replace(":", " "))
                db.add(perm)
                await db.flush()
                perm_map[code] = perm.id
            else:
                perm_map[code] = existing.id

        # Create roles
        role_map = {}
        for r in ROLES:
            from sqlalchemy import select
            existing = await db.scalar(select(Role).where(Role.name == r["name"]))
            if not existing:
                role = Role(**r, is_system=True)
                db.add(role)
                await db.flush()
                role_map[r["name"]] = role.id
            else:
                role_map[r["name"]] = existing.id

        # Assign permissions to roles
        for role_name, perms in ROLE_PERMISSIONS.items():
            role_id = role_map[role_name]
            for perm_code in perms:
                perm_id = perm_map.get(perm_code)
                if not perm_id:
                    continue
                from sqlalchemy import select
                existing = await db.scalar(
                    select(RolePermission).where(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == perm_id,
                    )
                )
                if not existing:
                    db.add(RolePermission(role_id=role_id, permission_id=perm_id))

        # Create default super admin company
        from sqlalchemy import select
        company = await db.scalar(select(Company).where(Company.name == "Mirfa Transport"))
        if not company:
            company = Company(
                name="Mirfa Transport",
                city="Dubai",
                country="AE",
                currency="AED",
                vat_rate=0.05,
            )
            db.add(company)
            await db.flush()
            print(f"  Created company: Mirfa Transport (id={company.id})")

        # Create super admin user
        super_admin_email = "admin@mirfatransport.ae"
        existing_user = await db.scalar(select(User).where(User.email == super_admin_email))
        if not existing_user:
            super_admin_role_id = role_map[RoleName.SUPER_ADMIN]
            user = User(
                email=super_admin_email,
                full_name="Super Admin",
                hashed_password=hash_password("Admin@1234"),   # CHANGE IN PRODUCTION
                role_id=super_admin_role_id,
                company_id=company.id,
                status=UserStatus.ACTIVE,
            )
            db.add(user)
            print(f"  Created super admin: {super_admin_email} / Admin@1234")
            print("  ⚠️  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!")

        await db.commit()
        print("✅ Roles and permissions seeded successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
