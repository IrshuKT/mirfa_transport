import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Star, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { banksApi } from '@/api/services'
import { ledgersApi } from '@/api/services'
import { Button, Card, PageHeader, Modal, Input, PageLoader, Badge, EmptyState } from '@/components/ui'
import { useForm } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BanksPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [activeBank, setActiveBank] = useState<any | null>(null)
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
            <Card
              key={b.id}
              className="p-5 cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setActiveBank(b)}
            >
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
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveBank(b) }}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md py-1.5 transition-colors"
              >
                <Receipt size={13} /> View Transactions
              </button>
            </Card>
          ))}
        </div>
      )}
      <CreateBankModal open={showCreate} onClose={() => setShowCreate(false)} />
      <BankLedgerModal bank={activeBank} onClose={() => setActiveBank(null)} />
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

function BankLedgerModal({ bank, onClose }: { bank: any | null; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['bank-book', bank?.id, dateFrom, dateTo],
    queryFn: () => ledgersApi.bankBook(bank!.id, { date_from: dateFrom, date_to: dateTo }),
    enabled: !!bank,
  })
  const report = data?.data as any

  return (
    <Modal open={!!bank} onClose={onClose} title={bank ? `${bank.bank_name} — Transactions` : ''} size="xl">
      {bank && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Input type="date" label="From" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} />
            <Input type="date" label="To" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} />
          </div>

          {isLoading ? (
            <PageLoader />
          ) : isError || !report ? (
            <EmptyState
              icon={<Receipt size={28} />}
              title="No ledger data"
              description="This bank account has no linked accounting entries yet."
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <SummaryTile label="Opening Balance" value={report.opening_balance} currency={bank.currency} />
                <SummaryTile label="Net Movement" value={report.total_debit - report.total_credit} currency={bank.currency} signed />
                <SummaryTile label="Closing Balance" value={report.closing_balance} currency={bank.currency} emphasize />
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Journal No.</th>
                      <th className="text-left px-3 py-2">Description</th>
                      <th className="text-right px-3 py-2">Debit</th>
                      <th className="text-right px-3 py-2">Credit</th>
                      <th className="text-right px-3 py-2">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.lines.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">No transactions in this period.</td></tr>
                    )}
                    {report.lines.map((l: any) => (
                      <tr key={`${l.entry_id}-${l.entry_date}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">{formatDate(l.entry_date)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.journal_no}</td>
                        <td className="px-3 py-2 text-slate-700">{l.line_description || l.description}</td>
                        <td className="px-3 py-2 text-right text-green-700">{l.debit ? formatCurrency(l.debit, bank.currency) : ''}</td>
                        <td className="px-3 py-2 text-right text-red-600">{l.credit ? formatCurrency(l.credit, bank.currency) : ''}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(l.running_balance, bank.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function SummaryTile({ label, value, currency, signed, emphasize }: { label: string; value: number; currency: string; signed?: boolean; emphasize?: boolean }) {
  const positive = value >= 0
  return (
    <div className={`rounded-lg border border-slate-100 p-3 ${emphasize ? 'bg-slate-50' : ''}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-base font-bold flex items-center gap-1 ${positive ? 'text-green-700' : 'text-red-600'}`}>
        {signed && (positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />)}
        {formatCurrency(value, currency)}
      </p>
    </div>
  )
}