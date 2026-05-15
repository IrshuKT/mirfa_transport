"""
Business entity models:
  Customer, Vendor, Service, Employee, Driver, Vehicle
"""
import enum
from typing import List, Optional
from datetime import date, datetime
from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Text
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ─────────────────────────── Customer ───────────────────────────────────────

class CustomerType(str, enum.Enum):
    INDIVIDUAL = "individual"
    CORPORATE = "corporate"
    GOVERNMENT = "government"


class Customer(Base):
    __tablename__ = "customers"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    customer_type: Mapped[CustomerType] = mapped_column(
        Enum(CustomerType, name="customer_type_enum"), default=CustomerType.CORPORATE
    )
    code: Mapped[Optional[str]] = mapped_column(String(30), index=True)
    trn: Mapped[Optional[str]] = mapped_column(String(50))          # UAE Tax Reg No
    email: Mapped[Optional[str]] = mapped_column(String(254))
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    mobile: Mapped[Optional[str]] = mapped_column(String(30))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(10), default="AE")
    credit_limit: Mapped[Optional[float]] = mapped_column(Numeric(15, 2))
    credit_days: Mapped[int] = mapped_column(Integer, default=30)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Portal access
    portal_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    contacts: Mapped[List["CustomerContact"]] = relationship(
        "CustomerContact", back_populates="customer", cascade="all, delete-orphan"
    )
    documents: Mapped[List["EntityDocument"]] = relationship(
        "EntityDocument",
        primaryjoin="and_(EntityDocument.entity_type=='customer', foreign(EntityDocument.entity_id)==Customer.id)",
        viewonly=True,
    )


class CustomerContact(Base):
    __tablename__ = "customer_contacts"

    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[Optional[str]] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(254))
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="contacts")


# ─────────────────────────── Vendor ─────────────────────────────────────────

class VendorType(str, enum.Enum):
    SUBCONTRACTOR = "subcontractor"
    SUPPLIER = "supplier"
    BOTH = "both"


class Vendor(Base):
    __tablename__ = "vendors"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(300), nullable=False)
    vendor_type: Mapped[VendorType] = mapped_column(
        Enum(VendorType, name="vendor_type_enum"), default=VendorType.SUPPLIER
    )
    code: Mapped[Optional[str]] = mapped_column(String(30), index=True)
    trn: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(254))
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    address: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(10), default="AE")
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    portal_user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)


# ─────────────────────────── Service Catalogue ───────────────────────────────

class Service(Base):
    __tablename__ = "services"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(30))
    description: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(50), default="trip")   # trip, ton, km, hour
    unit_price: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    vat_applicable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(default=0)


# ─────────────────────────── Employee ────────────────────────────────────────

class EmployeeStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"
    PROBATION = "probation"


class Employee(Base):
    __tablename__ = "employees"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    employee_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[Optional[str]] = mapped_column(String(100))
    department: Mapped[Optional[str]] = mapped_column(String(100))
    email: Mapped[Optional[str]] = mapped_column(String(254))
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    mobile: Mapped[Optional[str]] = mapped_column(String(30))
    nationality: Mapped[Optional[str]] = mapped_column(String(10))
    join_date: Mapped[Optional[date]] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date)
    status: Mapped[EmployeeStatus] = mapped_column(
        Enum(EmployeeStatus, name="employee_status_enum"), default=EmployeeStatus.ACTIVE
    )
    basic_salary: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(10), default="AED")

    # UAE compliance docs
    emirates_id: Mapped[Optional[str]] = mapped_column(String(30))
    emirates_id_expiry: Mapped[Optional[date]] = mapped_column(Date)
    visa_no: Mapped[Optional[str]] = mapped_column(String(50))
    visa_expiry: Mapped[Optional[date]] = mapped_column(Date)
    passport_no: Mapped[Optional[str]] = mapped_column(String(30))
    passport_expiry: Mapped[Optional[date]] = mapped_column(Date)
    labour_card_no: Mapped[Optional[str]] = mapped_column(String(50))
    labour_card_expiry: Mapped[Optional[date]] = mapped_column(Date)

    notes: Mapped[Optional[str]] = mapped_column(Text)


# ─────────────────────────── Driver ──────────────────────────────────────────

class DriverAvailability(str, enum.Enum):
    AVAILABLE = "available"
    ON_JOB = "on_job"
    OFF_DUTY = "off_duty"
    ON_LEAVE = "on_leave"


class Driver(Base):
    __tablename__ = "drivers"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    employee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, unique=True)

    driver_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    mobile: Mapped[str] = mapped_column(String(30), nullable=False)

    # License
    license_no: Mapped[Optional[str]] = mapped_column(String(50))
    license_expiry: Mapped[Optional[date]] = mapped_column(Date)
    license_type: Mapped[Optional[str]] = mapped_column(String(30))  # LMV, HMV, etc.

    # Status
    availability: Mapped[DriverAvailability] = mapped_column(
        Enum(DriverAvailability, name="driver_availability_enum"),
        default=DriverAvailability.OFF_DUTY,
    )
    current_lat: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    current_lng: Mapped[Optional[float]] = mapped_column(Numeric(10, 7))
    last_ping_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    fcm_token: Mapped[Optional[str]] = mapped_column(String(500))   # Firebase push token

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    location_pings: Mapped[List["DriverLocationPing"]] = relationship(
        "DriverLocationPing", back_populates="driver"
    )


class DriverLocationPing(Base):
    __tablename__ = "driver_location_pings"

    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), nullable=False, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    lat: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    lng: Mapped[float] = mapped_column(Numeric(10, 7), nullable=False)
    accuracy_m: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    speed_kmh: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    heading: Mapped[Optional[float]] = mapped_column(Numeric(6, 2))
    pinged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    driver: Mapped["Driver"] = relationship("Driver", back_populates="location_pings")
    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="location_pings")


# ─────────────────────────── Fleet / Vehicle ──────────────────────────────────

class VehicleStatus(str, enum.Enum):
    ACTIVE = "active"
    IN_MAINTENANCE = "in_maintenance"
    RETIRED = "retired"


class Vehicle(Base):
    __tablename__ = "vehicles"

    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)

    plate_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    fleet_no: Mapped[Optional[str]] = mapped_column(String(30))
    make: Mapped[Optional[str]] = mapped_column(String(100))
    model: Mapped[Optional[str]] = mapped_column(String(100))
    year: Mapped[Optional[int]] = mapped_column(Integer)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(100))   # Truck, Van, Trailer
    payload_tons: Mapped[Optional[float]] = mapped_column(Numeric(8, 2))
    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus, name="vehicle_status_enum"), default=VehicleStatus.ACTIVE
    )

    # UAE compliance
    mulkiya_expiry: Mapped[Optional[date]] = mapped_column(Date)
    insurance_expiry: Mapped[Optional[date]] = mapped_column(Date)
    insurance_policy_no: Mapped[Optional[str]] = mapped_column(String(100))
    rta_permit_expiry: Mapped[Optional[date]] = mapped_column(Date)

    notes: Mapped[Optional[str]] = mapped_column(Text)

    maintenance_records: Mapped[List["VehicleMaintenance"]] = relationship(
        "VehicleMaintenance", back_populates="vehicle", cascade="all, delete-orphan"
    )


class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenance"

    vehicle_id: Mapped[int] = mapped_column(
        ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recorded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    maintenance_type: Mapped[str] = mapped_column(String(100))   # oil change, tyre, inspection
    description: Mapped[Optional[str]] = mapped_column(Text)
    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    next_service_date: Mapped[Optional[date]] = mapped_column(Date)
    odometer_km: Mapped[Optional[int]] = mapped_column(Integer)
    cost: Mapped[Optional[float]] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    vendor_name: Mapped[Optional[str]] = mapped_column(String(200))
    invoice_ref: Mapped[Optional[str]] = mapped_column(String(100))

    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="maintenance_records")
