import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Upload } from 'lucide-react'
import { documentsApi } from '@/api/services'
import {
  Button, Card, CardHeader, CardBody,
  PageHeader, PageLoader, Badge,
} from '@/components/ui'
import { formatDate, getUrgencyColor } from '@/lib/utils'

export default function DocumentsPage() {
  const [daysAhead, setDaysAhead] = useState(60)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', 'expiry', daysAhead],
    queryFn: () => documentsApi.expiryDashboard(daysAhead),
  })

  const dash = data?.data

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Document Expiry Dashboard"
        subtitle="Track all compliance documents across employees, vehicles and company"
        actions={
          <div className="flex items-center gap-3">
            <select
              value={daysAhead}
              onChange={e => setDaysAhead(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value={30}>Next 30 days</option>
              <option value={60}>Next 60 days</option>
              <option value={90}>Next 90 days</option>
              <option value={180}>Next 180 days</option>
            </select>
            <Button icon={<Upload size={16} />} variant="outline" onClick={() => {}}>
              Upload Document
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      {dash?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Expired',  value: dash.summary.expired,  bg: 'bg-red-50',    text: 'text-red-700',    icon: '🚨' },
            { label: 'Critical (≤7d)', value: dash.summary.critical, bg: 'bg-orange-50', text: 'text-orange-700', icon: '⚠️' },
            { label: 'Warning (≤30d)', value: dash.summary.warning,  bg: 'bg-yellow-50', text: 'text-yellow-700', icon: '⏰' },
            { label: 'Notice',   value: dash.summary.notice,   bg: 'bg-blue-50',   text: 'text-blue-700',   icon: '📋' },
          ].map(s => (
            <Card key={s.label} className={`p-5 ${s.bg}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-3xl font-bold ${s.text}`}>{s.value}</p>
                  <p className="text-sm text-slate-600 mt-1">{s.label}</p>
                </div>
                <span className="text-2xl">{s.icon}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* All Clear */}
      {dash?.summary?.total_expiring === 0 && (
        <Card className="p-10 text-center">
          <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-slate-700">All documents are up to date!</p>
          <p className="text-sm text-slate-500 mt-1">No documents expiring in the next {daysAhead} days.</p>
        </Card>
      )}

      {/* Grouped by entity type */}
      {Object.entries(dash?.by_entity_type ?? {}).map(([entityType, docs]: [string, any]) => (
        <Card key={entityType}>
          <CardHeader>
            <h2 className="font-semibold text-slate-800 capitalize">
              {entityType.replace(/_/g, ' ')} Documents
              <Badge className="ml-2 bg-slate-100 text-slate-600">{docs.length}</Badge>
            </h2>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    doc.urgency === 'expired'  ? 'bg-red-500' :
                    doc.urgency === 'critical' ? 'bg-orange-500' :
                    doc.urgency === 'warning'  ? 'bg-yellow-500' : 'bg-blue-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">
                      {doc.doc_type.replace(/_/g, ' ')}
                      {doc.doc_no && <span className="text-slate-400 ml-1">#{doc.doc_no}</span>}
                    </p>
                    <p className="text-xs text-slate-500">
                      Entity #{doc.entity_id} · Expires {formatDate(doc.expiry_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold rounded-full px-3 py-1 ${getUrgencyColor(doc.days_remaining)}`}>
                    {doc.days_remaining < 0
                      ? `Expired ${Math.abs(doc.days_remaining)}d ago`
                      : `${doc.days_remaining} days left`
                    }
                  </span>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-600 hover:underline"
                  >
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
