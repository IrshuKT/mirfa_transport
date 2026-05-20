"""Run this to find company ID and seed CoA automatically."""
import asyncio
import sys
import os
sys.path.insert(0, r'.')

async def run():
    from app.core.database import AsyncSessionLocal
    from app.models.auth import Company
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Company))
        companies = result.scalars().all()
        
        if not companies:
            print("No companies found! Run seed_roles first.")
            return
            
        for c in companies:
            print(f"Found company → ID: {c.id} | Name: {c.name}")
        
        # Use the first company
        company_id = companies[0].id
        print(f"\nSeeding CoA for company_id={company_id}...")
        
        from seeds.seed_coa import seed_coa
        await seed_coa(company_id)

asyncio.run(run())
