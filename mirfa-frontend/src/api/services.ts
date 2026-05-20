import api from './client'
import type {
  TokenResponse, User, Company, Customer, Vendor, Job, Quotation,
  Employee, Driver, Vehicle, Invoice, Bank, Account, EntityDocument, Paginated
} from '@/types'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string, totp_code?: string) =>
    api.post<TokenResponse>('/auth/login', { email, password, totp_code }),
  refresh: (refresh_token: string) =>
    api.post<TokenResponse>('/auth/refresh', { refresh_token }),
  logout: (refresh_token: string) =>
    api.post('/auth/logout', { refresh_token }),
  me: () => api.get<User>('/auth/me'),
  changePassword: (current_password: string, new_password: string, confirm_password: string) =>
    api.post('/auth/password/change', { current_password, new_password, confirm_password }),
  setupTotp: () => api.post<{ secret: string; uri: string }>('/auth/totp/setup'),
  confirmTotp: (code: string) => api.post('/auth/totp/confirm', { code }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<User>>('/users', { params }),
  create: (data: any) => api.post<User>('/users', data),
  get: (id: number) => api.get<User>(`/users/${id}`),
  update: (id: number, data: any) => api.patch<User>(`/users/${id}`, data),
  deactivate: (id: number) => api.delete(`/users/${id}`),
}

// ── Companies ─────────────────────────────────────────────────────────────────
export const companiesApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<Company>>('/companies', { params }),
  get: (id: number) => api.get<Company>(`/companies/${id}`),
  getMyCompany: () => api.get<Company>('/companies/me'),
  create: (data: any) => api.post<Company>('/companies', data),
  update: (id: number, data: any) => api.patch<Company>(`/companies/${id}`, data),
}

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<Customer>>('/customers', { params }),
  get: (id: number) => api.get<Customer>(`/customers/${id}`),
  create: (data: any) => api.post<Customer>('/customers', data),
  update: (id: number, data: any) => api.patch<Customer>(`/customers/${id}`, data),
  deactivate: (id: number) => api.delete(`/customers/${id}`),
  addContact: (customerId: number, data: any) =>
    api.post(`/customers/${customerId}/contacts`, data),
  deleteContact: (customerId: number, contactId: number) =>
    api.delete(`/customers/${customerId}/contacts/${contactId}`),
}

// ── Vendors ───────────────────────────────────────────────────────────────────
export const vendorsApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<Vendor>>('/vendors', { params }),
  get: (id: number) => api.get<Vendor>(`/vendors/${id}`),
  create: (data: any) => api.post<Vendor>('/vendors', data),
  update: (id: number, data: any) => api.patch<Vendor>(`/vendors/${id}`, data),
  deactivate: (id: number) => api.delete(`/vendors/${id}`),
}

// ── Jobs ──────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<Job>>('/jobs', { params }),
  get: (id: number) => api.get<Job>(`/jobs/${id}`),
  create: (data: any) => api.post<Job>('/jobs', data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/jobs/${id}/status`, null, { params: { new_status: status } }),
  dispatch: (id: number, data: { driver_id: number; vehicle_id?: number }) =>
    api.post(`/jobs/${id}/dispatch`, data),
  track: (token: string) => api.get(`/jobs/track/${token}`),
  locationPing: (data: any) => api.post('/jobs/location/ping', data),
}

// ── Quotations ────────────────────────────────────────────────────────────────
export const quotationsApi = {
  list: (params?: Record<string, any>) =>
    api.get<Paginated<Quotation>>('/quotations', { params }),
  get: (id: number) => api.get<Quotation>(`/quotations/${id}`),
  create: (data: any) => api.post<Quotation>('/quotations', data),
  update: (id: number, data: any) => api.patch<Quotation>(`/quotations/${id}`, data),
  send: (id: number) => api.post(`/quotations/${id}/send`),
  accept: (id: number, name: string, email: string) =>
    api.post(`/quotations/${id}/accept`, null, {
      params: { accepted_by_name: name, accepted_by_email: email },
    }),
  convertToJob: (id: number) => api.post(`/quotations/${id}/convert-to-job`),
}

// ── Employees ─────────────────────────────────────────────────────────────────
export const employeesApi = {
  list: (params?: Record<string, any>) =>
    api.get<Paginated<Employee>>('/employees', { params }),
  get: (id: number) => api.get<Employee>(`/employees/${id}`),
  create: (data: any) => api.post<Employee>('/employees', data),
  update: (id: number, data: any) => api.patch<Employee>(`/employees/${id}`, data),
  expiryAlerts: (days_ahead = 30) =>
    api.get<Employee[]>('/employees/expiry-alerts', { params: { days_ahead } }),
}

// ── Drivers ───────────────────────────────────────────────────────────────────
export const driversApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<Driver>>('/drivers', { params }),
  available: () => api.get<Driver[]>('/drivers/available'),
  get: (id: number) => api.get<Driver>(`/drivers/${id}`),
  create: (data: any) => api.post<Driver>('/drivers', data),
  update: (id: number, data: any) => api.patch<Driver>(`/drivers/${id}`, data),
  setAvailability: (id: number, availability: string) =>
    api.patch(`/drivers/${id}/availability`, null, { params: { availability } }),
  getLocation: (id: number) => api.get(`/drivers/${id}/location`),
}

// ── Fleet ─────────────────────────────────────────────────────────────────────
export const fleetApi = {
  list: (params?: Record<string, any>) => api.get<Paginated<Vehicle>>('/fleet', { params }),
  get: (id: number) => api.get<Vehicle>(`/fleet/${id}`),
  create: (data: any) => api.post<Vehicle>('/fleet', data),
  update: (id: number, data: any) => api.patch<Vehicle>(`/fleet/${id}`, data),
  expiryAlerts: (days_ahead = 30) =>
    api.get('/fleet/expiry-alerts', { params: { days_ahead } }),
  listMaintenance: (id: number) => api.get(`/fleet/${id}/maintenance`),
  addMaintenance: (id: number, data: any) => api.post(`/fleet/${id}/maintenance`, data),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentsApi = {
  list: (params?: Record<string, any>) =>
    api.get<Paginated<EntityDocument>>('/documents', { params }),
  expiryDashboard: (days_ahead = 60) =>
    api.get('/documents/expiry-dashboard', { params: { days_ahead } }),
  upload: (formData: FormData) =>
    api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => api.delete(`/documents/${id}`),
}

// ── Accounting ────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: Record<string, any>) =>
    api.get<Paginated<Invoice>>('/accounting/invoices', { params }),
  get: (id: number) => api.get<Invoice>(`/accounting/invoices/${id}`),
  create: (data: any) => api.post<Invoice>('/accounting/invoices', data),
  send: (id: number) => api.post(`/accounting/invoices/${id}/send`),
  cancel: (id: number) => api.post(`/accounting/invoices/${id}/cancel`),
  aging: () => api.get('/accounting/invoices/aging'),
}

export const receiptsApi = {
  list: (params?: Record<string, any>) =>
    api.get('/accounting/receipts', { params }),
  create: (data: any) => api.post('/accounting/receipts', data),
}

export const paymentsApi = {
  list: (params?: Record<string, any>) =>
    api.get('/accounting/payments', { params }),
  create: (data: any) => api.post('/accounting/payments', data),
}

export const journalsApi = {
  list: (params?: Record<string, any>) =>
    api.get('/accounting/journals', { params }),
  create: (data: any) => api.post('/accounting/journals', data),
  reverse: (id: number) => api.post(`/accounting/journals/${id}/reverse`),
}

export const banksApi = {
  list: () => api.get<Bank[]>('/accounting/banks'),
  create: (data: any) => api.post<Bank>('/accounting/banks', data),
  update: (id: number, data: any) => api.patch<Bank>(`/accounting/banks/${id}`, data),
}

export const coaApi = {
  list: (params?: Record<string, any>) =>
    api.get<Account[]>('/accounting/coa', { params }),
  tree: () => api.get<Account[]>('/accounting/coa/tree'),
  create: (data: any) => api.post<Account>('/accounting/coa', data),
}

export const reportsApi = {
  trialBalance: (date_from: string, date_to: string) =>
    api.get('/accounting/reports/trial-balance', { params: { date_from, date_to } }),
  profitLoss: (date_from: string, date_to: string) =>
    api.get('/accounting/reports/profit-loss', { params: { date_from, date_to } }),
  balanceSheet: (as_of_date: string) =>
    api.get('/accounting/reports/balance-sheet', { params: { as_of_date } }),
  vatReturn: (date_from: string, date_to: string) =>
    api.get('/accounting/reports/vat-return', { params: { date_from, date_to } }),
  ledger: (account_id: number, date_from: string, date_to: string) =>
    api.get('/accounting/reports/ledger', { params: { account_id, date_from, date_to } }),
}

export const rolesApi = {
  list: () => api.get<{ id: number; name: string; description: string }[]>('/users/roles'),
}

// ── Invitations ───────────────────────────────────────────────────────────────
export const inviteApi = {
  // Super admin registers company + admin
  registerCompany: (data: any) =>
    api.post('/companies/register', data),

  // Admin invites staff user by role name
  inviteUser: (data: {
    full_name: string
    email: string
    phone?: string
    role_name: string
    send_welcome_email?: boolean
  }) => api.post('/users/invite', data),

  // Create customer portal login
  createCustomerPortal: (customer_id: number, send_email = true) =>
    api.post(`/customers/${customer_id}/create-portal-user`, null, {
      params: { send_email },
    }),

  // Create vendor portal login
  createVendorPortal: (vendor_id: number, send_email = true) =>
    api.post(`/vendors/${vendor_id}/create-portal-user`, null, {
      params: { send_email },
    }),
}
