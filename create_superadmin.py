"""
Create Super Admin user.
Run this once after setting up a fresh database.

Usage:
    python create_superadmin.py
    python create_superadmin.py --email admin@mirfa.ae --password MyPass@123 --name "Super Admin"
"""
import asyncio
import argparse
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def create_superadmin(
    email: str,
    password: str,
    full_name: str,
    company_name: str = "Mirfa Transport",
):
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal, init_db
    # Fix bcrypt 72-byte limit issue with passlib
    try:
        import bcrypt as _bcrypt_check
        if tuple(int(x) for x in _bcrypt_check.__version__.split('.')[:2]) >= (4, 1):
            import subprocess, sys
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'bcrypt==4.0.1', '-q'])
    except Exception:
        pass

    from app.core.security import hash_password
    from app.models.auth import (
        Company, Role, RoleName, Permission,
        RolePermission, User, UserStatus
    )

    print("\n🚀 Mirfa Transport — Super Admin Setup")
    print("=" * 45)

    # Step 1 — Create all tables
    print("\n[1/5] Creating database tables...")
    await init_db()
    print("      ✅ Tables ready")

    async with AsyncSessionLocal() as db:

        # Step 2 — Seed roles and permissions
        print("\n[2/5] Seeding roles and permissions...")

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

        ROLES = [
            {"name": RoleName.SUPER_ADMIN,     "description": "Full platform access"},
            {"name": RoleName.COMPANY_ADMIN,   "description": "Full access within own company"},
            {"name": RoleName.ACCOUNTANT,      "description": "Accounting + read ops"},
            {"name": RoleName.DISPATCHER,      "description": "Jobs + drivers + fleet"},
            {"name": RoleName.STAFF,           "description": "Quotations + customers"},
            {"name": RoleName.DRIVER,          "description": "Own jobs only"},
            {"name": RoleName.CUSTOMER_PORTAL, "description": "Customer self-service"},
            {"name": RoleName.VENDOR_PORTAL,   "description": "Vendor portal"},
        ]

        ROLE_PERMISSIONS = {
            RoleName.SUPER_ADMIN:     PERMISSIONS,
            RoleName.COMPANY_ADMIN:   [p for p in PERMISSIONS if not p.startswith("companies:")],
            RoleName.ACCOUNTANT:      [
                "jobs:read", "quotations:read", "customers:read", "vendors:read",
                "invoices:read", "invoices:write", "receipts:read", "receipts:write",
                "payments:read", "payments:write", "journals:read", "journals:write",
                "reports:read", "banks:read", "banks:write", "coa:read", "coa:write",
                "documents:read",
            ],
            RoleName.DISPATCHER:      [
                "jobs:read", "jobs:write", "quotations:read", "customers:read",
                "drivers:read", "drivers:write", "fleet:read", "fleet:write",
                "documents:read", "documents:write",
            ],
            RoleName.STAFF:           [
                "jobs:read", "quotations:read", "quotations:write",
                "customers:read", "customers:write", "vendors:read", "documents:read",
            ],
            RoleName.DRIVER:          ["jobs:read"],
            RoleName.CUSTOMER_PORTAL: ["jobs:read", "quotations:read", "invoices:read"],
            RoleName.VENDOR_PORTAL:   ["jobs:read", "payments:read"],
        }

        # Create permissions
        perm_map = {}
        for code in PERMISSIONS:
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
            existing = await db.scalar(select(Role).where(Role.name == r["name"]))
            if not existing:
                role = Role(**r, is_system=True)
                db.add(role)
                await db.flush()
                role_map[r["name"]] = role.id
            else:
                role_map[r["name"]] = existing.id

        # Assign permissions
        for role_name, perms in ROLE_PERMISSIONS.items():
            role_id = role_map[role_name]
            for perm_code in perms:
                perm_id = perm_map.get(perm_code)
                if not perm_id:
                    continue
                existing = await db.scalar(
                    select(RolePermission).where(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == perm_id,
                    )
                )
                if not existing:
                    db.add(RolePermission(role_id=role_id, permission_id=perm_id))

        await db.flush()
        print(f"      ✅ {len(ROLES)} roles, {len(PERMISSIONS)} permissions seeded")

        # Step 3 — Create company
        print(f"\n[3/5] Creating company: {company_name}...")
        existing_company = await db.scalar(
            select(Company).where(Company.name == company_name)
        )
        if existing_company:
            company = existing_company
            print(f"      ℹ️  Company already exists (ID: {company.id})")
        else:
            company = Company(
                name=company_name,
                city="Dubai",
                country="AE",
                currency="AED",
                vat_rate=0.05,
                is_active=True,
            )
            db.add(company)
            await db.flush()
            print(f"      ✅ Company created (ID: {company.id})")

        # Step 4 — Create super admin user
        print(f"\n[4/5] Creating super admin: {email}...")
        existing_user = await db.scalar(select(User).where(User.email == email))
        if existing_user:
            print(f"      ⚠️  User already exists — updating password...")
            existing_user.hashed_password = hash_password(password)
            existing_user.status = UserStatus.ACTIVE
            existing_user.company_id = company.id
            existing_user.role_id = role_map[RoleName.SUPER_ADMIN]
            await db.commit()
            print(f"      ✅ Password updated")
        else:
            user = User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                role_id=role_map[RoleName.SUPER_ADMIN],
                company_id=company.id,
                status=UserStatus.ACTIVE,
            )
            db.add(user)
            await db.commit()
            print(f"      ✅ Super admin created")

        # Step 5 — Seed chart of accounts
        print(f"\n[5/5] Seeding Chart of Accounts...")
        from seeds.seed_coa import seed_coa
        await seed_coa(company.id)

    # Done
    print("\n" + "=" * 45)
    print("✅ Setup complete! Login with:")
    print(f"   Email    : {email}")
    print(f"   Password : {password}")
    print(f"   URL      : http://localhost:3000")
    print("\n⚠️  Change your password after first login!")
    print("=" * 45 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create Mirfa Transport Super Admin")
    parser.add_argument("--email",    default="admin@mirfatransport.ae", help="Admin email")
    parser.add_argument("--password", default="Admin@1234",               help="Admin password")
    parser.add_argument("--name",     default="Super Admin",              help="Admin full name")
    parser.add_argument("--company",  default="Mirfa Transport",          help="Company name")
    args = parser.parse_args()

    asyncio.run(create_superadmin(
        email=args.email,
        password=args.password,
        full_name=args.name,
        company_name=args.company,
    ))
