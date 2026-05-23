// pages/jobs/MyJobsPage.tsx
// Shown to drivers/staff — only their assigned jobs
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsApi, authApi } from '@/api/services'
import { Card, CardHeader, Table, Th, Td, StatusBadge, PageHeader, PageLoader, EmptyState, Button } from '@/components/ui'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { AxiosResponse } from 'axios'

export default function MyJobsPage() {
  const navigate = useNavigate()

  // Get current logged-in user
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    select: (res: AxiosResponse<any>) => res.data,
  })

  // Fetch all jobs filtered by assigned_to_id = me.id
  const { data, isLoading } = useQuery({
    queryKey: ['my-jobs', me?.id],
    queryFn: () => jobsApi.list({ assigned_to_id: me!.id, page_size: 100 }),
    enabled: !!me?.id,
  })

  const jobs = data?.data

  if (isLoading || !me) return <PageLoader />

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Jobs"
        subtitle={`Welcome, ${me.full_name} — ${jobs?.total ?? 0} job(s) assigned to you`}
      />
      {me?.role === 'driver' && (
  <div className="bg-sky-50 border border-sky-200 rounded-lg px-4 py-3 flex items-center justify-between">
    <p className="text-sm text-sky-700">
      Need to change your password? Go to <strong>Settings → Password</strong>
    </p>
    <Button size="sm" variant="outline" onClick={() => navigate('/settings')}>
      Go to Settings
    </Button>
  </div>
)}

      <Card>
        {!jobs?.results?.length ? (
          <EmptyState
            title="No jobs assigned"
            description="You have no jobs assigned to you yet."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Job No.</Th>
                <Th>Pickup</Th>
                <Th>Delivery</Th>
                <Th>Scheduled Pickup</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.results.map((job: any) => (
                <tr
                  key={job.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/jobs/${job.id}/view`)}
                >
                  <Td className="font-medium text-sky-700">{job.job_no}</Td>
                  <Td className="max-w-[150px] truncate text-xs">{job.pickup_address}</Td>
                  <Td className="max-w-[150px] truncate text-xs">{job.delivery_address}</Td>
                  <Td className="text-xs">{formatDate(job.scheduled_pickup_at)}</Td>
                  <Td>{job.agreed_amount ? formatCurrency(job.agreed_amount, job.currency) : '—'}</Td>
                  <Td><StatusBadge status={job.status} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}