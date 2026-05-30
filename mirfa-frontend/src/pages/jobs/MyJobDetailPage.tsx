// pages/jobs/MyJobDetailPage.tsx
// Mobile-first job detail page for drivers

import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, customersApi } from '@/api/services'
import { PageLoader } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { AxiosResponse } from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowLeft, MapPin, Clock, Phone, Building2,
  CheckCircle, Truck, Loader, Navigation,
  Camera, Upload, ChevronRight, Package,
  AlertCircle, User, X
} from 'lucide-react'

const STATUS_FLOW: Record<string, { next: string; label: string }> = {
  assigned:    { next: 'in_progress', label: 'Accept Job'      },
  in_progress: { next: 'picked_up',   label: 'Mark Picked Up'  },
  picked_up:   { next: 'delivered',   label: 'Mark Delivered'  },
  delivered:   { next: 'completed',   label: 'Complete Job'    },
}

// Which status transitions need extra data collection
const NEEDS_DATA: Record<string, 'pickup' | 'delivery'> = {
  in_progress: 'pickup',   // when moving to picked_up
  picked_up:   'delivery', // when moving to delivered
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:     { label: 'Pending',     color: '#92400e', bg: '#fef3c7', icon: Clock },
  assigned:    { label: 'Assigned',    color: '#1e40af', bg: '#dbeafe', icon: Truck },
  in_progress: { label: 'In Progress', color: '#065f46', bg: '#d1fae5', icon: Loader },
  picked_up:   { label: 'Picked Up',   color: '#5b21b6', bg: '#ede9fe', icon: MapPin },
  delivered:   { label: 'Delivered',   color: '#064e3b', bg: '#d1fae5', icon: CheckCircle },
  completed:   { label: 'Completed',   color: '#064e3b', bg: '#d1fae5', icon: CheckCircle },
  cancelled:   { label: 'Cancelled',   color: '#991b1b', bg: '#fee2e2', icon: AlertCircle },
}

// ── Bottom Sheet Component ────────────────────────────────────────────────────
function StatusSheet({
  type,
  label,
  onConfirm,
  onClose,
  loading,
}: {
  type: 'pickup' | 'delivery'
  label: string
  onConfirm: (data: { date: string; time: string; km: string }) => void
  onClose: () => void
  loading: boolean
}) {
  const today = new Date().toISOString().slice(0, 10)
  const nowTime = new Date().toTimeString().slice(0, 5)
  const [date, setDate] = useState(today)
  const [time, setTime] = useState(nowTime)
  const [km, setKm] = useState('')

  const isPickup = type === 'pickup'
  const accentColor = isPickup ? '#34d399' : '#f87171'

  function handleConfirm() {
    if (!date || !time) {
      toast.error('Date and time are required')
      return
    }
    onConfirm({ date, time, km })
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#1e293b',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px 40px',
        zIndex: 101,
        border: '1px solid #334155',
      }}>
        {/* Handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2,
          background: '#475569', margin: '0 auto 20px',
        }} />

        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>
              {isPickup ? 'Pickup Details' : 'Delivery Details'}
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{label}</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#0f172a', border: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} color="#64748b" />
          </button>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Date */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
              {isPickup ? 'Pickup' : 'Delivery'} Date <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0f172a', border: `1px solid ${date ? accentColor + '66' : '#334155'}`,
                borderRadius: 12, color: '#f1f5f9', fontSize: 15,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Time */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
              {isPickup ? 'Pickup' : 'Delivery'} Time <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0f172a', border: `1px solid ${time ? accentColor + '66' : '#334155'}`,
                borderRadius: 12, color: '#f1f5f9', fontSize: 15,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* KM */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, display: 'block' }}>
              Odometer Reading (km) <span style={{ color: '#475569', fontSize: 11 }}>optional</span>
            </label>
            <input
              type="number"
              value={km}
              onChange={e => setKm(e.target.value)}
              placeholder="e.g. 12450"
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0f172a', border: '1px solid #334155',
                borderRadius: 12, color: '#f1f5f9', fontSize: 15,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirm}
            disabled={loading}
            style={{
              marginTop: 4,
              width: '100%', padding: '15px',
              borderRadius: 14, border: 'none',
              background: `linear-gradient(135deg, ${isPickup ? '#059669, #34d399' : '#7c3aed, #a78bfa'})`,
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? 'Updating...' : label}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyJobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [podNotes, setPodNotes] = useState('')
  const [podFiles, setPodFiles] = useState<File[]>([])
  const [uploadingPod, setUploadingPod] = useState(false)
  const [showPodSection, setShowPodSection] = useState(false)
  const [showSheet, setShowSheet] = useState(false)

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: job, isLoading } = useQuery({
    queryKey: ['my-job', id],
    queryFn: () => jobsApi.get(Number(id)),
    select: (res: AxiosResponse<any>) =>{
      console.log('Job data:', res.data)
      const jobData = res.data
      return res.data
    } 
  })

  const { data: customer } = useQuery({
    queryKey: ['customer', job?.customer_id],
    queryFn: () => customersApi.get(job!.customer_id),
    select: (res: AxiosResponse<any>) => res.data,
    enabled: !!job?.customer_id,
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['my-job-documents', id],
    queryFn: () => jobsApi.getDocuments(Number(id)),
    select: (res: AxiosResponse<any>) => res.data,
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: ({ newStatus, extraData }: { newStatus: string; extraData?: any }) =>
      extraData
        ? jobsApi.update(Number(id), extraData).then(() => jobsApi.updateStatus(Number(id), newStatus))
        : jobsApi.updateStatus(Number(id), newStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-job', id] })
      qc.invalidateQueries({ queryKey: ['my-jobs'] })
      toast.success('Status updated!')
      setShowSheet(false)
    },
    onError: () => toast.error('Failed to update status'),
  })

  async function uploadPOD() {
    if (!podFiles.length) return
    setUploadingPod(true)
    try {
      for (const file of podFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('doc_type', 'POD')
        formData.append('notes', podNotes)
        await jobsApi.uploadDocument(Number(id), formData,'BOL', podNotes) // Pass docType and notes as additional parameters
      }
      qc.invalidateQueries({ queryKey: ['my-job-documents', id] })
      toast.success(`${podFiles.length} document(s) uploaded`)
      setPodFiles([])
      setShowPodSection(false)
      setPodNotes('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingPod(false)
    }
  }

  if (isLoading || !job) return <PageLoader />

  const status = job.status?.toLowerCase()
  const statusCfg = STATUS_CONFIG[status] ?? { label: job.status, color: '#64748b', bg: '#1e293b', icon: Clock }
  const StatusIcon = statusCfg.icon
  const nextStep = STATUS_FLOW[status]
  const dataType = NEEDS_DATA[status] // 'pickup' | 'delivery' | undefined
  const contact = customer?.contacts?.[0]
  const podDocs = documents

  function openMap(address: string) {
    const encoded = encodeURIComponent(address)
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank')
  }

  function handleStatusTap() {
    if (dataType) {
      setShowSheet(true) // show bottom sheet to collect data
    } else {
      // No data needed (e.g. Accept Job, Complete Job)
      statusMutation.mutate({ newStatus: nextStep.next })
    }
  }

  function handleSheetConfirm({ date, time, km }: { date: string; time: string; km: string }) {
    const iso = new Date(`${date}T${time}:00`).toISOString()
    const extraData: Record<string, any> = {}

    if (dataType === 'pickup') {
      extraData.actual_pickup_at = iso
      if (km) extraData.pickup_km = parseFloat(km)
    } else {
      extraData.actual_delivery_at = iso
      if (km) extraData.delivery_km = parseFloat(km)
    }
    console.log('dataType:', dataType)      
    console.log('extraData:', extraData)    
    console.log('nextStep:', nextStep) 

    statusMutation.mutate({ newStatus: nextStep.next, extraData })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0f172a',
      fontFamily: "'DM Sans', sans-serif",
      color: '#f8fafc',
      paddingBottom: 100,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '52px 20px 20px',
        borderBottom: '1px solid #1e293b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/my-jobs')}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#334155', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} color="#94a3b8" />
          </button>
          <div>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Job Details</p>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#38bdf8', margin: 0 }}>{job.job_no}</h1>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '4px 12px',
              borderRadius: 20, background: statusCfg.bg, color: statusCfg.color,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <StatusIcon size={10} />
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Route Card */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, border: '1px solid #334155' }}>
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Route</p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
              <div style={{ width: 2, height: 32, background: '#334155', margin: '4px 0' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 2px', textTransform: 'uppercase' }}>Pickup</p>
              <p style={{ fontSize: 14, color: '#f1f5f9', margin: 0, lineHeight: 1.4 }}>{job.pickup_address || '—'}</p>
            </div>
            {job.pickup_address && (
              <button onClick={() => openMap(job.pickup_address)} style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <Navigation size={15} color="#38bdf8" />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ paddingTop: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f87171', flexShrink: 0 }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 2px', textTransform: 'uppercase' }}>Delivery</p>
              <p style={{ fontSize: 14, color: '#f1f5f9', margin: 0, lineHeight: 1.4 }}>{job.delivery_address || '—'}</p>
            </div>
            {job.delivery_address && (
              <button onClick={() => openMap(job.delivery_address)} style={{ width: 36, height: 36, borderRadius: 10, background: '#0f172a', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <Navigation size={15} color="#f87171" />
              </button>
            )}
          </div>
        </div>

        {/* Schedule Card */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, border: '1px solid #334155' }}>
          <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Schedule</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' }}>Scheduled Pickup</p>
              <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>{job.scheduled_pickup_at ? formatDate(job.scheduled_pickup_at) : '—'}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase' }}>Scheduled Delivery</p>
              <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>{job.scheduled_delivery_at ? formatDate(job.scheduled_delivery_at) : '—'}</p>
            </div>

            {/* Actual times — shown once filled by driver */}
            {job.actual_pickup_at && (
              <div>
                <p style={{ fontSize: 10, color: '#34d399', margin: '0 0 4px', textTransform: 'uppercase' }}>Actual Pickup</p>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>{formatDate(job.actual_pickup_at)}</p>
                {job.pickup_km && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{job.pickup_km} km</p>}
              </div>
            )}
            {job.actual_delivery_at && (
              <div>
                <p style={{ fontSize: 10, color: '#34d399', margin: '0 0 4px', textTransform: 'uppercase' }}>Actual Delivery</p>
                <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>{formatDate(job.actual_delivery_at)}</p>
                {job.delivery_km && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{job.delivery_km} km</p>}
              </div>
            )}
          </div>
        </div>

        {/* Customer Card */}
        {customer && (
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, border: '1px solid #334155' }}>
            <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Customer</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: contact ? 12 : 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#0f172a', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={16} color="#38bdf8" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{customer.name}</p>
            </div>
            {contact && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', borderRadius: 12, padding: '10px 14px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <User size={14} color="#64748b" />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{contact.name}</p>
                    {contact.phone && <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{contact.phone}</p>}
                  </div>
                </div>
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} style={{ width: 36, height: 36, borderRadius: 10, background: '#052e16', border: '1px solid #166534', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0 }}>
                    <Phone size={15} color="#34d399" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        

        {/* Notes */}
        {job.notes && (
          <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, border: '1px solid #334155' }}>
            <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Notes</p>
            <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>{job.notes}</p>
          </div>
        )}
        {/* Actual Pickup / Delivery Summary */}
{(job.actual_pickup_at || job.actual_delivery_at) && (
  <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, border: '1px solid #0369a1' }}>
    <p style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
      Activity Log
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Pickup entry */}
      {job.actual_pickup_at && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#052e16', border: '1px solid #166534', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={15} color="#34d399" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#34d399', fontWeight: 600, margin: '0 0 2px' }}>Picked Up</p>
            <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>{formatDate(job.actual_pickup_at)}</p>
            {job.pickup_km && (
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Odometer: {job.pickup_km} km</p>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      {job.actual_pickup_at && job.actual_delivery_at && (
        <div style={{ width: 1, height: 16, background: '#334155', marginLeft: 15 }} />
      )}

      {/* Delivery entry */}
      {job.actual_delivery_at && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#2e1065', border: '1px solid #6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CheckCircle size={15} color="#a78bfa" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600, margin: '0 0 2px' }}>Delivered</p>
            <p style={{ fontSize: 13, color: '#f1f5f9', margin: 0 }}>{formatDate(job.actual_delivery_at)}</p>
            {job.delivery_km && (
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Odometer: {job.delivery_km} km</p>
            )}
          </div>
        </div>
      )}

    </div>
  </div>
)}

        {/* POD Section */}
        <div style={{ background: '#1e293b', borderRadius: 16, padding: 16, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Proof of Delivery</p>
            <input
      type="text"
      value={podNotes}
      onChange={e => setPodNotes(e.target.value)}
      placeholder="Document name (e.g. Signed BOL, Gate Pass)"
      style={{
        width: '50%', padding: '11px 14px',
        background: '#0f172a', border: '1px solid #334155',
        borderRadius: 12, color: '#f1f5f9', fontSize: 13,
        outline: 'none', boxSizing: 'border-box', marginBottom: 8,
      }}
    />
            <button
              onClick={() => setShowPodSection(!showPodSection)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '6px 10px', color: '#38bdf8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              <Camera size={13} /> Add 
            </button>
          </div>

          {showPodSection && (
            <div style={{ marginBottom: 12 }}>
              <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed #334155', borderRadius: 12, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 12}}>
                <Upload size={20} color="#475569" style={{ margin: '0 auto 6px' }} />
                <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Tap to select photos</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }} onChange={e => setPodFiles(Array.from(e.target.files ?? []))} />
              </div>
              {podFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {podFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', borderRadius: 8, padding: '8px 12px', border: '1px solid #334155' }}>
                      <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>{f.name}</p>
                      <button onClick={() => setPodFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 12, cursor: 'pointer' }}>Remove</button>
                    </div>
                  ))}
                  <button onClick={uploadPOD} disabled={uploadingPod} style={{ background: '#0369a1', border: 'none', borderRadius: 10, padding: '10px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Upload size={14} />
                    {uploadingPod ? 'Uploading...' : `Upload ${podFiles.length} Photo${podFiles.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {podDocs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {podDocs.map((doc: any) => (
                <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', borderRadius: 10, padding: '10px 12px', border: '1px solid #334155', textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package size={14} color="#38bdf8" />
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>{doc.file_name}</p>
                  </div>
                  <ChevronRight size={14} color="#475569" />
                </a>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>No POD uploaded yet</p>
          )}
        </div>
      </div>

     

      {/* Bottom CTA */}
      {nextStep && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px 32px', background: 'linear-gradient(to top, #0f172a 70%, transparent)' }}>
          <button
            onClick={handleStatusTap}
            disabled={statusMutation.isPending}
            style={{
              width: '100%', padding: '16px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #0369a1, #0ea5e9)',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 24px rgba(3,105,161,0.4)',
              opacity: statusMutation.isPending ? 0.7 : 1,
            }}
          >
            <Truck size={18} />
            {statusMutation.isPending ? 'Updating...' : nextStep.label}
          </button>
        </div>
      )}

      {/* Bottom Sheet */}
      {showSheet && dataType && (
        <StatusSheet
          type={dataType}
          label={nextStep.label}
          onConfirm={handleSheetConfirm}
          onClose={() => setShowSheet(false)}
          loading={statusMutation.isPending}
        />
      )}
    </div>
  )
}