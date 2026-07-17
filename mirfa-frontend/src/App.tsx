import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'

import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import JobsPage from '@/pages/jobs/JobsPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import QuotationsPage from '@/pages/quotations/QuotationsPage'
import DocumentsPage from '@/pages/documents/DocumentsPage'
import InvoicesPage from '@/pages/accounting/InvoicesPage'
import ReceiptsPage from '@/pages/accounting/ReceiptsPage'
import PaymentsPage from '@/pages/accounting/PaymentsPage'
import JournalsPage from '@/pages/accounting/JournalsPage'
import BanksPage from '@/pages/accounting/BanksPage'
import CoaPage from '@/pages/accounting/CoaPage'
import ReportsPage from '@/pages/accounting/ReportsPage'
import { VendorsPage, EmployeesPage, FleetPage } from '@/pages/other/OtherPages'
import DriversPage from '@/pages/drivers/DriversPage'
import CompaniesPage from '@/pages/companies/CompaniesPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage'
import CustomerFormPage from '@/pages/customers/CustomerFormPage'
import JobFormPage from '@/pages/jobs/JobFormPage'
import { JobDetailPage } from './pages/jobs/JobDetailPage'
import MyJobsPage from '@/pages/jobs/MyJobsPage'
import MyJobDetailPage from '@/pages/jobs/MyJobDetailPage'
import InvoiceDetailPage from '@/pages/accounting/InvoiceDetailPage'
import CashBookPage from '@/pages/accounting/CashBookPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontSize: '14px', borderRadius: '10px' } }} />
        <Routes>
          <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="/my-jobs" element={<RequireAuth><MyJobsPage /></RequireAuth>} />
          <Route path="/my-jobs/:id/view" element={<RequireAuth><MyJobDetailPage /></RequireAuth>} />

          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/jobs"       element={<JobsPage />} />
            <Route path="/jobs/new"      element={<JobFormPage />} />
            <Route path="/jobs/:id"      element={<JobFormPage />} />
            <Route path="/jobs/:id/view" element={<JobDetailPage />} />
            <Route path="/quotations" element={<QuotationsPage />} />
            <Route path="/customers"  element={<CustomersPage />} />
            <Route path="/customers/new"  element={<CustomerFormPage />} />
            <Route path="/customers/:id/edit" element={<CustomerFormPage />} /> 
            <Route path="/vendors"    element={<VendorsPage />} />
            <Route path="/employees"  element={<EmployeesPage />} />
            <Route path="/fleet"      element={<FleetPage />} />
            <Route path="/drivers"    element={<DriversPage />} />
            <Route path="/documents"  element={<DocumentsPage />} />
            <Route path="/accounting/invoices" element={<InvoicesPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="/accounting/receipts" element={<ReceiptsPage />} />
            <Route path="/accounting/payments" element={<PaymentsPage />} />
            <Route path="/accounting/journals" element={<JournalsPage />} />
            <Route path="/accounting/cash-book" element={<CashBookPage />} />
            <Route path="/accounting/banks"    element={<BanksPage />} />
            <Route path="/accounting/coa"      element={<CoaPage />} />
            <Route path="/accounting/reports"  element={<ReportsPage />} />
            <Route path="/companies"  element={<CompaniesPage />} />
            <Route path="/settings"   element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
