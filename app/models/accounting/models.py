"""
UAE-compliant double-entry accounting models.
Every AR/AP transaction posts a JournalEntry automatically via service layer.
"""
import enum
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey,
    Numeric, String, Text, Integer
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class Account(Base):
    __tablename__ = "accounts"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type_enum"), nullable=False
    )
    is_control: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    children: Mapped[List["Account"]] = relationship("Account")
    journal_lines: Mapped[List["JournalLine"]] = relationship("JournalLine", back_populates="account")


class Bank(Base):
    __tablename__ = "banks"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    account_id: Mapped[Optional[int]] = mapped_column(ForeignKey("accounts.id"), nullable=True)
    bank_name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_no: Mapped[str] = mapped_column(String(100), nullable=False)
    iban: Mapped[Optional[str]] = mapped_column(String(50))
    swift_code: Mapped[Optional[str]] = mapped_column(String(20))
    branch: Mapped[Optional[str]] = mapped_column(String(200))
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    current_balance: Mapped[float] = mapped_column(Numeric(18, 2), default=0)


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    CREDIT_NOTE = "credit_note"


class Invoice(Base):
    __tablename__ = "invoices"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    invoice_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status_enum"), default=InvoiceStatus.DRAFT
    )
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    customer_trn: Mapped[Optional[str]] = mapped_column(String(50))
    supply_date: Mapped[Optional[date]] = mapped_column(Date)
    place_of_supply: Mapped[str] = mapped_column(String(10), default="AE")
    subtotal: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    taxable_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    balance_due: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    terms: Mapped[Optional[str]] = mapped_column(Text)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    line_items: Mapped[List["InvoiceLineItem"]] = relationship(
        "InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    receipts: Mapped[List["Receipt"]] = relationship("Receipt", back_populates="invoice")


class InvoiceLineItem(Base):
    __tablename__ = "invoice_line_items"

    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("services.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    unit_price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    discount_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    vat_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=5)
    vat_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    line_total: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    sort_order: Mapped[int] = mapped_column(default=0)
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="line_items")


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CHEQUE = "cheque"
    BANK_TRANSFER = "bank_transfer"
    CARD = "card"
    ONLINE = "online"


class Receipt(Base):
    __tablename__ = "receipts"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    bank_id: Mapped[Optional[int]] = mapped_column(ForeignKey("banks.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    receipt_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method_enum"), default=PaymentMethod.BANK_TRANSFER
    )
    cheque_no: Mapped[Optional[str]] = mapped_column(String(50))
    cheque_date: Mapped[Optional[date]] = mapped_column(Date)
    cheque_bank: Mapped[Optional[str]] = mapped_column(String(100))
    reference_no: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=False)
    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="receipts")


class VendorInvoice(Base):
    __tablename__ = "vendor_invoices"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True)

    vendor_invoice_no: Mapped[str] = mapped_column(String(100), nullable=False)
    our_reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    balance_due: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=False)


class VendorPayment(Base):
    __tablename__ = "vendor_payments"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False, index=True)
    vendor_invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendor_invoices.id"), nullable=True)
    bank_id: Mapped[Optional[int]] = mapped_column(ForeignKey("banks.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    payment_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(PaymentMethod, name="payment_method_enum2"), default=PaymentMethod.BANK_TRANSFER
    )
    reference_no: Mapped[Optional[str]] = mapped_column(String(100))
    cheque_no: Mapped[Optional[str]] = mapped_column(String(50))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=False)


class JournalType(str, enum.Enum):
    GENERAL = "general"
    SALES = "sales"
    PURCHASE = "purchase"
    CASH_RECEIPT = "cash_receipt"
    CASH_PAYMENT = "cash_payment"
    BANK = "bank"
    OPENING = "opening"
    CLOSING = "closing"
    VAT = "vat"


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    journal_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    journal_type: Mapped[JournalType] = mapped_column(
        Enum(JournalType, name="journal_type_enum"), default=JournalType.GENERAL
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    reversal_of_id: Mapped[Optional[int]] = mapped_column(ForeignKey("journal_entries.id"))
    total_debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    lines: Mapped[List["JournalLine"]] = relationship(
        "JournalLine", back_populates="journal_entry", cascade="all, delete-orphan"
    )


class JournalLine(Base):
    __tablename__ = "journal_lines"

    journal_entry_id: Mapped[int] = mapped_column(
        ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    sort_order: Mapped[int] = mapped_column(default=0)
    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")
    account: Mapped["Account"] = relationship("Account", back_populates="journal_lines")


class EntityDocument(Base):
    """Central expiry-tracked document store for employees, vehicles, customers, vendors, company."""
    __tablename__ = "entity_documents"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    doc_no: Mapped[Optional[str]] = mapped_column(String(100))
    file_name: Mapped[str] = mapped_column(String(300), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    issued_date: Mapped[Optional[date]] = mapped_column(Date)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, index=True)
    alert_days_before: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
