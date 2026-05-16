import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { driversApi } from '@/api/services'
import { Card, PageHeader, PageLoader, Badge, Button } from '@/components/ui'

export default function DriversPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({ queryKey: ['drivers', page], queryFn: () => driversApi.list({ page, page_size: 25 }) })
  const drivers = data?.data
  const availColors: Record<string, string> = {
    available: 'bg-green-100 text-green-700', on_job: 'bg-blue-100 text-blue-700',
    off_duty: 'bg-gray-100 text-gray-600', on_leave: 'bg-orange-100 text-orange-700',
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Drivers" subtitle={drivers ? `${drivers.total} drivers` : undefined} />
      <Card>
        {isLoading ? <PageLoader /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>{['Code','Name','Mobile','License No.','License Expiry','Availability','Status'].map(h =>
                  <th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr>
              </thead>
              <tbody>
                {drivers?.results?.length === 0
                  ? <tr><td colSpan={7}><div className="text-center py-12 text-slate-400">No drivers found</div></td></tr>
                  : drivers?.results?.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="px-4 py-3 text-xs text-slate-500">{d.driver_code}</td>
                      <td className="px-4 py-3 font-medium">{d.full_name}</td>
                      <td className="px-4 py-3">{d.mobile}</td>
                      <td className="px-4 py-3 text-xs">{d.license_no || '—'}</td>
                      <td className={`px-4 py-3 text-xs ${d.license_expiry && new Date(d.license_expiry) < new Date(Date.now() + 30*86400000) ? 'text-red-600 font-semibold' : ''}`}>
                        {d.license_expiry ? new Date(d.license_expiry).toLocaleDateString('en-AE') : '—'}
                      </td>
                      <td className="px-4 py-3"><Badge className={availColors[d.availability] || 'bg-gray-100 text-gray-600'}>{d.availability?.replace(/_/g,' ')}</Badge></td>
                      <td className="px-4 py-3"><Badge className={d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{d.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {drivers && drivers.pages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {drivers.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page>=drivers.pages} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
