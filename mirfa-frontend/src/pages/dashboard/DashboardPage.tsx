import { useQuery } from '@tanstack/react-query'
import {
  Briefcase, FileText, AlertTriangle,
  CheckCircle, Clock, Truck, PackageCheck,
} from 'lucide-react'
import { jobsApi, customersApi, invoicesApi, documentsApi, authApi } from '@/api/services'
import { StatCard, Card, CardHeader, CardBody, PageLoader, StatusBadge } from '@/components/ui'
import { formatCurrency, formatDate, getUrgencyColor } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Navigate } from 'react-router-dom'

export default function DashboardPage() {
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    select: r => r.data,
  })

  if (meLoading) return <PageLoader />

  if (me?.role === 'driver' || me?.role === 'staff') {
    return <Navigate to="/my-jobs" replace />
  }

  if (me?.role === 'customer_portal') {
    return <CustomerPortalDashboard me={me} />
  }

  return <AdminDashboard />
}

// ── Admin / Staff Dashboard ───────────────────────────────────────────────────
function AdminDashboard() {
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', 'dashboard'],
    queryFn: () => jobsApi.list({ page_size: 5 }),
  })

  const { data: customers } = useQuery({
    queryKey: ['customers', 'count'],
    queryFn: () => customersApi.list({ page_size: 1 }),
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', 'dashboard'],
    queryFn: () => invoicesApi.list({ page_size: 1 }),
  })

  const { data: aging } = useQuery({
    queryKey: ['invoices', 'aging'],
    queryFn: () => invoicesApi.aging(),
  })

  const { data: expiryData } = useQuery({
    queryKey: ['documents', 'expiry-dashboard'],
    queryFn: () => documentsApi.expiryDashboard(60),
  })

  const jobStats = jobs?.data
  const expiryDash = expiryData?.data
  const agingData = aging?.data

  const agingChart = agingData ? [
    { name: 'Current',   amount: agingData.current },
    { name: '1-30 days', amount: agingData['1_30'] },
    { name: '31-60',     amount: agingData['31_60'] },
    { name: '61-90',     amount: agingData['61_90'] },
    { name: '90+ days',  amount: agingData['over_90'] },
  ] : []

  if (jobsLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back — here's what's happening today.</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={jobStats?.total ?? 0} icon={<Briefcase size={20} />} color="sky" />
        <StatCard label="Customers" value={customers?.data?.total ?? 0} icon={<Briefcase size={20} />} color="purple" />
        <StatCard label="Open Invoices" value={invoices?.data?.total ?? 0} icon={<FileText size={20} />} color="orange" />
        <StatCard
          label="Doc Expiry Alerts"
          value={expiryDash?.summary?.total_expiring ?? 0}
          icon={<AlertTriangle size={20} />}
          color={expiryDash?.summary?.expired > 0 ? 'red' : 'orange'}
          sub={expiryDash?.summary?.expired > 0 ? `${expiryDash.summary.expired} already expired!` : 'Next 60 days'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Jobs */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Recent Jobs</h2>
                <a href="/jobs" className="text-xs text-sky-600 hover:underline">View all →</a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {jobStats?.results?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-10">No jobs yet</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {jobStats?.results?.map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{job.job_no}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                          {job.pickup_address} → {job.delivery_address}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {job.agreed_amount && (
                          <span className="text-sm font-medium text-slate-700">
                            {formatCurrency(job.agreed_amount, job.currency)}
                          </span>
                        )}
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Document Expiry Alerts */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Expiry Alerts</h2>
                <a href="/documents" className="text-xs text-sky-600 hover:underline">View all →</a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {expiryDash?.summary && (
                <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b border-slate-100">
                  {[
                    { label: 'Expired',  value: expiryDash.summary.expired,  color: 'text-red-600' },
                    { label: 'Critical', value: expiryDash.summary.critical, color: 'text-orange-600' },
                    { label: 'Warning',  value: expiryDash.summary.warning,  color: 'text-yellow-600' },
                    { label: 'Notice',   value: expiryDash.summary.notice,   color: 'text-blue-600' },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {Object.entries(expiryDash?.by_entity_type ?? {}).flatMap(([, docs]: [string, any]) =>
                  (docs as any[]).slice(0, 3).map((doc: any) => (
                    <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-800 capitalize">
                          {doc.entity_type} #{doc.entity_id}
                        </p>
                        <p className="text-xs text-slate-500">{doc.doc_type.replace(/_/g, ' ')}</p>
                      </div>
                      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${getUrgencyColor(doc.days_remaining)}`}>
                        {doc.days_remaining < 0 ? 'Expired' : `${doc.days_remaining}d`}
                      </span>
                    </div>
                  ))
                )}
                {Object.keys(expiryDash?.by_entity_type ?? {}).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <CheckCircle size={24} className="text-green-500" />
                    <p className="text-xs text-slate-500">All documents up to date!</p>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* AR Aging Chart */}
      {agingChart.length > 0 && agingChart.some(d => d.amount > 0) && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-800">AR Aging (AED)</h2>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingChart} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: number) => [`AED ${v.toLocaleString()}`, 'Amount']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

// ── Customer Portal Dashboard ─────────────────────────────────────────────────
function CustomerPortalDashboard({ me }: { me: any }) {
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['portal-jobs'],
    queryFn: () => jobsApi.list({ page_size: 50 }), // backend filters by customer automatically
  })

  const { data: invoicesData } = useQuery({
    queryKey: ['portal-invoices'],
    queryFn: () => invoicesApi.list({ page_size: 50 }),
  })

  const jobs: any[] = jobsData?.data?.results ?? []
  const invoices: any[] = invoicesData?.data?.results ?? []

  // compute job status counts
  const statusCounts = jobs.reduce((acc: any, job: any) => {
    acc[job.status] = (acc[job.status] || 0) + 1
    return acc
  }, {})

  const totalJobs     = jobs.length
  const activeJobs    = (statusCounts['assigned'] ?? 0) + (statusCounts['in_progress'] ?? 0) + (statusCounts['picked_up'] ?? 0)
  const completedJobs = statusCounts['delivered'] ?? statusCounts['completed'] ?? 0
  const pendingJobs   = statusCounts['pending'] ?? statusCounts['new'] ?? 0

  const unpaidInvoices  = invoices.filter((i: any) => i.status === 'unpaid' || i.status === 'overdue')
  const totalOutstanding = unpaidInvoices.reduce((s: number, i: any) => s + (i.balance_due ?? i.total_amount ?? 0), 0)

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          Welcome, {me?.full_name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Here's a summary of your shipments and account.</p>
      </div>

      {/* KPI Stats — portal relevant only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Jobs"
          value={totalJobs}
          icon={<Briefcase size={20} />}
          color="sky"
        />
        <StatCard
          label="Active / In Transit"
          value={activeJobs}
          icon={<Truck size={20} />}
          color="purple"
        />
        <StatCard
          label="Completed"
          value={completedJobs}
          icon={<PackageCheck size={20} />}
          color="green"
        />
        <StatCard
          label="Outstanding (AED)"
          value={totalOutstanding > 0 ? `${totalOutstanding.toLocaleString()}` : '0'}
          icon={<FileText size={20} />}
          color={totalOutstanding > 0 ? 'orange' : 'sky'}
          sub={unpaidInvoices.length > 0 ? `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length > 1 ? 's' : ''}` : 'All clear'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Jobs */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">My Shipments</h2>
                <a href="/jobs" className="text-xs text-sky-600 hover:underline">View all →</a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Truck size={28} className="text-slate-300" />
                  <p className="text-sm text-slate-500">No shipments yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {jobs.slice(0, 8).map((job: any) => (
                    <div key={job.id} className="flex items-center justify-between px-6 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{job.job_no}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                          {job.pickup_address} → {job.delivery_address}
                        </p>
                        {job.scheduled_date && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            <Clock size={10} className="inline mr-1" />
                            {formatDate(job.scheduled_date)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {job.agreed_amount && (
                          <span className="text-sm font-medium text-slate-700">
                            {formatCurrency(job.agreed_amount, job.currency)}
                          </span>
                        )}
                        <StatusBadge status={job.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Unpaid Invoices */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Unpaid Invoices</h2>
                <a href="/invoices" className="text-xs text-sky-600 hover:underline">View all →</a>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              {unpaidInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <CheckCircle size={24} className="text-green-500" />
                  <p className="text-xs text-slate-500">No outstanding invoices</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {unpaidInvoices.slice(0, 6).map((inv: any) => (
                    <div key={inv.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{inv.invoice_no}</p>
                        <p className="text-xs text-slate-500">{formatDate(inv.due_date ?? inv.invoice_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-800">
                          AED {(inv.balance_due ?? inv.total_amount ?? 0).toLocaleString()}
                        </p>
                        <span className={`text-xs font-medium ${inv.status === 'overdue' ? 'text-red-500' : 'text-orange-500'}`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}