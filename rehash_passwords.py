"""
One-time migration: rehash all user passwords.
Run this if users can't login after updating security.py.

Since we can't reverse bcrypt hashes, this script resets ALL passwords
to a temporary password and prints them so admin can distribute.

Usage:
    python rehash_passwords.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def rehash():
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.core.security import hash_password
    from app.models.auth import User, UserStatus

    print("\n🔐 Password Rehash Migration")
    print("=" * 45)
    print("This resets all user passwords to temporary ones.")
    print("Users must change their password on next login.\n")

    # New temp password for everyone
    TEMP_PASSWORD = "Temp@12345"

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.status == UserStatus.ACTIVE)
        )
        users = result.scalars().all()

        print(f"Found {len(users)} active users\n")
        print(f"{'Email':<35} {'Name':<25} New Password")
        print("-" * 75)

        for user in users:
            user.hashed_password = hash_password(TEMP_PASSWORD)
            print(f"{user.email:<35} {user.full_name:<25} {TEMP_PASSWORD}")

        await db.commit()

    print("\n" + "=" * 45)
    print(f"✅ All {len(users)} users reset to: {TEMP_PASSWORD}")
    print("\nShare new passwords with each user.")
    print("They should change it immediately after login.\n")


if __name__ == "__main__":
    asyncio.run(rehash())
