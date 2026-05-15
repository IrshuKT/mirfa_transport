"""
Import all models here so SQLAlchemy metadata is fully populated
before Alembic or create_all() is called.
"""
from app.models.auth import (  # noqa: F401
    Company, Role, RolePermission, Permission, User, RefreshToken, AuditLog
)
from app.models.entities import (  # noqa: F401
    Customer, CustomerContact, Vendor, Service,
    Employee, Driver, DriverLocationPing, Vehicle, VehicleMaintenance
)
from app.models.job import (  # noqa: F401
    ServiceRequest, Job, Dispatch, JobDocument
)
from app.models.quotation import Quotation, QuotationLineItem  # noqa: F401
from app.models.sequence import NumberSequence  # noqa: F401
from app.models.accounting.models import (  # noqa: F401
    Account, Bank, Invoice, InvoiceLineItem, Receipt,
    VendorInvoice, VendorPayment, JournalEntry, JournalLine, EntityDocument
)

all_models = True  # sentinel used by database.py and alembic/env.py
