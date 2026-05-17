from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AccountantRequired
from app.models.accounting.models import Account, AccountType

router = APIRouter(prefix="/accounting/coa", tags=["Accounting - Chart of Accounts"])
DB = Annotated[AsyncSession, Depends(get_db)]


class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: AccountType
    parent_id: Optional[int] = None
    is_control: bool = False
    description: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_accounts(db: DB, current_user: CurrentUser, account_type: Optional[AccountType] = None):
    q = select(Account).where(Account.company_id == current_user.company_id, Account.is_active == True)
    if account_type:
        q = q.where(Account.account_type == account_type)
    result = await db.execute(q.order_by(Account.code))
    accounts = result.scalars().all()
    return [_fmt(a) for a in accounts]


@router.get("/tree")
async def account_tree(db: DB, current_user: CurrentUser):
    """Return accounts as a nested tree grouped by type."""
    result = await db.execute(
        select(Account).where(Account.company_id == current_user.company_id, Account.is_active == True)
        .order_by(Account.code)
    )
    accounts = result.scalars().all()
    by_id = {a.id: _fmt(a) | {"children": []} for a in accounts}
    roots = []
    for a in accounts:
        node = by_id[a.id]
        if a.parent_id and a.parent_id in by_id:
            by_id[a.parent_id]["children"].append(node)
        else:
            roots.append(node)
    return roots


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_account(
    payload: AccountCreate, db: DB, current_user: CurrentUser,
):
    existing = await db.scalar(
        select(Account).where(Account.code == payload.code, Account.company_id == current_user.company_id)
    )
    if existing:
        raise HTTPException(status_code=400, detail="Account code already exists")
    account = Account(company_id=current_user.company_id, **payload.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _fmt(account)


@router.patch("/{account_id}")
async def update_account(
    account_id: int, payload: AccountUpdate, db: DB, current_user: CurrentUser,
):
    account = await _get_or_404(account_id, current_user.company_id, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(account, k, v)
    await db.commit()
    return _fmt(account)


async def _get_or_404(account_id: int, company_id: int, db: AsyncSession) -> Account:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.company_id == company_id)
    )
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Account not found")
    return a


def _fmt(a: Account) -> dict:
    return {
        "id": a.id, "code": a.code, "name": a.name,
        "account_type": a.account_type, "parent_id": a.parent_id,
        "is_control": a.is_control, "is_active": a.is_active,
        "description": a.description,
    }
