import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { vendorsApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, SearchInput, Badge, EmptyState, PageLoader, Modal, Input, Select,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

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
      <PageHeader
        title="Vendors"
        subtitle={vendors ? `${vendors.total} vendors` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Vendor</Button>}
      />
      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={(v: string) => { setSearch(v); setPage(1) }}
            placeholder="Search vendors..."
          />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th><Th>Type</Th><Th>Email</Th><Th>Phone</Th><Th>Payment Terms</Th><Th>Status</Th>
              </tr>
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
                  <Td>
                    <Badge className={v.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {v.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
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
            <Select
              label="Type"
              options={[
                { value: 'supplier', label: 'Supplier' },
                { value: 'subcontractor', label: 'Subcontractor' },
                { value: 'both', label: 'Both' },
              ]}
              {...register('vendor_type')}
            />
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