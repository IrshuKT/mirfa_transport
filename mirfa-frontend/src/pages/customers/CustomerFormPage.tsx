import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import { customersApi } from '@/api/services'
import {
  Button, Card, CardBody, CardHeader,
  Input, PageHeader, PageLoader, Badge,
} from '@/components/ui'
import toast from 'react-hot-toast'

export default function CustomerFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const qc = useQueryClient()
  const isEdit = !!id

  // fetch existing customer if edit mode
  const { data: existing, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(Number(id)),
    enabled: isEdit,
  })
  const customer = existing?.data

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<any>({
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

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit ? customersApi.update(Number(id), data) : customersApi.create(data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['customers'] })
      toast.success(isEdit ? 'Customer updated!' : 'Customer created!')
      navigate('/customers')
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  if (isEdit && isLoading) return <PageLoader />

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title={isEdit ? `Edit — ${customer?.name || ''}` : 'New Customer'}
        subtitle={isEdit ? `Customer ID #${id}` : 'Fill in the details below'}
        actions={
          <Button variant="outline" icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/customers')}>
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
              <Input label="Customer Code" placeholder="CUST-001" {...register('code')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select {...register('customer_type')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
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
                <select {...register('country')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
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
                <select {...register('currency')}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500">
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

        {/* Contacts */}
        {isEdit && customer && (
          <ContactsSection customerId={Number(id)} contacts={customer.contacts || []} />
        )}

        {/* Notes */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Notes</h3></CardHeader>
          <CardBody>
            <textarea rows={3} {...register('notes')} placeholder="Any additional notes..."
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
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
    </div>
  )
}

// ── Contacts Section (edit mode only) ────────────────────────────────────────
function ContactsSection({ customerId, contacts }: { customerId: number; contacts: any[] }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const { register, handleSubmit, reset } = useForm<any>({
    defaultValues: { is_primary: false }
  })

  const addMutation = useMutation({
    mutationFn: (data: any) => customersApi.addContact(customerId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', String(customerId)] })
      toast.success('Contact added!')
      reset()
      setShowAdd(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (contactId: number) => customersApi.deleteContact(customerId, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer', String(customerId)] })
      toast.success('Contact removed')
    },
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Contacts</h3>
          <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAdd(!showAdd)}>
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">

        {/* Add contact form */}
        {showAdd && (
          <form onSubmit={handleSubmit((d) => addMutation.mutate(d))}
            className="bg-slate-50 rounded-lg p-4 space-y-3 border border-slate-200">
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
                <input type="checkbox" {...register('is_primary')}
                  className="rounded border-slate-300 text-sky-600" />
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

        {/* Contacts list */}
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
            <Button size="sm" variant="ghost" icon={<Trash2 size={13} />}
              loading={deleteMutation.isPending}
              onClick={() => { if (confirm(`Remove ${c.name}?`)) deleteMutation.mutate(c.id) }}
              className="text-red-400 hover:text-red-600 hover:bg-red-50" />
          </div>
        ))}
      </CardBody>
    </Card>
  )
}