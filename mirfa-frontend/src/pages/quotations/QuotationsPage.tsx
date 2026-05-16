import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Send, ArrowRight, Trash2 } from 'lucide-react'
import { quotationsApi, customersApi } from '@/api/services'
import {
  Button, Card, Table, Th, Td, PageHeader, Modal,
  Input, Textarea, Select, EmptyState, PageLoader, StatusBadge,
} from '@/components/ui'
import { useForm, useFieldArray } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function QuotationsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', page],
    queryFn: () => quotationsApi.list({ page, page_size: 25 }),
  })

  const sendMutation = useMutation({
    mutationFn: (id: number) => quotationsApi.send(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); toast.success('Quotation sent') },
    onError: () => toast.error('Failed to send'),
  })

  const convertMutation = useMutation({
    mutationFn: (id: number) => quotationsApi.convertToJob(id),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['quotations'] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      toast.success(`Job ${res.data.job_no} created!`)
      setSelected(null)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const quotes = data?.data

  return (
    <div className="space-y-5">
      <PageHeader title="Quotations" subtitle={quotes ? `${quotes.total} quotations` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Quotation</Button>}
      />
      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr><Th>Quote No.</Th><Th>Amount</Th><Th>VAT</Th><Th>Total</Th><Th>Valid Until</Th><Th>Status</Th><Th>Actions</Th></tr>
            </thead>
            <tbody>
              {!quotes?.results?.length ? (
                <tr><td colSpan={7}><EmptyState title="No quotations yet" /></td></tr>
              ) : quotes.results.map((q: any) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-sky-700">{q.quote_no}</Td>
                  <Td>{formatCurrency(q.subtotal)}</Td>
                  <Td>{formatCurrency(q.vat_amount)}</Td>
                  <Td className="font-semibold">{formatCurrency(q.total_amount)}</Td>
                  <Td className="text-xs">{formatDate(q.valid_until)}</Td>
                  <Td><StatusBadge status={q.status} /></Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(q)}>View</Button>
                      {q.status === 'draft' && (
                        <Button size="sm" variant="outline" icon={<Send size={12} />}
                          loading={sendMutation.isPending} onClick={() => sendMutation.mutate(q.id)}>Send</Button>
                      )}
                      {q.status === 'accepted' && !q.converted_to_job_id && (
                        <Button size="sm" icon={<ArrowRight size={12} />}
                          loading={convertMutation.isPending} onClick={() => convertMutation.mutate(q.id)}>To Job</Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {quotes && quotes.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {quotes.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p => p-1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page>=quotes.pages} onClick={() => setPage(p => p+1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <CreateQuotationModal open={showCreate} onClose={() => setShowCreate(false)} />
      {selected && <QuotationDetailModal quotation={selected} onClose={() => setSelected(null)} onConvert={() => convertMutation.mutate(selected.id)} />}
    </div>
  )
}

function CreateQuotationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, control, watch, reset } = useForm<any>({
    defaultValues: { currency: 'AED', line_items: [{ description: '', quantity: 1, unit_price: 0, unit: 'trip', discount_pct: 0, vat_pct: 5 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })
  const lineItems: any[] = watch('line_items') || []
  const subtotal = lineItems.reduce((s: number, li: any) => s + (Number(li.quantity)||0) * (Number(li.unit_price)||0), 0)
  const vat = lineItems.reduce((s: number, li: any) => s + (Number(li.quantity)||0) * (Number(li.unit_price)||0) * (1 - (Number(li.discount_pct)||0)/100) * ((Number(li.vat_pct)||5)/100), 0)

  const { data: customers } = useQuery({ queryKey: ['customers','select'], queryFn: () => customersApi.list({ page_size: 200 }), enabled: open })
  const mutation = useMutation({
    mutationFn: (data: any) => quotationsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); toast.success('Quotation created'); reset(); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  return (
    <Modal open={open} onClose={onClose} title="New Quotation" size="xl">
      <form onSubmit={handleSubmit((d: any) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Customer *" options={customers?.data?.results?.map((c: any) => ({ value: c.id, label: c.name })) ?? []} placeholder="Select customer" {...register('customer_id', { required: true, valueAsNumber: true })} />
          <Input label="Valid Until" type="date" {...register('valid_until')} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Line Items</p>
            <Button type="button" size="sm" variant="outline" icon={<Plus size={14} />}
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, unit: 'trip', discount_pct: 0, vat_pct: 5 })}>Add Line</Button>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500">Description</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-16">Qty</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-24">Unit Price</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-16">Disc%</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-16">VAT%</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-24">Total</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => {
                  const li: any = lineItems[i] || {}
                  const lineTotal = (Number(li.quantity)||0) * (Number(li.unit_price)||0) * (1-(Number(li.discount_pct)||0)/100) * (1+(Number(li.vat_pct)||5)/100)
                  return (
                    <tr key={field.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5"><input className="w-full text-xs border-0 outline-none" placeholder="Description" {...register(`line_items.${i}.description`)} /></td>
                      <td className="px-2 py-1.5"><input type="number" className="w-full text-xs border-0 outline-none" {...register(`line_items.${i}.quantity`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1.5"><input type="number" step="0.01" className="w-full text-xs border-0 outline-none" {...register(`line_items.${i}.unit_price`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1.5"><input type="number" className="w-full text-xs border-0 outline-none" {...register(`line_items.${i}.discount_pct`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1.5"><input type="number" className="w-full text-xs border-0 outline-none" {...register(`line_items.${i}.vat_pct`, { valueAsNumber: true })} /></td>
                      <td className="px-2 py-1.5 font-medium">{isNaN(lineTotal) ? '—' : formatCurrency(lineTotal)}</td>
                      <td className="px-1">{fields.length > 1 && <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr><td colSpan={5} className="px-3 py-1.5 text-xs text-right text-slate-500">Subtotal</td><td className="px-2 text-xs font-medium">{formatCurrency(subtotal)}</td><td /></tr>
                <tr><td colSpan={5} className="px-3 py-1 text-xs text-right text-slate-500">VAT (5%)</td><td className="px-2 text-xs font-medium">{formatCurrency(vat)}</td><td /></tr>
                <tr><td colSpan={5} className="px-3 py-2 text-sm text-right font-bold">Total (AED)</td><td className="px-2 text-sm font-bold">{formatCurrency(subtotal + vat)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Textarea label="Notes" rows={2} {...register('notes')} />
          <Textarea label="Terms & Conditions" rows={2} {...register('terms')} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Create Quotation</Button>
        </div>
      </form>
    </Modal>
  )
}

function QuotationDetailModal({ quotation, onClose, onConvert }: { quotation: any; onClose: () => void; onConvert: () => void }) {
  return (
    <Modal open={true} onClose={onClose} title={`Quotation ${quotation.quote_no}`} size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={quotation.status} />
          {quotation.status === 'accepted' && !quotation.converted_to_job_id && (
            <Button size="sm" icon={<ArrowRight size={14} />} onClick={onConvert}>Convert to Job</Button>
          )}
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><Th>Description</Th><Th>Qty</Th><Th>Unit Price</Th><Th>VAT%</Th><Th>Total</Th></tr></thead>
            <tbody>
              {quotation.line_items?.map((li: any) => (
                <tr key={li.id} className="border-t border-slate-100">
                  <Td>{li.description}</Td><Td>{li.quantity}</Td>
                  <Td>{formatCurrency(li.unit_price)}</Td><Td>{li.vat_pct}%</Td>
                  <Td className="font-medium">{formatCurrency(li.line_total)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <div className="text-right space-y-1 text-sm">
            <div className="flex justify-between gap-8"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(quotation.subtotal)}</span></div>
            <div className="flex justify-between gap-8"><span className="text-slate-500">VAT</span><span>{formatCurrency(quotation.vat_amount)}</span></div>
            <div className="flex justify-between gap-8 font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(quotation.total_amount)}</span></div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
