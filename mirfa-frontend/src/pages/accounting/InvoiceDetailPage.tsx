import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Send, XCircle, Printer, CheckCircle, Plus,Edit2 } from 'lucide-react'
import { invoicesApi, customersApi, receiptsApi, companiesApi } from '@/api/services'
import { Button, Card, CardBody, CardHeader, PageLoader, Badge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getApiError } from '@/api/services'
import toast from 'react-hot-toast'


const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    sent: 'bg-blue-100 text-blue-700',
    partially_paid: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-50 text-red-400',
    credit_note: 'bg-purple-100 text-purple-700',
}

export default function InvoiceDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const printRef = useRef<HTMLDivElement>(null)
    const [showPayment, setShowPayment] = useState(false)
    const [editingNotes, setEditingNotes] = useState(false)
    const [notes, setNotes] = useState('')
    const [showEdit, setShowEdit] = useState(false)
    const { data: inv, isLoading } = useQuery({
        queryKey: ['invoice', id],
        queryFn: () => invoicesApi.get(Number(id)),
        select: (r: any) => r.data,
    })

    useEffect(() => {
        if (inv?.notes !== undefined) setNotes(inv.notes || '')
    }, [inv])

    const { data: customer } = useQuery({
        queryKey: ['customer', inv?.customer_id],
        queryFn: () => customersApi.get(inv.customer_id),
        select: (r: any) => r.data,
        enabled: !!inv?.customer_id,
    })

    const sendMutation = useMutation({
        mutationFn: () => invoicesApi.send(Number(id)),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Invoice sent') },
        onError: (e: any) => toast.error(getApiError(e)),
    })

    const cancelMutation = useMutation({
        mutationFn: () => invoicesApi.cancel(Number(id)),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoice', id] }); toast.success('Invoice cancelled') },
        onError: (e: any) => toast.error(getApiError(e)),
    })

    const notesMutation = useMutation({
        mutationFn: () => invoicesApi.update(Number(id), { notes }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['invoice', id] })
            toast.success('Notes saved')
            setEditingNotes(false)
        },
        onError: (e: any) => toast.error(getApiError(e)),
    })

    const { data: company } = useQuery({
        queryKey: ['my-company'],
        queryFn: () => companiesApi.getMe(),
        select: (r: any) => r.data,
    })

    function handlePrint() {
        const printContent = printRef.current?.innerHTML
        if (!printContent) return
        const win = window.open('', '_blank')
        if (!win) return
        win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Invoice ${inv?.invoice_no}</title>
        <style>
          @page {
            margin: 16mm 14mm;
            size: A4;
          }
          @media print {
            html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 13px;
            color: #1e293b;
            padding: 32px;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          .invoice-body { flex: 1; }
          .company-name { font-size: 22px; font-weight: 700; color: #0ea5e9; }
          .invoice-title { font-size: 26px; font-weight: 700; color: #0f172a; text-align: right; }
          .invoice-no { font-size: 13px; color: #0ea5e9; font-weight: 600; text-align: right; margin-top: 4px; }
          .divider { border: none; border-top: 2px solid #e2e8f0; margin: 20px 0; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
          .value { font-size: 13px; font-weight: 500; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 11px;
               text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
          th:last-child, td:last-child { text-align: right; }
          td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
          l-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          /* Replace bill-grid styles in handlePrint CSS */
.bill-grid { 
  display: table; 
  width: 100%; 
  margin-bottom: 24px; 
}
.bill-left { 
  display: table-cell; 
  width: 50%; 
  vertical-align: top; 
}
.bill-right { 
  display: table-cell; 
  width: 50%; 
  vertical-align: top; 
  text-align: right; 
}
.meta-row { 
  display: flex; 
  justify-content: flex-end; 
  gap: 16px; 
  font-size: 13px;
  border-bottom: 1px solid #f1f5f9; 
  padding: 5px 0; 
}
.meta-label { 
  color: #94a3b8; 
  width: 90px; 
  text-align: left;
  flex-shrink: 0; 
}
.meta-value { 
  font-weight: 500; 
  color: #1e293b; 
  text-align: right; 
  width: 100px;
}
        
/* Table — right-align all except col 1 and 2 */
th:nth-child(n+3), td:nth-child(n+3) { text-align: right; }
th:nth-child(1), td:nth-child(1) { text-align: left; color: #94a3b8; width: 3px; }
th:nth-child(2), td:nth-child(2) { text-align: left; }
th:last-child, td:last-child { text-align: right; }
          .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
          .totals { width: 260px; }
          .totals-row { display: flex; justify-content: space-between; padding: 5px 0;
                        font-size: 13px; color: #475569; border-bottom: 1px solid #f1f5f9; }
          .totals-vat  { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; color: #475569; }
          .totals-total { display: flex; justify-content: space-between; padding: 10px 0;
                          font-size: 15px; font-weight: 700; border-top: 2px solid #0ea5e9;
                          color: #0ea5e9; margin-top: 4px; }
          .totals-paid { display: flex; justify-content: space-between; padding: 5px 0;
                         font-size: 13px; color: #16a34a; }
          .totals-balance { display: flex; justify-content: space-between; padding: 8px 0;
                            font-size: 13px; font-weight: 700; color: #dc2626;
                            border-top: 1px solid #e2e8f0; }
          .notes-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-top: 24px; }
          .notes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
          .notes-label { font-size: 11px; font-weight: 600; color: #94a3b8;
                         text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
          .notes-text { font-size: 12px; color: #475569; white-space: pre-line; }
          .footer { text-align: center; font-size: 11px; color.bil: #94a3b8;
                    border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 32px; }
        </style>
      </head>
      <body>
        <div class="invoice-body">${printContent}</div>
      </body>
    </html>
  `)
        win.document.close()
        win.focus()
        setTimeout(() => { win.print(); win.close() }, 300)
    }

    if (isLoading) return <PageLoader />
    if (!inv) return <div className="p-8 text-slate-500">Invoice not found</div>

    return (
        <div className="space-y-5 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/invoices')} className="text-sm text-slate-500 hover:text-slate-700">
                        ← Back
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">{inv.invoice_no}</h1>
                        <p className="text-sm text-slate-500">Invoice Detail</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[inv.status] || 'bg-slate-100 text-slate-600'}>
                        {inv.status.replace(/_/g, ' ')}
                    </Badge>
                    {inv.status === 'draft' && (
                        <Button size="sm" icon={<Send size={14} />} loading={sendMutation.isPending}
                            onClick={() => sendMutation.mutate()}>
                            Send
                        </Button>
                    )}
                    {inv.status === 'draft' && (
  <Button size="sm" variant="outline" icon={<Edit2 size={14} />}
    onClick={() => setShowEdit(true)}>
    Edit
  </Button>
)}
                    {!['paid', 'cancelled'].includes(inv.status) && (
                        <Button size="sm" variant="outline" icon={<XCircle size={14} />}
                            loading={cancelMutation.isPending}
                            onClick={() => { if (confirm('Cancel this invoice?')) cancelMutation.mutate() }}>
                            Cancel
                        </Button>
                    )}
                    <Button size="sm" variant="outline" icon={<Printer size={14} />} onClick={handlePrint}>
                        Print
                    </Button>
                    {['sent', 'partially_paid', 'overdue'].includes(inv.status) && (
                        <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowPayment(true)}>
                            Record Payment
                        </Button>
                    )}
                </div>
            </div>

            {/* Printable Invoice */}
            <Card>
                <CardBody className="p-8">
                    <div ref={printRef}>
                        {/* Print Header */}
                        <div className="print-header flex justify-between items-start mb-8">
                            <div>
                                <p className="company-name text-2xl font-bold text-sky-600">
                                    {company?.name || 'Mirfa Transport'}
                                </p>
                                {company?.address && (
                                    <p className="text-sm text-slate-500 mt-0.5">{company.address}</p>
                                )}
                                {company?.city && (
                                    <p className="text-sm text-slate-500">{company.city}</p>
                                )}
                                {company?.phone && (
                                    <p className="text-sm text-slate-500 mt-0.5">{company.phone}</p>
                                )}
                                {company?.email && (
                                    <p className="text-sm text-slate-500">{company.email}</p>
                                )}
                                {company?.trn && (
                                    <p className="text-sm text-slate-500">TRN: {company.trn}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className="invoice-title text-3xl font-bold text-slate-900">INVOICE</p>
                                <p className="invoice-no text-sky-600 font-semibold mt-1">{inv.invoice_no}</p>
                            </div>
                        </div>

                        <hr className="divider border-slate-200 my-6" />

                        {/* Bill To & Invoice Info */}
                        <div className="grid-2 grid grid-cols-2 gap-6 mb-6">
                            <div>
                                <p className="label text-xs text-slate-400 uppercase tracking-wide mb-2">Bill To</p>
                                <p className="value font-semibold text-slate-900 text-base">{customer?.name || `Customer #${inv.customer_id}`}</p>
                                {customer?.address && <p className="text-sm text-slate-500 mt-1">{customer.address}</p>}
                                {customer?.city && <p className="text-sm text-slate-500">{customer.city}</p>}
                                {customer?.email && <p className="text-sm text-slate-500 mt-1">{customer.email}</p>}
                                {(inv.customer_trn || customer?.trn) && (
                                    <p className="text-sm text-slate-500 mt-1">TRN: {inv.customer_trn || customer?.trn}</p>
                                )}
                            </div>
                            {/* Right side — aligned label : value */}
                            <div className="flex flex-col items-end pt-6">
                                {[
                                    ['Invoice Date', formatDate(inv.invoice_date)],
                                    ['Due Date', formatDate(inv.due_date)],
                                    ['Currency', inv.currency],
                                    ...(inv.job_id ? [['Job Ref', `Job #${inv.job_id}`]] : []),
                                ].map(([label, value]) => (
                                    <div key={label} className="flex text-sm border-b border-slate-100 py-1 gap-6 w-64">
                                        <span className="text-slate-400 w-24 shrink-0">{label}</span>
                                        <span className="font-medium text-slate-800 text-right flex-1">{value}</span>
                                    </div>
                                ))}
                            </div>

                        </div>

                        {/* Line Items Table */}
                        <table className="w-full text-sm border-collapse mt-6">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="text-left px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-10">No</th>
                                    <th className="text-left px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200">Description</th>
                                    <th className="text-right px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-12">Qty</th>
                                    <th className="text-right px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-24">Unit Price</th>
                                    <th className="text-right px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-14">Disc%</th>
                                    <th className="text-right px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-14">VAT%</th>
                                    <th className="text-right px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-24">VAT Amt</th>
                                    <th className="text-right px-3 py-3 text-xs text-slate-500 uppercase tracking-wide border-b-2 border-slate-200 w-24">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inv.line_items?.map((li: any, i: number) => (
                                    <tr key={i} className="border-b border-slate-100">
                                        <td className="px-3 py-3 text-slate-400 text-xs">{i + 1}</td>
                                        <td className="px-3 py-3 text-slate-800 whitespace-pre-line">{li.description}</td>
                                        <td className="px-3 py-3 text-right text-slate-600">{li.quantity}</td>
                                        <td className="px-3 py-3 text-right text-slate-600">{Number(li.unit_price).toFixed(2)}</td>
                                        <td className="px-3 py-3 text-right text-slate-500">{li.discount_pct}%</td>
                                        <td className="px-3 py-3 text-right text-slate-500">{li.vat_pct}%</td>
                                        <td className="px-3 py-3 text-right text-slate-600">{Number(li.vat_amount).toFixed(2)}</td>
                                        <td className="px-3 py-3 text-right font-medium text-slate-800">{formatCurrency(li.line_total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="totals-wrap flex justify-end mt-4">
                            <div className="totals w-64 space-y-0">
                                <div className="totals-row flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(inv.subtotal)}</span>
                                </div>
                                {inv.discount_amount > 0 && (
                                    <div className="flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100">
                                        <span>Discount</span>
                                        <span className="text-red-500">-{formatCurrency(inv.discount_amount)}</span>
                                    </div>
                                )}
                                <div className="totals-vat flex justify-between text-sm text-slate-600 py-1">
                                    <span>VAT (5%)</span>
                                    <span>{formatCurrency(inv.vat_amount)}</span>
                                </div>
                                <div className="totals-total flex justify-between font-bold text-base text-sky-600 border-t-2 border-sky-200 pt-3 mt-1">
                                    <span>Total</span>  {/* ← removed "AED" here */}
                                    <span>{formatCurrency(inv.total_amount)}</span>
                                </div>
                                {inv.paid_amount > 0 && (
                                    <>
                                        <div className="totals-paid flex justify-between text-sm text-green-600 py-1">
                                            <span>Paid</span>
                                            <span>-{formatCurrency(inv.paid_amount)}</span>
                                        </div>
                                        <div className="totals-balance flex justify-between font-bold text-sm text-red-600 border-t border-slate-200 pt-2">
                                            <span>Balance Due</span>
                                            <span>{formatCurrency(inv.balance_due)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Notes & Terms */}
                        {(inv.notes || inv.terms) && (
                            <div className="notes-box grid grid-cols-2 gap-6 mt-8 bg-slate-50 rounded-xl p-5">
                                {inv.notes && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Notes</p>
                                        <p className="text-sm text-slate-600 whitespace-pre-line">{inv.notes}</p>
                                    </div>
                                )}
                                {inv.terms && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Terms</p>
                                        <p className="text-sm text-slate-600 whitespace-pre-line">{inv.terms}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="footer text-center mt-10 text-xs text-slate-400 border-t border-slate-100 pt-5">
                            Thank you for your business · Mirfa Transport LLC · UAE
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Edit Notes */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800">Notes</h3>
                        {!editingNotes && inv.status !== 'cancelled' && (
                            <Button size="sm" variant="outline" onClick={() => setEditingNotes(true)}>
                                Edit
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardBody>
                    {editingNotes ? (
                        <div className="space-y-3">
                            <textarea
                                rows={3}
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add notes to this invoice..."
                                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => { setNotes(inv.notes || ''); setEditingNotes(false) }}>
                                    Cancel
                                </Button>
                                <Button size="sm" loading={notesMutation.isPending} onClick={() => notesMutation.mutate()}>
                                    Save Notes
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600">
                            {inv.notes || <span className="text-slate-400 italic">No notes added</span>}
                        </p>
                    )}
                </CardBody>
            </Card>

            {/* Record Payment Modal */}
            {showPayment && (
                <RecordPaymentModal
                    invoice={inv}
                    onClose={() => setShowPayment(false)}
                    onSuccess={() => {
                        setShowPayment(false)
                        qc.invalidateQueries({ queryKey: ['invoice', id] })
                        qc.invalidateQueries({ queryKey: ['invoices'] })
                    }}
                />
            )}
            
        </div>
    )
}

// ── Record Payment Modal ──────────────────────────────────────────────────────
function RecordPaymentModal({ invoice, onClose, onSuccess }: {
    invoice: any
    onClose: () => void
    onSuccess: () => void
}) {
    const [amount, setAmount] = useState(String(invoice.balance_due))
    const [method, setMethod] = useState('bank_transfer')
    const [ref, setRef] = useState('')
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            await receiptsApi.create({
                invoice_id: invoice.id,
                customer_id: invoice.customer_id,
                receipt_date: date,
                amount: parseFloat(amount),
                payment_method: method,
                reference_no: ref || undefined,
            })
            toast.success('Payment recorded!')
            onSuccess()
        } catch (err: any) {
            toast.error(getApiError(err))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-semibold text-slate-900">Record Payment</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
                </div>

                <div className="bg-slate-50 rounded-lg px-4 py-3 mb-5 text-sm">
                    <div className="flex justify-between text-slate-600">
                        <span>Invoice</span><span className="font-medium">{invoice.invoice_no}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 mt-1">
                        <span>Balance Due</span>
                        <span className="font-bold text-red-600">{formatCurrency(invoice.balance_due)} {invoice.currency}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                        <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                        <select value={method} onChange={e => setMethod(e.target.value)}
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="cash">Cash</option>
                            <option value="cheque">Cheque</option>
                            <option value="card">Card</option>
                            <option value="online">Online</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reference No.</label>
                        <input type="text" value={ref} onChange={e => setRef(e.target.value)} placeholder="Cheque no / transfer ref"
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" loading={loading} icon={<CheckCircle size={14} />}>
                            Record Payment
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}