from typing import Annotated, Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, StaffRequired
from app.models.auth import User
from app.models.quotation import Quotation, QuotationLineItem, QuotationStatus
from app.utils.pagination import paginate
from app.utils.numbering import next_quote_no

router = APIRouter(prefix="/quotations", tags=["Quotations"])
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


class QuotationCreate(BaseModel):
    customer_id: int
    service_request_id: Optional[int] = None
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    currency: str = "AED"
    line_items: List[LineItemIn] = []


class QuotationUpdate(BaseModel):
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    line_items: Optional[List[LineItemIn]] = None


def _compute_totals(lines: List[LineItemIn]) -> dict:
    subtotal = sum(i.quantity * i.unit_price for i in lines)
    discount = sum(i.quantity * i.unit_price * i.discount_pct / 100 for i in lines)
    taxable = subtotal - discount
    vat = sum(i.quantity * i.unit_price * (1 - i.discount_pct / 100) * i.vat_pct / 100 for i in lines)
    return {
        "subtotal": round(subtotal, 2),
        "discount_amount": round(discount, 2),
        "vat_amount": round(vat, 2),
        "total_amount": round(taxable + vat, 2),
    }


def _line_total(item: LineItemIn) -> float:
    base = item.quantity * item.unit_price * (1 - item.discount_pct / 100)
    return round(base * (1 + item.vat_pct / 100), 2)


@router.get("")
async def list_quotations(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    customer_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
):
    q = select(Quotation).where(Quotation.company_id == current_user.company_id)
    if customer_id:
        q = q.where(Quotation.customer_id == customer_id)
    if status_filter:
        q = q.where(Quotation.status == status_filter)
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(
        q.options(selectinload(Quotation.line_items))
        .order_by(Quotation.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )
    return paginate(total, page, page_size, [_fmt(q) for q in result.scalars().all()])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_quotation(
    payload: QuotationCreate, db: DB, current_user: CurrentUser,
    _: Annotated[User, StaffRequired],
):
    totals = _compute_totals(payload.line_items)
    quote_no = await next_quote_no(db, current_user.company_id)
    quotation = Quotation(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        quote_no=quote_no,
        customer_id=payload.customer_id,
        service_request_id=payload.service_request_id,
        valid_until=payload.valid_until,
        notes=payload.notes,
        terms=payload.terms,
        currency=payload.currency,
        **totals,
    )
    db.add(quotation)
    await db.flush()
    for item in payload.line_items:
        db.add(QuotationLineItem(
            quotation_id=quotation.id,
            line_total=_line_total(item),
            **item.model_dump(),
        ))
    await db.commit()
    await db.refresh(quotation, ["line_items"])
    return _fmt(quotation)


@router.get("/{quote_id}")
async def get_quotation(quote_id: int, db: DB, current_user: CurrentUser):
    return _fmt(await _get_or_404(quote_id, current_user.company_id, db))


@router.patch("/{quote_id}")
async def update_quotation(
    quote_id: int, payload: QuotationUpdate, db: DB, current_user: CurrentUser,
    _: Annotated[User, StaffRequired],
):
    quotation = await _get_or_404(quote_id, current_user.company_id, db)
    if quotation.status not in (QuotationStatus.DRAFT, QuotationStatus.SENT):
        raise HTTPException(status_code=400, detail="Only draft/sent quotations can be edited")

    for k, v in payload.model_dump(exclude_none=True, exclude={"line_items"}).items():
        setattr(quotation, k, v)

    if payload.line_items is not None:
        # Replace all line items
        for li in quotation.line_items:
            await db.delete(li)
        await db.flush()
        for item in payload.line_items:
            db.add(QuotationLineItem(
                quotation_id=quotation.id,
                line_total=_line_total(item),
                **item.model_dump(),
            ))
        totals = _compute_totals(payload.line_items)
        for k, v in totals.items():
            setattr(quotation, k, v)

    await db.commit()
    await db.refresh(quotation, ["line_items"])
    return _fmt(quotation)


@router.post("/{quote_id}/send", status_code=status.HTTP_204_NO_CONTENT)
async def send_quotation(
    quote_id: int, db: DB, current_user: CurrentUser,
    _: Annotated[User, StaffRequired],
):
    quotation = await _get_or_404(quote_id, current_user.company_id, db)
    quotation.status = QuotationStatus.SENT
    await db.commit()


@router.post("/{quote_id}/accept")
async def accept_quotation(
    quote_id: int,
    accepted_by_name: str,
    accepted_by_email: str,
    db: DB,
    current_user: CurrentUser,
):
    """Mark quotation as accepted — typically called from portal or manually by staff."""
    quotation = await _get_or_404(quote_id, current_user.company_id, db)
    if quotation.status not in (QuotationStatus.SENT, QuotationStatus.DRAFT):
        raise HTTPException(status_code=400, detail="Quotation cannot be accepted in current status")
    quotation.status = QuotationStatus.ACCEPTED
    quotation.accepted_at = datetime.utcnow()
    quotation.accepted_by_name = accepted_by_name
    quotation.accepted_by_email = accepted_by_email
    await db.commit()
    return {"message": "Quotation accepted", "quote_no": quotation.quote_no}


@router.post("/{quote_id}/convert-to-job", status_code=status.HTTP_201_CREATED)
async def convert_to_job(quote_id: int, db: DB, current_user: CurrentUser,
    _: Annotated[User, StaffRequired],
):
    """Convert an accepted quotation into a Job."""
    import secrets
    from app.models.job import Job, JobStatus
    from app.utils.numbering import next_job_no

    quotation = await _get_or_404(quote_id, current_user.company_id, db)
    if quotation.status != QuotationStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Quotation must be accepted before converting")

    job_no = await next_job_no(db, current_user.company_id)
    job = Job(
        company_id=current_user.company_id,
        created_by_id=current_user.id,
        customer_id=quotation.customer_id,
        service_request_id=quotation.service_request_id,
        job_no=job_no,
        status=JobStatus.PENDING,
        agreed_amount=quotation.total_amount,
        currency=quotation.currency,
        tracking_token=secrets.token_urlsafe(32),
        notes=quotation.notes,
        pickup_address="",     # dispatcher fills these in
        delivery_address="",
    )
    db.add(job)
    await db.flush()
    quotation.status = QuotationStatus.CONVERTED
    quotation.converted_to_job_id = job.id
    await db.commit()
    return {"job_id": job.id, "job_no": job.job_no, "quote_no": quotation.quote_no}


async def _get_or_404(quote_id: int, company_id: int, db: AsyncSession) -> Quotation:
    result = await db.execute(
        select(Quotation)
        .options(selectinload(Quotation.line_items))
        .where(Quotation.id == quote_id, Quotation.company_id == company_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return q


def _fmt(q: Quotation) -> dict:
    return {
        "id": q.id, "quote_no": q.quote_no, "status": q.status,
        "customer_id": q.customer_id, "currency": q.currency,
        "subtotal": float(q.subtotal), "discount_amount": float(q.discount_amount),
        "vat_amount": float(q.vat_amount), "total_amount": float(q.total_amount),
        "valid_until": q.valid_until, "notes": q.notes, "terms": q.terms,
        "accepted_at": q.accepted_at, "accepted_by_name": q.accepted_by_name,
        "converted_to_job_id": q.converted_to_job_id,
        "line_items": [
            {"id": li.id, "description": li.description, "quantity": float(li.quantity),
             "unit": li.unit, "unit_price": float(li.unit_price),
             "discount_pct": float(li.discount_pct), "vat_pct": float(li.vat_pct),
             "line_total": float(li.line_total)}
            for li in (q.line_items or [])
        ],
        "created_at": q.created_at,
    }
