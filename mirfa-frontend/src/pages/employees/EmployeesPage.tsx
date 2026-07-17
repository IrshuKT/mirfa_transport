// EmployeesPage.tsx
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '@/api/services'
import {
  Card, CardHeader, Table, Th, Td,
  PageHeader, SearchInput, Badge, EmptyState, PageLoader, Button, Input, Select
} from '@/components/ui'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  full_name: '',
  employee_no: '',
  designation: '',
  department: '',
  email: '',
  phone: '',
  mobile: '',
  nationality: '',
  join_date: '',
  end_date: '',
  basic_salary: '',
  currency: 'AED',
  status: 'active',
  // UAE Compliance
  emirates_id: '',
  emirates_id_expiry: '',
  visa_no: '',
  visa_expiry: '',
  passport_no: '',
  passport_expiry: '',
  labour_card_no: '',
  labour_card_expiry: '',
  notes: '',
}

// ── Inline Add/Edit Form ───────────────────────────────────────────────────────
function EmployeeForm({ employee, onCancel }: { employee?: any; onCancel: () => void }) {
  const qc = useQueryClient()
  const isEdit = !!employee
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    setForm(employee ? {
      full_name:           employee.full_name ?? '',
      employee_no:         employee.employee_no ?? '',
      designation:         employee.designation ?? '',
      department:          employee.department ?? '',
      email:               employee.email ?? '',
      phone:               employee.phone ?? '',
      mobile:              employee.mobile ?? '',
      nationality:         employee.nationality ?? '',
      join_date:           employee.join_date?.slice(0, 10) ?? '',
      end_date:            employee.end_date?.slice(0, 10) ?? '',
      basic_salary:        employee.basic_salary ?? '',
      currency:            employee.currency ?? 'AED',
      status:              employee.status ?? 'active',
      emirates_id:         employee.emirates_id ?? '',
      emirates_id_expiry:  employee.emirates_id_expiry?.slice(0, 10) ?? '',
      visa_no:             employee.visa_no ?? '',
      visa_expiry:         employee.visa_expiry?.slice(0, 10) ?? '',
      passport_no:         employee.passport_no ?? '',
      passport_expiry:     employee.passport_expiry?.slice(0, 10) ?? '',
      labour_card_no:      employee.labour_card_no ?? '',
      labour_card_expiry:  employee.labour_card_expiry?.slice(0, 10) ?? '',
      notes:               employee.notes ?? '',
    } : EMPTY_FORM)
  }, [employee])

  const mutation = useMutation({
  mutationFn: (data: any) => {
    // Convert empty strings to null for optional fields
    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? null : v])
    )
    return isEdit ? employeesApi.update(employee.id, cleaned) : employeesApi.create(cleaned)
  },
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['employees'] })
    toast.success(isEdit ? 'Employee updated' : 'Employee added')
    onCancel()
  },
  onError: () => toast.error('Something went wrong.'),
})

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <div className="p-5 space-y-6">
        <h2 className="text-sm font-semibold text-slate-700">
          {isEdit ? `Editing: ${employee.full_name}` : 'New Employee'}
        </h2>

        {/* Basic Info */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Basic Information</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Input label="Full Name *"     value={form.full_name}   onChange={set('full_name')} />
            <Input label="Employee No. *"  value={form.employee_no} onChange={set('employee_no')} />
            <Input label="Designation"     value={form.designation} onChange={set('designation')} />
            <Input label="Department"      value={form.department}  onChange={set('department')} />
            <Input label="Email"           type="email" value={form.email}  onChange={set('email')} />
            <Input label="Phone"           value={form.phone}       onChange={set('phone')} />
            <Input label="Mobile"          value={form.mobile}      onChange={set('mobile')} />
            <Input label="Nationality"     value={form.nationality} onChange={set('nationality')} />
            <Input label="Join Date"       type="date" value={form.join_date}  onChange={set('join_date')} />
            <Input label="End Date"        type="date" value={form.end_date}   onChange={set('end_date')} />
            <Input label="Basic Salary"    type="number" value={form.basic_salary} onChange={set('basic_salary')} />
            <Select label="Currency" value={form.currency} onChange={set('currency')}
              options={[
                { label: 'AED', value: 'AED' },
                { label: 'USD', value: 'USD' },
              ]} />
            <Select label="Status" value={form.status} onChange={set('status')}
              options={[
                { label: 'Active',      value: 'active' },
                { label: 'On Leave',    value: 'on_leave' },
                { label: 'Probation',   value: 'probation' },
                { label: 'Terminated',  value: 'terminated' },
              ]} />
          </div>
        </div>

        {/* UAE Compliance */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">UAE Compliance Documents</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Input label="Emirates ID"        value={form.emirates_id}        onChange={set('emirates_id')} />
            <Input label="EID Expiry"         type="date" value={form.emirates_id_expiry} onChange={set('emirates_id_expiry')} />
            <Input label="Visa No."           value={form.visa_no}            onChange={set('visa_no')} />
            <Input label="Visa Expiry"        type="date" value={form.visa_expiry}        onChange={set('visa_expiry')} />
            <Input label="Passport No."       value={form.passport_no}        onChange={set('passport_no')} />
            <Input label="Passport Expiry"    type="date" value={form.passport_expiry}    onChange={set('passport_expiry')} />
            <Input label="Labour Card No."    value={form.labour_card_no}     onChange={set('labour_card_no')} />
            <Input label="Labour Card Expiry" type="date" value={form.labour_card_expiry} onChange={set('labour_card_expiry')} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={2}
            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => mutation.mutate(form)} loading={mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Add Employee'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Inactivate Confirm Row ─────────────────────────────────────────────────────
function InactivateConfirmRow({
  employee, onCancel
}: { employee: any; onCancel: () => void }) {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => employeesApi.update(employee.id, { status: 'inactive' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success(`${employee.full_name} set as inactive`)
      onCancel()
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  })

  return (
    <tr className="bg-red-50">
      <td colSpan={8} className="px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-700">
            Set <strong>{employee.full_name}</strong> as inactive?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="danger" onClick={() => mutation.mutate()} loading={mutation.isPending}>
              Confirm Inactive
            </Button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [formState, setFormState] = useState<{ show: boolean; employee?: any }>({ show: false })
  const [inactivateId, setInactivateId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', page, search],
    queryFn: () => employeesApi.list({ page, page_size: 25, search }),
  })

  const employees = data?.data
  const soon = (d?: string) => d && new Date(d) < new Date(Date.now() + 30 * 86400000)

  const handleEdit = (e: any) => {
    setInactivateId(null)      // close inactivate if open
    setFormState({ show: true, employee: e })
  }

  const handleInactivate = (id: number) => {
    setFormState({ show: false }) // close form if open
    setInactivateId(id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Employees"
          subtitle={employees ? `${employees.total} employees` : undefined}
        />
        <Button onClick={() => { setFormState({ show: true }); setInactivateId(null) }}>
          + Add Employee
        </Button>
      </div>

      {/* Inline Add / Edit Form */}
      {formState.show && (
        <EmployeeForm
          employee={formState.employee}
          onCancel={() => setFormState({ show: false })}
        />
      )}

      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={(v: string) => { setSearch(v); setPage(1) }}
            placeholder="Search employees..."
          />
        </CardHeader>

        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>No.</Th><Th>Name</Th><Th>Designation</Th><Th>Department</Th>
                <Th>Visa Expiry</Th><Th>EID Expiry</Th><Th>Status</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {employees?.results?.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="No employees found" /></td></tr>
              ) : employees?.results?.map((e: any) => (
                <React.Fragment key={e.id}>
                  <tr className={`hover:bg-slate-50 ${inactivateId === e.id ? 'bg-red-50' : ''}`}>
                    <Td className="text-xs text-slate-500">{e.employee_no}</Td>
                    <Td className="font-medium text-slate-900">{e.full_name}</Td>
                    <Td>{e.designation || '—'}</Td>
                    <Td>{e.department || '—'}</Td>
                    <Td className={`text-xs ${soon(e.visa_expiry) ? 'text-red-600 font-semibold' : ''}`}>
                      {e.visa_expiry ? new Date(e.visa_expiry).toLocaleDateString('en-AE') : '—'}
                    </Td>
                    <Td className={`text-xs ${soon(e.emirates_id_expiry) ? 'text-red-600 font-semibold' : ''}`}>
                      {e.emirates_id_expiry ? new Date(e.emirates_id_expiry).toLocaleDateString('en-AE') : '—'}
                    </Td>
                    <Td>
                      <Badge className={e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                        {e.status}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => handleEdit(e)}
                        >Edit</button>
                        {e.status === 'active' && (
                          <button
                            className="text-xs text-red-500 hover:underline"
                            onClick={() => handleInactivate(e.id)}
                          >Inactivate</button>
                        )}
                      </div>
                    </Td>
                  </tr>

                  {/* Inline inactivate confirm below the row */}
                  {inactivateId === e.id && (
                    <InactivateConfirmRow
                      key={`inactivate-${e.id}`}
                      employee={e}
                      onCancel={() => setInactivateId(null)}
                    />
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}