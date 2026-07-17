"""
Pydantic response schemas for Cash Book / Bank Book / Journal (General) Ledger.
"""
from datetime import date
from typing import List, Optional
from pydantic import BaseModel


class LedgerLine(BaseModel):
    entry_id: int
    journal_no: str
    entry_date: date
    journal_type: str
    reference: Optional[str] = None
    description: str
    line_description: Optional[str] = None
    account_id: int
    debit: float
    credit: float
    running_balance: float
    is_posted: bool

    class Config:
        from_attributes = True


class LedgerReport(BaseModel):
    company_id: int
    account_id: int
    account_code: str
    account_name: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    lines: List[LedgerLine]


class CashBookReport(BaseModel):
    """One or more cash accounts combined (if multiple is_cash accounts exist)."""
    company_id: int
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    opening_balance: float
    total_debit: float
    total_credit: float
    closing_balance: float
    accounts: List[LedgerReport]  # per-account breakdown
    lines: List[LedgerLine]       # merged, date-sorted view


class BankBookReport(LedgerReport):
    bank_id: int
    bank_name: str
    account_no: str


class JournalRegisterLine(BaseModel):
    """A single journal ENTRY (header) row, for the day-book / journal register view."""
    entry_id: int
    journal_no: str
    entry_date: date
    journal_type: str
    reference: Optional[str] = None
    description: str
    total_debit: float
    total_credit: float
    is_posted: bool
    is_reversed: bool

    class Config:
        from_attributes = True


class JournalRegisterReport(BaseModel):
    company_id: int
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    total_debit: float
    total_credit: float
    entries: List[JournalRegisterLine]