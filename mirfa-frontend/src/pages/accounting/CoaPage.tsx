import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { coaApi } from '@/api/services'
import { Card, PageHeader, PageLoader, Badge } from '@/components/ui'

export default function CoaPage() {
  const { data, isLoading } = useQuery({ queryKey: ['coa', 'tree'], queryFn: () => coaApi.tree() })
  const accounts = (data?.data ?? []) as any[]
  const typeColors: Record<string, string> = {
    asset: 'bg-blue-50 text-blue-700', liability: 'bg-orange-50 text-orange-700',
    equity: 'bg-purple-50 text-purple-700', revenue: 'bg-green-50 text-green-700', expense: 'bg-red-50 text-red-700',
  }
  function AccountNode({ account, depth = 0 }: { account: any; depth?: number }) {
    const [open, setOpen] = useState(true)
    return (
      <div>
        <div className="flex items-center gap-2 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50"
          style={{ paddingLeft: `${16 + depth * 20}px` }} onClick={() => setOpen(!open)}>
          {account.children?.length > 0
            ? (open ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />)
            : <div className="w-3.5 shrink-0" />}
          <span className="text-xs text-slate-400 font-mono w-16 shrink-0">{account.code}</span>
          <span className="text-sm text-slate-800 flex-1">{account.name}</span>
          <Badge className={`text-xs mr-4 ${typeColors[account.account_type] || 'bg-slate-100 text-slate-600'}`}>{account.account_type}</Badge>
          {account.is_control && <Badge className="bg-yellow-50 text-yellow-700 text-xs mr-4">Control</Badge>}
        </div>
        {open && account.children?.map((child: any) => <AccountNode key={child.id} account={child} depth={depth + 1} />)}
      </div>
    )
  }
  return (
    <div className="space-y-5">
      <PageHeader title="Chart of Accounts" subtitle="UAE logistics account structure" />
      <Card>
        {isLoading ? <PageLoader /> : <div>{accounts.map((a: any) => <AccountNode key={a.id} account={a} />)}</div>}
      </Card>
    </div>
  )
}
