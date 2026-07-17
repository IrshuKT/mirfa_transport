"""
Ledger service layer (ASYNC — matches this app's AsyncSessionLocal pattern).

Builds three reports on top of the existing double-entry tables
(JournalEntry / JournalLine), with no new posting logic required -
these are read-only projections over data your service layer already writes.

    - get_general_ledger()   -> per-account ledger with running balance
                                 (this IS the "Journal Ledger" for one account)
    - get_cash_book()        -> get_general_ledger() for the is_cash account(s)
    - get_bank_book()        -> get_general_ledger() for a Bank's linked account
    - get_journal_register() -> day-book listing of journal entries themselves

Only POSTED entries (JournalEntry.is_posted == True) are included, matching
standard accounting practice: draft/unposted journals don't affect balances.

Balance sign convention: for ASSET and EXPENSE accounts, debit increases the
balance (normal debit balance). For LIABILITY, EQUITY and REVENUE accounts,
credit increases the balance (normal credit balance). Cash and Bank accounts
are ASSET accounts, so debit - credit is the natural running balance for them.
"""
from datetime import date
from typing import List, Optional, Sequence

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting.models import (
    Account,
    AccountType,
    Bank,
    JournalEntry,
    JournalLine,
)
from app.schemas.ledger_schema import (
    LedgerLine,
    LedgerReport,
    CashBookReport,
    BankBookReport,
    JournalRegisterLine,
    JournalRegisterReport,
)

# Account types with a normal DEBIT balance (debit increases balance).
_DEBIT_NORMAL = {AccountType.ASSET, AccountType.EXPENSE}


def _signed_movement(account_type: AccountType, debit: float, credit: float) -> float:
    """Movement in the direction of the account's normal balance."""
    if account_type in _DEBIT_NORMAL:
        return float(debit) - float(credit)
    return float(credit) - float(debit)


async def _opening_balance(
    db: AsyncSession,
    company_id: int,
    account_ids: Sequence[int],
    date_from: Optional[date],
    account_type: AccountType,
) -> float:
    """Sum of all posted movement strictly before date_from."""
    if not date_from:
        return 0.0
    stmt = (
        select(
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(
            JournalEntry.company_id == company_id,
            JournalEntry.is_posted == True,  # noqa: E712
            JournalEntry.entry_date < date_from,
            JournalLine.account_id.in_(account_ids),
        )
    )
    result = await db.execute(stmt)
    total_debit, total_credit = result.one()
    return _signed_movement(account_type, total_debit, total_credit)


async def get_general_ledger(
    db: AsyncSession,
    company_id: int,
    account_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> LedgerReport:
    """
    Full ledger (a.k.a. Journal Ledger) for a single account, with a running
    balance. This is the building block for both Cash Book and Bank Book.
    """
    account = await db.get(Account, account_id)
    if account is None or account.company_id != company_id:
        raise ValueError(f"Account {account_id} not found for company {company_id}")

    opening = await _opening_balance(db, company_id, [account_id], date_from, account.account_type)

    stmt = (
        select(JournalLine, JournalEntry)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(
            JournalEntry.company_id == company_id,
            JournalEntry.is_posted == True,  # noqa: E712
            JournalLine.account_id == account_id,
        )
        .order_by(JournalEntry.entry_date.asc(), JournalEntry.id.asc(), JournalLine.sort_order.asc())
    )
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)

    result = await db.execute(stmt)
    rows = result.all()

    running = opening
    total_debit = 0.0
    total_credit = 0.0
    lines: List[LedgerLine] = []
    for line, entry in rows:
        running += _signed_movement(account.account_type, line.debit, line.credit)
        total_debit += float(line.debit)
        total_credit += float(line.credit)
        lines.append(
            LedgerLine(
                entry_id=entry.id,
                journal_no=entry.journal_no,
                entry_date=entry.entry_date,
                journal_type=entry.journal_type.value,
                reference=entry.reference,
                description=entry.description,
                line_description=line.description,
                account_id=line.account_id,
                debit=float(line.debit),
                credit=float(line.credit),
                running_balance=running,
                is_posted=entry.is_posted,
            )
        )

    return LedgerReport(
        company_id=company_id,
        account_id=account.id,
        account_code=account.code,
        account_name=account.name,
        date_from=date_from,
        date_to=date_to,
        opening_balance=opening,
        total_debit=total_debit,
        total_credit=total_credit,
        closing_balance=running,
        lines=lines,
    )


async def get_cash_book(
    db: AsyncSession,
    company_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    account_id: Optional[int] = None,
) -> CashBookReport:
    """
    Cash Book = ledger of the Account(s) flagged is_cash=True.
    Pass account_id to restrict to one specific cash account (e.g. a branch
    till); otherwise all is_cash accounts for the company are combined.
    """
    stmt = select(Account).where(Account.company_id == company_id, Account.is_cash == True)  # noqa: E712
    if account_id:
        stmt = stmt.where(Account.id == account_id)
    result = await db.execute(stmt)
    cash_accounts = result.scalars().all()
    # (fixed: db.execute() on AsyncSession must be awaited before .scalars())

    if not cash_accounts:
        raise ValueError("No cash account found (set Account.is_cash = True on your Cash-in-Hand account).")

    per_account = [
        await get_general_ledger(db, company_id, acc.id, date_from, date_to) for acc in cash_accounts
    ]

    merged_lines = sorted(
        (line for report in per_account for line in report.lines),
        key=lambda l: (l.entry_date, l.entry_id),
    )
    # Recompute a single combined running balance across the merged, date-sorted lines.
    opening = sum(r.opening_balance for r in per_account)
    running = opening
    for line in merged_lines:
        running += (line.debit - line.credit)  # cash accounts are debit-normal ASSETs
        line.running_balance = running

    return CashBookReport(
        company_id=company_id,
        date_from=date_from,
        date_to=date_to,
        opening_balance=opening,
        total_debit=sum(r.total_debit for r in per_account),
        total_credit=sum(r.total_credit for r in per_account),
        closing_balance=running,
        accounts=per_account,
        lines=merged_lines,
    )


async def get_bank_book(
    db: AsyncSession,
    company_id: int,
    bank_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> BankBookReport:
    """Bank Book = ledger of the Account linked to a specific Bank row."""
    bank = await db.get(Bank, bank_id)
    if bank is None or bank.company_id != company_id:
        raise ValueError(f"Bank {bank_id} not found for company {company_id}")
    if bank.account_id is None:
        raise ValueError(f"Bank '{bank.bank_name}' has no linked ledger Account (Bank.account_id is null).")

    base = await get_general_ledger(db, company_id, bank.account_id, date_from, date_to)
    return BankBookReport(
        **base.model_dump(),
        bank_id=bank.id,
        bank_name=bank.bank_name,
        account_no=bank.account_no,
    )


async def get_all_bank_books(
    db: AsyncSession,
    company_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> List[BankBookReport]:
    """Convenience: bank book for every active bank account of the company."""
    result = await db.execute(
        select(Bank).where(
            Bank.company_id == company_id,
            Bank.is_active == True,  # noqa: E712
            Bank.account_id.is_not(None),
        )
    )
    banks = result.scalars().all()
    return [await get_bank_book(db, company_id, b.id, date_from, date_to) for b in banks]


async def get_journal_register(
    db: AsyncSession,
    company_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    journal_type: Optional[str] = None,
    include_unposted: bool = False,
) -> JournalRegisterReport:
    """
    Day-book view: one row per JOURNAL ENTRY (not per line), for browsing/
    auditing the register itself rather than a single account's balance.
    """
    stmt = select(JournalEntry).where(JournalEntry.company_id == company_id)
    if not include_unposted:
        stmt = stmt.where(JournalEntry.is_posted == True)  # noqa: E712
    if date_from:
        stmt = stmt.where(JournalEntry.entry_date >= date_from)
    if date_to:
        stmt = stmt.where(JournalEntry.entry_date <= date_to)
    if journal_type:
        stmt = stmt.where(JournalEntry.journal_type == journal_type)
    stmt = stmt.order_by(JournalEntry.entry_date.asc(), JournalEntry.id.asc())

    result = await db.execute(stmt)
    entries = result.scalars().all()

    rows = [
        JournalRegisterLine(
            entry_id=e.id,
            journal_no=e.journal_no,
            entry_date=e.entry_date,
            journal_type=e.journal_type.value,
            reference=e.reference,
            description=e.description,
            total_debit=float(e.total_debit),
            total_credit=float(e.total_credit),
            is_posted=e.is_posted,
            is_reversed=e.is_reversed,
        )
        for e in entries
    ]

    return JournalRegisterReport(
        company_id=company_id,
        date_from=date_from,
        date_to=date_to,
        total_debit=sum(r.total_debit for r in rows),
        total_credit=sum(r.total_credit for r in rows),
        entries=rows,
    )