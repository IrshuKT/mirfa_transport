import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Plus, Trash2, Save, KeyRound, ShieldCheck } from 'lucide-react'
import { customersApi, inviteApi } from '@/api/services'
import {
  Button, Card, CardBody, CardHeader,
  Input, PageHeader, PageLoader, Badge,
} from '@/components/ui'
import toast from 'react-hot-toast'

// ── helpers ───────────────────────────────────────────────────────────────────
function getApiError(e: any): string {
  const detail = e.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((err: any) => `${err.loc?.slice(-1)[0]}: ${err.msg}`).join(', ')
  }
  return detail || 'Something went wrong'
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const qc = useQueryClient()
  const isEdit = !!id

  // fetch existing customer if edit mode
  const { data: existing, isLoading } = useQuery({
    queryKey: ['customer', Number(id)],
    queryFn: () => customersApi.get(Number(id)),
    enabled: !!id,
  })
  const customer = existing?.data

  // fetch next customer code for new customer
  const { data: nextCodeData } = useQuery({
    queryKey: ['customers-next-code'],
    queryFn: () => customersApi.nextCode?.(), 
  })

  const { register, handleSubmit, reset, setValue, watch, formState: { isDirty } } = useForm<any>({
    defaultValues: {
      customer_type: 'corporate',
      credit_days: 30,
      currency: 'AED',
      country: 'AE',
    }
  })

  // populate form when editing
  useEffect(() => {
    if (customer) reset(customer)
  }, [customer])

  // set auto-generated code for new customer
  useEffect(() => {
    if (!isEdit && nextCodeData?.data?.code) {
      setValue('code', nextCodeData.data.code)
    }
  }, [nextCodeData])

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? customersApi.update(Number(id), data) : customersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(isEdit ? 'Customer updated!' : 'Customer created!')
      navigate('/customers')
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  if (isEdit && isLoading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title={isEdit ? `Edit — ${customer?.name || ''}` : 'New Customer'}
        subtitle={isEdit ? `Customer ID #${id}` : 'Fill in the details below'}
        actions={
          <Button variant="outline" icon={<ArrowLeft size={16} />} onClick={() => navigate('/customers')}>
            Back
          </Button>
        }
      />

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">

        {/* Basic Info */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Basic Information</h3></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Customer Name *" {...register('name', { required: true })} />
              <div>
                <Input
                  label="Customer Code"
                  placeholder="MRTC-01"
                  {...register('code')}
                />
                {!isEdit && (
                  <p className="text-xs text-slate-400 mt-1">
                    Auto-generated · you can override
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  {...register('customer_type')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="corporate">Corporate</option>
                  <option value="individual">Individual</option>
                  <option value="government">Government</option>
                </select>
              </div>
              <Input label="TRN (UAE Tax Reg No)" {...register('trn')} />
            </div>
          </CardBody>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Contact Information</h3></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" {...register('email')} />
              <Input label="Phone" {...register('phone')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Mobile" {...register('mobile')} />
              <Input label="City" {...register('city')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                <select
                  {...register('country')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="AE">🇦🇪 UAE</option>
                  <option value="SA">🇸🇦 Saudi Arabia</option>
                  <option value="OM">🇴🇲 Oman</option>
                  <option value="KW">🇰🇼 Kuwait</option>
                  <option value="QA">🇶🇦 Qatar</option>
                  <option value="BH">🇧🇭 Bahrain</option>
                  <option value="IN">🇮🇳 India</option>
                  <option value="PK">🇵🇰 Pakistan</option>
                  <option value="GB">🇬🇧 UK</option>
                  <option value="US">🇺🇸 USA</option>
                </select>
              </div>
              <Input label="Address" {...register('address')} />
            </div>
          </CardBody>
        </Card>

        {/* Financial Info */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Financial Settings</h3></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Input label="Credit Days" type="number"
                {...register('credit_days', { valueAsNumber: true })} />
              <Input label="Credit Limit" type="number" step="0.01" placeholder="0.00"
                {...register('credit_limit', { valueAsNumber: true })} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
                <select
                  {...register('currency')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="INR">INR — Indian Rupee</option>
                </select>
              </div>
            </div>
          </CardBody>
        </Card>

       

        {/* Notes */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Notes</h3></CardHeader>
          <CardBody>
            <textarea
              rows={3}
              {...register('notes')}
              placeholder="Any additional notes..."
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </CardBody>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/customers')}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending} icon={<Save size={15} />}>
            {isEdit ? 'Save Changes' : 'Create Customer'}
          </Button>
        </div>

      </form>
       {/* Contacts — edit mode only */}
        {isEdit && customer && (
          <ContactsSection customerId={Number(id)} />
        )}

        {/* Portal Access — edit mode only */}
        {isEdit && customer && (
          <PortalAccessCard customer={customer} />
        )}

    </div>
  )
}

// ── Portal Access Card ────────────────────────────────────────────────────────
function PortalAccessCard({ customer }: { customer: any }) {
  const qc = useQueryClient()

  const createMutation = useMutation({
    mutationFn: () => inviteApi.createCustomerPortal(customer.id, true),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['customer', String(customer.id)] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(`Portal login created! Temp password: ${res.data.temp_password}`)
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const revokeMutation = useMutation({
    mutationFn: () => inviteApi.revokeCustomerPortal(customer.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', String(customer.id)] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Portal access revoked')
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800">Customer Portal Access</h3>
        </div>
      </CardHeader>
      <CardBody>
        {customer.portal_user_id ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                <ShieldCheck size={16} className="text-green-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">Portal access active</p>
                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {customer.email} · User ID #{customer.portal_user_id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<KeyRound size={13} />}
                loading={createMutation.isPending}
                onClick={() => {
                  if (confirm('Send a new password reset email to this customer?')) {
                    createMutation.mutate()
                  }
                }}
              >
                Reset Password
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={revokeMutation.isPending}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Revoke portal access for ${customer.name}? They will no longer be able to log in.`)) {
                    revokeMutation.mutate()
                  }
                }}
              >
                Revoke Access
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                <ShieldCheck size={16} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">No portal access</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {customer.email
                    ? 'Create login credentials and send via email'
                    : 'Add an email address first to enable portal access'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              icon={<KeyRound size={13} />}
              disabled={!customer.email}
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Create Portal Login
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Contacts Section ──────────────────────────────────────────────────────────
function ContactsSection({ customerId }: { customerId: number }) {
 const [showAdd, setShowAdd] = useState(false)
  const { data } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => customersApi.get(customerId),
  })

  const contacts = data?.data?.contacts || []
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<any>({
    defaultValues: { is_primary: false }
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => customersApi.addContact(customerId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      toast.success('Contact added!')
      reset()
      setShowAdd(false)
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (contactId: number) => customersApi.deleteContact(customerId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', customerId] })
      toast.success('Contact removed')
    },
    onError: (e: any) => toast.error(getApiError(e)),
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Contacts</h3>
          <Button size="sm" icon={<Plus size={14} />} onClick={(e) => {
  e.preventDefault()
  e.stopPropagation()
  setShowAdd(!showAdd)
}}>
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">

        {showAdd && (
          <form
  onSubmit={(d) =>{
    d.preventDefault ()
    d.stopPropagation()
     handleSubmit((e) => addMutation.mutate(e))(d)}}
    className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200 block"

          >
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name *" {...register('name', { required: true })} />
              <Input label="Designation" {...register('designation')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" {...register('email')} />
              <Input label="Phone" {...register('phone')} />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" {...register('is_primary')} className="rounded border-slate-300 text-sky-600" />
                Primary contact
              </label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline"
                  onClick={() => { reset(); setShowAdd(false) }}>Cancel</Button>
                <Button type="submit" size="sm" loading={addMutation.isPending}>Save</Button>
              </div>
            </div>
          </form>
        )}

        {contacts.length === 0 && !showAdd ? (
          <p className="text-sm text-slate-400 text-center py-4">No contacts added yet</p>
        ) : contacts.map((c: any) => (
          <div key={c.id}
            className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900">{c.name}</p>
                {c.is_primary && <Badge className="bg-sky-100 text-sky-700 text-xs">Primary</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {[c.designation, c.email, c.phone].filter(Boolean).join(' · ')}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 size={13} />}
              loading={deleteMutation.isPending}
              onClick={() => { if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c.id) }}
              className="text-red-400 hover:text-red-600 hover:bg-red-50"
            />
          </div>
        ))}
      </CardBody>
    </Card>
  )
}