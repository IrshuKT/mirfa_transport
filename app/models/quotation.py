"""Quotation / Sales Order models."""
import enum
from typing import List, Optional
from sqlalchemy import Enum, ForeignKey, Numeric, String, Text, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.core.database import Base


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CONVERTED = "converted"       # → Job


class Quotation(Base):
    __tablename__ = "quotations"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    service_request_id: Mapped[Optional[int]] = mapped_column(ForeignKey("service_requests.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    quote_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    status: Mapped[QuotationStatus] = mapped_column(
        Enum(QuotationStatus, name="quotation_status_enum"), default=QuotationStatus.DRAFT
    )

    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    terms: Mapped[Optional[str]] = mapped_column(Text)

    # Totals (auto-computed from line items)
    subtotal: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    vat_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    discount_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="AED")

    # Acceptance
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    accepted_by_name: Mapped[Optional[str]] = mapped_column(String(200))
    accepted_by_email: Mapped[Optional[str]] = mapped_column(String(254))
    converted_to_job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True)

    # Relations
    service_request: Mapped[Optional["ServiceRequest"]] = relationship(
        "ServiceRequest", back_populates="quotations"
    )
    line_items: Mapped[List["QuotationLineItem"]] = relationship(
        "QuotationLineItem", back_populates="quotation", cascade="all, delete-orphan"
    )


class QuotationLineItem(Base):
    __tablename__ = "quotation_line_items"

    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("services.id"), nullable=True)

    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 3), default=1)
    unit: Mapped[Optional[str]] = mapped_column(String(50))       # trip, ton, km, hour
    unit_price: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    discount_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    vat_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=5)  # UAE 5%
    line_total: Mapped[float] = mapped_column(Numeric(15, 2), default=0)

    sort_order: Mapped[int] = mapped_column(default=0)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="line_items")
