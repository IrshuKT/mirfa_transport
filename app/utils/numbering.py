"""
Centralised sequential number generator.
Pattern: PREFIX-YYYYMM-XXXX  e.g. INV-202501-0042
All counters are per-company and per-month to keep numbers short.
"""
from datetime import date
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def next_number(db: AsyncSession, prefix: str, company_id: int) -> str:
    """
    Uses a PostgreSQL sequence-like approach via a counter table row-lock.
    Falls back to COUNT if the numbering table isn't seeded yet.
    """
    period = date.today().strftime("%Y%m")
    key = f"{prefix}:{company_id}:{period}"

    # Upsert counter
    await db.execute(
        text("""
            INSERT INTO number_sequences (seq_key, last_value)
            VALUES (:key, 1)
            ON CONFLICT (seq_key) DO UPDATE
                SET last_value = number_sequences.last_value + 1
        """),
        {"key": key},
    )
    result = await db.execute(
        text("SELECT last_value FROM number_sequences WHERE seq_key = :key"),
        {"key": key},
    )
    seq = result.scalar_one()
    return f"{prefix}-{period}-{seq:04d}"


# Convenience wrappers
async def next_invoice_no(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "INV", company_id)

async def next_receipt_no(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "RCT", company_id)

async def next_payment_no(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "PMT", company_id)

async def next_journal_no(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "JV", company_id)

async def next_quote_no(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "QT", company_id)

async def next_job_no(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "JOB", company_id)

async def next_vendor_ref(db: AsyncSession, company_id: int) -> str:
    return await next_number(db, "BILL", company_id)
