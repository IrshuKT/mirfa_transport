import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Star } from 'lucide-react'
import { banksApi } from '@/api/services'
import { Button, Card, CardBody, PageHeader, Modal, Input, PageLoader, Badge } from '@/components/ui'
import { useForm } from 'react-hook-form'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BanksPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['banks'], queryFn: () => banksApi.list() })
  const banks = (data?.data ?? []) as any[]

  return (
    <div className="space-y-5">
      <PageHeader title="Bank Accounts" subtitle={`${banks.length} accounts`}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add Bank</Button>}
      />
      {isLoading ? <PageLoader /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {banks.map((b: any) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-slate-900">{b.bank_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.account_name}</p>
                </div>
                {b.is_default && <Badge className="bg-sky-100 text-sky-700"><Star size={10} className="inline mr-1" />Default</Badge>}
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Account No.</span><span className="font-mono">{b.account_no}</span></div>
                {b.iban && <div className="flex justify-between"><span className="text-slate-500">IBAN</span><span className="font-mono text-xs">{b.iban}</span></div>}
                {b.swift_code && <div className="flex justify-between"><span className="text-slate-500">SWIFT</span><span>{b.swift_code}</span></div>}
                <div className="flex justify-between border-t border-slate-100 pt-2 mt-2">
                  <span className="text-slate-500">Balance</span>
                  <span className={`font-bold ${b.current_balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(b.current_balance, b.currency)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CreateBankModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CreateBankModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, reset } = useForm<any>({ defaultValues: { currency: 'AED', is_default: false } })
  const mutation = useMutation({
    mutationFn: (d: any) => banksApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['banks'] }); toast.success('Bank added'); reset(); onClose() },
    onError: () => toast.error('Failed'),
  })
  return (
    <Modal open={open} onClose={onClose} title="Add Bank Account" size="md">
      <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Bank Name *" {...register('bank_name', { required: true })} />
          <Input label="Account Name *" {...register('account_name', { required: true })} />
        </div>
        <Input label="Account No. *" {...register('account_no', { required: true })} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="IBAN" {...register('iban')} />
          <Input label="SWIFT Code" {...register('swift_code')} />
        </div>
        <Input label="Branch" {...register('branch')} />
        <div className="flex items-center gap-2">
          <input type="checkbox" id="is_default" {...register('is_default')} className="rounded" />
          <label htmlFor="is_default" className="text-sm text-slate-600">Set as default bank</label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending}>Add Bank</Button>
        </div>
      </form>
    </Modal>
  )
}
