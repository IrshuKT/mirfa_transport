"""
Financial Reports:
  - Trial Balance
  - Profit & Loss
  - Balance Sheet
  - UAE FTA VAT Return (Boxes 1-9)
  - Ledger (account-level drill-down)
"""
from typing import Annotated, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.models.accounting.models import Account, AccountType, JournalLine, JournalEntry

router = APIRouter(prefix="/accounting/reports", tags=["Accounting - Reports"])

DB = Annotated[AsyncSession, Depends(get_db)]


async def _account_balances(
    db: AsyncSession, company_id: int, date_from: date, date_to: date
) -> list:
    result = await db.execute(
        select(
            Account.id, Account.code, Account.name, Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), 0).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(
            Account.company_id == company_id,
            JournalEntry.company_id == company_id,
            JournalEntry.is_posted == True,
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
        .group_by(Account.id, Account.code, Account.name, Account.account_type)
        .order_by(Account.code)
    )
    rows = result.all()
    balances = []
    for row in rows:
        dr = float(row.total_debit)
        cr = float(row.total_credit)
        if row.account_type in (AccountType.ASSET, AccountType.EXPENSE):
            balance = dr - cr
        else:
            balance = cr - dr
        balances.append({
            "account_id": row.id,
            "code": row.code,
            "name": row.name,
            "account_type": row.account_type,
            "total_debit": round(dr, 2),
            "total_credit": round(cr, 2),
            "balance": round(balance, 2),
        })
    return balances


@router.get("/trial-balance")
async def trial_balance(
    db: DB,
    current_user: CurrentUser,
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    balances = await _account_balances(db, current_user.company_id, date_from, date_to)
    total_dr = round(sum(r["total_debit"] for r in balances), 2)
    total_cr = round(sum(r["total_credit"] for r in balances), 2)
    return {
        "period": {"from": date_from, "to": date_to},
        "accounts": balances,
        "totals": {
            "debit": total_dr,
            "credit": total_cr,
            "balanced": abs(total_dr - total_cr) < 0.01,
        },
    }


@router.get("/profit-loss")
async def profit_and_loss(
    db: DB,
    current_user: CurrentUser,
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    balances = await _account_balances(db, current_user.company_id, date_from, date_to)
    revenue  = [b for b in balances if b["account_type"] == AccountType.REVENUE]
    expenses = [b for b in balances if b["account_type"] == AccountType.EXPENSE]
    total_revenue  = round(sum(r["balance"] for r in revenue), 2)
    total_expenses = round(sum(e["balance"] for e in expenses), 2)
    net_profit = round(total_revenue - total_expenses, 2)
    return {
        "period": {"from": date_from, "to": date_to},
        "revenue":  {"accounts": revenue,  "total": total_revenue},
        "expenses": {"accounts": expenses, "total": total_expenses},
        "net_profit": net_profit,
        "net_profit_margin_pct": round(net_profit / total_revenue * 100, 2) if total_revenue else 0,
    }


@router.get("/balance-sheet")
async def balance_sheet(
    db: DB,
    current_user: CurrentUser,
    as_of_date: date = Query(...),
):
    from datetime import date as dt
    balances = await _account_balances(db, current_user.company_id, dt(2000, 1, 1), as_of_date)
    assets      = [b for b in balances if b["account_type"] == AccountType.ASSET]
    liabilities = [b for b in balances if b["account_type"] == AccountType.LIABILITY]
    equity      = [b for b in balances if b["account_type"] == AccountType.EQUITY]
    total_assets      = round(sum(a["balance"] for a in assets), 2)
    total_liabilities = round(sum(l["balance"] for l in liabilities), 2)
    total_equity      = round(sum(e["balance"] for e in equity), 2)
    return {
        "as_of": as_of_date,
        "assets":      {"accounts": assets,      "total": total_assets},
        "liabilities": {"accounts": liabilities, "total": total_liabilities},
        "equity":      {"accounts": equity,      "total": total_equity},
        "total_liabilities_and_equity": round(total_liabilities + total_equity, 2),
        "balanced": abs(total_assets - (total_liabilities + total_equity)) < 0.01,
    }


@router.get("/vat-return")
async def vat_return(
    db: DB,
    current_user: CurrentUser,
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    from app.models.accounting.models import Invoice, InvoiceStatus, VendorInvoice

    inv_result = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.taxable_amount), 0).label("taxable"),
            func.coalesce(func.sum(Invoice.vat_amount), 0).label("vat"),
        ).where(
            Invoice.company_id == current_user.company_id,
            Invoice.status != InvoiceStatus.CANCELLED,
            Invoice.invoice_date >= date_from,
            Invoice.invoice_date <= date_to,
        )
    )
    inv_row = inv_result.one()
    box1_sales      = round(float(inv_row.taxable), 2)
    box5_output_vat = round(float(inv_row.vat), 2)

    vi_result = await db.execute(
        select(
            func.coalesce(func.sum(VendorInvoice.subtotal), 0).label("purchases"),
            func.coalesce(func.sum(VendorInvoice.vat_amount), 0).label("input_vat"),
        ).where(
            VendorInvoice.company_id == current_user.company_id,
            VendorInvoice.is_posted == True,
            VendorInvoice.invoice_date >= date_from,
            VendorInvoice.invoice_date <= date_to,
        )
    )
    vi_row = vi_result.one()
    box4_purchases = round(float(vi_row.purchases), 2)
    box6_input_vat = round(float(vi_row.input_vat), 2)
    box9_net_vat   = round(box5_output_vat - box6_input_vat, 2)

    return {
        "period": {"from": date_from, "to": date_to},
        "currency": "AED",
        "boxes": {
            "box_1_standard_rated_supplies": box1_sales,
            "box_2_zero_rated_supplies": 0,
            "box_3_exempt_supplies": 0,
            "box_4_goods_imported": box4_purchases,
            "box_5_output_vat": box5_output_vat,
            "box_6_input_vat_recoverable": box6_input_vat,
            "box_7_vat_on_imports": 0,
            "box_8_adjustments": 0,
            "box_9_net_vat_payable": box9_net_vat,
        },
        "summary": {
            "total_sales": box1_sales,
            "total_purchases": box4_purchases,
            "vat_payable":   box9_net_vat if box9_net_vat > 0 else 0,
            "vat_refundable": abs(box9_net_vat) if box9_net_vat < 0 else 0,
        },
    }


@router.get("/ledger")
async def account_ledger(
    db: DB,
    current_user: CurrentUser,
    account_id: int = Query(...),
    date_from: date = Query(...),
    date_to: date = Query(...),
):
    result = await db.execute(
        select(
            JournalLine.id,
            JournalLine.debit,
            JournalLine.credit,
            JournalLine.description,
            JournalEntry.entry_date,
            JournalEntry.journal_no,
            JournalEntry.reference,
        )
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)
        .where(
            JournalLine.account_id == account_id,
            JournalEntry.company_id == current_user.company_id,
            JournalEntry.is_posted == True,
            JournalEntry.entry_date >= date_from,
            JournalEntry.entry_date <= date_to,
        )
        .order_by(JournalEntry.entry_date, JournalEntry.journal_no)
    )
    rows = result.all()
    running_balance = 0.0
    lines = []
    for row in rows:
        running_balance += float(row.debit) - float(row.credit)
        lines.append({
            "date": row.entry_date,
            "journal_no": row.journal_no,
            "reference": row.reference,
            "description": row.description,
            "debit": float(row.debit),
            "credit": float(row.credit),
            "balance": round(running_balance, 2),
        })
    return {
        "account_id": account_id,
        "period": {"from": date_from, "to": date_to},
        "transactions": lines,
        "closing_balance": round(running_balance, 2),
    }
