import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { vendorsApi, employeesApi, fleetApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, SearchInput, Badge, EmptyState, PageLoader, Modal, Input, Select,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

// ── Vendors ───────────────────────────────────────────────────────────────────
export function VendorsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vendors', page, search],
    queryFn: () => vendorsApi.list({ page, page_size: 25, search }),
  })
  const vendors = data?.data

  const { register, handleSubmit, reset } = useForm<any>({
    defaultValues: { vendor_type: 'supplier', payment_terms_days: 30, currency: 'AED', country: 'AE' },
  })

  const mutation = useMutation({
    mutationFn: (d: any) => vendorsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor created')
      reset()
      setShowCreate(false)
    },
    onError: () => toast.error('Failed to create vendor'),
  })

  return (
    <div className="space-y-5">
      <PageHeader title="Vendors" subtitle={vendors ? `${vendors.total} vendors` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Vendor</Button>}
      />
      <Card>
        <CardHeader>
          <SearchInput value={search} onChange={(v: string) => { setSearch(v); setPage(1) }} placeholder="Search vendors..." />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr><Th>Name</Th><Th>Type</Th><Th>Email</Th><Th>Phone</Th><Th>Payment Terms</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {vendors?.results?.length === 0 ? (
                <tr><td colSpan={6}><EmptyState title="No vendors found" /></td></tr>
              ) : vendors?.results?.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td><p className="font-medium text-slate-900">{v.name}</p></Td>
                  <Td><Badge className="bg-slate-100 text-slate-600 capitalize">{v.vendor_type}</Badge></Td>
                  <Td>{v.email || '—'}</Td>
                  <Td>{v.phone || '—'}</Td>
                  <Td>{v.payment_terms_days} days</Td>
                  <Td><Badge className={v.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{v.is_active ? 'Active' : 'Inactive'}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {vendors && vendors.pages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {vendors.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= vendors.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Vendor" size="md">
        <form onSubmit={handleSubmit((d: any) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name *" {...register('name', { required: true })} />
            <Select label="Type" options={[{ value: 'supplier', label: 'Supplier' }, { value: 'subcontractor', label: 'Subcontractor' }, { value: 'both', label: 'Both' }]} {...register('vendor_type')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" {...register('email')} />
            <Input label="Phone" {...register('phone')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="TRN" {...register('trn')} />
            <Input label="Payment Terms (days)" type="number" {...register('payment_terms_days', { valueAsNumber: true })} />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={mutation.isPending}>Create Vendor</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Employees ─────────────────────────────────────────────────────────────────
export function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => employeesApi.list({ page, page_size: 25, search }),
  })
  const employees = data?.data

  return (
    <div className="space-y-5">
      <PageHeader title="Employees" subtitle={employees ? `${employees.total} employees` : undefined} />
      <Card>
        <CardHeader>
          <SearchInput value={search} onChange={(v: string) => { setSearch(v); setPage(1) }} placeholder="Search employees..." />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr><Th>No.</Th><Th>Name</Th><Th>Designation</Th><Th>Department</Th><Th>Visa Expiry</Th><Th>EID Expiry</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {employees?.results?.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No employees found" /></td></tr>
              ) : employees?.results?.map((e: any) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td className="text-xs text-slate-500">{e.employee_no}</Td>
                  <Td className="font-medium text-slate-900">{e.full_name}</Td>
                  <Td>{e.designation || '—'}</Td>
                  <Td>{e.department || '—'}</Td>
                  <Td className={`text-xs ${e.visa_expiry && new Date(e.visa_expiry) < new Date(Date.now() + 30 * 86400000) ? 'text-red-600 font-semibold' : ''}`}>
                    {e.visa_expiry ? new Date(e.visa_expiry).toLocaleDateString('en-AE') : '—'}
                  </Td>
                  <Td className={`text-xs ${e.emirates_id_expiry && new Date(e.emirates_id_expiry) < new Date(Date.now() + 30 * 86400000) ? 'text-red-600 font-semibold' : ''}`}>
                    {e.emirates_id_expiry ? new Date(e.emirates_id_expiry).toLocaleDateString('en-AE') : '—'}
                  </Td>
                  <Td><Badge className={e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>{e.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}

// ── Fleet ─────────────────────────────────────────────────────────────────────
export function FleetPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['fleet', page, search],
    queryFn: () => fleetApi.list({ page, page_size: 25, search }),
  })
  const vehicles = data?.data
  const soon = (d?: string) => d && new Date(d) < new Date(Date.now() + 30 * 86400000)

  return (
    <div className="space-y-5">
      <PageHeader title="Fleet" subtitle={vehicles ? `${vehicles.total} vehicles` : undefined} />
      <Card>
        <CardHeader>
          <SearchInput value={search} onChange={(v: string) => { setSearch(v); setPage(1) }} placeholder="Search plate or fleet no..." />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr><Th>Plate No.</Th><Th>Fleet No.</Th><Th>Type</Th><Th>Make/Model</Th><Th>Mulkiya Expiry</Th><Th>Insurance Expiry</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {vehicles?.results?.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No vehicles found" /></td></tr>
              ) : vehicles?.results?.map((v: any) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-900">{v.plate_no}</Td>
                  <Td>{v.fleet_no || '—'}</Td>
                  <Td>{v.vehicle_type || '—'}</Td>
                  <Td>{[v.make, v.model, v.year].filter(Boolean).join(' ') || '—'}</Td>
                  <Td className={`text-xs ${soon(v.mulkiya_expiry) ? 'text-red-600 font-semibold' : ''}`}>
                    {v.mulkiya_expiry ? new Date(v.mulkiya_expiry).toLocaleDateString('en-AE') : '—'}
                  </Td>
                  <Td className={`text-xs ${soon(v.insurance_expiry) ? 'text-red-600 font-semibold' : ''}`}>
                    {v.insurance_expiry ? new Date(v.insurance_expiry).toLocaleDateString('en-AE') : '—'}
                  </Td>
                  <Td><Badge className={v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>{v.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
