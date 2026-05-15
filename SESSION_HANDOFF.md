# Logistics Platform — Session Handoff
**Date:** 2026-05-14  
**Stack:** FastAPI (Python) + React + PostgreSQL + Redis  
**Purpose:** UAE-based logistics platform — drivers, jobs, accounting, portals

---

## Project Overview

Full-stack logistics platform with:
- Multi-role auth (super_admin, company_admin, accountant, dispatcher, staff, driver, customer_portal, vendor_portal)
- Job lifecycle: ServiceRequest → Job → Dispatch → POD
- Quotations with line items and VAT
- UAE-compliant double-entry accounting (VAT 5%, FTA)
- Document expiry dashboard (employees, vehicles, trade license, visa, etc.)
- Real-time driver tracking (GPS ping → shareable customer link)
- Multi-company / branch support

---

## ✅ DONE — Files Built This Session (18 files)

```
logistics-backend/
├── requirements.txt                         ← all pip dependencies
├── .env.example                             ← all env vars documented
└── app/
    ├── core/
    │   ├── config.py                        ← pydantic-settings, all settings
    │   ├── database.py                      ← async engine, Base, get_db()
    │   ├── security.py                      ← JWT, bcrypt, TOTP (pyotp)
    │   └── dependencies.py                  ← CurrentUser, require_roles(), shortcuts
    ├── models/
    │   ├── __init__.py                      ← imports ALL models for Alembic
    │   ├── auth.py                          ← Company, Role, Permission, User, RefreshToken, AuditLog
    │   ├── entities.py                      ← Customer, Vendor, Service, Employee, Driver, Vehicle, Fleet
    │   ├── job.py                           ← ServiceRequest, Job, Dispatch, JobDocument, DriverLocationPing
    │   ├── quotation.py                     ← Quotation, QuotationLineItem
    │   └── accounting/
    │       └── models.py                    ← Account, Bank, Invoice, Receipt, VendorInvoice,
    │                                           VendorPayment, JournalEntry, JournalLine, EntityDocument
    ├── schemas/
    │   └── auth.py                          ← LoginRequest, TokenResponse, UserCreate/Update/Response, TOTP, Company
    ├── services/
    │   └── auth_service.py                  ← login, refresh_tokens, logout, TOTP setup/confirm/disable, change_password
    └── routers/
        ├── auth.py                          ← POST /auth/login|refresh|logout, GET /auth/me, TOTP endpoints
        ├── users.py                         ← GET|POST /users, GET|PATCH|DELETE /users/{id}
        └── jobs.py                          ← Full job lifecycle + dispatch + POD + GPS ping + public tracking
```

---

## ⏳ PENDING — Next Session Build List

### Priority 1 — Make it runnable (do these first)
| File | What it does |
|------|-------------|
| `app/main.py` | FastAPI app factory, mounts all routers, CORS, exception handlers, startup |
| `alembic.ini` | Alembic config pointing to DATABASE_URL_SYNC |
| `alembic/env.py` | Imports Base + all models, runs migrations |
| `docker-compose.yml` | postgres:16, redis:7, app, celery-worker services |

### Priority 2 — Business routers (follow pattern of routers/users.py)
| File | Key endpoints |
|------|--------------|
| `routers/customers.py` | CRUD + contacts + portal user link |
| `routers/vendors.py` | CRUD + vendor portal link |
| `routers/quotations.py` | CRUD + line items + accept + convert-to-job |
| `routers/employees.py` | CRUD + doc expiry fields |
| `routers/drivers.py` | CRUD + availability toggle + current location |
| `routers/fleet.py` | Vehicle CRUD + maintenance records |
| `routers/documents.py` | Upload to S3 + expiry dashboard endpoint |
| `routers/companies.py` | Super-admin only — manage all companies |

### Priority 3 — Accounting routers (most complex)
| File | Key endpoints |
|------|--------------|
| `routers/accounting/invoices.py` | CRUD + send + mark-paid + credit note |
| `routers/accounting/receipts.py` | Create receipt → auto-update invoice balance |
| `routers/accounting/payments.py` | Vendor payment CRUD |
| `routers/accounting/journals.py` | Manual JV CRUD + post + reverse |
| `routers/accounting/banks.py` | Bank CRUD + balance |
| `routers/accounting/coa.py` | Chart of accounts CRUD + tree view |
| `routers/accounting/reports.py` | Trial Balance, P&L, Balance Sheet, VAT Return (FTA boxes 1-9) |

### Priority 4 — Service layer (business logic)
| File | What it does |
|------|-------------|
| `services/invoice_service.py` | Auto-post double-entry JE on invoice create/payment; compute VAT |
| `services/notification_service.py` | Firebase push (FCM), Twilio SMS, SendGrid email |
| `services/document_service.py` | S3 upload/presigned URL + Celery expiry alert task |
| `services/report_service.py` | Trial Balance, P&L, Balance Sheet aggregation from journal_lines |

### Priority 5 — Supporting files
| File | Notes |
|------|-------|
| `app/utils/numbering.py` | Auto-generate INV-2025-0001, RCT-0001, JV-0001 etc. |
| `app/utils/pagination.py` | Reusable paginated response helper |
| `app/tasks/celery_app.py` | Celery + Redis broker setup |
| `app/tasks/document_alerts.py` | Daily task: find docs expiring in ≤30 days, send alerts |
| `app/tasks/invoice_reminders.py` | Overdue invoice email reminders |
| `seeds/seed_roles.py` | Seed default roles + permissions + super admin user |
| `seeds/seed_coa.py` | Seed UAE logistics chart of accounts |

---

## Key Design Decisions (for consistency)

### Auth & RBAC
- JWT access token (30 min) + refresh token (7 days, rotated on use, stored hashed)
- TOTP 2FA optional per user (pyotp, stored as base32 secret)
- `require_roles(*roles)` dependency factory — used as `Depends(require_roles("admin"))`
- Company scoping: every query filters by `current_user.company_id` unless `super_admin`

### Accounting (UAE)
- Every AR/AP transaction must post a `JournalEntry` + `JournalLine` rows automatically
- VAT = 5% default, stored per line item as `vat_pct`
- FTA VAT Return: Box 1 = standard rated sales, Box 5 = input tax, etc.
- Invoice numbering: `INV-YYYYMM-XXXX` — use `app/utils/numbering.py`
- `is_posted` flag on invoices/receipts/JVs — only posted entries appear in reports

### Jobs
- Job number: `JOB-YYYYMMDD-XXXX`
- Tracking token: `secrets.token_urlsafe(32)` — public URL `/jobs/track/{token}`
- Driver location: pinged every ~10s by mobile app to `POST /jobs/location/ping`
- Dispatch status flow: ASSIGNED → ACCEPTED → EN_ROUTE → AT_PICKUP → LOADED → AT_DELIVERY → DELIVERED

### Models pattern
- All models extend `Base` (from `app/core/database.py`) — auto `id`, `created_at`, `updated_at`
- Use `Mapped[type]` + `mapped_column()` (SQLAlchemy 2.0 style)
- Enums: Python `enum.Enum` + SQLAlchemy `Enum(MyEnum, name="my_enum")`

### Routers pattern
```python
router = APIRouter(prefix="/resource", tags=["Resource"])
DB = Annotated[AsyncSession, Depends(get_db)]

@router.get("", response_model=dict)
async def list_items(db: DB, current_user: CurrentUser, page: int = 1, page_size: int = 25):
    # always filter by current_user.company_id (unless super_admin)
    ...
```

---

## Role Matrix
| Role | Scope |
|------|-------|
| super_admin | All companies, all data |
| company_admin | Own company, full access |
| accountant | Accounting + read jobs |
| dispatcher | Jobs + drivers + fleet |
| staff | Quotations + customers + read jobs |
| driver | Own dispatches only (mobile) |
| customer_portal | Own jobs + invoices + tracking |
| vendor_portal | Assigned jobs + their AP invoices |

---

## To Resume Next Session — Say This:

> "Continue the logistics platform FastAPI backend. Read SESSION_HANDOFF.md for context. Start with main.py + docker-compose.yml + Alembic, then build the remaining routers and services."

The handoff doc is at: `logistics-backend/SESSION_HANDOFF.md`
