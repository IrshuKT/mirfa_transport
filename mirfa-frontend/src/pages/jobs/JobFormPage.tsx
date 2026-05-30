import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, CheckCircle, Save,FileText } from 'lucide-react'
import { jobsApi, customersApi, getApiError, invoicesApi } from '@/api/services'
import {
  Button, Card, CardBody, CardHeader,
  Input, PageHeader, PageLoader, Badge, StatusBadge,
} from '@/components/ui'
import toast from 'react-hot-toast'

// ── helper: combine date + time strings → ISO ─────────────────────────────────
function combineDatetime(date: string, time: string): string | null {
  if (!date) return null
  const t = time || '00:00'
  return new Date(`${date}T${t}:00`).toISOString()
}

// ── helper: split ISO → { date, time } ───────────────────────────────────────
function splitDatetime(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const date = d.toISOString().slice(0, 10)
  const time = d.toTimeString().slice(0, 5)
  return { date, time }
}

export default function JobFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const qc = useQueryClient()
  const isEdit = !!id

  const { data: existing, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(Number(id)),
    enabled: isEdit,
  })
  const job = existing?.data

  const { data: customersData } = useQuery({
    queryKey: ['customers', 'select'],
    queryFn: () => customersApi.list({ page_size: 200 }),
  })
  const customers = customersData?.data?.results || []

  const [showInvoicePreview, setShowInvoicePreview] = useState(false)


  const { register, handleSubmit, reset, watch,setValue, formState: { isDirty } } = useForm<any>({
    defaultValues: {
      priority: 'normal',
      currency: 'AED',
    }
  })

 const rawCustomerId = watch('customer_id')
const watchedCustomerId = Number(rawCustomerId) || Number((job as any)?.customer_id) || undefined
console.log('rawCustomerId:', rawCustomerId, '→ watchedCustomerId:', watchedCustomerId)

 const { data: contactCustomerData } = useQuery({
  queryKey: ['customer', watchedCustomerId],
  queryFn: () => customersApi.get(Number(watchedCustomerId)),
  enabled: !!watchedCustomerId,
})
 
  const contacts = contactCustomerData?.data?.contacts || []

  

  useEffect(() => {
    if (job) {
      const pu = splitDatetime(job.scheduled_pickup_at)
      const de = splitDatetime(job.scheduled_delivery_at)
      const apu = splitDatetime(job.actual_pickup_at)
      const ade = splitDatetime(job.actual_delivery_at)
      reset({
        ...(job as any),
        customer_id: (job as any).customer_id,
        contact_id: (job as any).contact?.id ?? (job as any).contact_id,
        scheduled_pickup_date: pu.date,
        scheduled_pickup_time: pu.time,
        scheduled_delivery_date: de.date,
        scheduled_delivery_time: de.time,
        actual_pickup_date: apu.date,
        actual_pickup_time: apu.time,
        actual_delivery_date: ade.date,
        actual_delivery_time: ade.time,
      })
    }
  }, [job])

  const mutation = useMutation({
    mutationFn: (data: any) => {
      const cleaned = { ...data }

      // Recombine split date+time fields → ISO
      cleaned.scheduled_pickup_at   = combineDatetime(data.scheduled_pickup_date,   data.scheduled_pickup_time)
      cleaned.scheduled_delivery_at = combineDatetime(data.scheduled_delivery_date, data.scheduled_delivery_time)
      cleaned.actual_pickup_at      = combineDatetime(data.actual_pickup_date,      data.actual_pickup_time)
      cleaned.actual_delivery_at    = combineDatetime(data.actual_delivery_date,    data.actual_delivery_time)

      // Remove split fields — backend doesn't know them
      delete cleaned.scheduled_pickup_date
      delete cleaned.scheduled_pickup_time
      delete cleaned.scheduled_delivery_date
      delete cleaned.scheduled_delivery_time
      delete cleaned.actual_pickup_date
      delete cleaned.actual_pickup_time
      delete cleaned.actual_delivery_date
      delete cleaned.actual_delivery_time

      // Clean NaN number fields
      const numberFields = ['agreed_amount', 'pickup_lat', 'pickup_lng', 'delivery_lat', 'delivery_lng','contact_id']
      numberFields.forEach(f => { if (isNaN(cleaned[f])) cleaned[f] = null })

      return isEdit ? jobsApi.update(Number(id), cleaned) : jobsApi.create(cleaned)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      toast.success(isEdit ? 'Job updated!' : 'Job created!')
      navigate('/jobs')
    },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail
      if (Array.isArray(detail)) {
        toast.error(detail.map((e: any) => `${e.loc?.at(-1)}: ${e.msg}`).join('\n'))
      } else {
        toast.error(detail || 'Failed')
      }
    },
  })

  const invoiceMutation = useMutation({
  mutationFn: (description: string) =>
    invoicesApi.fromJob(Number(id), description),
  onSuccess: (res: any) => {
    qc.invalidateQueries({ queryKey: ['job', id] })
    toast.success(`Invoice ${res.data.invoice_no} created!`)
    navigate('/invoices')
  },
  onError: (e: any) => toast.error(getApiError(e)),
})

  const statusMutation = useMutation({
    mutationFn: (status: string) => jobsApi.updateStatus(Number(id), status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job', id] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Status updated!')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

 const jobContactId = (job as any)?.contact?.id ?? (job as any)?.contact_id
 
 useEffect(() => {
  if (!isEdit || !contacts.length || !job) return
  const savedContactId = (job as any)?.contact?.id ?? (job as any)?.contact_id
  if (savedContactId) {
    // Use String() — HTML select values are always strings
    setValue('contact_id', String(savedContactId), { shouldDirty: false })
  }
}, [contacts, job])

  if (isEdit && isLoading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title={isEdit ? `Job — ${job?.job_no || ''}` : 'New Job'}
        subtitle={isEdit ? undefined : 'Fill in the details below'}
        actions={
          <div className="flex items-center gap-2">
            {isEdit && job && <StatusBadge status={job.status} />}
            <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/jobs')}>
              Back
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

        {/* Customer & Priority */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Job Details</h3></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  {...register('customer_id', { required: true, valueAsNumber: true })}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select customer</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
             
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  {...register('priority')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Agreed Amount" type="number" step="0.01" placeholder="0.00"
                {...register('agreed_amount', { valueAsNumber: true })} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select
                  {...register('currency')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            {contacts.length > 0 && (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        Contact Person
      </label>
      <select
        {...register('contact_id')}
        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm 
                   focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
      >
        <option value="">— Select contact —</option>
        {contacts.map((c: any) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
            {c.is_primary ? ' ★' : ''}
            {c.designation ? ` · ${c.designation}` : ''}
          </option>
        ))}
      </select>

      {/* View-only: show saved contact details below the dropdown */}
      {isEdit && (job as any)?.contact && (
        <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs text-slate-500 mb-0.5">Currently saved</p>
          <p className="text-sm font-medium text-slate-800">
            {(job as any).contact.name}
            {(job as any).contact.is_primary && (
              <span className="ml-1 text-amber-500">★</span>
            )}
          </p>
          {(job as any).contact.designation && (
            <p className="text-xs text-slate-500">{(job as any).contact.designation}</p>
          )}
          {(job as any).contact.phone && (
            <p className="text-xs text-slate-500">{(job as any).contact.phone}</p>
          )}
        </div>
      )}
    </div>
    <div />
  </div>
)}

          </CardBody>
        </Card>

        

        {/* Locations */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Locations</h3></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pickup Address *</label>
              <textarea rows={2} {...register('pickup_address', { required: true })}
                placeholder="Full pickup address..."
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pickup Lat" type="number" step="any" {...register('pickup_lat', { valueAsNumber: true })} />
              <Input label="Pickup Lng" type="number" step="any" {...register('pickup_lng', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Delivery Address *</label>
              <textarea rows={2} {...register('delivery_address', { required: true })}
                placeholder="Full delivery address..."
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Delivery Lat" type="number" step="any" {...register('delivery_lat', { valueAsNumber: true })} />
              <Input label="Delivery Lng" type="number" step="any" {...register('delivery_lng', { valueAsNumber: true })} />
            </div>
          </CardBody>
        </Card>

        {/* Schedule — split date + time */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Schedule</h3></CardHeader>
          <CardBody className="space-y-4">

            {/* Scheduled Pickup */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Scheduled Pickup</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Date" type="date" {...register('scheduled_pickup_date')} />
                <Input label="Time" type="time" {...register('scheduled_pickup_time')} />
              </div>
            </div>

            {/* Scheduled Delivery */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Scheduled Delivery</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Date" type="date" {...register('scheduled_delivery_date')} />
                <Input label="Time" type="time" {...register('scheduled_delivery_time')} />
              </div>
            </div>

            {/* Actual times — edit mode only */}
            {isEdit && (
              <>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Actual Pickup</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Date" type="date" {...register('actual_pickup_date')} />
                    <Input label="Time" type="time" {...register('actual_pickup_time')} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Actual Delivery</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Date" type="date" {...register('actual_delivery_date')} />
                    <Input label="Time" type="time" {...register('actual_delivery_time')} />
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* Dispatch info — view only */}
        {isEdit && (job as any)?.dispatches?.length > 0 && (
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-800">Dispatch</h3></CardHeader>
            <CardBody>
              {(job as any)?.dispatches?.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">Driver ID: {d.driver_id}</p>
                    {d.vehicle_id && <p className="text-xs text-slate-500">Vehicle ID: {d.vehicle_id}</p>}
                  </div>
                  <Badge className="capitalize bg-sky-100 text-sky-700">{d.status}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Status change */}
        {isEdit && job && (
          <Card>
            <CardHeader><h3 className="font-semibold text-slate-800">Update Status</h3></CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {['pending', 'assigned', 'in_progress', 'on_hold', 'completed', 'cancelled']
                  .filter(s => s !== job.status)
                  .map(s => (
                    <Button key={s} size="sm" variant="outline"
                      loading={statusMutation.isPending}
                      onClick={() => {
                        if (confirm(`Change status to "${s}"?`)) statusMutation.mutate(s)
                      }}
                      className="capitalize">
                      → {s.replace(/_/g, ' ')}
                    </Button>
                  ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Notes</h3></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Notes</label>
              <textarea rows={2} {...register('notes')} placeholder="Notes visible to customer..."
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
              <textarea rows={2} {...register('internal_notes')} placeholder="Internal notes only..."
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            </div>
          </CardBody>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/jobs')}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save size={15} />}>
            {isEdit ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
        {/* Invoice */}
       {isEdit && job?.status === 'completed' && !job?.is_invoiced && (
  <Card>
    <CardHeader>
      <h3 className="font-semibold text-slate-800">Invoice</h3>
    </CardHeader>
    <CardBody>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-700">Job completed — ready to invoice</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Creates invoice for {job.currency} {job.agreed_amount} with 5% VAT
          </p>
        </div>
        <Button
        type="button"
          icon={<FileText size={15} />}
          onClick={() => setShowInvoicePreview(true)}
        >
          Create Invoice
        </Button>
      </div>
    </CardBody>
  </Card>
)}



{isEdit && job?.is_invoiced && (
  <Card>
    <CardBody>
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle size={16} />
        <span className="text-sm font-medium">Invoice created for this job</span>
        <Button size="sm" variant="ghost" onClick={() => navigate('/invoices')}>
          View Invoice →
        </Button>
      </div>
    </CardBody>
  </Card>
)}


      </form>
      {showInvoicePreview && job && (
  <InvoicePreviewModal
    job={job}
    onClose={() => setShowInvoicePreview(false)}
    onConfirm={(description) => {
      invoiceMutation.mutate(description)
      setShowInvoicePreview(false)
    }}
    isLoading={invoiceMutation.isPending}
  />
)}
    </div>
  )
}

function InvoicePreviewModal({
  job, onClose, onConfirm, isLoading,
}: {
  job: any
  onClose: () => void
  onConfirm: (description: string) => void
  isLoading: boolean
}) {
  const [description, setDescription] = useState(
    `Transport service — ${job.pickup_address} → ${job.delivery_address}`
  )
  const subtotal = Number(job.agreed_amount) || 0
  const vat = subtotal * 0.05
  const total = subtotal + vat

 return (
  <div className="fixed inset-0 bg-slate-100 z-50 overflow-y-auto">
    <div className="max-w-3xl mx-auto px-6 py-8 pb-24">

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Back to Job
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Invoice Preview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Review before creating</p>
        </div>
        <div className="w-28" />
      </div>

      {/* A4 Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 space-y-6">

        {/* Job Info */}
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Job Details</p>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-slate-500">Job No.</span>
            <span className="font-medium text-slate-800">{job.job_no}</span>
            <span className="text-slate-500">Customer</span>
            <span className="font-medium text-slate-800">Customer #{job.customer_id}</span>
            {job.contact && (
              <>
                <span className="text-slate-500">Contact</span>
                <span className="font-medium text-slate-800">{job.contact.name}</span>
              </>
            )}
            <span className="text-slate-500">Pickup</span>
            <span className="text-slate-700 text-xs">{job.pickup_address}</span>
            <span className="text-slate-500">Delivery</span>
            <span className="text-slate-700 text-xs">{job.delivery_address}</span>
            {job.scheduled_pickup_at && (
              <>
                <span className="text-slate-500">Sched. Pickup</span>
                <span className="text-slate-700 text-xs">
                  {new Date(job.scheduled_pickup_at).toLocaleDateString()}
                </span>
              </>
            )}
            {job.scheduled_delivery_at && (
              <>
                <span className="text-slate-500">Sched. Delivery</span>
                <span className="text-slate-700 text-xs">
                  {new Date(job.scheduled_delivery_at).toLocaleDateString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Divider */}
        <hr className="border-slate-200" />

        {/* Editable Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Line Item Description
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        {/* Amount Breakdown */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Amount Breakdown
            </p>
          </div>
          <div className="px-4 py-4 space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">{job.currency} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>VAT (5%)</span>
              <span className="font-medium">{job.currency} {vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sky-700 border-t border-slate-200 pt-3">
              <span>Total</span>
              <span>{job.currency} {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    {/* Sticky Footer */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shadow-lg">
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button
        icon={<FileText size={15} />}
        loading={isLoading}
        onClick={() => onConfirm(description)}
      >
        Confirm & Create Invoice
      </Button>
    </div>
  </div>
)
}