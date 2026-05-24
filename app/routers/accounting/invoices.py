from typing import Annotated, Optional, List
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AccountantRequired, StaffRequired
from app.models.accounting.models import Invoice, InvoiceStatus
from app.services.invoice_service import create_invoice, post_invoice_journal
from app.utils.pagination import paginate

router = APIRouter(prefix="/accounting/invoices", tags=["Accounting - Invoices"])
DB = Annotated[AsyncSession, Depends(get_db)]


class LineItemIn(BaseModel):
    description: str
    service_id: Optional[int] = None
    quantity: float = 1
    unit: Optional[str] = None
    unit_price: float
    discount_pct: float = 0
    vat_pct: float = 5
    sort_order: int = 0


class InvoiceCreate(BaseModel):
    customer_id: int
    invoice_date: date
    due_date: date
    job_id: Optional[int] = None
    customer_trn: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    currency: str = "AED"
    line_items: List[LineItemIn]
    auto_post: bool = True      # post journal entry immediately


@router.get("")
async def list_invoices(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    customer_id: Optional[int] = None,
    inv_status: Optional[str] = Query(None, alias="status"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    q = select(Invoice).where(Invoice.company_id == current_user.company_id)
    if customer_id:
        q = q.where(Invoice.customer_id == customer_id)
    if inv_status:
        q = q.where(Invoice.status == inv_status)
    if date_from:
        q = q.where(Invoice.invoice_date >= date_from)
    if date_to:
        q = q.where(Invoice.invoice_date <= date_to)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(
        q.options(selectinload(Invoice.line_items))
        .order_by(Invoice.invoice_date.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(total, page, page_size, [_fmt(i) for i in result.scalars().all()])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_invoice_endpoint(
    payload: InvoiceCreate, db: DB, current_user: CurrentUser,
):
    invoice = await create_invoice(
        db=db,
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        **payload.model_dump(exclude={"auto_post", "line_items"}),
        line_items=[li.model_dump() for li in payload.line_items],
    )
    if payload.auto_post:
        await post_invoice_journal(db, invoice, current_user.id)
    return _fmt(invoice)


@router.get("/aging")
async def aging_report(db: DB, current_user: CurrentUser):
    """AR Aging: Current / 1-30 / 31-60 / 61-90 / 90+ days overdue."""
    from datetime import timedelta
    today = date.today()
    result = await db.execute(
        select(Invoice).where(
            Invoice.company_id == current_user.company_id,
            Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]),
        )
    )
    invoices = result.scalars().all()
    buckets = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
    for inv in invoices:
        overdue_days = (today - inv.due_date).days
        bal = float(inv.balance_due)
        if overdue_days <= 0:
            buckets["current"] += bal
        elif overdue_days <= 30:
            buckets["1_30"] += bal
        elif overdue_days <= 60:
            buckets["31_60"] += bal
        elif overdue_days <= 90:
            buckets["61_90"] += bal
        else:
            buckets["over_90"] += bal
    return {k: round(v, 2) for k, v in buckets.items()}

# Create invoice directly from a completed job
@router.post("/from-job/{job_id}", status_code=status.HTTP_201_CREATED)
async def create_invoice_from_job(
    job_id: int,
    db: DB,
    current_user: CurrentUser,
):
    from app.models.job import Job
    from datetime import timedelta

    # Get the job
    result = await db.execute(
        select(Job).where(
            Job.id == job_id,
            Job.company_id == current_user.company_id,
        )
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.is_invoiced:
        raise HTTPException(status_code=400, detail="Job already invoiced")
    if not job.agreed_amount:
        raise HTTPException(status_code=400, detail="Job has no agreed amount")

    # Get customer's credit days for due date
    from app.models.entities import Customer
    customer = await db.get(Customer, job.customer_id)
    credit_days = customer.credit_days if customer else 30

    today = date.today()
    invoice = await create_invoice(
        db=db,
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        customer_id=job.customer_id,
        job_id=job.id,
        invoice_date=today,
        due_date=today + timedelta(days=credit_days),
        customer_trn=customer.trn if customer else None,
        currency=job.currency or "AED",
        line_items=[{
            "description": f"Transportation Service — Job {job.job_no}\n{job.pickup_address} → {job.delivery_address}",
            "quantity": 1,
            "unit": "job",
            "unit_price": float(job.agreed_amount),
            "discount_pct": 0,
            "vat_pct": 5,
            "sort_order": 0,
        }],
    )

    # Mark job as invoiced
    job.is_invoiced = True
    await db.commit()
    await post_invoice_journal(db, invoice, current_user.id)

    return _fmt(invoice)


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: int, db: DB, current_user: CurrentUser):
    return _fmt(await _get_or_404(invoice_id, current_user.company_id, db))


@router.post("/{invoice_id}/send", status_code=status.HTTP_204_NO_CONTENT)
async def send_invoice(invoice_id: int, db: DB, current_user: CurrentUser):
    from datetime import datetime
    invoice = await _get_or_404(invoice_id, current_user.company_id, db)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft invoices can be sent")
    invoice.status = InvoiceStatus.SENT
    invoice.sent_at = datetime.utcnow()
    await db.commit()


@router.post("/{invoice_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_invoice(
    invoice_id: int, db: DB, current_user: CurrentUser,
):
    invoice = await _get_or_404(invoice_id, current_user.company_id, db)
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Cannot cancel a fully paid invoice")
    invoice.status = InvoiceStatus.CANCELLED
    await db.commit()


async def _get_or_404(invoice_id: int, company_id: int, db: AsyncSession) -> Invoice:
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.line_items))
        .where(Invoice.id == invoice_id, Invoice.company_id == company_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


def _fmt(i: Invoice) -> dict:
    return {
        "id": i.id, "invoice_no": i.invoice_no, "status": i.status,
        "customer_id": i.customer_id, "job_id": i.job_id,
        "invoice_date": i.invoice_date, "due_date": i.due_date,
        "customer_trn": i.customer_trn,
        "subtotal": float(i.subtotal), "discount_amount": float(i.discount_amount),
        "taxable_amount": float(i.taxable_amount), "vat_amount": float(i.vat_amount),
        "total_amount": float(i.total_amount), "paid_amount": float(i.paid_amount),
        "balance_due": float(i.balance_due), "currency": i.currency,
        "notes": i.notes, "terms": i.terms, "sent_at": i.sent_at,
        "line_items": [
            {"id": li.id, "description": li.description, "quantity": float(li.quantity),
             "unit": li.unit, "unit_price": float(li.unit_price),
             "discount_pct": float(li.discount_pct), "vat_pct": float(li.vat_pct),
             "vat_amount": float(li.vat_amount), "line_total": float(li.line_total)}
            for li in (i.line_items or [])
        ],
        "created_at": i.created_at,
    }
