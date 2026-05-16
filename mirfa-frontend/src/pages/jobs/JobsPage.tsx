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
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['jobs', page, search, statusFilter],
    queryFn: () => jobsApi.list({ page, page_size: 25, search, status: statusFilter || undefined }),
  })
  const jobs = data?.data

  return (
    <div className="space-y-5">
      <PageHeader title="Jobs" subtitle={jobs ? `${jobs.total} total jobs` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Job</Button>}
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={search} onChange={(v: string) => { setSearch(v); setPage(1) }} placeholder="Search job no..." />
            <Select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
              options={[{value:'pending',label:'Pending'},{value:'assigned',label:'Assigned'},{value:'in_progress',label:'In Progress'},{value:'completed',label:'Completed'},{value:'cancelled',label:'Cancelled'}]}
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
                <tr key={job.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/jobs/${job.id}`)}>
                  <Td className="font-medium text-sky-700">{job.job_no}</Td>
                  <Td className="max-w-[150px] truncate text-xs">{job.pickup_address}</Td>
                  <Td className="max-w-[150px] truncate text-xs">{job.delivery_address}</Td>
                  <Td className="text-xs">{formatDate(job.scheduled_pickup_at)}</Td>
                  <Td>{job.agreed_amount ? formatCurrency(job.agreed_amount, job.currency) : '—'}</Td>
                  <Td><StatusBadge status={job.status} /></Td>
                  <Td><Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={(e: any) => { e.stopPropagation(); navigate(`/jobs/${job.id}`) }}>View</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {jobs && jobs.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {jobs.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page>=jobs.pages} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <CreateJobModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CreateJobModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<any>()
  const { data: customers } = useQuery({ queryKey: ['customers','select'], queryFn: () => customersApi.list({ page_size: 200 }), enabled: open })
  const mutation = useMutation({
    mutationFn: (data: any) => jobsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['jobs'] }); toast.success('Job created'); reset(); onClose() },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to create job'),
  })
  return (
    <Modal open={open} onClose={onClose} title="Create New Job" size="lg">
      <form onSubmit={handleSubmit((d: any) => mutation.mutate(d))} className="space-y-4">
        <Select label="Customer *" options={customers?.data?.results?.map((c: any) => ({ value: c.id, label: c.name })) ?? []} placeholder="Select customer" {...register('customer_id', { required: true, valueAsNumber: true })} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Priority" options={[{value:'low',label:'Low'},{value:'normal',label:'Normal'},{value:'high',label:'High'},{value:'urgent',label:'Urgent'}]} {...register('priority')} />
          <Input label="Agreed Amount (AED)" type="number" step="0.01" {...register('agreed_amount', { valueAsNumber: true })} />
        </div>
        <Textarea label="Pickup Address *" rows={2} {...register('pickup_address', { required: true })} />
        <Textarea label="Delivery Address *" rows={2} {...register('delivery_address', { required: true })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Scheduled Pickup" type="datetime-local" {...register('scheduled_pickup_at')} />
          <Input label="Scheduled Delivery" type="datetime-local" {...register('scheduled_delivery_at')} />
        </div>
        <Textarea label="Notes" rows={2} {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Job</Button>
        </div>
      </form>
    </Modal>
  )
}
