"""
Invoice service — core accounting logic.
Every invoice/receipt posts balanced double-entry journal entries automatically.
"""
from datetime import date
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.accounting.models import (
    Invoice, InvoiceLineItem, InvoiceStatus,
    JournalEntry, JournalLine, JournalType, Receipt,
)
from app.utils.numbering import next_invoice_no, next_journal_no


# ── Default GL account codes (must match seeded CoA) ─────────────────────────
AR_ACCOUNT_CODE = "1100"        # Accounts Receivable
VAT_OUTPUT_CODE = "2200"        # VAT Payable (Output)
REVENUE_CODE    = "4100"        # Revenue - Freight
# BANK_CODE removed — bank/cash account is now always resolved explicitly per
# receipt via resolve_cash_or_bank_account_id(), never a hardcoded fallback.


def _calc_line(qty: float, unit_price: float, disc_pct: float, vat_pct: float) -> dict:
    base = round(qty * unit_price, 4)
    discount = round(base * disc_pct / 100, 4)
    taxable = round(base - discount, 4)
    vat = round(taxable * vat_pct / 100, 4)
    return {
        "discount_amount": discount,
        "taxable": taxable,
        "vat_amount": vat,
        "line_total": round(taxable + vat, 2),
    }


async def _get_account_id(db: AsyncSession, company_id: int, code: str) -> Optional[int]:
    from app.models.accounting.models import Account
    result = await db.execute(
        select(Account.id).where(Account.company_id == company_id, Account.code == code)
    )
    return result.scalar_one_or_none()


# ── Invoice CRUD + JE posting ─────────────────────────────────────────────────

async def create_invoice(
    db: AsyncSession,
    company_id: int,
    created_by_id: int,
    customer_id: int,
    invoice_date: date,
    due_date: date,
    line_items: list,
    job_id: Optional[int] = None,
    customer_trn: Optional[str] = None,
    notes: Optional[str] = None,
    terms: Optional[str] = None,
    currency: str = "AED",
) -> Invoice:
    invoice_no = await next_invoice_no(db, company_id)

    subtotal = discount_total = vat_total = 0.0
    computed_lines = []
    for li in line_items:
        calc = _calc_line(li["quantity"], li["unit_price"], li.get("discount_pct", 0), li.get("vat_pct", 5))
        subtotal += li["quantity"] * li["unit_price"]
        discount_total += calc["discount_amount"]
        vat_total += calc["vat_amount"]
        computed_lines.append({**li, **calc})

    taxable_amount = round(subtotal - discount_total, 2)
    total_amount = round(taxable_amount + vat_total, 2)

    invoice = Invoice(
        company_id=company_id,
        customer_id=customer_id,
        job_id=job_id,
        created_by_id=created_by_id,
        invoice_no=invoice_no,
        status=InvoiceStatus.DRAFT,
        invoice_date=invoice_date,
        due_date=due_date,
        customer_trn=customer_trn,
        supply_date=invoice_date,
        subtotal=round(subtotal, 2),
        discount_amount=round(discount_total, 2),
        taxable_amount=taxable_amount,
        vat_amount=round(vat_total, 2),
        total_amount=total_amount,
        paid_amount=0,
        balance_due=total_amount,
        currency=currency,
        notes=notes,
        terms=terms,
    )
    db.add(invoice)
    await db.flush()

    for li in computed_lines:
        db.add(InvoiceLineItem(
            invoice_id=invoice.id,
            service_id=li.get("service_id"),
            description=li["description"],
            quantity=li["quantity"],
            unit=li.get("unit"),
            unit_price=li["unit_price"],
            discount_pct=li.get("discount_pct", 0),
            vat_pct=li.get("vat_pct", 5),
            vat_amount=li["vat_amount"],
            line_total=li["line_total"],
            sort_order=li.get("sort_order", 0),
        ))

    await db.commit()
    await db.refresh(invoice, ["line_items"])
    return invoice


async def post_invoice_journal(db: AsyncSession, invoice: Invoice, created_by_id: int) -> JournalEntry:
    """
    Post the sales journal entry:
      DR  Accounts Receivable   (total incl VAT)
      CR  Revenue               (taxable amount)
      CR  VAT Payable           (VAT amount)
    """
    company_id = invoice.company_id
    jv_no = await next_journal_no(db, company_id)

    ar_id  = await _get_account_id(db, company_id, AR_ACCOUNT_CODE)
    rev_id = await _get_account_id(db, company_id, REVENUE_CODE)
    vat_id = await _get_account_id(db, company_id, VAT_OUTPUT_CODE)

    if not ar_id or not rev_id:
        raise ValueError("Missing required Accounts Receivable or Revenue account in chart of accounts")

    je = JournalEntry(
        company_id=company_id,
        created_by_id=created_by_id,
        journal_no=jv_no,
        journal_type=JournalType.SALES,
        entry_date=invoice.invoice_date,
        reference=invoice.invoice_no,
        description=f"Sales invoice {invoice.invoice_no}",
        is_posted=True,
        total_debit=invoice.total_amount,
        total_credit=invoice.total_amount,
    )
    db.add(je)
    await db.flush()

    db.add(JournalLine(journal_entry_id=je.id, account_id=ar_id,
                       description=f"AR - {invoice.invoice_no}",
                       debit=invoice.total_amount, credit=0, currency=invoice.currency))
    db.add(JournalLine(journal_entry_id=je.id, account_id=rev_id,
                       description=f"Revenue - {invoice.invoice_no}",
                       debit=0, credit=invoice.taxable_amount, currency=invoice.currency))
    if invoice.vat_amount > 0 and vat_id:
        db.add(JournalLine(journal_entry_id=je.id, account_id=vat_id,
                           description=f"VAT output - {invoice.invoice_no}",
                           debit=0, credit=invoice.vat_amount, currency=invoice.currency))
    await db.commit()
    return je


async def post_receipt_journal(
    db: AsyncSession, receipt: Receipt, invoice: Invoice, created_by_id: int, bank_account_id: int
) -> JournalEntry:
    """
    Post the receipt journal entry:
      DR  Bank / Cash           (amount received)
      CR  Accounts Receivable   (reduce AR)

    bank_account_id is now REQUIRED — no hardcoded fallback account. Callers
    must resolve it via accounting_helpers.resolve_cash_or_bank_account_id()
    based on receipt.bank_id, so cash receipts land in the Cash account and
    bank receipts land in the correct Bank's account.
    """
    company_id = receipt.company_id
    jv_no = await next_journal_no(db, company_id)

    ar_id = await _get_account_id(db, company_id, AR_ACCOUNT_CODE)
    if not ar_id:
        raise ValueError("Accounts Receivable account not found in chart of accounts")

    je = JournalEntry(
        company_id=company_id,
        created_by_id=created_by_id,
        journal_no=jv_no,
        journal_type=JournalType.BANK if receipt.bank_id else JournalType.CASH_RECEIPT,
        entry_date=receipt.receipt_date,
        reference=receipt.receipt_no,
        description=f"Receipt {receipt.receipt_no} for invoice {invoice.invoice_no}",
        is_posted=True,
        total_debit=receipt.amount,
        total_credit=receipt.amount,
    )
    db.add(je)
    await db.flush()

    db.add(JournalLine(journal_entry_id=je.id, account_id=bank_account_id,
                       description=f"Bank/Cash receipt - {receipt.receipt_no}",
                       debit=receipt.amount, credit=0, currency=receipt.currency))
    db.add(JournalLine(journal_entry_id=je.id, account_id=ar_id,
                       description=f"AR settlement - {invoice.invoice_no}",
                       debit=0, credit=receipt.amount, currency=receipt.currency))

    # Update invoice paid/balance
    new_paid = float(invoice.paid_amount) + receipt.amount
    new_balance = float(invoice.total_amount) - new_paid
    invoice.paid_amount = round(new_paid, 2)
    invoice.balance_due = round(new_balance, 2)
    invoice.status = (
        InvoiceStatus.PAID if new_balance <= 0
        else InvoiceStatus.PARTIALLY_PAID
    )

    receipt.is_posted = True
    await db.commit()
    return je


async def post_receipt_journal_unlinked(
    db: AsyncSession, receipt: Receipt, receivable_account_id: int,
    bank_account_id: int, created_by_id: int,
) -> JournalEntry:
    """
    Post a receipt that isn't tied to a specific invoice (e.g. advance/on-account
    payment):
      DR  Bank / Cash
      CR  Customer Receivable (or a generic AR/advances account)
    """
    company_id = receipt.company_id
    jv_no = await next_journal_no(db, company_id)

    je = JournalEntry(
        company_id=company_id,
        created_by_id=created_by_id,
        journal_no=jv_no,
        journal_type=JournalType.BANK if receipt.bank_id else JournalType.CASH_RECEIPT,
        entry_date=receipt.receipt_date,
        reference=receipt.receipt_no,
        description=f"Receipt {receipt.receipt_no} (on account)",
        is_posted=True,
        total_debit=receipt.amount,
        total_credit=receipt.amount,
    )
    db.add(je)
    await db.flush()

    db.add(JournalLine(journal_entry_id=je.id, account_id=bank_account_id,
                       description=f"Bank/Cash receipt - {receipt.receipt_no}",
                       debit=receipt.amount, credit=0, currency=receipt.currency))
    db.add(JournalLine(journal_entry_id=je.id, account_id=receivable_account_id,
                       description=f"On-account receipt - {receipt.receipt_no}",
                       debit=0, credit=receipt.amount, currency=receipt.currency))

    receipt.is_posted = True
    await db.commit()
    return je