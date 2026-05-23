// pages/JobDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect  } from 'react'
import { jobsApi, usersApi } from '@/api/services'
import {
  Card, CardHeader, PageHeader, Badge, Button, PageLoader
} from '@/components/ui'
import toast from 'react-hot-toast'
import type { Job } from '@/types'
import type { AxiosResponse } from 'axios'

// ── Local types ───────────────────────────────────────────────────────────────
interface JobDocument {
  id: number
  doc_type: string
  file_name: string
  file_url: string
  file_size_bytes?: number
  mime_type?: string
  notes?: string
  uploaded_by_id: number
}

export function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Assignment state ──────────────────────────────────────────────────────
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null)
  const [selectedVehicleId] = useState<number | undefined>(undefined)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  // ── Schedule state ────────────────────────────────────────────────────────
  const [pickupAt, setPickupAt] = useState('')
  const [deliveryAt, setDeliveryAt] = useState('')
  const [savingSchedule, setSavingSchedule] = useState(false)

  // ── Document state ────────────────────────────────────────────────────────
  const [docType, setDocType] = useState('BOL')
  const [docNotes, setDocNotes] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // ── Queries ───────────────────────────────────────────────────────────────
 const { data: job, isLoading: jobLoading } = useQuery({
  queryKey: ['job', id],
  queryFn: () => jobsApi.get(Number(id)),
  select: (res: AxiosResponse<Job>) => res.data,
})

  useEffect(() => {
    if (job?.scheduled_pickup_at) {
    setPickupAt(toDatetimeLocal(job.scheduled_pickup_at))
   }
  if (job?.scheduled_delivery_at) {
    setDeliveryAt(toDatetimeLocal(job.scheduled_delivery_at))
  }
  }, [job])

  const { data: users = [], isLoading: usersLoading } = useQuery({
  queryKey: ['users-list'],
  queryFn: () => usersApi.list({ page_size: 200 }),
  select: (res: AxiosResponse<any>) => res.data.results,
})

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: ['job-documents', id],
    queryFn: () => jobsApi.getDocuments(Number(id)),
    select: (res: AxiosResponse<JobDocument[]>) => res.data,
  })

  const drivers = users.filter((user: any) => user.role.name === 'driver') ?? []

  // ── Mutations ─────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
  mutationFn: () => jobsApi.update(Number(id), { assigned_to_id: selectedUserId }),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['job', id] })
    toast.success('Job assigned successfully')
    setSelectedUserId(null)
  },
  onError: () => toast.error('Failed to assign'),
})

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function saveSchedule() {
    setSavingSchedule(true)
    try {
      await jobsApi.update(Number(id), {
        scheduled_pickup_at: pickupAt ? new Date(pickupAt).toISOString() : null,
        scheduled_delivery_at: deliveryAt ? new Date(deliveryAt).toISOString() : null,
      })
      qc.invalidateQueries({ queryKey: ['job', id] })
      toast.success('Schedule saved')
    } catch {
      toast.error('Failed to save schedule')
    } finally {
      setSavingSchedule(false)
    }
  }

  async function uploadDocuments() {
    if (!selectedFiles.length) return
    setUploadingDoc(true)
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('doc_type', docType)
        if (docNotes) formData.append('notes', docNotes)
        await jobsApi.uploadDocument(Number(id), formData)
      }
      qc.invalidateQueries({ queryKey: ['job-documents', id] })
      toast.success(`${selectedFiles.length} document(s) uploaded`)
      setSelectedFiles([])
      setDocNotes('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingDoc(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFiles(Array.from(e.target.files ?? []))
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (jobLoading) return <PageLoader />

  const isAssigned = job?.status !== 'pending'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-slate-500 hover:text-slate-700"
        >← Back</button>
        <PageHeader title={job?.job_no} subtitle="Job details" />
      </div>

      {/* ── Job Info ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-5">
          <Detail label="Job No."   value={job?.job_no} />
          <Detail label="Pickup"    value={job?.pickup_address} />
          <Detail label="Delivery"  value={job?.delivery_address} />
          <Detail label="Scheduled Pickup" value={
            job?.scheduled_pickup_at
              ? new Date(job.scheduled_pickup_at).toLocaleString('en-AE')
              : '—'
          } />
          <Detail label="Scheduled Delivery" value={
            job?.scheduled_delivery_at
              ? new Date(job.scheduled_delivery_at).toLocaleString('en-AE')
              : '—'
          } />
          <Detail label="Amount"    value={job?.agreed_amount ? `${job.currency} ${job.agreed_amount}` : '—'} />
          <Detail label="Status"    value={
            <Badge className={statusColor(job?.status)}>{job?.status}</Badge>
          } />
          <Detail label="Priority"  value={job?.priority ?? '—'} />
        </div>
      </Card>

      {/* ── Schedule ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-700">Schedule</h2>
        </CardHeader>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
              Pickup Date & Time
            </label>
            <input
              type="datetime-local"
              value={pickupAt}
              onChange={e => setPickupAt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
              Delivery Date & Time
            </label>
            <input
              type="datetime-local"
              value={deliveryAt}
              onChange={e => setDeliveryAt(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={saveSchedule} loading={savingSchedule}>
              Save Schedule
            </Button>
          </div>
        </div>
      </Card>

      {!isAssigned && (
  <Card>
    <CardHeader>
      <h2 className="text-sm font-semibold text-slate-700">Assign To</h2>
    </CardHeader>
    <div className="p-5">
      {usersLoading ? (
        <p className="text-sm text-slate-400">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-400">No users found.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((u: any) => (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                  ${selectedUserId === u.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center
                  text-xs font-semibold text-slate-600">
                  {u.full_name?.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{u.full_name}</p>
                  <p className="text-xs text-slate-400">{u.role ?? u.email ?? ''}</p>
                </div>
                {selectedUserId === u.id && (
                  <span className="ml-auto text-blue-500 text-xs font-semibold">Selected</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => assignMutation.mutate()}
              loading={assignMutation.isPending}
              disabled={!selectedUserId}
            >
              Confirm Assignment
            </Button>
          </div>
        </div>
      )}
    </div>
  </Card>
)}

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-700">Documents</h2>
        </CardHeader>
        <div className="p-5 space-y-5">

          {/* Upload area */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Doc type */}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                  Document Type
                </label>
                <select
                  value={docType}
                  onChange={e => setDocType(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['BOL', 'CMR', 'POD', 'Permit', 'Invoice', 'Other'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wide mb-1 block">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={docNotes}
                  onChange={e => setDocNotes(e.target.value)}
                  placeholder="e.g. Signed copy"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800
                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* File picker */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center
                cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              <p className="text-sm text-slate-500">
                Click to select files <span className="text-slate-400">(multiple allowed)</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Selected files preview */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50
                    border border-slate-200 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >Remove</button>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button
                    onClick={uploadDocuments}
                    loading={uploadingDoc}
                    disabled={!selectedFiles.length}
                  >
                    Upload {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Uploaded docs list */}
          {docsLoading ? (
            <p className="text-sm text-slate-400">Loading documents...</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-400">No documents uploaded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map((doc: JobDocument) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{doc.file_name}</p>
                    <p className="text-xs text-slate-400">
                      {doc.doc_type}
                      {doc.notes ? ` · ${doc.notes}` : ''}
                      {doc.file_size_bytes ? ` · ${formatBytes(doc.file_size_bytes)}` : ''}
                    </p>
                  </div>
                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="text-sm font-medium text-slate-800">{value ?? '—'}</div>
    </div>
  )
}

function statusColor(status?: string) {
  const map: Record<string, string> = {
    assigned:    'bg-blue-100 text-blue-700',
    pending:     'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-purple-100 text-purple-700',
    completed:   'bg-green-100 text-green-700',
    cancelled:   'bg-red-100 text-red-700',
    on_hold:     'bg-gray-100 text-gray-600',
  }
  return map[status ?? ''] ?? 'bg-gray-100 text-gray-600'
}

function toDatetimeLocal(iso: string) {
  // Convert ISO string → value for datetime-local input (strips seconds/tz)
  return iso ? iso.slice(0, 16) : ''
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}