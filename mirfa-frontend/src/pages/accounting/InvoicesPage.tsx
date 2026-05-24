import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Send, XCircle, Eye } from 'lucide-react'
import { invoicesApi, customersApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, Modal, Input, Textarea, Select,
  EmptyState, PageLoader, Badge,
} from '@/components/ui'
import { useForm, useFieldArray } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getApiError } from '@/api/services'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-100 text-blue-700',
  partially_paid: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-red-50 text-red-400',
}

export default function InvoicesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter],
    queryFn: () => invoicesApi.list({ page, page_size: 25, status: statusFilter || undefined }),
  })

  // Fetch all customers for name lookup
  const { data: customersData } = useQuery({
    queryKey: ['customers', 'select'],
    queryFn: () => customersApi.list({ page_size: 200 }),
  })
  const customerMap = Object.fromEntries(
    (customersData?.data?.results || []).map((c: any) => [c.id, c.name])
  )

  const sendMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.send(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice sent') },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice cancelled') },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const invoices = data?.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle={invoices ? `${invoices.total} invoices` : undefined}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            New Invoice
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <Select
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'partially_paid', label: 'Partially Paid' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            placeholder="All statuses"
            value={statusFilter}
            onChange={(e: any) => { setStatusFilter(e.target.value); setPage(1) }}
            className="w-44"
          />
        </CardHeader>

        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice No.</Th>
                <Th>Customer</Th>
                <Th>Date</Th>
                <Th>Due Date</Th>
                <Th>Total</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {!invoices?.results?.length ? (
                <tr><td colSpan={8}><EmptyState title="No invoices found" /></td></tr>
              ) : invoices.results.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <Td className="font-medium text-sky-700">{inv.invoice_no}</Td>
                  <Td className="font-medium text-slate-800">
                    {customerMap[inv.customer_id] || `#${inv.customer_id}`}
                  </Td>
                  <Td className="text-xs">{formatDate(inv.invoice_date)}</Td>
                  <Td className="text-xs">{formatDate(inv.due_date)}</Td>
                  <Td className="font-medium">{formatCurrency(inv.total_amount)}</Td>
                  <Td className={inv.balance_due > 0 ? 'font-medium text-red-600' : 'text-green-600'}>
                    {formatCurrency(inv.balance_due)}
                  </Td>
                  <Td>
                    <Badge className={STATUS_COLORS[inv.status] || 'bg-slate-100 text-slate-600'}>
                      {inv.status.replace(/_/g, ' ')}
                    </Badge>
                  </Td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" icon={<Eye size={13} />}
                        onClick={() => navigate(`/invoices/${inv.id}`)}>
                        View
                      </Button>
                      {inv.status === 'draft' && (
                        <Button size="sm" variant="outline" icon={<Send size={12} />}
                          loading={sendMutation.isPending}
                          onClick={() => sendMutation.mutate(inv.id)}>
                          Send
                        </Button>
                      )}
                      {!['paid', 'cancelled'].includes(inv.status) && (
                        <Button size="sm" variant="ghost" icon={<XCircle size={12} />}
                          loading={cancelMutation.isPending}
                          onClick={() => { if (confirm('Cancel this invoice?')) cancelMutation.mutate(inv.id) }}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50">
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {invoices && invoices.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {invoices.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= invoices.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <CreateInvoiceModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

// ── Create Invoice Modal ──────────────────────────────────────────────────────
function CreateInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, control, watch, reset } = useForm<any>({
    defaultValues: {
      currency: 'AED',
      auto_post: true,
      line_items: [{ description: '', quantity: 1, unit_price: 0, discount_pct: 0, vat_pct: 5 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const lineItems = watch('line_items') || []

  const subtotal = lineItems.reduce((s: number, li: any) =>
    s + (li.quantity || 0) * (li.unit_price || 0), 0)
  const vat = lineItems.reduce((s: number, li: any) =>
    s + (li.quantity || 0) * (li.unit_price || 0) * (1 - (li.discount_pct || 0) / 100) * ((li.vat_pct || 5) / 100), 0)

  const { data: customers } = useQuery({
    queryKey: ['customers', 'select'],
    queryFn: () => customersApi.list({ page_size: 200 }),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (data: any) => invoicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice created!')
      reset()
      onClose()
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  return (
    <Modal open={open} onClose={onClose} title="New Invoice" size="xl">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Select
            label="Customer *"
            options={customers?.data?.results?.map((c: any) => ({ value: c.id, label: c.name })) ?? []}
            placeholder="Select customer"
            {...register('customer_id', { required: true, valueAsNumber: true })}
          />
          <Input label="Invoice Date *" type="date" {...register('invoice_date', { required: true })} />
          <Input label="Due Date *" type="date" {...register('due_date', { required: true })} />
        </div>

        <Input label="Customer TRN" placeholder="UAE Tax Registration No" {...register('customer_trn')} />

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Line Items</p>
            <Button type="button" size="sm" variant="outline" icon={<Plus size={14} />}
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, discount_pct: 0, vat_pct: 5 })}>
              Add Line
            </Button>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500">Description</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-16">Qty</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-28">Unit Price</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-16">Disc%</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-16">VAT%</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-28">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => {
                  const li = lineItems[i] || {}
                  const t = (li.quantity || 0) * (li.unit_price || 0)
                    * (1 - (li.discount_pct || 0) / 100)
                    * (1 + (li.vat_pct || 5) / 100)
                  return (
                    <tr key={field.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <input className="w-full text-xs border-0 outline-none"
                          placeholder="Description"
                          {...register(`line_items.${i}.description`)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" className="w-16 text-xs border-0 outline-none"
                          {...register(`line_items.${i}.quantity`, { valueAsNumber: true })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" className="w-24 text-xs border-0 outline-none"
                          {...register(`line_items.${i}.unit_price`, { valueAsNumber: true })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" className="w-14 text-xs border-0 outline-none"
                          {...register(`line_items.${i}.discount_pct`, { valueAsNumber: true })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" className="w-14 text-xs border-0 outline-none"
                          {...register(`line_items.${i}.vat_pct`, { valueAsNumber: true })} />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-slate-700">
                        {isNaN(t) ? '—' : formatCurrency(t)}
                      </td>
                      <td className="px-1">
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-3 py-1.5 text-xs text-right text-slate-500">Subtotal</td>
                  <td className="px-2 text-xs font-medium">{formatCurrency(subtotal)}</td><td />
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 py-1 text-xs text-right text-slate-500">VAT</td>
                  <td className="px-2 text-xs font-medium">{formatCurrency(vat)}</td><td />
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-sm text-right font-bold">Total (AED)</td>
                  <td className="px-2 text-sm font-bold text-slate-900">{formatCurrency(subtotal + vat)}</td><td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Textarea label="Notes" rows={2} {...register('notes')} />
          <Textarea label="Payment Terms" rows={2} {...register('terms')} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="auto_post" {...register('auto_post')} className="rounded" />
          <label htmlFor="auto_post" className="text-sm text-slate-600">Auto-post journal entry</label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Invoice</Button>
        </div>
      </form>
    </Modal>
  )
}