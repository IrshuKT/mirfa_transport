"""
Job lifecycle: ServiceRequest → Job → Dispatch → POD
"""
import enum
from typing import List, Optional
from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Integer,
    Numeric, String, Text, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime

from app.core.database import Base


class RequestStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    QUOTED = "quoted"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class DispatchStatus(str, enum.Enum):
    ASSIGNED = "assigned"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EN_ROUTE = "en_route"
    AT_PICKUP = "at_pickup"
    LOADED = "loaded"
    AT_DELIVERY = "at_delivery"
    DELIVERED = "delivered"
    FAILED = "failed"


class JobPriority(str, enum.Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


# ── Service Request ──────────────────────────────────────────────────────────

class ServiceRequest(Base):
    __tablename__ = "service_requests"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    requested_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    reference_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    service_id: Mapped[Optional[int]] = mapped_column(ForeignKey("services.id"), nullable=True)
    status: Mapped[RequestStatus] = mapped_column(
        Enum(RequestStatus, name="request_status_enum"), default=RequestStatus.DRAFT
    )
    priority: Mapped[JobPriority] = mapped_column(
        Enum(JobPriority, name="job_priority_enum"), default=JobPriority.NORMAL
    )

    # Location
    pickup_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    pickup_lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    delivery_address: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    delivery_lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))

    # Cargo
    cargo_description: Mapped[Optional[str]] = mapped_column(Text)
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(10, 2))
    volume_m3: Mapped[Optional[float]] = mapped_column(Numeric(10, 3))
    special_requirements: Mapped[Optional[str]] = mapped_column(Text)

    # Schedule
    requested_pickup_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    requested_delivery_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    notes: Mapped[Optional[str]] = mapped_column(Text)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON)

    # Relations
    quotations: Mapped[List["Quotation"]] = relationship("Quotation", back_populates="service_request")
    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="service_request", uselist=False)


# ── Job ──────────────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    service_request_id: Mapped[Optional[int]] = mapped_column(ForeignKey("service_requests.id"))
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    vendor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vendors.id"), nullable=True)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    job_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status_enum"), default=JobStatus.PENDING
    )
    priority: Mapped[JobPriority] = mapped_column(
        Enum(JobPriority, name="job_priority_enum2"), default=JobPriority.NORMAL
    )

    # Same location fields as request
    pickup_address: Mapped[str] = mapped_column(Text, nullable=False)
    pickup_lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    pickup_lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    delivery_address: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    delivery_lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))

    # Schedule (confirmed times)
    scheduled_pickup_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    scheduled_delivery_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_pickup_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_delivery_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Billing
    agreed_amount: Mapped[Optional[float]] = mapped_column(Numeric(15, 2))
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    is_invoiced: Mapped[bool] = mapped_column(Boolean, default=False)

    notes: Mapped[Optional[str]] = mapped_column(Text)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text)
    tracking_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True)  # shareable link

    # Relations
    service_request: Mapped[Optional["ServiceRequest"]] = relationship(
        "ServiceRequest", back_populates="job"
    )
    dispatches: Mapped[List["Dispatch"]] = relationship("Dispatch", back_populates="job")
    documents: Mapped[List["JobDocument"]] = relationship("JobDocument", back_populates="job")
    location_pings: Mapped[List["DriverLocationPing"]] = relationship(
        "DriverLocationPing", back_populates="job"
    )
    # In models/job.py — add to Job class
    assigned_to_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

# ── Dispatch ─────────────────────────────────────────────────────────────────

class Dispatch(Base):
    __tablename__ = "dispatches"

    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), nullable=False, index=True)
    vehicle_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vehicles.id"), nullable=True)
    assigned_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    status: Mapped[DispatchStatus] = mapped_column(
        Enum(DispatchStatus, name="dispatch_status_enum"), default=DispatchStatus.ASSIGNED
    )

    # Timestamps for each status change
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    en_route_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    at_pickup_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    loaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    at_delivery_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # POD
    pod_signature_url: Mapped[Optional[str]] = mapped_column(String(500))
    pod_photo_url: Mapped[Optional[str]] = mapped_column(String(500))
    pod_notes: Mapped[Optional[str]] = mapped_column(Text)
    pod_received_by: Mapped[Optional[str]] = mapped_column(String(200))

    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    driver_notes: Mapped[Optional[str]] = mapped_column(Text)

    job: Mapped["Job"] = relationship("Job", back_populates="dispatches")


# ── Job Document ──────────────────────────────────────────────────────────────

class JobDocument(Base):
    __tablename__ = "job_documents"

    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    doc_type: Mapped[str] = mapped_column(String(100))  # BOL, CMR, POD, permit, etc.
    file_name: Mapped[str] = mapped_column(String(300))
    file_url: Mapped[str] = mapped_column(String(500))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)

    job: Mapped["Job"] = relationship("Job", back_populates="documents")
