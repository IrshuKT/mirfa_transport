"""
Seed a standard UAE logistics Chart of Accounts.
Run after seed_roles.py.

Usage:
  python -m seeds.seed_coa --company_id 1
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


COA = [
    # ── ASSETS ─────────────────────────────────────────────────────────────
    {"code": "1000", "name": "Current Assets",               "type": "asset",     "parent": None},
    {"code": "1010", "name": "Cash on Hand",                 "type": "asset",     "parent": "1000", "is_cash": True},
    {"code": "1020", "name": "Bank — Emirates NBD",          "type": "asset",     "parent": "1000"},
    {"code": "1021", "name": "Bank — FAB",                   "type": "asset",     "parent": "1000"},
    {"code": "1030", "name": "Petty Cash",                   "type": "asset",     "parent": "1000", "is_cash": True},
    {"code": "1100", "name": "Accounts Receivable",          "type": "asset",     "parent": "1000", "is_control": True},
    {"code": "1110", "name": "Advance to Drivers",           "type": "asset",     "parent": "1000"},
    {"code": "1120", "name": "Advance to Employees",         "type": "asset",     "parent": "1000"},
    {"code": "1130", "name": "VAT Receivable (Input)",       "type": "asset",     "parent": "1000"},
    {"code": "1200", "name": "Prepaid Expenses",             "type": "asset",     "parent": "1000"},
    {"code": "1500", "name": "Non-Current Assets",           "type": "asset",     "parent": None},
    {"code": "1510", "name": "Vehicles",                     "type": "asset",     "parent": "1500"},
    {"code": "1511", "name": "Accumulated Depreciation — Vehicles", "type": "asset", "parent": "1500"},
    {"code": "1520", "name": "Equipment",                    "type": "asset",     "parent": "1500"},
    {"code": "1521", "name": "Accumulated Depreciation — Equipment", "type": "asset", "parent": "1500"},
    {"code": "1530", "name": "Office Furniture & Fixtures",  "type": "asset",     "parent": "1500"},

    # ── LIABILITIES ──────────────────────────────────────────────────────────
    {"code": "2000", "name": "Current Liabilities",          "type": "liability", "parent": None},
    {"code": "2100", "name": "Accounts Payable",             "type": "liability", "parent": "2000", "is_control": True},
    {"code": "2110", "name": "Accrued Expenses",             "type": "liability", "parent": "2000"},
    {"code": "2120", "name": "Advance from Customers",       "type": "liability", "parent": "2000"},
    {"code": "2200", "name": "VAT Payable (Output)",         "type": "liability", "parent": "2000"},
    {"code": "2210", "name": "VAT Clearing",                 "type": "liability", "parent": "2000"},
    {"code": "2300", "name": "Employee Gratuity Payable",    "type": "liability", "parent": "2000"},
    {"code": "2310", "name": "Salary Payable",               "type": "liability", "parent": "2000"},
    {"code": "2400", "name": "Loan — Short Term",            "type": "liability", "parent": "2000"},
    {"code": "2500", "name": "Non-Current Liabilities",      "type": "liability", "parent": None},
    {"code": "2510", "name": "Loan — Long Term",             "type": "liability", "parent": "2500"},

    # ── EQUITY ───────────────────────────────────────────────────────────────
    {"code": "3000", "name": "Equity",                       "type": "equity",    "parent": None},
    {"code": "3010", "name": "Owner's Capital",              "type": "equity",    "parent": "3000"},
    {"code": "3020", "name": "Retained Earnings",            "type": "equity",    "parent": "3000"},
    {"code": "3030", "name": "Current Year Profit / Loss",   "type": "equity",    "parent": "3000"},

    # ── REVENUE ──────────────────────────────────────────────────────────────
    {"code": "4000", "name": "Revenue",                      "type": "revenue",   "parent": None},
    {"code": "4100", "name": "Freight Revenue",              "type": "revenue",   "parent": "4000"},
    {"code": "4110", "name": "Trucking Revenue — Local",     "type": "revenue",   "parent": "4000"},
    {"code": "4120", "name": "Trucking Revenue — Cross Border", "type": "revenue","parent": "4000"},
    {"code": "4130", "name": "Courier / Last Mile Revenue",  "type": "revenue",   "parent": "4000"},
    {"code": "4140", "name": "Warehousing Revenue",          "type": "revenue",   "parent": "4000"},
    {"code": "4150", "name": "Customs Clearance Revenue",    "type": "revenue",   "parent": "4000"},
    {"code": "4200", "name": "Other Income",                 "type": "revenue",   "parent": "4000"},

    # ── EXPENSES ─────────────────────────────────────────────────────────────
    {"code": "5000", "name": "Cost of Revenue (COGS)",       "type": "expense",   "parent": None},
    {"code": "5100", "name": "Subcontractor Costs",          "type": "expense",   "parent": "5000"},
    {"code": "5110", "name": "Fuel Expenses",                "type": "expense",   "parent": "5000"},
    {"code": "5120", "name": "Toll & Road Charges",          "type": "expense",   "parent": "5000"},
    {"code": "5130", "name": "Driver Overtime",              "type": "expense",   "parent": "5000"},
    {"code": "5140", "name": "Vehicle Maintenance",          "type": "expense",   "parent": "5000"},
    {"code": "5150", "name": "Vehicle Insurance",            "type": "expense",   "parent": "5000"},
    {"code": "5160", "name": "Vehicle Registration (Mulkiya)", "type": "expense", "parent": "5000"},
    {"code": "6000", "name": "Operating Expenses",           "type": "expense",   "parent": None},
    {"code": "6010", "name": "Salaries & Wages",             "type": "expense",   "parent": "6000"},
    {"code": "6020", "name": "Employee Gratuity Expense",    "type": "expense",   "parent": "6000"},
    {"code": "6030", "name": "Visa & Immigration Fees",      "type": "expense",   "parent": "6000"},
    {"code": "6040", "name": "Office Rent",                  "type": "expense",   "parent": "6000"},
    {"code": "6050", "name": "Utilities",                    "type": "expense",   "parent": "6000"},
    {"code": "6060", "name": "Telephone & Internet",         "type": "expense",   "parent": "6000"},
    {"code": "6070", "name": "Office Supplies",              "type": "expense",   "parent": "6000"},
    {"code": "6080", "name": "Trade License & Govt Fees",    "type": "expense",   "parent": "6000"},
    {"code": "6090", "name": "Bank Charges",                 "type": "expense",   "parent": "6000"},
    {"code": "6100", "name": "Depreciation Expense",         "type": "expense",   "parent": "6000"},
    {"code": "6110", "name": "Advertising & Marketing",      "type": "expense",   "parent": "6000"},
    {"code": "6120", "name": "Legal & Professional Fees",    "type": "expense",   "parent": "6000"},
    {"code": "6130", "name": "Miscellaneous Expenses",       "type": "expense",   "parent": "6000"},
]


async def seed_coa(company_id: int):
    from sqlalchemy import select
    from app.core.database import AsyncSessionLocal
    from app.models.accounting.models import Account, AccountType

    async with AsyncSessionLocal() as db:
        print(f"Seeding Chart of Accounts for company_id={company_id}...")

        code_to_id = {}

        for entry in COA:
            existing = await db.scalar(
                select(Account).where(
                    Account.company_id == company_id,
                    Account.code == entry["code"],
                )
            )
            if existing:
                code_to_id[entry["code"]] = existing.id
                # Backfill is_cash on existing rows too, in case this is a re-run
                # after adding the flag to a company that was already seeded.
                if entry.get("is_cash") and not existing.is_cash:
                    existing.is_cash = True
                continue

            parent_id = None
            if entry.get("parent"):
                parent_id = code_to_id.get(entry["parent"])

            account = Account(
                company_id=company_id,
                code=entry["code"],
                name=entry["name"],
                account_type=AccountType(entry["type"]),
                parent_id=parent_id,
                is_control=entry.get("is_control", False),
                is_cash=entry.get("is_cash", False),
                is_active=True,
            )
            db.add(account)
            await db.flush()
            code_to_id[entry["code"]] = account.id
            print(f"  {entry['code']} — {entry['name']}")

        await db.commit()
        print(f"✅ Chart of Accounts seeded: {len(COA)} accounts for company {company_id}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--company_id", type=int, default=1)
    args = parser.parse_args()
    asyncio.run(seed_coa(args.company_id))