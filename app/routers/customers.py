from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, StaffRequired
from app.models.auth import User
from app.models.entities import Customer, CustomerContact, CustomerType
from app.utils.pagination import paginate

router = APIRouter(prefix="/customers", tags=["Customers"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ContactSchema(BaseModel):
    name: str
    designation: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_primary: bool = False


class CustomerCreate(BaseModel):
    name: str
    customer_type: CustomerType = CustomerType.CORPORATE
    code: Optional[str] = None
    trn: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "AE"
    credit_limit: Optional[float] = None
    credit_days: int = 30
    currency: str = "AED"
    notes: Optional[str] = None
    contacts: list[ContactSchema] = []


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    trn: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    credit_limit: Optional[float] = None
    credit_days: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_customers(
    db: DB, current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    customer_type: Optional[CustomerType] = None,
    is_active: Optional[bool] = True,
):
    q = select(Customer).where(Customer.company_id == current_user.company_id)
    if is_active is not None:
        q = q.where(Customer.is_active == is_active)
    if customer_type:
        q = q.where(Customer.customer_type == customer_type)
    if search:
        q = q.where(or_(
            Customer.name.ilike(f"%{search}%"),
            Customer.code.ilike(f"%{search}%"),
            Customer.email.ilike(f"%{search}%"),
        ))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(
        q.options(selectinload(Customer.contacts))
        .order_by(Customer.name)
        .offset((page - 1) * page_size).limit(page_size)
    )
    customers = result.scalars().all()
    return paginate(total, page, page_size, [_fmt(c) for c in customers])

@router.get("/next-code")
async def next_customer_code(db: DB):
    result = await db.execute(
        select(func.count()).select_from(Customer)
    )
    count = result.scalar() or 0

    return {
        "code": f"MRTC-{str(count + 1).zfill(2)}"
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate, db: DB, current_user: CurrentUser,
):
    customer = Customer(
        company_id=current_user.company_id,
        **payload.model_dump(exclude={"contacts"}),
    )
    db.add(customer)
    await db.flush()
    for c in payload.contacts:
        db.add(CustomerContact(customer_id=customer.id, **c.model_dump()))
    await db.commit()
    await db.refresh(customer, ["contacts"])
    return _fmt(customer)


@router.get("/{customer_id}")
async def get_customer(customer_id: int, db: DB, current_user: CurrentUser):
    customer = await _get_or_404(customer_id, current_user, db)
    return _fmt(customer)


@router.patch("/{customer_id}")
async def update_customer(
    customer_id: int, payload: CustomerUpdate, db: DB, current_user: CurrentUser,
):
    customer = await _get_or_404(customer_id, current_user, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(customer, k, v)
    await db.commit()
    await db.refresh(customer, ["contacts"])
    return _fmt(customer)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_customer(
    customer_id: int, db: DB, current_user: CurrentUser,
):
    customer = await _get_or_404(customer_id, current_user, db)
    customer.is_active = False
    await db.commit()


# ── Contacts sub-resource ─────────────────────────────────────────────────────

@router.post("/{customer_id}/contacts", status_code=status.HTTP_201_CREATED)
async def add_contact(
    customer_id: int, payload: ContactSchema, db: DB, current_user: CurrentUser,
):
    await _get_or_404(customer_id, current_user, db)
    contact = CustomerContact(customer_id=customer_id, **payload.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return {"id": contact.id, **payload.model_dump()}


@router.delete("/{customer_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    customer_id: int, contact_id: int, db: DB, current_user: CurrentUser,
):
    await _get_or_404(customer_id, current_user, db)
    result = await db.execute(
        select(CustomerContact).where(
            CustomerContact.id == contact_id,
            CustomerContact.customer_id == customer_id,
        )
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_or_404(customer_id: int, user: User, db: AsyncSession) -> Customer:
    result = await db.execute(
        select(Customer)
        .options(selectinload(Customer.contacts))
        .where(Customer.id == customer_id, Customer.company_id == user.company_id)
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


def _fmt(c: Customer) -> dict:
    return {
        "id": c.id, "name": c.name, "code": c.code,
        "customer_type": c.customer_type, "trn": c.trn,
        "email": c.email, "phone": c.phone, "mobile": c.mobile,
        "address": c.address, "city": c.city, "country": c.country,
        "credit_limit": float(c.credit_limit) if c.credit_limit else None,
        "credit_days": c.credit_days, "currency": c.currency,
        "is_active": c.is_active, "notes": c.notes,
        "contacts": [
            {"id": ct.id, "name": ct.name, "designation": ct.designation,
             "email": ct.email, "phone": ct.phone, "is_primary": ct.is_primary}
            for ct in (c.contacts or [])
        ],
        "created_at": c.created_at,
    }


# ── Customer Portal Login ─────────────────────────────────────────────────────
from app.services.invitation_service import create_customer_portal_user

@router.post("/{customer_id}/create-portal-user")
async def create_portal_user(
    customer_id: int,
    db: DB,
    current_user: CurrentUser,
    send_email: bool = True,
):
    """Create portal login for a customer — sends welcome email with credentials."""
    try:
        result = await create_customer_portal_user(
            db=db,
            customer_id=customer_id,
            company_id=current_user.company_id,
            created_by_id=current_user.id,
            send_welcome=send_email,
        )
        return {
            "message": "Portal login created successfully",
            **result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    


@router.delete("/{customer_id}/portal")
def revoke_customer_portal(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer or not customer.portal_user_id:
        raise HTTPException(404, "No portal user found")
    
    user = db.query(User).filter(User.id == customer.portal_user_id).first()
    if user:
        db.delete(user)  # or set user.is_active = False if you prefer soft delete
    
    customer.portal_user_id = None
    db.commit()
    return {"detail": "Portal access revoked"}