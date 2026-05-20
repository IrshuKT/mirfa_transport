import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Key, User as UserIcon, Shield, Trash2, Eye, EyeOff } from 'lucide-react'
import { authApi, usersApi, rolesApi, inviteApi } from '@/api/services'
import { useAuthStore } from '@/stores/authStore'
import {
  Button, Card, CardBody, CardHeader, PageHeader,
  Input, Select, Modal, Table, Th, Td, Badge,
  EmptyState, PageLoader,
} from '@/components/ui'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'


// ── Role colours ──────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
  super_admin:     'bg-red-100 text-red-700',
  company_admin:   'bg-purple-100 text-purple-700',
  accountant:      'bg-blue-100 text-blue-700',
  dispatcher:      'bg-indigo-100 text-indigo-700',
  staff:           'bg-sky-100 text-sky-700',
  driver:          'bg-green-100 text-green-700',
  customer_portal: 'bg-orange-100 text-orange-700',
  vendor_portal:   'bg-yellow-100 text-yellow-700',
}

// ── Create user schema ────────────────────────────────────────────────────────
const createSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string()
               .min(8,  'Min 8 characters')
               .regex(/[A-Z]/, 'Need one uppercase letter')
               .regex(/[0-9]/, 'Need one number'),
  phone:     z.string().optional(),
  role_name: z.string().min(1, 'Select a role'),
})
type CreateForm = z.infer<typeof createSchema>

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'users' | 'profile' | 'password'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('users')
  const isAdmin = user?.role === 'super_admin' || user?.role === 'company_admin'

  const tabs = [
    { id: 'users'    as Tab, label: 'Users',    icon: <UserIcon size={15} />, show: isAdmin },
    { id: 'profile'  as Tab, label: 'Profile',  icon: <Shield size={15} />,   show: true },
    { id: 'password' as Tab, label: 'Password', icon: <Key size={15} />,      show: true },
  ].filter(t => t.show)

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'users'    && isAdmin && <UsersTab />}
      {tab === 'profile'  && <ProfileTab />}
      {tab === 'password' && <PasswordTab />}
    </div>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const [showCreate, setShowCreate] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, page_size: 25, search: search || undefined }),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => usersApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated') },
    onError:   () => toast.error('Failed to deactivate user'),
  })

  const users = data?.data

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{users?.total ?? 0} users</p>
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or email..."
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Create User
        </Button>
      </div>

      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Last Login</Th>
                <Th>2FA</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {!users?.results?.length ? (
                <tr><td colSpan={8}><EmptyState title="No users found" /></td></tr>
              ) : users.results.map((u: any) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 uppercase shrink-0">
                        {u.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{u.full_name}</p>
                        {u.id === me?.id && <span className="text-xs text-sky-500">You</span>}
                      </div>
                    </div>
                  </Td>
                  <Td className="text-xs">{u.email}</Td>
                  <Td className="text-xs">{u.phone || '—'}</Td>
                  <Td>
                    <Badge className={`capitalize text-xs ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role?.replace(/_/g, ' ')}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge className={u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>
                      {u.status}
                    </Badge>
                  </Td>
                  <Td className="text-xs">{formatDate(u.last_login_at)}</Td>
                  <Td>
                    <Badge className={u.totp_enabled ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}>
                      {u.totp_enabled ? '✓ On' : 'Off'}
                    </Badge>
                  </Td>
                  <Td>
                    {u.id !== me?.id && u.status === 'active' && (
                      <Button size="sm" variant="ghost"
                        icon={<Trash2 size={13} />}
                        loading={deactivateMutation.isPending}
                        onClick={() => { if (confirm(`Deactivate ${u.full_name}?`)) deactivateMutation.mutate(u.id) }}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        Deactivate
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {users && users.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {users.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page>=users.pages} onClick={() => setPage(p=>p+1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

// ── Create User Modal ─────────────────────────────────────────────────────────
function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { user: me } = useAuthStore()
  const [showPw, setShowPw] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role_name: 'staff' },
  })

  const password = watch('password') || ''
  const strengthChecks = [
    { label: '8+ chars',   ok: password.length >= 8 },
    { label: 'Uppercase',  ok: /[A-Z]/.test(password) },
    { label: 'Number',     ok: /[0-9]/.test(password) },
    { label: '12+ chars',  ok: password.length >= 12 },
  ]

  // Role options — filtered by current user role
  const roleOptions = [
    ...(me?.role === 'super_admin' ? [{ value: 'company_admin', label: 'Company Admin' }] : []),
    { value: 'accountant',      label: 'Accountant' },
    { value: 'dispatcher',      label: 'Dispatcher' },
    { value: 'staff',           label: 'Staff' },
    { value: 'driver',          label: 'Driver' },
    { value: 'customer_portal', label: 'Customer Portal' },
    { value: 'vendor_portal',   label: 'Vendor Portal' },
  ]

  const ROLE_DESCRIPTIONS: Record<string, string> = {
    company_admin:   'Full access within company — manage all modules',
    accountant:      'Accounting module + read-only access to jobs',
    dispatcher:      'Manage jobs, assign drivers, track fleet',
    staff:           'Create quotations, manage customers, read jobs',
    driver:          'View own assigned jobs only (mobile app login)',
    customer_portal: 'Customer self-service — view their jobs & invoices',
    vendor_portal:   'Vendor/subcontractor — view assigned jobs',
  }

  const selectedRole = watch('role_name')

  // Fetch real role IDs from backend
  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  })

  const mutation = useMutation({
    mutationFn: async (data: CreateForm) => {
      const roles = rolesData?.data || []
      const role = roles.find((r: any) => r.name === data.role_name)
      
      // Fallback role ID map if API hasn't loaded yet
      const fallbackMap: Record<string, number> = {
        super_admin: 1, company_admin: 2, accountant: 3,
        dispatcher: 4, staff: 5, driver: 6,
        customer_portal: 7, vendor_portal: 8,
      }
      const role_id = role?.id ?? fallbackMap[data.role_name] ?? 5

      // Use invite endpoint — creates user by role name + sends welcome email
      return inviteApi.inviteUser({
        full_name:           data.full_name,
        email:               data.email,
        phone:               data.phone || undefined,
        role_name:           data.role_name,
        send_welcome_email:  true,
      })
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(`✅ User "${res.data.full_name}" created!`)
      reset()
      onClose()
    },
    onError: (e: any) => {
      const msg = e.response?.data?.detail || 'Failed to create user'
      toast.error(msg)
    },
  })

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Create New User" size="md">
      <form onSubmit={handleSubmit((d: CreateForm) => mutation.mutate(d))} className="space-y-4">

        <Input label="Full Name *" placeholder="Ahmed Al Rashidi"
          error={errors.full_name?.message} {...register('full_name')} />

        <Input label="Email Address *" type="email" placeholder="ahmed@mirfatransport.ae"
          error={errors.email?.message} {...register('email')} />

        <Input label="Phone" placeholder="+971 50 000 0000" {...register('phone')} />

        {/* Password with strength meter */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Password *</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm placeholder-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              {...register('password')}
            />
            <button type="button" onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {/* Strength bar */}
          {password && (
            <div className="space-y-1.5 mt-2">
              <div className="flex gap-1">
                {strengthChecks.map((c, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${c.ok ? 'bg-green-400' : 'bg-slate-200'}`} />
                ))}
              </div>
              <div className="flex gap-3">
                {strengthChecks.map((c, i) => (
                  <span key={i} className={`text-xs ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
                    {c.ok ? '✓' : '○'} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>

        {/* Role selector */}
        <Select label="Role *" options={roleOptions}
          error={errors.role_name?.message} {...register('role_name')} />

        {/* Role description hint */}
        {selectedRole && ROLE_DESCRIPTIONS[selectedRole] && (
          <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 text-xs text-sky-700">
            <span className="font-semibold capitalize">{selectedRole.replace(/_/g, ' ')}: </span>
            {ROLE_DESCRIPTIONS[selectedRole]}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending} icon={<Plus size={15} />}>
            Create User
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user } = useAuthStore()
  return (
    <Card className="max-w-xl">
      <CardHeader><h3 className="font-semibold text-slate-800">My Profile</h3></CardHeader>
      <CardBody>
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-sky-600 flex items-center justify-center text-2xl font-bold text-white uppercase">
            {user?.full_name?.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{user?.full_name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <Badge className={`mt-1 capitalize text-xs ${ROLE_COLORS[user?.role || ''] || 'bg-gray-100'}`}>
              {user?.role?.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-100 pt-4">
          {[
            ['Full Name',  user?.full_name],
            ['Email',      user?.email],
            ['Phone',      user?.phone || '—'],
            ['Role',       user?.role?.replace(/_/g, ' ')],
            ['2FA',        user?.totp_enabled ? '✓ Enabled' : 'Disabled'],
            ['Last Login', formatDate(user?.last_login_at)],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="font-medium text-slate-800 mt-0.5 capitalize">{value}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// ── Password Tab ──────────────────────────────────────────────────────────────
function PasswordTab() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [showNew, setShowNew]     = useState(false)

  const checks = [
    { label: '8+ characters',   ok: newPw.length >= 8 },
    { label: '1 uppercase',     ok: /[A-Z]/.test(newPw) },
    { label: '1 number',        ok: /[0-9]/.test(newPw) },
    { label: 'Passwords match', ok: newPw === confirm && confirm.length > 0 },
  ]
  const allOk = checks.every(c => c.ok)

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allOk) { toast.error('Please meet all password requirements'); return }
    setLoading(true)
    try {
      await authApi.changePassword(currentPw, newPw, confirm)
      toast.success('Password changed successfully!')
      setCurrentPw(''); setNewPw(''); setConfirm('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally { setLoading(false) }
  }

  return (
    <Card className="max-w-md">
      <CardHeader><h3 className="font-semibold text-slate-800">Change Password</h3></CardHeader>
      <CardBody>
        <form onSubmit={handleChange} className="space-y-4">
          <Input label="Current Password" type="password"
            value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">New Password</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                required />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <Input label="Confirm New Password" type="password"
            value={confirm} onChange={e => setConfirm(e.target.value)} required />

          {/* Requirements checklist */}
          {(newPw || confirm) && (
            <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={c.ok ? 'text-green-500' : 'text-slate-300'}>
                    {c.ok ? '✓' : '○'}
                  </span>
                  <span className={c.ok ? 'text-green-700' : 'text-slate-500'}>{c.label}</span>
                </div>
              ))}
            </div>
          )}

          <Button type="submit" loading={loading} disabled={!allOk || !currentPw} className="w-full">
            Update Password
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
