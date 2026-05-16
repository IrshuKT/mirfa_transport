import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { paymentsApi, vendorsApi, banksApi } from '@/api/services'
import {
  Button, Card, Table, Th, Td,
  PageHeader, Modal, Input, Select, EmptyState, PageLoader,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function PaymentsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page],
    queryFn: () => paymentsApi.list({ page, page_size: 25 }),
  })
  const payments = data?.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendor Payments"
        subtitle={payments ? `${payments.total} payments` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Payment</Button>}
      />
      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr><Th>Payment No.</Th><Th>Vendor</Th><Th>Date</Th><Th>Amount</Th><Th>Method</Th><Th>Reference</Th></tr>
            </thead>
            <tbody>
              {payments?.results?.length === 0 ? (
                <tr><td colSpan={6}><EmptyState title="No payments found" /></td></tr>
              ) : payments?.results?.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-sky-700">{p.payment_no}</Td>
                  <Td>{p.vendor_id}</Td>
                  <Td className="text-xs">{formatDate(p.payment_date)}</Td>
                  <Td className="font-semibold text-red-600">{formatCurrency(p.amount)}</Td>
                  <Td className="capitalize text-xs">{p.payment_method?.replace(/_/g, ' ')}</Td>
                  <Td className="text-xs">{p.reference_no || p.cheque_no || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {payments && payments.pages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {payments.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= payments.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <CreatePaymentModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CreatePaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<any>({ defaultValues: { payment_method: 'bank_transfer', currency: 'AED' } })
  const { data: vendors } = useQuery({ queryKey: ['vendors', 'select'], queryFn: () => vendorsApi.list({ page_size: 200 }), enabled: open })
  const { data: banks } = useQuery({ queryKey: ['banks'], queryFn: () => banksApi.list(), enabled: open })

  const mutation = useMutation({
    mutationFn: (d: any) => paymentsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Payment created'); reset(); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  return (
    <Modal open={open} onClose={onClose} title="New Vendor Payment" size="md">
      <form onSubmit={handleSubmit(d => mutation.mutate({ ...d, vendor_id: Number(d.vendor_id), bank_id: d.bank_id ? Number(d.bank_id) : undefined, amount: Number(d.amount) }))} className="space-y-4">
        <Select label="Vendor *" options={vendors?.data?.results?.map((v: any) => ({ value: v.id, label: v.name })) ?? []} placeholder="Select vendor" {...register('vendor_id', { required: true })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Payment Date *" type="date" {...register('payment_date', { required: true })} />
          <Input label="Amount (AED) *" type="number" step="0.01" {...register('amount', { required: true })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment Method" options={[{ value: 'bank_transfer', label: 'Bank Transfer' }, { value: 'cheque', label: 'Cheque' }, { value: 'cash', label: 'Cash' }]} {...register('payment_method')} />
          <Select label="Bank" options={banks?.data?.map((b: any) => ({ value: b.id, label: b.bank_name })) ?? []} placeholder="Select bank" {...register('bank_id')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Reference No." {...register('reference_no')} />
          <Input label="Cheque No." {...register('cheque_no')} />
        </div>
        <Input label="Notes" {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Payment</Button>
        </div>
      </form>
    </Modal>
  )
}
