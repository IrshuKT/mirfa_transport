"""
Run all seeds in order:
  python -m seeds
"""
import asyncio
from seeds.seed_roles import seed as seed_roles
from seeds.seed_coa import seed_coa


async def run_all():
    print("=" * 50)
    print("Running all seed scripts...")
    print("=" * 50)
    await seed_roles()
    await seed_coa(company_id=1)   # seeds CoA for the default company
    print("\n✅ All seeds complete. You can now log in as:")
    print("   Email:    admin@mirfatransport.ae")
    print("   Password: Admin@1234")
    print("   ⚠️  Change the password immediately!")


if __name__ == "__main__":
    asyncio.run(run_all())
