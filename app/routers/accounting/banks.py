from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AccountantRequired
from app.models.accounting.models import Bank

router = APIRouter(prefix="/accounting/banks", tags=["Accounting - Banks"])
DB = Annotated[AsyncSession, Depends(get_db)]


class BankCreate(BaseModel):
    bank_name: str
    account_name: str
    account_no: str
    iban: Optional[str] = None
    swift_code: Optional[str] = None
    branch: Optional[str] = None
    currency: str = "AED"
    is_default: bool = False
    account_id: Optional[int] = None   # link to GL account


class BankUpdate(BaseModel):
    bank_name: Optional[str] = None
    account_name: Optional[str] = None
    iban: Optional[str] = None
    swift_code: Optional[str] = None
    branch: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None
    account_id: Optional[int] = None


@router.get("")
async def list_banks(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Bank).where(Bank.company_id == current_user.company_id, Bank.is_active == True)
        .order_by(Bank.bank_name)
    )
    return [_fmt(b) for b in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_bank(
    payload: BankCreate, db: DB, current_user: CurrentUser,
    _: Annotated[object, AccountantRequired],
):
    if payload.is_default:
        # Unset existing default
        result = await db.execute(select(Bank).where(Bank.company_id == current_user.company_id, Bank.is_default == True))
        for b in result.scalars().all():
            b.is_default = False
    bank = Bank(company_id=current_user.company_id, **payload.model_dump())
    db.add(bank)
    await db.commit()
    await db.refresh(bank)
    return _fmt(bank)


@router.patch("/{bank_id}")
async def update_bank(
    bank_id: int, payload: BankUpdate, db: DB, current_user: CurrentUser,
    _: Annotated[object, AccountantRequired],
):
    bank = await _get_or_404(bank_id, current_user.company_id, db)
    if payload.is_default:
        result = await db.execute(select(Bank).where(Bank.company_id == current_user.company_id, Bank.is_default == True))
        for b in result.scalars().all():
            b.is_default = False
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(bank, k, v)
    await db.commit()
    return _fmt(bank)


async def _get_or_404(bank_id: int, company_id: int, db: AsyncSession) -> Bank:
    result = await db.execute(select(Bank).where(Bank.id == bank_id, Bank.company_id == company_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Bank not found")
    return b


def _fmt(b: Bank) -> dict:
    return {
        "id": b.id, "bank_name": b.bank_name, "account_name": b.account_name,
        "account_no": b.account_no, "iban": b.iban, "swift_code": b.swift_code,
        "branch": b.branch, "currency": b.currency, "is_default": b.is_default,
        "is_active": b.is_active, "current_balance": float(b.current_balance),
        "account_id": b.account_id,
    }
