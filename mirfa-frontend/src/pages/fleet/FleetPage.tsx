import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { fleetApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, SearchInput, Badge, EmptyState, PageLoader, Modal, Input, Select,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'


// ─── Types ────────────────────────────────────────────────────────────────────

interface Vehicle {
  id: number
  plate_no: string
  fleet_no?: string
  vehicle_type?: string
  make?: string
  model?: string
  year?: number
  mulkiya_expiry?: string
  insurance_expiry?: string
  status: 'active' | 'inactive' | string
}

const EMPTY_FORM = {
  plate_no: '',
  fleet_no: '',
  vehicle_type: '',
  make: '',
  model: '',
  year: '',
  mulkiya_expiry: '',
  insurance_expiry: '',
  status: 'active',
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function VehicleModal({
  vehicle,
  onClose,
  onSave,
  saving,
}: {
  vehicle: Vehicle | null    // null = new
  onClose: () => void
  onSave: (data: any) => void
  saving: boolean
}) {
  const [form, setForm] = useState(
    vehicle
      ? {
          plate_no: vehicle.plate_no ?? '',
          fleet_no: vehicle.fleet_no ?? '',
          vehicle_type: vehicle.vehicle_type ?? '',
          make: vehicle.make ?? '',
          model: vehicle.model ?? '',
          year: vehicle.year?.toString() ?? '',
          mulkiya_expiry: vehicle.mulkiya_expiry?.slice(0, 10) ?? '',
          insurance_expiry: vehicle.insurance_expiry?.slice(0, 10) ?? '',
          status: vehicle.status ?? 'active',
        }
      : { ...EMPTY_FORM },
  )

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...form,
      year: form.year ? Number(form.year) : undefined,
      mulkiya_expiry: form.mulkiya_expiry || undefined,
      insurance_expiry: form.insurance_expiry || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {vehicle ? 'Edit Vehicle' : 'Add Vehicle'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plate No. *">
              <input required value={form.plate_no} onChange={set('plate_no')} placeholder="e.g. 12345 AB" />
            </Field>
            <Field label="Fleet No.">
              <input value={form.fleet_no} onChange={set('fleet_no')} placeholder="e.g. F-001" />
            </Field>
            <Field label="Vehicle Type">
              <input value={form.vehicle_type} onChange={set('vehicle_type')} placeholder="e.g. Sedan, SUV" />
            </Field>
            <Field label="Make">
              <input value={form.make} onChange={set('make')} placeholder="e.g. Toyota" />
            </Field>
            <Field label="Model">
              <input value={form.model} onChange={set('model')} placeholder="e.g. Camry" />
            </Field>
            <Field label="Year">
              <input type="number" min="1990" max="2099" value={form.year} onChange={set('year')} placeholder="e.g. 2022" />
            </Field>
            <Field label="Mulkiya Expiry">
              <input type="date" value={form.mulkiya_expiry} onChange={set('mulkiya_expiry')} />
            </Field>
            <Field label="Insurance Expiry">
              <input type="date" value={form.insurance_expiry} onChange={set('insurance_expiry')} />
            </Field>
            <Field label="Status" className="col-span-2">
              <select value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving…' : vehicle ? 'Save Changes' : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="[&>input]:w-full [&>select]:w-full [&>input]:px-3 [&>input]:py-2 [&>select]:px-3 [&>select]:py-2 [&>input]:text-sm [&>select]:text-sm [&>input]:border [&>select]:border [&>input]:border-slate-200 [&>select]:border-slate-200 [&>input]:rounded-lg [&>select]:rounded-lg [&>input]:outline-none [&>select]:outline-none [&>input]:focus:ring-2 [&>select]:focus:ring-2 [&>input]:focus:ring-blue-500/20 [&>select]:focus:ring-blue-500/20 [&>input]:focus:border-blue-400 [&>select]:focus:border-blue-400 [&>input]:bg-slate-50 [&>select]:bg-slate-50">
        {children}
      </div>
    </label>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  vehicle,
  onClose,
  onConfirm,
  deleting,
}: {
  vehicle: Vehicle
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Delete Vehicle</h3>
            <p className="text-sm text-slate-500">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-5">
          Are you sure you want to delete <span className="font-semibold text-slate-900">{vehicle.plate_no}</span>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FleetPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'add' | 'edit' | 'delete' | null>(null)
  const [selected, setSelected] = useState<Vehicle | null>(null)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['fleet', page, search],
    queryFn: () => fleetApi.list({ page, page_size: 25, search }),
  })

  const vehicles = data?.data

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fleet'] })

  const createMutation = useMutation({
    mutationFn: (d: any) => fleetApi.create(d),
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => fleetApi.update(id, data),
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      // uses the api instance directly since fleetApi.delete isn't defined yet
      // swap for fleetApi.delete(id) if you add it
      fetch(`/api/fleet/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); setModal(null) },
  })

  const soon = (d?: string) => d && new Date(d) < new Date(Date.now() + 30 * 86400000)

  const openEdit = (v: Vehicle) => { setSelected(v); setModal('edit') }
  const openDelete = (v: Vehicle) => { setSelected(v); setModal('delete') }

  const totalPages = vehicles ? Math.ceil(vehicles.total / 25) : 1

  return (
    <div className="space-y-5">
      <PageHeader
    title="Fleet"
    subtitle={vehicles ? `${vehicles.total} vehicles` : undefined}
  />

  <button
    onClick={() => {
      setSelected(null)
      setModal('add')
    }}
    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
  >
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
    Add Vehicle
  </button>
        
      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={(v: string) => { setSearch(v); setPage(1) }}
            placeholder="Search plate or fleet no..."
          />
        </CardHeader>

        {isLoading ? (
          <PageLoader />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Plate No.</Th>
                  <Th>Fleet No.</Th>
                  <Th>Type</Th>
                  <Th>Make/Model</Th>
                  <Th>Mulkiya Expiry</Th>
                  <Th>Insurance Expiry</Th>
                  <Th>Status</Th>
                  <Th className="w-20 text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {vehicles?.results?.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState title="No vehicles found" />
                    </td>
                  </tr>
                ) : (
                  vehicles?.results?.map((v: Vehicle) => (
                    <tr key={v.id} className="hover:bg-slate-50 group">
                      <Td className="font-medium text-slate-900">{v.plate_no}</Td>
                      <Td>{v.fleet_no || '—'}</Td>
                      <Td>{v.vehicle_type || '—'}</Td>
                      <Td>{[v.make, v.model, v.year].filter(Boolean).join(' ') || '—'}</Td>
                      <Td className={`text-xs ${soon(v.mulkiya_expiry) ? 'text-red-600 font-semibold' : ''}`}>
                        {v.mulkiya_expiry
                          ? new Date(v.mulkiya_expiry).toLocaleDateString('en-AE')
                          : '—'}
                      </Td>
                      <Td className={`text-xs ${soon(v.insurance_expiry) ? 'text-red-600 font-semibold' : ''}`}>
                        {v.insurance_expiry
                          ? new Date(v.insurance_expiry).toLocaleDateString('en-AE')
                          : '—'}
                      </Td>
                      <Td>
                        <Badge
                          className={
                            v.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }
                        >
                          {v.status}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {/* Action buttons — visible on row hover */}
                        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Edit */}
                          <button
                            onClick={() => openEdit(v)}
                            title="Edit"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => openDelete(v)}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add / Edit Modal */}
      {(modal === 'add' || modal === 'edit') && (
        <VehicleModal
          vehicle={modal === 'edit' ? selected : null}
          onClose={() => setModal(null)}
          saving={createMutation.isPending || updateMutation.isPending}
          onSave={formData => {
            if (modal === 'add') {
              createMutation.mutate(formData)
            } else if (selected) {
              updateMutation.mutate({ id: selected.id, data: formData })
            }
          }}
        />
      )}

      {/* Delete Confirm */}
      {modal === 'delete' && selected && (
        <DeleteConfirm
          vehicle={selected}
          onClose={() => setModal(null)}
          deleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(selected.id)}
        />
      )}
    </div>
  )
}