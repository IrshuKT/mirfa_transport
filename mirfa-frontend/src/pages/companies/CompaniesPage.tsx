import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Building2, CheckCircle, XCircle, Copy } from 'lucide-react'
import { companiesApi, inviteApi } from '@/api/services'
import { useAuthStore } from '@/stores/authStore'
import {
  Button, Card, CardBody, CardHeader, PageHeader,
  Table, Th, Td, Badge, Modal, Input, PageLoader, EmptyState,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import api from '@/api/client'

// ── Register Company Modal ────────────────────────────────────────────────────
interface RegisterForm {
  company_name: string
  trade_license_no: string
  trn: string
  city: string
  address: string
  phone: string
  company_email: string
  vat_rate: number
  currency: string
  admin_full_name: string
  admin_email: string
  admin_phone: string
  send_welcome_email: boolean
}

export default function CompaniesPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [showRegister, setShowRegister] = useState(false)
  const [createdResult, setCreatedResult] = useState<any>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page],
    queryFn: () => companiesApi.list({ page, page_size: 25 }),
    enabled: user?.role === 'super_admin',
  })

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const token = JSON.parse(localStorage.getItem('mirfa-auth') || '{}')?.state?.accessToken || ''
      const res = await fetch(`/api/v1/companies/${id}/toggle-active`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['companies'] }); toast.success('Updated') },
    onError: () => toast.error('Failed to update company status'),
  })

  const companies = data?.data

  if (user?.role !== 'super_admin') {
    return <MyCompanyProfile />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Companies"
        subtitle={companies ? `${companies.total} registered companies` : undefined}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setShowRegister(true)}>
            Register Company
          </Button>
        }
      />

      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Company</Th><Th>City</Th><Th>TRN</Th>
                <Th>Currency</Th><Th>VAT</Th><Th>Registered</Th>
                <Th>Status</Th><Th> </Th>
              </tr>
            </thead>
            <tbody>
              {!companies?.results?.length ? (
                <tr><td colSpan={8}>
                  <EmptyState
                    title="No companies registered yet"
                    description="Register your first company to get started."
                    action={
                      <Button icon={<Plus size={16} />} onClick={() => setShowRegister(true)}>
                        Register Company
                      </Button>
                    }
                  />
                </td></tr>
              ) : companies.results.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                        <Building2 size={16} className="text-sky-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{c.name}</p>
                        {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td>{c.city}</Td>
                  <Td className="text-xs font-mono">{c.trn || '—'}</Td>
                  <Td>{c.currency}</Td>
                  <Td>{(c.vat_rate * 100).toFixed(0)}%</Td>
                  <Td className="text-xs">{formatDate(c.created_at)}</Td>
                  <Td>
                    <Badge className={c.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'}>
                      {c.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      size="sm" variant="ghost"
                      icon={c.is_active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                      className={c.is_active
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-green-600 hover:bg-green-50'}
                      loading={toggleMutation.isPending}
                      onClick={() => {
                        if (confirm(`${c.is_active ? 'Suspend' : 'Activate'} ${c.name}?`)) {
                          toggleMutation.mutate(c.id)
                        }
                      }}>
                      {c.is_active ? 'Suspend' : 'Activate'}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {companies && companies.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {companies.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= companies.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <RegisterCompanyModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        onSuccess={(result: any) => { setShowRegister(false); setCreatedResult(result) }}
      />

      {createdResult && (
        <SuccessModal result={createdResult} onClose={() => setCreatedResult(null)} />
      )}
    </div>
  )
}

// ── Register Company Modal ────────────────────────────────────────────────────
function RegisterCompanyModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: (r: any) => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<RegisterForm>({
    defaultValues: {
      city: 'Dubai', vat_rate: 0.05, currency: 'AED', send_welcome_email: true,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: RegisterForm) => inviteApi.registerCompany({
      company_name:       data.company_name,
      trade_license_no:   data.trade_license_no || undefined,
      trn:                data.trn || undefined,
      address:            data.address || undefined,
      city:               data.city,
      phone:              data.phone || undefined,
      company_email:      data.company_email || undefined,
      vat_rate:           Number(data.vat_rate),
      currency:           data.currency,
      admin_full_name:    data.admin_full_name,
      admin_email:        data.admin_email,
      admin_phone:        data.admin_phone || undefined,
      send_welcome_email: data.send_welcome_email,
    }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      toast.success(`Company "${res.data.company_name}" registered!`)
      reset()
      onSuccess(res.data)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed to register company'),
  })

  return (
    <Modal open={open} onClose={onClose} title="Register New Company" size="lg">
      <form onSubmit={handleSubmit((d: RegisterForm) => mutation.mutate(d))} className="space-y-5">

        {/* Company section */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Company Details
          </p>
          <div className="space-y-3">
            <Input label="Company Name *" placeholder="Mirfa Logistics LLC"
              {...register('company_name', { required: true })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Trade License No." placeholder="DED-12345"
                {...register('trade_license_no')} />
              <Input label="TRN (UAE VAT)" placeholder="100XXXXXXXXX00003"
                {...register('trn')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" placeholder="Dubai" {...register('city')} />
              <Input label="Phone" placeholder="+971 4 000 0000" {...register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Company Email" type="email" placeholder="info@company.ae"
                {...register('company_email')} />
              <Input label="VAT Rate" type="number" step="0.01" placeholder="0.05"
                {...register('vat_rate')} />
            </div>
            <Input label="Address" placeholder="P.O. Box 12345, Dubai, UAE"
              {...register('address')} />
          </div>
        </div>

        {/* Admin section */}
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Company Admin User
          </p>
          <div className="space-y-3">
            <Input label="Admin Full Name *" placeholder="Ahmed Al Rashidi"
              {...register('admin_full_name', { required: true })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Admin Email *" type="email" placeholder="admin@company.ae"
                {...register('admin_email', { required: true })} />
              <Input label="Admin Phone" placeholder="+971 50 000 0000"
                {...register('admin_phone')} />
            </div>
          </div>
        </div>

        {/* Email toggle */}
        <div className="bg-sky-50 rounded-lg p-3 flex items-start gap-3">
          <input type="checkbox" id="send_welcome" className="mt-0.5 rounded"
            {...register('send_welcome_email')} />
          <div>
            <label htmlFor="send_welcome" className="text-sm font-medium text-slate-700 cursor-pointer">
              Send welcome email to admin
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Credentials will also be shown on screen after creation.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Plus size={15} />}>
            Register Company
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Success Modal ─────────────────────────────────────────────────────────────
function SuccessModal({ result, onClose }: { result: any; onClose: () => void }) {
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  return (
    <Modal open={true} onClose={onClose} title="✅ Company Registered Successfully" size="md">
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-green-800">
          <p className="font-semibold text-base">{result.company_name}</p>
          <p className="mt-1 text-green-600 text-xs">
            {result.email_sent
              ? '📧 Welcome email sent to admin successfully.'
              : '⚠️ Email not sent — share credentials manually below.'}
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Admin Login Credentials
          </p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{result.admin_email}</p>
            </div>
            <Button size="sm" variant="ghost" icon={<Copy size={13} />}
              onClick={() => copy(result.admin_email)}>
              Copy
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <div>
              <p className="text-xs text-slate-500">Temporary Password</p>
              <p className="font-mono text-xl font-bold text-slate-900 tracking-widest mt-1">
                {result.temp_password}
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={<Copy size={13} />}
              onClick={() => copy(result.temp_password)}>
              Copy
            </Button>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-800">
          ⚠️ <strong>Save this password now</strong> — it will not be shown again.
          The admin must change it on first login.
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Company ID: {result.company_id} · User ID: {result.admin_user_id}
          </p>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── My Company Profile (non super-admin) ──────────────────────────────────────
function MyCompanyProfile() {
  const { data, isLoading } = useQuery({
    queryKey: ['company', 'me'],
    queryFn: () => companiesApi.getMyCompany(),
  })
  const company = data?.data
  if (isLoading) return <PageLoader />
  if (!company) return null

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Company Profile" />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-100 flex items-center justify-center">
              <Building2 size={20} className="text-sky-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900">{company.name}</p>
              <Badge className="bg-green-100 text-green-700 text-xs mt-0.5">Active</Badge>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-5">
            {[
              ['Trade License', company.trade_license_no || '—'],
              ['TRN (UAE VAT)',  company.trn || '—'],
              ['City',           company.city],
              ['Country',        company.country],
              ['Phone',          company.phone || '—'],
              ['Email',          company.email || '—'],
              ['Currency',       company.currency],
              ['VAT Rate',       `${(company.vat_rate * 100).toFixed(0)}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="font-medium text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
