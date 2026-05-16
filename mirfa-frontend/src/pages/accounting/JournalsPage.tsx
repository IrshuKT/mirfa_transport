import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RotateCcw } from 'lucide-react'
import { journalsApi, coaApi } from '@/api/services'
import {
  Button, Card, Table, Th, Td,
  PageHeader, Modal, Input, Select, EmptyState, PageLoader, Badge,
} from '@/components/ui'
import { useForm, useFieldArray } from 'react-hook-form'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function JournalsPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['journals', page],
    queryFn: () => journalsApi.list({ page, page_size: 25 }),
  })

  const reverseMutation = useMutation({
    mutationFn: (id: number) => journalsApi.reverse(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['journals'] }); toast.success(`Reversal posted: ${res.data.reversal_journal_no}`) },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const journals = data?.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Journal Entries"
        subtitle={journals ? `${journals.total} entries` : undefined}
        actions={<Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>New Journal</Button>}
      />
      <Card>
        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr><Th>Journal No.</Th><Th>Type</Th><Th>Date</Th><Th>Description</Th><Th>Debit</Th><Th>Credit</Th><Th>Status</Th><Th> </Th></tr>
            </thead>
            <tbody>
              {journals?.results?.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="No journal entries found" /></td></tr>
              ) : journals?.results?.map((j: any) => (
                <tr key={j.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-sky-700">{j.journal_no}</Td>
                  <Td><Badge className="bg-slate-100 text-slate-600 capitalize text-xs">{j.journal_type?.replace(/_/g,' ')}</Badge></Td>
                  <Td className="text-xs">{formatDate(j.entry_date)}</Td>
                  <Td className="max-w-[200px] truncate text-xs">{j.description}</Td>
                  <Td className="font-mono text-sm">{formatCurrency(j.total_debit)}</Td>
                  <Td className="font-mono text-sm">{formatCurrency(j.total_credit)}</Td>
                  <Td>
                    {j.is_reversed
                      ? <Badge className="bg-gray-100 text-gray-500">Reversed</Badge>
                      : <Badge className="bg-green-100 text-green-700">Posted</Badge>
                    }
                  </Td>
                  <Td>
                    {!j.is_reversed && j.journal_type === 'general' && (
                      <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />}
                        loading={reverseMutation.isPending}
                        onClick={() => { if (confirm('Reverse this entry?')) reverseMutation.mutate(j.id) }}
                      >Reverse</Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {journals && journals.pages > 1 && (
          <div className="flex justify-between items-center px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {journals.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= journals.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
      <CreateJournalModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function CreateJournalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, control, watch, reset } = useForm<any>({
    defaultValues: {
      journal_type: 'general',
      lines: [
        { account_id: '', description: '', debit: 0, credit: 0 },
        { account_id: '', description: '', debit: 0, credit: 0 },
      ],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const lines = watch('lines') || []

  const totalDebit  = lines.reduce((s: number, l: any) => s + (Number(l.debit)  || 0), 0)
  const totalCredit = lines.reduce((s: number, l: any) => s + (Number(l.credit) || 0), 0)
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const { data: accounts } = useQuery({ queryKey: ['coa'], queryFn: () => coaApi.list(), enabled: open })

  const mutation = useMutation({
    mutationFn: (d: any) => journalsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal posted'); reset(); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const accountOptions = accounts?.data?.map((a: any) => ({ value: a.id, label: `${a.code} — ${a.name}` })) ?? []

  return (
    <Modal open={open} onClose={onClose} title="New Journal Entry" size="xl">
      <form onSubmit={handleSubmit(d => mutation.mutate({ ...d, lines: d.lines.map((l: any) => ({ ...l, account_id: Number(l.account_id), debit: Number(l.debit), credit: Number(l.credit) })) }))} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Input label="Date *" type="date" {...register('entry_date', { required: true })} />
          <Select label="Type" options={[
            { value: 'general', label: 'General' },
            { value: 'bank', label: 'Bank' },
            { value: 'opening', label: 'Opening Balance' },
          ]} {...register('journal_type')} />
          <Input label="Reference" {...register('reference')} />
        </div>
        <Input label="Description *" {...register('description', { required: true })} />

        {/* Lines */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Journal Lines</p>
            <Button type="button" size="sm" variant="outline" icon={<Plus size={14} />}
              onClick={() => append({ account_id: '', description: '', debit: 0, credit: 0 })}>
              Add Line
            </Button>
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500">Account</th>
                  <th className="text-left px-2 py-2 text-slate-500">Description</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-28">Debit (AED)</th>
                  <th className="text-left px-2 py-2 text-slate-500 w-28">Credit (AED)</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, i) => (
                  <tr key={field.id} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      <select className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        {...register(`lines.${i}.account_id`)}>
                        <option value="">Select account</option>
                        {accountOptions.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" placeholder="Description" {...register(`lines.${i}.description`)} /></td>
                    <td className="px-2 py-1.5"><input type="number" step="0.01" className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none font-mono" {...register(`lines.${i}.debit`)} /></td>
                    <td className="px-2 py-1.5"><input type="number" step="0.01" className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none font-mono" {...register(`lines.${i}.credit`)} /></td>
                    <td className="px-1">{fields.length > 2 && <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-xs font-bold text-right text-slate-600">Totals</td>
                  <td className="px-2 py-2 text-xs font-mono font-bold">{formatCurrency(totalDebit)}</td>
                  <td className="px-2 py-2 text-xs font-mono font-bold">{formatCurrency(totalCredit)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {!balanced && totalDebit > 0 && (
            <p className="text-xs text-red-600 mt-1">⚠ Journal is not balanced — difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}</p>
          )}
          {balanced && totalDebit > 0 && (
            <p className="text-xs text-green-600 mt-1">✓ Journal is balanced</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={mutation.isPending} disabled={!balanced}>Post Journal</Button>
        </div>
      </form>
    </Modal>
  )
}
