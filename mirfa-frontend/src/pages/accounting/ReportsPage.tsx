import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api/services'
import {
  Button, Card, CardHeader, CardBody, Table, Th, Td,
  PageHeader, Select, PageLoader,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Input } from '@/components/ui'

type ReportType = 'trial_balance' | 'profit_loss' | 'balance_sheet' | 'vat_return'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('profit_loss')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [run, setRun] = useState(false)

  const { data: tbData, isLoading: tbLoading } = useQuery({
    queryKey: ['report', 'tb', dateFrom, dateTo],
    queryFn: () => reportsApi.trialBalance(dateFrom, dateTo),
    enabled: run && reportType === 'trial_balance',
  })

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ['report', 'pl', dateFrom, dateTo],
    queryFn: () => reportsApi.profitLoss(dateFrom, dateTo),
    enabled: run && reportType === 'profit_loss',
  })

  const { data: bsData, isLoading: bsLoading } = useQuery({
    queryKey: ['report', 'bs', dateTo],
    queryFn: () => reportsApi.balanceSheet(dateTo),
    enabled: run && reportType === 'balance_sheet',
  })

  const { data: vatData, isLoading: vatLoading } = useQuery({
    queryKey: ['report', 'vat', dateFrom, dateTo],
    queryFn: () => reportsApi.vatReturn(dateFrom, dateTo),
    enabled: run && reportType === 'vat_return',
  })

  const isLoading = tbLoading || plLoading || bsLoading || vatLoading

  return (
    <div className="space-y-5">
      <PageHeader title="Financial Reports" subtitle="UAE-compliant accounting reports" />

      {/* Controls */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <Select
              label="Report Type"
              value={reportType}
              onChange={e => { setReportType(e.target.value as ReportType); setRun(false) }}
              options={[
                { value: 'profit_loss',   label: 'Profit & Loss' },
                { value: 'trial_balance', label: 'Trial Balance' },
                { value: 'balance_sheet', label: 'Balance Sheet' },
                { value: 'vat_return',    label: 'VAT Return (FTA)' },
              ]}
              className="w-52"
            />
            {reportType !== 'balance_sheet' && (
              <Input label="From" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            )}
            <Input
              label={reportType === 'balance_sheet' ? 'As of Date' : 'To'}
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
            <Button onClick={() => setRun(true)}>Run Report</Button>
          </div>
        </CardBody>
      </Card>

      {isLoading && <PageLoader />}

      {/* P&L */}
      {run && reportType === 'profit_loss' && plData?.data && (
        <PLReport data={plData.data} />
      )}

      {/* Trial Balance */}
      {run && reportType === 'trial_balance' && tbData?.data && (
        <TBReport data={tbData.data} />
      )}

      {/* Balance Sheet */}
      {run && reportType === 'balance_sheet' && bsData?.data && (
        <BSReport data={bsData.data} />
      )}

      {/* VAT Return */}
      {run && reportType === 'vat_return' && vatData?.data && (
        <VATReport data={vatData.data} />
      )}
    </div>
  )
}

function PLReport({ data }: { data: any }) {
  const chartData = [
    { name: 'Revenue',  value: data.revenue.total },
    { name: 'Expenses', value: data.expenses.total },
    { name: 'Net Profit', value: data.net_profit },
  ]
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: data.revenue.total, color: 'text-green-600' },
          { label: 'Total Expenses', value: data.expenses.total, color: 'text-red-500' },
          { label: 'Net Profit', value: data.net_profit, color: data.net_profit >= 0 ? 'text-green-700' : 'text-red-700' },
        ].map(s => (
          <Card key={s.label} className="p-5 text-center">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{formatCurrency(s.value)}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barSize={50}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), 'AED']} />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* Revenue */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Revenue</h3></CardHeader>
          <Table>
            <thead><tr><Th>Account</Th><Th>Balance</Th></tr></thead>
            <tbody>
              {data.revenue.accounts.map((a: any) => (
                <tr key={a.account_id}><Td>{a.code} — {a.name}</Td><Td className="text-right font-medium text-green-600">{formatCurrency(a.balance)}</Td></tr>
              ))}
              <tr className="bg-green-50"><Td className="font-bold">Total Revenue</Td><Td className="text-right font-bold text-green-700">{formatCurrency(data.revenue.total)}</Td></tr>
            </tbody>
          </Table>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Expenses</h3></CardHeader>
          <Table>
            <thead><tr><Th>Account</Th><Th>Balance</Th></tr></thead>
            <tbody>
              {data.expenses.accounts.map((a: any) => (
                <tr key={a.account_id}><Td>{a.code} — {a.name}</Td><Td className="text-right font-medium text-red-500">{formatCurrency(a.balance)}</Td></tr>
              ))}
              <tr className="bg-red-50"><Td className="font-bold">Total Expenses</Td><Td className="text-right font-bold text-red-600">{formatCurrency(data.expenses.total)}</Td></tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}

function TBReport({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Trial Balance</h3>
          <span className={`text-sm font-medium ${data.totals.balanced ? 'text-green-600' : 'text-red-600'}`}>
            {data.totals.balanced ? '✓ Balanced' : '✗ Not balanced!'}
          </span>
        </div>
      </CardHeader>
      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Account</Th>
            <Th>Type</Th>
            <Th className="text-right">Debit</Th>
            <Th className="text-right">Credit</Th>
          </tr>
        </thead>
        <tbody>
          {data.accounts.map((a: any) => (
            <tr key={a.account_id} className="hover:bg-slate-50">
              <Td className="text-xs text-slate-500">{a.code}</Td>
              <Td>{a.name}</Td>
              <Td className="capitalize text-xs">{a.account_type}</Td>
              <Td className="text-right font-mono text-sm">{a.total_debit > 0 ? formatCurrency(a.total_debit) : '—'}</Td>
              <Td className="text-right font-mono text-sm">{a.total_credit > 0 ? formatCurrency(a.total_credit) : '—'}</Td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-bold">
            <td className="px-4 py-3 font-bold text-slate-700 bg-slate-100" colSpan={3}>Totals</td>
            <Td className="text-right font-mono">{formatCurrency(data.totals.debit)}</Td>
            <Td className="text-right font-mono">{formatCurrency(data.totals.credit)}</Td>
          </tr>
        </tbody>
      </Table>
    </Card>
  )
}

function BSReport({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Assets */}
      <Card>
        <CardHeader><h3 className="font-semibold text-slate-800">Assets</h3></CardHeader>
        <Table>
          <thead><tr><Th>Account</Th><Th className="text-right">Balance</Th></tr></thead>
          <tbody>
            {data.assets.accounts.map((a: any) => (
              <tr key={a.account_id}><Td>{a.code} — {a.name}</Td><Td className="text-right">{formatCurrency(a.balance)}</Td></tr>
            ))}
            <tr className="bg-slate-100 font-bold"><Td>Total Assets</Td><Td className="text-right">{formatCurrency(data.assets.total)}</Td></tr>
          </tbody>
        </Table>
      </Card>

      {/* Liabilities + Equity */}
      <div className="space-y-4">
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Liabilities</h3></CardHeader>
          <Table>
            <thead><tr><Th>Account</Th><Th className="text-right">Balance</Th></tr></thead>
            <tbody>
              {data.liabilities.accounts.map((a: any) => (
                <tr key={a.account_id}><Td>{a.code} — {a.name}</Td><Td className="text-right">{formatCurrency(a.balance)}</Td></tr>
              ))}
              <tr className="bg-slate-100 font-bold"><Td>Total Liabilities</Td><Td className="text-right">{formatCurrency(data.liabilities.total)}</Td></tr>
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader><h3 className="font-semibold text-slate-800">Equity</h3></CardHeader>
          <Table>
            <thead><tr><Th>Account</Th><Th className="text-right">Balance</Th></tr></thead>
            <tbody>
              {data.equity.accounts.map((a: any) => (
                <tr key={a.account_id}><Td>{a.code} — {a.name}</Td><Td className="text-right">{formatCurrency(a.balance)}</Td></tr>
              ))}
              <tr className="bg-slate-100 font-bold"><Td>Total Equity</Td><Td className="text-right">{formatCurrency(data.equity.total)}</Td></tr>
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  )
}

function VATReport({ data }: { data: any }) {
  const boxes = data.boxes
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sales (excl. VAT)', value: data.summary.total_sales, color: 'text-slate-800' },
          { label: 'VAT Payable', value: data.summary.vat_payable, color: 'text-red-600' },
          { label: 'VAT Refundable', value: data.summary.vat_refundable, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label} className="p-5 text-center">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{formatCurrency(s.value)}</p>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><h3 className="font-semibold text-slate-800">FTA VAT Return — Box Details</h3></CardHeader>
        <CardBody>
          <div className="space-y-2">
            {Object.entries(boxes).map(([key, value]: [string, any]) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600 capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
