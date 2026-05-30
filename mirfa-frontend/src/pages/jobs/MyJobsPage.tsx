// pages/jobs/MyJobsPage.tsx
// Mobile-first driver view — redesigned for Capacitor Android app

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { jobsApi, authApi, customersApi } from '@/api/services'
import { PageLoader } from '@/components/ui'
import { formatDate } from '@/lib/utils'
import type { AxiosResponse } from 'axios'
import {
  MapPin, Clock, ChevronRight, Briefcase,
  CheckCircle, Loader, AlertCircle, Truck,
  User, LogOut, Settings
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:     { label: 'Pending',     color: '#92400e', bg: '#fef3c7', icon: Clock },
  assigned:    { label: 'Assigned',    color: '#1e40af', bg: '#dbeafe', icon: Truck },
  in_progress: { label: 'In Progress', color: '#065f46', bg: '#d1fae5', icon: Loader },
  picked_up:   { label: 'Picked Up',   color: '#5b21b6', bg: '#ede9fe', icon: MapPin },
  delivered:   { label: 'Delivered',   color: '#064e3b', bg: '#d1fae5', icon: CheckCircle },
  completed:   { label: 'Completed',   color: '#064e3b', bg: '#d1fae5', icon: CheckCircle },
  cancelled:   { label: 'Cancelled',   color: '#991b1b', bg: '#fee2e2', icon: AlertCircle },
}

const FILTERS = ['all', 'assigned', 'in_progress', 'picked_up', 'delivered']

export default function MyJobsPage() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [activeFilter, setActiveFilter] = useState('all')
  const [showProfile, setShowProfile] = useState(false)

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me(),
    select: (res: AxiosResponse<any>) => res.data,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['my-jobs', me?.id],
    queryFn: () => jobsApi.list({ assigned_to_id: me!.id, page_size: 100 }),
    enabled: !!me?.id,
  })

  const allJobs = data?.data?.results ?? []

  const visibleJobs = allJobs.filter((j: any) =>
    !['completed', 'cancelled'].includes(j.status.toLowerCase())
  )

  const filteredJobs = activeFilter === 'all'
    ? visibleJobs
    : visibleJobs.filter((j: any) => j.status.toLowerCase() === activeFilter)

  const activeCount = allJobs.filter((j: any) =>
    ['assigned', 'in_progress', 'picked_up'].includes(j.status.toLowerCase())
  ).length

  const doneCount = allJobs.filter((j: any) =>
    ['delivered', 'completed'].includes(j.status.toLowerCase())
  ).length

  const customerIds = [...new Set(allJobs.map((j: any) => j.customer_id).filter(Boolean))] as number[]

  const { data: customersMap } = useQuery({
    queryKey: ['job-customers', customerIds],
    queryFn: async () => {
      const results: Record<number, any> = {}
      await Promise.all(
        customerIds.map(async (cid: number) => {
          const res = await customersApi.get(cid)
          results[cid] = res.data
        })
      )
      return results
    },
    enabled: customerIds.length > 0,
  })

  if (isLoading || !me) return <PageLoader />

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0f172a',
      fontFamily: "'DM Sans', sans-serif",
      color: '#f8fafc',
      paddingBottom: 80,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '52px 20px 20px',
        borderBottom: '1px solid #1e293b',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Good day,</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              {me.full_name?.split(' ')[0]} 👋
            </h1>
          </div>
          <button
            onClick={() => setShowProfile(!showProfile)}
            style={{
              width: 42, height: 42, borderRadius: '50%',
              background: '#334155', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <User size={18} color="#94a3b8" />
          </button>
        </div>

        {/* Profile dropdown */}
        {showProfile && (
          <div style={{
            marginTop: 12,
            background: '#1e293b',
            borderRadius: 12,
            border: '1px solid #334155',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => { navigate('/settings'); setShowProfile(false) }}
              style={{
                width: '100%', padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', color: '#cbd5e1',
                fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #334155',
              }}
            >
              <Settings size={16} /> Settings
            </button>
            <button
              onClick={logout}
              style={{
                width: '100%', padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', color: '#f87171',
                fontSize: 14, cursor: 'pointer',
              }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        )}

        {/* Stats row */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10, marginTop: 20,
        }}>
          {[
            { label: 'Total', value: allJobs.length, color: '#38bdf8' },
            { label: 'Active', value: activeCount, color: '#34d399' },
            { label: 'Done', value: doneCount, color: '#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#1e293b', borderRadius: 12,
              padding: '12px 8px', textAlign: 'center',
              border: '1px solid #334155',
            }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 8, padding: '16px 20px',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            style={{
              padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: activeFilter === f ? '#38bdf8' : '#1e293b',
              color: activeFilter === f ? '#0f172a' : '#64748b',
              transition: 'all 0.2s',
            }}
          >
            {f === 'all' ? 'All Jobs' : f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredJobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
            <Briefcase size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>No jobs found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {activeFilter === 'all' ? 'No jobs assigned yet' : `No ${activeFilter.replace(/_/g, ' ')} jobs`}
            </p>
          </div>
        ) : (
          filteredJobs.map((job: any) => {
            const cfg = STATUS_CONFIG[job.status.toLowerCase()] ?? { label: job.status, color: '#64748b', bg: '#1e293b', icon: Clock }
            const Icon = cfg.icon
            const isActive = ['assigned', 'in_progress', 'picked_up'].includes(job.status.toLowerCase())
            const customer = customersMap?.[job.customer_id]
            const contact = customer?.contacts?.[0]

            return (
              <div
                key={job.id}
                onClick={() => navigate(`/my-jobs/${job.id}/view`)}
                style={{
                  background: '#1e293b',
                  borderRadius: 16,
                  padding: '16px',
                  border: isActive ? '1px solid #0369a1' : '1px solid #334155',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0,
                    width: 4, height: '100%',
                    background: '#38bdf8', borderRadius: '16px 0 0 16px',
                  }} />
                )}

                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#38bdf8' }}>{job.job_no}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px',
                      borderRadius: 20, background: cfg.bg, color: cfg.color,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Icon size={10} />
                      {cfg.label}
                    </span>
                    <ChevronRight size={16} color="#475569" />
                  </div>
                </div>

                {/* Route */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: '#34d399', marginTop: 4, flexShrink: 0,
                    }} />
                    <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                      {job.pickup_address || '—'}
                    </p>
                  </div>
                  <div style={{ width: 1, height: 12, background: '#334155', marginLeft: 3.5 }} />
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: '#f87171', marginTop: 4, flexShrink: 0,
                    }} />
                    <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>
                      {job.delivery_address || '—'}
                    </p>
                  </div>
                </div>

                {/* Bottom row */}
                <div style={{
                  marginTop: 12, paddingTop: 12, borderTop: '1px solid #334155',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {/* Customer name + contact */}
                  {customer && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={11} color="#64748b" />
                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                          {customer.name}
                        </span>
                      </div>
                      {contact && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{contact.name}</span>
                          {contact.phone && (
                            <>
                              <span style={{ color: '#334155' }}>·</span>
                              <a
                                href={`tel:${contact.phone}`}
                                onClick={e => e.stopPropagation()}
                                style={{ fontSize: 11, color: '#38bdf8', textDecoration: 'none' }}
                              >
                                {contact.phone}
                              </a>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                    <Clock size={12} />
                    <span style={{ fontSize: 12 }}>
                      {job.scheduled_pickup_at ? formatDate(job.scheduled_pickup_at) : 'No date set'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}