import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet, Receipt, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { ledgersApi } from '@/api/services'
import { Card, PageHeader, Input, PageLoader, EmptyState, Badge } from '@/components/ui'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function CashBookPage() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [accountId, setAccountId] = useState<number | undefined>(undefined)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['cash-book', dateFrom, dateTo, accountId],
    queryFn: () => ledgersApi.cashBook({ date_from: dateFrom, date_to: dateTo, account_id: accountId }),
  })
  const report = data?.data as any
  const currency = report?.accounts?.[0]?.account_code ? 'AED' : 'AED' // cash accounts are single-currency AED by convention

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cash Book"
        subtitle={report ? `${report.accounts.length} cash account${report.accounts.length !== 1 ? 's' : ''}` : undefined}
      />

      <div className="flex flex-wrap items-end gap-3">
        <Input type="date" label="From" value={dateFrom} onChange={(e: any) => setDateFrom(e.target.value)} />
        <Input type="date" label="To" value={dateTo} onChange={(e: any) => setDateTo(e.target.value)} />
      </div>

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <EmptyState
          icon={<Wallet size={28} />}
          title="No cash account set up"
          description="Flag an account as the Cash account in Chart of Accounts to enable the Cash Book."
        />
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryTile label="Opening Balance" value={report.opening_balance} currency={currency} />
            <SummaryTile label="Net Movement" value={report.total_debit - report.total_credit} currency={currency} signed />
            <SummaryTile label="Closing Balance" value={report.closing_balance} currency={currency} emphasize />
          </div>

          {report.accounts.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <FilterChip label="All Accounts" active={!accountId} onClick={() => setAccountId(undefined)} />
              {report.accounts.map((a: any) => (
                <FilterChip
                  key={a.account_id}
                  label={a.account_name}
                  active={accountId === a.account_id}
                  onClick={() => setAccountId(a.account_id)}
                />
              ))}
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Journal No.</th>
                    <th className="text-left px-4 py-3">Description</th>
                    <th className="text-right px-4 py-3">Cash In (Dr)</th>
                    <th className="text-right px-4 py-3">Cash Out (Cr)</th>
                    <th className="text-right px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.lines.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <Receipt size={22} className="text-slate-300" />
                        No cash transactions in this period.
                      </div>
                    </td></tr>
                  )}
                  {report.lines
                    .filter((l: any) => !accountId || l.account_id === accountId)
                    .map((l: any) => (
                      <tr key={`${l.entry_id}-${l.entry_date}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">{formatDate(l.entry_date)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{l.journal_no}</td>
                        <td className="px-4 py-2.5 text-slate-700">
                          {l.line_description || l.description}
                          {l.journal_type && (
                            <Badge className="ml-2 bg-slate-100 text-slate-500 text-[10px]">
                              {l.journal_type.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-700">{l.debit ? formatCurrency(l.debit, currency) : ''}</td>
                        <td className="px-4 py-2.5 text-right text-red-600">{l.credit ? formatCurrency(l.credit, currency) : ''}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-900">{formatCurrency(l.running_balance, currency)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function SummaryTile({ label, value, currency, signed, emphasize }: { label: string; value: number; currency: string; signed?: boolean; emphasize?: boolean }) {
  const positive = value >= 0
  return (
    <Card className={`p-4 ${emphasize ? 'bg-slate-50' : ''}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold flex items-center gap-1 ${positive ? 'text-green-700' : 'text-red-600'}`}>
        {signed && (positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />)}
        {formatCurrency(value, currency)}
      </p>
    </Card>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  )
}