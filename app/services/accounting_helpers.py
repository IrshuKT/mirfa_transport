from sqlalchemy import select, text
from fastapi import HTTPException
import enum
from typing import List, Optional 
from datetime import date, datetime 
from sqlalchemy import ( Boolean, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, Integer ) 
from sqlalchemy.orm import Mapped, mapped_column, relationship 
from app.core.database import Base
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.accounting.models import Account,Bank

async def resolve_cash_or_bank_account_id(
    db: AsyncSession, company_id: int, bank_id: Optional[int]
) -> int:

    db_name = await db.execute(text("SELECT current_database()"))
    print("DATABASE =", db_name.scalar())

    sql = text("""
        SELECT id, code, name, is_cash, is_active
        FROM accounts
        WHERE company_id = :cid
          AND is_cash = true
          AND is_active = true
    """)

    rows = (await db.execute(sql, {"cid": company_id})).all()

    print("ROWS =", rows)

    result = await db.execute(
        select(Account).where(
            Account.company_id == company_id,
            Account.is_cash.is_(True),
            Account.is_active.is_(True),
        )
    )

    accounts = result.scalars().all()

    print("ORM ROWS =", [(a.id, a.code, a.name) for a in accounts])

    if not accounts:
        raise HTTPException(400, "No cash account")

    return accounts[0].id