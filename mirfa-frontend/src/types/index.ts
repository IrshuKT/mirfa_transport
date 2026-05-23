// ── Auth ──────────────────────────────────────────────────────────────────────
export type Role =
  | 'super_admin' | 'company_admin' | 'accountant'
  | 'dispatcher'  | 'staff'         | 'driver'
  | 'customer_portal' | 'vendor_portal'

export interface User {
  id: number
  email: string
  full_name: string
  phone?: string
  role: Role
  company_id?: number
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  totp_enabled: boolean
  last_login_at?: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user_id: number
  role: Role
  company_id?: number
  totp_required?: boolean
  force_password_change?: boolean
}

// ── Company ───────────────────────────────────────────────────────────────────
export interface Company {
  id: number
  name: string
  trade_license_no?: string
  trn?: string
  address?: string
  city: string
  country: string
  phone?: string
  email?: string
  logo_url?: string
  is_active: boolean
  currency: string
  vat_rate: number
  created_at: string
}

// ── Customer ──────────────────────────────────────────────────────────────────
export interface CustomerContact {
  id: number
  name: string
  designation?: string
  email?: string
  phone?: string
  is_primary: boolean
}

export interface Customer {
  id: number
  name: string
  code?: string
  customer_type: 'individual' | 'corporate' | 'government'
  trn?: string
  email?: string
  phone?: string
  mobile?: string
  address?: string
  city?: string
  country: string
  credit_limit?: number
  credit_days: number
  currency: string
  is_active: boolean
  notes?: string
  contacts: CustomerContact[]
  created_at: string
}

// ── Vendor ────────────────────────────────────────────────────────────────────
export interface Vendor {
  id: number
  name: string
  code?: string
  vendor_type: 'subcontractor' | 'supplier' | 'both'
  trn?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country: string
  payment_terms_days: number
  currency: string
  is_active: boolean
  notes?: string
  created_at: string
}

// ── Job ───────────────────────────────────────────────────────────────────────
export type JobStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent'
export type DispatchStatus =
  | 'assigned' | 'accepted' | 'rejected' | 'en_route'
  | 'at_pickup' | 'loaded' | 'at_delivery' | 'delivered' | 'failed'

export interface Job {
  id: number
  job_no: string
  status: JobStatus
  priority: JobPriority
  customer_id: number
  pickup_address: string
  delivery_address: string
  pickup_lat?: number
  pickup_lng?: number
  delivery_lat?: number
  delivery_lng?: number
  scheduled_pickup_at?: string
  scheduled_delivery_at?: string
  actual_pickup_at?: string
  actual_delivery_at?: string
  agreed_amount?: number
  currency: string
  is_invoiced: boolean
  tracking_token?: string
  notes?: string
  created_at: string
  updated_at: string
  assigned_to_id?: number
}

// ── Quotation ─────────────────────────────────────────────────────────────────
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted'

export interface QuotationLineItem {
  id: number
  description: string
  quantity: number
  unit?: string
  unit_price: number
  discount_pct: number
  vat_pct: number
  line_total: number
}

export interface Quotation {
  id: number
  quote_no: string
  status: QuotationStatus
  customer_id: number
  currency: string
  subtotal: number
  discount_amount: number
  vat_amount: number
  total_amount: number
  valid_until?: string
  notes?: string
  terms?: string
  accepted_at?: string
  accepted_by_name?: string
  converted_to_job_id?: number
  line_items: QuotationLineItem[]
  created_at: string
}

// ── Employee ──────────────────────────────────────────────────────────────────
export interface Employee {
  id: number
  employee_no: string
  full_name: string
  designation?: string
  department?: string
  email?: string
  phone?: string
  mobile?: string
  nationality?: string
  join_date?: string
  end_date?: string
  status: 'active' | 'on_leave' | 'terminated' | 'probation'
  basic_salary?: number
  currency: string
  emirates_id?: string
  emirates_id_expiry?: string
  visa_no?: string
  visa_expiry?: string
  passport_no?: string
  passport_expiry?: string
  labour_card_no?: string
  labour_card_expiry?: string
  notes?: string
  created_at: string
}

// ── Driver ────────────────────────────────────────────────────────────────────
export interface Driver {
  id: number
  driver_code: string
  full_name: string
  mobile: string
  user_id: number
  employee_id?: number
  license_no?: string
  license_expiry?: string
  license_type?: string
  availability: 'available' | 'on_job' | 'off_duty' | 'on_leave'
  is_active: boolean
  current_lat?: number
  current_lng?: number
  last_ping_at?: string
  notes?: string
  created_at: string
}

// ── Vehicle ───────────────────────────────────────────────────────────────────
export interface Vehicle {
  id: number
  plate_no: string
  fleet_no?: string
  make?: string
  model?: string
  year?: number
  vehicle_type?: string
  payload_tons?: number
  status: 'active' | 'in_maintenance' | 'retired'
  mulkiya_expiry?: string
  insurance_expiry?: string
  insurance_policy_no?: string
  rta_permit_expiry?: string
  notes?: string
  created_at: string
}

// ── Accounting ────────────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'credit_note'

export interface InvoiceLineItem {
  id: number
  description: string
  quantity: number
  unit?: string
  unit_price: number
  discount_pct: number
  vat_pct: number
  vat_amount: number
  line_total: number
}

export interface Invoice {
  id: number
  invoice_no: string
  status: InvoiceStatus
  customer_id: number
  job_id?: number
  invoice_date: string
  due_date: string
  customer_trn?: string
  subtotal: number
  discount_amount: number
  taxable_amount: number
  vat_amount: number
  total_amount: number
  paid_amount: number
  balance_due: number
  currency: string
  notes?: string
  terms?: string
  sent_at?: string
  line_items: InvoiceLineItem[]
  created_at: string
}

export interface Bank {
  id: number
  bank_name: string
  account_name: string
  account_no: string
  iban?: string
  swift_code?: string
  branch?: string
  currency: string
  is_default: boolean
  is_active: boolean
  current_balance: number
  account_id?: number
}

export interface Account {
  id: number
  code: string
  name: string
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  parent_id?: number
  is_control: boolean
  is_active: boolean
  description?: string
  children?: Account[]
}

// ── Documents ─────────────────────────────────────────────────────────────────
export interface EntityDocument {
  id: number
  entity_type: string
  entity_id: number
  doc_type: string
  doc_no?: string
  file_name: string
  file_url: string
  issued_date?: string
  expiry_date?: string
  alert_days_before: number
  notes?: string
  created_at: string
  days_remaining?: number
  urgency?: 'expired' | 'critical' | 'warning' | 'notice'
}

// ── Pagination ────────────────────────────────────────────────────────────────
export interface Paginated<T> {
  total: number
  page: number
  page_size: number
  pages: number
  results: T[]
}
