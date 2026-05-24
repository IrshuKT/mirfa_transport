import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { receiptsApi, customersApi, invoicesApi, banksApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, Modal, Input, Select,
  EmptyState, PageLoader,
} from '@/components/ui'
import { useForm, useWatch } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getApiError } from '@/api/services'
import toast from 'react-hot-toast'

// customer name map helper
function useCustomerMap() {
  const { data } = useQuery({
    queryKey: ['customers', 'select'],
    queryFn: () => customersApi.list({ page_size: 200 }),
  })
  return Object.fromEntries(
    (data?.data?.results || []).map((c: any) => [c.id, c.name])
  )
}

export default function ReceiptsPage() {
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const customerMap = useCustomerMap()

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
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            New Receipt
          </Button>
        }
      />

      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Receipt No.</Th>
                <Th>Customer</Th>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Method</Th>
                <Th>Reference</Th>
              </tr>
            </thead>
            <tbody>
              {!receipts?.results?.length ? (
                <tr><td colSpan={7}><EmptyState title="No receipts found" /></td></tr>
              ) : receipts.results.map((r: any) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-sky-700">{r.receipt_no}</Td>
                  <Td>{customerMap[r.customer_id] || `#${r.customer_id}`}</Td>
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

// ── Create Receipt Modal ──────────────────────────────────────────────────────
function CreateReceiptModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset, watch, setValue, control } = useForm<any>({
    defaultValues: { currency: 'AED', payment_method: 'bank_transfer' },
  })

  const method     = watch('payment_method')
  const customerId = watch('customer_id')
  const invoiceId  = watch('invoice_id')

  // Customers list
  const { data: customers } = useQuery({
    queryKey: ['customers', 'select'],
    queryFn: () => customersApi.list({ page_size: 200 }),
    enabled: open,
  })

  // Banks list
  const { data: banks } = useQuery({
    queryKey: ['banks'],
    queryFn: () => banksApi.list(),
    enabled: open,
  })

  // Unpaid invoices for selected customer
  const { data: unpaidData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', 'unpaid', customerId],
    queryFn: () => invoicesApi.list({
      customer_id: customerId,
      page_size: 100,
      // fetch sent + partially_paid + overdue
    }),
    enabled: !!customerId && open,
    select: (r: any) => (r.data?.results || []).filter(
      (inv: any) => ['sent', 'partially_paid', 'overdue'].includes(inv.status)
    ),
  })
  const unpaidInvoices: any[] = unpaidData || []

  // When invoice is selected, auto-fill amount with balance_due
  function handleInvoiceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value)
    setValue('invoice_id', id || undefined)
    if (id) {
      const inv = unpaidInvoices.find((i: any) => i.id === id)
      if (inv) setValue('amount', inv.balance_due)
    }
  }

  // Reset invoice and amount when customer changes
  function handleCustomerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setValue('customer_id', e.target.value)
    setValue('invoice_id', undefined)
    setValue('amount', '')
  }

  const mutation = useMutation({
    mutationFn: (d: any) => receiptsApi.create({
      ...d,
      customer_id: Number(d.customer_id),
      invoice_id:  d.invoice_id ? Number(d.invoice_id) : undefined,
      bank_id:     d.bank_id    ? Number(d.bank_id)    : undefined,
      amount:      Number(d.amount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['invoice'] })
      toast.success('Receipt created & journal posted')
      reset()
      onClose()
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title="New Receipt" size="lg">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">

        {/* Customer + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
            <select
              {...register('customer_id', { required: true })}
              onChange={handleCustomerChange}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Select customer</option>
              {customers?.data?.results?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input label="Receipt Date *" type="date"
            {...register('receipt_date', { required: true })} />
        </div>

        {/* Invoice dropdown — loads when customer selected */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Invoice
            {customerId && (
              <span className="ml-2 text-xs text-slate-400 font-normal">
                {invoicesLoading ? 'Loading...' : `${unpaidInvoices.length} unpaid`}
              </span>
            )}
          </label>
          <select
            onChange={handleInvoiceChange}
            disabled={!customerId || invoicesLoading}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">
              {!customerId
                ? 'Select customer first'
                : invoicesLoading
                ? 'Loading invoices...'
                : unpaidInvoices.length === 0
                ? 'No unpaid invoices'
                : 'Select invoice (optional)'}
            </option>
            {unpaidInvoices.map((inv: any) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoice_no} — Balance: {formatCurrency(inv.balance_due)} — Due: {formatDate(inv.due_date)}
              </option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <Input
          label="Amount (AED) *"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register('amount', { required: true })}
        />

        {/* Payment Method + Bank */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Payment Method"
            options={[
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cheque',        label: 'Cheque' },
              { value: 'cash',          label: 'Cash' },
              { value: 'card',          label: 'Card' },
              { value: 'online',        label: 'Online' },
            ]}
            {...register('payment_method')}
          />
          <Select
            label="Bank Account"
            options={banks?.data?.map((b: any) => ({
              value: b.id,
              label: `${b.bank_name} — ${b.account_no}`,
            })) ?? []}
            placeholder="Select bank"
            {...register('bank_id')}
          />
        </div>

        {/* Cheque fields */}
        {method === 'cheque' && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Cheque No."  {...register('cheque_no')} />
            <Input label="Cheque Date" type="date" {...register('cheque_date')} />
          </div>
        )}

        <Input label="Reference No." {...register('reference_no')} />
        <Input label="Notes"         {...register('notes')} />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Create Receipt
          </Button>
        </div>
      </form>
    </Modal>
  )
}