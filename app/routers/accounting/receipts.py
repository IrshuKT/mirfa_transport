from typing import Annotated, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AccountantRequired
from app.models.accounting.models import (
    Receipt, PaymentMethod, Invoice, VendorInvoice, VendorPayment,
    JournalEntry, JournalLine, JournalType
)
from app.services.invoice_service import post_receipt_journal
from app.utils.numbering import next_receipt_no, next_payment_no, next_journal_no
from app.utils.pagination import paginate

# ── Receipts ──────────────────────────────────────────────────────────────────
receipts_router = APIRouter(prefix="/accounting/receipts", tags=["Accounting - Receipts"])
DB = Annotated[AsyncSession, Depends(get_db)]


class ReceiptCreate(BaseModel):
    customer_id: int
    invoice_id: Optional[int] = None
    bank_id: Optional[int] = None
    receipt_date: date
    amount: float
    currency: str = "AED"
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    cheque_no: Optional[str] = None
    cheque_date: Optional[date] = None
    cheque_bank: Optional[str] = None
    reference_no: Optional[str] = None
    notes: Optional[str] = None


@receipts_router.get("")
async def list_receipts(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    customer_id: Optional[int] = None,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
):
    q = select(Receipt).where(Receipt.company_id == current_user.company_id)
    if customer_id:
        q = q.where(Receipt.customer_id == customer_id)
    if date_from:
        q = q.where(Receipt.receipt_date >= date_from)
    if date_to:
        q = q.where(Receipt.receipt_date <= date_to)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Receipt.receipt_date.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt_receipt(r) for r in result.scalars().all()])


@receipts_router.post("", status_code=status.HTTP_201_CREATED)
async def create_receipt(
    payload: ReceiptCreate, db: DB, current_user: CurrentUser,
):
    receipt_no = await next_receipt_no(db, current_user.company_id)
    receipt = Receipt(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        receipt_no=receipt_no,
        **payload.model_dump(),
    )
    db.add(receipt)
    await db.flush()

    # Post journal entry and update invoice if linked
    if payload.invoice_id:
        invoice_result = await db.execute(
            select(Invoice).where(Invoice.id == payload.invoice_id, Invoice.company_id == current_user.company_id)
        )
        invoice = invoice_result.scalar_one_or_none()
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice not found")
        await post_receipt_journal(db, receipt, invoice, current_user.id)
    else:
        receipt.is_posted = True
        await db.commit()

    await db.refresh(receipt)
    return _fmt_receipt(receipt)


def _fmt_receipt(r: Receipt) -> dict:
    return {
        "id": r.id, "receipt_no": r.receipt_no,
        "customer_id": r.customer_id, "invoice_id": r.invoice_id,
        "receipt_date": r.receipt_date, "amount": float(r.amount),
        "currency": r.currency, "payment_method": r.payment_method,
        "cheque_no": r.cheque_no, "reference_no": r.reference_no,
        "is_posted": r.is_posted, "notes": r.notes, "created_at": r.created_at,
    }


# ── Vendor Payments ───────────────────────────────────────────────────────────
payments_router = APIRouter(prefix="/accounting/payments", tags=["Accounting - Vendor Payments"])


class PaymentCreate(BaseModel):
    vendor_id: int
    vendor_invoice_id: Optional[int] = None
    bank_id: Optional[int] = None
    payment_date: date
    amount: float
    currency: str = "AED"
    payment_method: PaymentMethod = PaymentMethod.BANK_TRANSFER
    reference_no: Optional[str] = None
    cheque_no: Optional[str] = None
    notes: Optional[str] = None


@payments_router.get("")
async def list_payments(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    vendor_id: Optional[int] = None,
):
    q = select(VendorPayment).where(VendorPayment.company_id == current_user.company_id)
    if vendor_id:
        q = q.where(VendorPayment.vendor_id == vendor_id)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(VendorPayment.payment_date.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt_payment(p) for p in result.scalars().all()])


@payments_router.post("", status_code=status.HTTP_201_CREATED)
async def create_payment(
    payload: PaymentCreate, db: DB, current_user: CurrentUser,
):
    payment_no = await next_payment_no(db, current_user.company_id)
    payment = VendorPayment(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        payment_no=payment_no,
        **payload.model_dump(),
    )
    db.add(payment)

    # Update vendor invoice balance if linked
    if payload.vendor_invoice_id:
        vi_result = await db.execute(
            select(VendorInvoice).where(
                VendorInvoice.id == payload.vendor_invoice_id,
                VendorInvoice.company_id == current_user.company_id,
            )
        )
        vi = vi_result.scalar_one_or_none()
        if vi:
            vi.paid_amount = round(float(vi.paid_amount) + payload.amount, 2)
            vi.balance_due = round(float(vi.total_amount) - float(vi.paid_amount), 2)

    await db.commit()
    await db.refresh(payment)
    return _fmt_payment(payment)


def _fmt_payment(p: VendorPayment) -> dict:
    return {
        "id": p.id, "payment_no": p.payment_no, "vendor_id": p.vendor_id,
        "vendor_invoice_id": p.vendor_invoice_id, "payment_date": p.payment_date,
        "amount": float(p.amount), "currency": p.currency,
        "payment_method": p.payment_method, "reference_no": p.reference_no,
        "cheque_no": p.cheque_no, "notes": p.notes, "created_at": p.created_at,
    }


# ── Journal Entries ────────────────────────────────────────────────────────────
journals_router = APIRouter(prefix="/accounting/journals", tags=["Accounting - Journals"])


class JournalLineIn(BaseModel):
    account_id: int
    description: Optional[str] = None
    debit: float = 0
    credit: float = 0
    currency: str = "AED"
    sort_order: int = 0


class JournalCreate(BaseModel):
    entry_date: date
    description: str
    reference: Optional[str] = None
    journal_type: JournalType = JournalType.GENERAL
    lines: list[JournalLineIn]


@journals_router.get("")
async def list_journals(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    journal_type: Optional[JournalType] = None,
):
    q = select(JournalEntry).where(JournalEntry.company_id == current_user.company_id)
    if date_from:
        q = q.where(JournalEntry.entry_date >= date_from)
    if date_to:
        q = q.where(JournalEntry.entry_date <= date_to)
    if journal_type:
        q = q.where(JournalEntry.journal_type == journal_type)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(JournalEntry.entry_date.desc()).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt_je(j) for j in result.scalars().all()])


@journals_router.post("", status_code=status.HTTP_201_CREATED)
async def create_journal(
    payload: JournalCreate, db: DB, current_user: CurrentUser,
):
    total_debit = sum(l.debit for l in payload.lines)
    total_credit = sum(l.credit for l in payload.lines)
    if round(total_debit, 2) != round(total_credit, 2):
        raise HTTPException(status_code=400, detail=f"Journal is not balanced: DR {total_debit} ≠ CR {total_credit}")

    jv_no = await next_journal_no(db, current_user.company_id)
    je = JournalEntry(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        journal_no=jv_no,
        journal_type=payload.journal_type,
        entry_date=payload.entry_date,
        reference=payload.reference,
        description=payload.description,
        is_posted=True,
        total_debit=round(total_debit, 2),
        total_credit=round(total_credit, 2),
    )
    db.add(je)
    await db.flush()
    for li in payload.lines:
        db.add(JournalLine(journal_entry_id=je.id, **li.model_dump()))
    await db.commit()
    await db.refresh(je)
    return _fmt_je(je)


@journals_router.post("/{je_id}/reverse", status_code=status.HTTP_201_CREATED)
async def reverse_journal(
    je_id: int, db: DB, current_user: CurrentUser,
):
    """Create a reversal entry that mirrors all lines with DR/CR swapped."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(JournalEntry).options(selectinload(JournalEntry.lines))
        .where(JournalEntry.id == je_id, JournalEntry.company_id == current_user.company_id)
    )
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if original.is_reversed:
        raise HTTPException(status_code=400, detail="Journal entry already reversed")

    jv_no = await next_journal_no(db, current_user.company_id)
    rev = JournalEntry(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        journal_no=jv_no,
        journal_type=original.journal_type,
        entry_date=date.today(),
        reference=original.journal_no,
        description=f"Reversal of {original.journal_no}",
        is_posted=True,
        reversal_of_id=original.id,
        total_debit=original.total_credit,
        total_credit=original.total_debit,
    )
    db.add(rev)
    await db.flush()
    for line in original.lines:
        db.add(JournalLine(
            journal_entry_id=rev.id,
            account_id=line.account_id,
            description=f"Reversal: {line.description or ''}",
            debit=line.credit,
            credit=line.debit,
            currency=line.currency,
        ))
    original.is_reversed = True
    await db.commit()
    return {"message": "Reversal posted", "reversal_journal_no": rev.journal_no}


def _fmt_je(j: JournalEntry) -> dict:
    return {
        "id": j.id, "journal_no": j.journal_no, "journal_type": j.journal_type,
        "entry_date": j.entry_date, "reference": j.reference,
        "description": j.description, "is_posted": j.is_posted,
        "is_reversed": j.is_reversed, "reversal_of_id": j.reversal_of_id,
        "total_debit": float(j.total_debit), "total_credit": float(j.total_credit),
        "created_at": j.created_at,
    }


# Re-export all three routers for main.py
router = receipts_router   # default import alias
