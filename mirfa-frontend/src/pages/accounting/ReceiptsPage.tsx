import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { receiptsApi, customersApi, invoicesApi, banksApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, Modal, Input, Select,
  EmptyState, PageLoader,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function ReceiptsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['receipts', page],
    queryFn: () => receiptsApi.list({ page, page_size: 25 }),
  })

  const receipts = data?.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Receipts"
        subtitle={receipts ? `${receipts.total} receipts` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Receipt</Button>}
      />
      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Receipt No.</Th><Th>Customer</Th><Th>Invoice</Th>
                <Th>Date</Th><Th>Amount</Th><Th>Method</Th><Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {receipts?.results?.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No receipts found" /></td></tr>
              ) : receipts?.results?.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-sky-700">{r.receipt_no}</Td>
                  <Td>{r.customer_id}</Td>
                  <Td>{r.invoice_id ? `#${r.invoice_id}` : '—'}</Td>
                  <Td className="text-xs">{formatDate(r.receipt_date)}</Td>
                  <Td className="font-semibold text-green-700">{formatCurrency(r.amount)}</Td>
                  <Td className="capitalize text-xs">{r.payment_method?.replace(/_/g, ' ')}</Td>
                  <Td className="text-xs">{r.reference_no || r.cheque_no || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {receipts && receipts.pages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {receipts.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= receipts.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <CreateReceiptModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CreateReceiptModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, watch } = useForm<any>({
    defaultValues: { currency: 'AED', payment_method: 'bank_transfer' },
  })
  const method = watch('payment_method')

  const { data: customers } = useQuery({ queryKey: ['customers', 'select'], queryFn: () => customersApi.list({ page_size: 200 }), enabled: open })
  const { data: banks } = useQuery({ queryKey: ['banks'], queryFn: () => banksApi.list(), enabled: open })

  const mutation = useMutation({
    mutationFn: (d: any) => receiptsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['receipts'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Receipt created & journal posted'); reset(); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  return (
    <Modal open={open} onClose={onClose} title="New Receipt" size="lg">
      <form onSubmit={handleSubmit(d => mutation.mutate({ ...d, customer_id: Number(d.customer_id), invoice_id: d.invoice_id ? Number(d.invoice_id) : undefined, bank_id: d.bank_id ? Number(d.bank_id) : undefined, amount: Number(d.amount) }))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Customer *" options={customers?.data?.results?.map((c: any) => ({ value: c.id, label: c.name })) ?? []} placeholder="Select customer" {...register('customer_id', { required: true })} />
          <Input label="Receipt Date *" type="date" {...register('receipt_date', { required: true })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Invoice ID (optional)" type="number" placeholder="Link to invoice" {...register('invoice_id')} />
          <Input label="Amount (AED) *" type="number" step="0.01" {...register('amount', { required: true })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Payment Method" options={[
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'cheque', label: 'Cheque' },
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
          ]} {...register('payment_method')} />
          <Select label="Bank Account" options={banks?.data?.map((b: any) => ({ value: b.id, label: `${b.bank_name} — ${b.account_no}` })) ?? []} placeholder="Select bank" {...register('bank_id')} />
        </div>
        {method === 'cheque' && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cheque No." {...register('cheque_no')} />
            <Input label="Cheque Date" type="date" {...register('cheque_date')} />
          </div>
        )}
        <Input label="Reference No." {...register('reference_no')} />
        <Input label="Notes" {...register('notes')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Receipt</Button>
        </div>
      </form>
    </Modal>
  )
}
