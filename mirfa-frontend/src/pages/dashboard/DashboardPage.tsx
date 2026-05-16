import { useQuery } from '@tanstack/react-query'
import {
  Briefcase, Users, FileText, AlertTriangle,
  TrendingUp, Clock, CheckCircle, XCircle,
} from 'lucide-react'
import { jobsApi, customersApi, invoicesApi, documentsApi } from '@/api/services'
import { StatCard, Card, CardHeader, CardBody, PageLoader, StatusBadge } from '@/components/ui'
import { formatCurrency, formatDate, getUrgencyColor } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function DashboardPage() {
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

  // Build chart data from aging
  const agingChart = agingData ? [
    { name: 'Current',  amount: agingData.current },
    { name: '1-30 days', amount: agingData['1_30'] },
    { name: '31-60',   amount: agingData['31_60'] },
    { name: '61-90',   amount: agingData['61_90'] },
    { name: '90+ days', amount: agingData['over_90'] },
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
        <StatCard
          label="Total Jobs"
          value={jobStats?.total ?? 0}
          icon={<Briefcase size={20} />}
          color="sky"
        />
        <StatCard
          label="Customers"
          value={customers?.data?.total ?? 0}
          icon={<Users size={20} />}
          color="purple"
        />
        <StatCard
          label="Open Invoices"
          value={invoices?.data?.total ?? 0}
          icon={<FileText size={20} />}
          color="orange"
        />
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
                        <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{job.pickup_address} → {job.delivery_address}</p>
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
