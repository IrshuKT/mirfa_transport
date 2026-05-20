from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, StaffRequired
from app.models.auth import User
from app.models.entities import Vendor, VendorType
from app.utils.pagination import paginate

router = APIRouter(prefix="/vendors", tags=["Vendors"])
DB = Annotated[AsyncSession, Depends(get_db)]


class VendorCreate(BaseModel):
    name: str
    vendor_type: VendorType = VendorType.SUPPLIER
    code: Optional[str] = None
    trn: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "AE"
    payment_terms_days: int = 30
    currency: str = "AED"
    notes: Optional[str] = None


class VendorUpdate(BaseModel):
    name: Optional[str] = None
    trn: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    payment_terms_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_vendors(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    vendor_type: Optional[VendorType] = None,
    is_active: Optional[bool] = True,
):
    q = select(Vendor).where(Vendor.company_id == current_user.company_id)
    if is_active is not None:
        q = q.where(Vendor.is_active == is_active)
    if vendor_type:
        q = q.where(Vendor.vendor_type == vendor_type)
    if search:
        q = q.where(or_(Vendor.name.ilike(f"%{search}%"), Vendor.code.ilike(f"%{search}%")))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Vendor.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(v) for v in result.scalars().all()])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate, db: DB, current_user: CurrentUser,
):
    vendor = Vendor(company_id=current_user.company_id, **payload.model_dump())
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return _fmt(vendor)


@router.get("/{vendor_id}")
async def get_vendor(vendor_id: int, db: DB, current_user: CurrentUser):
    return _fmt(await _get_or_404(vendor_id, current_user.company_id, db))


@router.patch("/{vendor_id}")
async def update_vendor(
    vendor_id: int, payload: VendorUpdate, db: DB, current_user: CurrentUser,
):
    vendor = await _get_or_404(vendor_id, current_user.company_id, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(vendor, k, v)
    await db.commit()
    return _fmt(vendor)


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_vendor(
    vendor_id: int, db: DB, current_user: CurrentUser,
):
    vendor = await _get_or_404(vendor_id, current_user.company_id, db)
    vendor.is_active = False
    await db.commit()


async def _get_or_404(vendor_id: int, company_id: int, db: AsyncSession) -> Vendor:
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.company_id == company_id)
    )
    v = result.scalar_one_or_none()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return v


def _fmt(v: Vendor) -> dict:
    return {
        "id": v.id, "name": v.name, "code": v.code, "vendor_type": v.vendor_type,
        "trn": v.trn, "email": v.email, "phone": v.phone,
        "address": v.address, "city": v.city, "country": v.country,
        "payment_terms_days": v.payment_terms_days, "currency": v.currency,
        "is_active": v.is_active, "notes": v.notes, "created_at": v.created_at,
    }


# ── Vendor Portal Login ───────────────────────────────────────────────────────
from app.services.invitation_service import create_vendor_portal_user

@router.post("/{vendor_id}/create-portal-user")
async def create_vendor_portal_user_endpoint(
    vendor_id: int,
    db: DB,
    current_user: CurrentUser,
    send_email: bool = True,
):
    """Create portal login for a vendor — sends welcome email with credentials."""
    try:
        result = await create_vendor_portal_user(
            db=db,
            vendor_id=vendor_id,
            company_id=current_user.company_id,
            created_by_id=current_user.id,
            send_welcome=send_email,
        )
        return {
            "message": "Vendor portal login created successfully",
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
