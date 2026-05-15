from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, SuperAdminRequired
from app.models.auth import Company, User
from app.utils.pagination import paginate

router = APIRouter(prefix="/companies", tags=["Companies"])
DB = Annotated[AsyncSession, Depends(get_db)]


class CompanyCreate(BaseModel):
    name: str
    trade_license_no: Optional[str] = None
    trn: Optional[str] = None
    address: Optional[str] = None
    city: str = "Dubai"
    country: str = "AE"
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    currency: str = "AED"
    vat_rate: float = 0.05


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    trade_license_no: Optional[str] = None
    trn: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    vat_rate: Optional[float] = None


@router.get("", dependencies=[SuperAdminRequired])
async def list_companies(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    q = select(Company)
    if is_active is not None:
        q = q.where(Company.is_active == is_active)
    if search:
        q = q.where(Company.name.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Company.name).offset((page - 1) * page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(c) for c in result.scalars().all()])


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[SuperAdminRequired])
async def create_company(payload: CompanyCreate, db: DB):
    company = Company(**payload.model_dump())
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return _fmt(company)


@router.get("/me")
async def get_my_company(db: DB, current_user: CurrentUser):
    """Any authenticated user can see their own company profile."""
    if not current_user.company_id:
        raise HTTPException(status_code=404, detail="No company associated")
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return _fmt(company)


@router.get("/{company_id}", dependencies=[SuperAdminRequired])
async def get_company(company_id: int, db: DB):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return _fmt(company)


@router.patch("/{company_id}")
async def update_company(
    company_id: int, payload: CompanyUpdate, db: DB, current_user: CurrentUser,
):
    # Super admin can edit any; company admin can edit only their own
    if current_user.role.name != "super_admin" and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(company, k, v)
    await db.commit()
    return _fmt(company)


def _fmt(c: Company) -> dict:
    return {
        "id": c.id, "name": c.name,
        "trade_license_no": c.trade_license_no, "trn": c.trn,
        "address": c.address, "city": c.city, "country": c.country,
        "phone": c.phone, "email": c.email, "logo_url": c.logo_url,
        "is_active": c.is_active, "currency": c.currency, "vat_rate": c.vat_rate,
        "created_at": c.created_at,
    }
