from typing import Annotated, List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, AccountantRequired
from app.schemas.ledger_schema import (
    LedgerReport,
    CashBookReport,
    BankBookReport,
    JournalRegisterReport,
)
from app.services import ledger_service

router = APIRouter(prefix="/accounting/ledgers", tags=["Accounting - Ledgers"])
DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/cash-book", response_model=CashBookReport, dependencies=[AccountantRequired])
async def cash_book(
    db: DB,
    current_user: CurrentUser,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    account_id: Optional[int] = None,
):
    try:
        return await ledger_service.get_cash_book(
            db, current_user.company_id, date_from, date_to, account_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/bank-book/{bank_id}", response_model=BankBookReport, dependencies=[AccountantRequired])
async def bank_book(
    bank_id: int,
    db: DB,
    current_user: CurrentUser,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    try:
        return await ledger_service.get_bank_book(
            db, current_user.company_id, bank_id, date_from, date_to
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/bank-book", response_model=List[BankBookReport], dependencies=[AccountantRequired])
async def all_bank_books(
    db: DB,
    current_user: CurrentUser,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    return await ledger_service.get_all_bank_books(db, current_user.company_id, date_from, date_to)


@router.get("/general-ledger/{account_id}", response_model=LedgerReport, dependencies=[AccountantRequired])
async def general_ledger(
    account_id: int,
    db: DB,
    current_user: CurrentUser,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
):
    """Journal Ledger for any single account (asset, liability, revenue, etc)."""
    try:
        return await ledger_service.get_general_ledger(
            db, current_user.company_id, account_id, date_from, date_to
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/journal-register", response_model=JournalRegisterReport, dependencies=[AccountantRequired])
async def journal_register(
    db: DB,
    current_user: CurrentUser,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    journal_type: Optional[str] = None,
    include_unposted: bool = False,
):
    """Day-book listing of journal entries (headers), e.g. for an audit trail view."""
    return await ledger_service.get_journal_register(
        db, current_user.company_id, date_from, date_to, journal_type, include_unposted
    )