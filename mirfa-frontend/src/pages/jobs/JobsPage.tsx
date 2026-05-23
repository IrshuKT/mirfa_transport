import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye } from 'lucide-react'
import { jobsApi, customersApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  StatusBadge, PageHeader, SearchInput, Select, Modal,
  Input, Textarea, EmptyState, PageLoader,
} from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

export default function JobsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)


  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, search, statusFilter],
    queryFn: () => jobsApi.list({ page, page_size: 25, search, status: statusFilter || undefined }),
  })
  const jobs = data?.data

  return (
    <div className="space-y-5">
      <PageHeader title="Jobs" subtitle={jobs ? `${jobs.total} total jobs` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => navigate('/jobs/new')}>
          New Job
        </Button>}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={(v: string) => { setSearch(v); setPage(1) }} placeholder="Search job no..." />
            <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              options={[{ value: 'pending', label: 'Pending' }, { value: 'assigned', label: 'Assigned' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]}
              placeholder="All statuses" className="w-44" />
          </div>
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead><tr><Th>Job No.</Th><Th>Pickup</Th><Th>Delivery</Th><Th>Scheduled</Th><Th>Amount</Th><Th>Status</Th><Th> </Th></tr></thead>
            <tbody>
              {!jobs?.results?.length ? (
                <tr><td colSpan={7}><EmptyState title="No jobs found" description="Create your first job to get started." /></td></tr>
              ) : jobs.results.map((job: any) => (
                <tr key={job.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/jobs/${job.id}/view`)}>
                  <Td className="font-medium text-sky-700">{job.job_no}</Td>
                  <Td className="max-w-[150px] truncate text-xs">{job.pickup_address}</Td>
                  <Td className="max-w-[150px] truncate text-xs">{job.delivery_address}</Td>
                  <Td className="text-xs">{formatDate(job.scheduled_pickup_at)}</Td>
                  <Td>{job.agreed_amount ? formatCurrency(job.agreed_amount, job.currency) : '—'}</Td>
                  <Td><StatusBadge status={job.status} /></Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Eye size={14} />}
                        onClick={(e: any) => { e.stopPropagation(); navigate(`/jobs/${job.id}/view`) }}>
                        View
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={(e: any) => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}>
                        Edit
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {jobs && jobs.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {jobs.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= jobs.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

    </div>
  )
}


