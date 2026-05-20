from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, SuperAdminRequired
from app.models.auth import Company
from app.services.invitation_service import register_company_with_admin
from app.utils.pagination import paginate

router = APIRouter(prefix="/companies", tags=["Companies"])
DB = Annotated[AsyncSession, Depends(get_db)]


class RegisterCompanyRequest(BaseModel):
    # Company
    company_name: str
    trade_license_no: Optional[str] = None
    trn: Optional[str] = None
    address: Optional[str] = None
    city: str = "Dubai"
    phone: Optional[str] = None
    company_email: Optional[EmailStr] = None
    vat_rate: float = 0.05
    currency: str = "AED"
    # Admin user
    admin_full_name: str
    admin_email: EmailStr
    admin_phone: Optional[str] = None
    send_welcome_email: bool = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    trade_license_no: Optional[str] = None
    trn: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None
    vat_rate: Optional[float] = None


@router.get("", dependencies=[SuperAdminRequired])
async def list_companies(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None, is_active: Optional[bool] = None,
):
    q = select(Company)
    if is_active is not None:
        q = q.where(Company.is_active == is_active)
    if search:
        q = q.where(Company.name.ilike(f"%{search}%"))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Company.name).offset((page-1)*page_size).limit(page_size))
    return paginate(total, page, page_size, [_fmt(c) for c in result.scalars().all()])


@router.post("/register", status_code=status.HTTP_201_CREATED, dependencies=[SuperAdminRequired])
async def register_company(payload: RegisterCompanyRequest, db: DB, current_user: CurrentUser):
    """Super Admin registers a new company AND its Company Admin user in one shot."""
    try:
        result = await register_company_with_admin(
            db=db,
            created_by_id=current_user.id,
            company_name=payload.company_name,
            trade_license_no=payload.trade_license_no,
            trn=payload.trn,
            address=payload.address,
            city=payload.city,
            phone=payload.phone,
            company_email=str(payload.company_email) if payload.company_email else None,
            vat_rate=payload.vat_rate,
            currency=payload.currency,
            admin_full_name=payload.admin_full_name,
            admin_email=str(payload.admin_email),
            admin_phone=payload.admin_phone,
            send_welcome=payload.send_welcome_email,
        )
        return {"message": f"Company '{payload.company_name}' registered successfully", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_my_company(db: DB, current_user: CurrentUser):
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
async def update_company(company_id: int, payload: CompanyUpdate, db: DB, current_user: CurrentUser):
    if current_user.role.name != "super_admin" and current_user.company_id != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(company, k, v)
    await db.commit()
    return _fmt(company)


@router.patch("/{company_id}/toggle-active", dependencies=[SuperAdminRequired])
async def toggle_company(company_id: int, db: DB):
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    company.is_active = not company.is_active
    await db.commit()
    return {"company_id": company_id, "is_active": company.is_active}


def _fmt(c: Company) -> dict:
    return {
        "id": c.id, "name": c.name,
        "trade_license_no": c.trade_license_no, "trn": c.trn,
        "address": c.address, "city": c.city, "country": c.country,
        "phone": c.phone, "email": c.email, "logo_url": c.logo_url,
        "is_active": c.is_active, "currency": c.currency,
        "vat_rate": c.vat_rate, "created_at": c.created_at,
    }
