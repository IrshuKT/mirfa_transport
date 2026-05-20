import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Eye } from 'lucide-react'
import { customersApi, inviteApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, SearchInput, Badge, EmptyState, PageLoader,
  Modal, Input, Textarea, Select,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => customersApi.list({ page, page_size: 25, search }),
  })
  const customers = data?.data

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle={customers ? `${customers.total} customers` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Customer</Button>}
      />
      <Card>
        <CardHeader>
          <SearchInput value={search} onChange={(v: string) => { setSearch(v); setPage(1) }} placeholder="Search customers..." />
        </CardHeader>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead><tr><Th>Name</Th><Th>Type</Th><Th>Email</Th><Th>Phone</Th><Th>Credit Days</Th><Th>Status</Th><Th> </Th></tr></thead>
            <tbody>
              {!customers?.results?.length ? (
                <tr><td colSpan={7}><EmptyState title="No customers found" /></td></tr>
              ) : customers.results.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td><p className="font-medium text-slate-900">{c.name}</p>{c.code && <p className="text-xs text-slate-400">{c.code}</p>}</Td>
                  <Td><Badge className="bg-slate-100 text-slate-600 capitalize">{c.customer_type}</Badge></Td>
                  <Td>{c.email || '—'}</Td>
                  <Td>{c.phone || c.mobile || '—'}</Td>
                  <Td>{c.credit_days} days</Td>
                  <Td><Badge className={c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></Td>
                  <Td><Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setSelected(c)}>View</Button></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {customers && customers.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {customers.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page>=customers.pages} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <CustomerFormModal open={showCreate} onClose={() => setShowCreate(false)} />
      {selected && <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function CustomerFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<any>({ defaultValues: { customer_type: 'corporate', credit_days: 30 } })
  const mutation = useMutation({
    mutationFn: (data: any) => customersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer created'); reset(); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })
  return (
    <Modal open={open} onClose={onClose} title="New Customer" size="lg">
      <form onSubmit={handleSubmit((d: any) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name *" {...register('name', { required: true })} />
          <Select label="Type" options={[{value:'corporate',label:'Corporate'},{value:'individual',label:'Individual'},{value:'government',label:'Government'}]} {...register('customer_type')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" type="email" {...register('email')} />
          <Input label="Phone" {...register('phone')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Mobile" {...register('mobile')} />
          <Input label="TRN (UAE)" {...register('trn')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Credit Days" type="number" {...register('credit_days', { valueAsNumber: true })} />
          <Input label="Credit Limit (AED)" type="number" step="0.01" {...register('credit_limit', { valueAsNumber: true })} />
        </div>
        <Input label="City" {...register('city')} />
        <Textarea label="Address" rows={2} {...register('address')} />
        <Textarea label="Notes" rows={2} {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Customer</Button>
        </div>
      </form>
    </Modal>
  )
}

function CustomerDetailModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  return (
    <Modal open={true} onClose={onClose} title={customer.name} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[['Type',customer.customer_type],['Email',customer.email||'—'],['Phone',customer.phone||'—'],['Mobile',customer.mobile||'—'],['TRN',customer.trn||'—'],['City',customer.city||'—'],['Credit Days',`${customer.credit_days} days`],['Credit Limit',customer.credit_limit?`AED ${customer.credit_limit.toLocaleString()}`:'—']].map(([l,v]) => (
            <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium text-slate-800 capitalize">{v}</p></div>
          ))}
        </div>
        {customer.contacts?.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">Contacts</p>
            <div className="space-y-2">
              {customer.contacts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-slate-500">{[c.designation,c.email,c.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  {c.is_primary && <Badge className="bg-sky-100 text-sky-700">Primary</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
        {customer.notes && <div><p className="text-xs text-slate-500">Notes</p><p className="text-sm text-slate-700 mt-1">{customer.notes}</p></div>}

        {/* Portal Login */}
        <div className="border-t border-slate-100 pt-3">
          {customer.portal_user_id ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span>✓</span>
              <span>Portal login active (User ID: {customer.portal_user_id})</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Customer Portal Login</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {customer.email ? 'Create login and send credentials via email' : 'Add email address first'}
                </p>
              </div>
              <CreatePortalLoginButton customer={customer} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function CreatePortalLoginButton({ customer }: { customer: any }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => inviteApi.createCustomerPortal(customer.id, true),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(`Portal login created! Temp password: ${res.data.temp_password}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })
  return (
    <Button size="sm" variant="outline"
      disabled={!customer.email}
      loading={mutation.isPending}
      onClick={() => mutation.mutate()}>
      Create Portal Login
    </Button>
  )
}
