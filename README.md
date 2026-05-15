# Mirfa Transport — Logistics Platform Backend

FastAPI + PostgreSQL + Redis backend for UAE-based logistics operations.

## Tech Stack
- **FastAPI** 0.115 + **SQLAlchemy** 2.0 (async) + **Alembic**
- **PostgreSQL** 16 · **Redis** 7 · **MinIO** (S3-compatible)
- **Celery** + **beat** for scheduled tasks
- **JWT** auth + **TOTP** 2FA · UAE VAT 5% compliant accounting

---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/IrshuKT/mirfa_transport.git
cd mirfa_transport

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY

# 3. Start all services
docker compose up -d

# 4. Run DB migrations
docker compose exec app alembic upgrade head

# 5. Seed roles + chart of accounts
docker compose exec app python -m seeds

# 6. Open API docs
open http://localhost:8000/docs
```

Default login after seeding:
- **Email:** `admin@mirfatransport.ae`
- **Password:** `Admin@1234` ← change immediately

---

## Local Development (without Docker)

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start postgres + redis separately, then:
cp .env.example .env     # set DATABASE_URL etc.
alembic upgrade head
python -m seeds
uvicorn app.main:app --reload
```

---

## Project Structure

```
app/
├── core/           config, database, security, dependencies (RBAC)
├── models/         SQLAlchemy models — auth, entities, job, quotation, accounting
├── routers/        FastAPI routers — one per module
│   └── accounting/ invoices, receipts, payments, journals, banks, coa, reports
├── schemas/        Pydantic request/response schemas
├── services/       Business logic — auth, invoice (double-entry JE), notifications
├── tasks/          Celery tasks — document alerts, invoice reminders
└── utils/          Pagination, sequential numbering

seeds/              One-time seed scripts (roles, CoA)
alembic/            Database migrations
```

---

## Key API Endpoints

| Module | Base URL |
|--------|----------|
| Auth | `POST /api/v1/auth/login` |
| Jobs | `GET/POST /api/v1/jobs` |
| Quotations | `GET/POST /api/v1/quotations` |
| Customers | `GET/POST /api/v1/customers` |
| Invoices | `GET/POST /api/v1/accounting/invoices` |
| Reports | `GET /api/v1/accounting/reports/trial-balance` |
| VAT Return | `GET /api/v1/accounting/reports/vat-return` |
| Doc Expiry | `GET /api/v1/documents/expiry-dashboard` |
| Driver Track | `GET /api/v1/jobs/track/{token}` (public) |

Full interactive docs: `http://localhost:8000/docs`

---

## Roles

| Role | Access |
|------|--------|
| `super_admin` | All companies, all data |
| `company_admin` | Own company, full access |
| `accountant` | Accounting + read ops |
| `dispatcher` | Jobs, drivers, fleet |
| `staff` | Quotations, customers |
| `driver` | Own jobs (mobile app) |
| `customer_portal` | Own jobs + invoices |
| `vendor_portal` | Assigned jobs + AP |

---

## Running Seeds Individually

```bash
# Roles + super admin only
python -m seeds.seed_roles

# Chart of Accounts for a specific company
python -m seeds.seed_coa --company_id 1
```

## Alembic Migrations

```bash
# Generate migration after model changes
alembic revision --autogenerate -m "describe your change"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```
