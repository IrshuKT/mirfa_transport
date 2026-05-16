# Mirfa Transport — React Frontend

React 18 + TypeScript + Vite + TailwindCSS + React Query + Zustand

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev        # http://localhost:3000
```

## Features
- Role-aware sidebar (super_admin, company_admin, accountant, dispatcher, staff, driver, portals)
- Dashboard with KPIs, AR aging chart, document expiry panel
- Jobs — full lifecycle with dispatch, GPS tracking, POD
- Quotations — line items, VAT, convert to job
- Customers & Vendors — full CRUD with contacts
- Employees & Fleet — UAE compliance doc expiry highlighting
- Drivers — availability, live location
- Document Expiry Dashboard — central expiry tracker with urgency levels
- Accounting — Invoices (auto double-entry), Receipts, Vendor Payments, Journal Entries (with reversal), Banks, Chart of Accounts, Reports (Trial Balance, P&L, Balance Sheet, UAE FTA VAT Return)

## API
Proxied to `http://localhost:8000` in dev (see `vite.config.ts`).
Backend: see `/logistics-backend` folder.
