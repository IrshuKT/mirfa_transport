import { useQuery } from '@tanstack/react-query'
import { companiesApi } from '@/api/services'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardBody, PageHeader, PageLoader, Badge } from '@/components/ui'

export default function CompaniesPage() {
  const { user } = useAuthStore()
  const { data: myCompany, isLoading: myLoading } = useQuery({ queryKey: ['company','me'], queryFn: () => companiesApi.getMyCompany() })
  const { data: allData, isLoading: allLoading } = useQuery({ queryKey: ['companies'], queryFn: () => companiesApi.list(), enabled: user?.role === 'super_admin' })

  if (user?.role !== 'super_admin') {
    const c = myCompany?.data
    if (myLoading) return <PageLoader />
    return (
      <div className="space-y-5 max-w-2xl">
        <PageHeader title="Company Profile" />
        <Card><CardBody>
          {c && <div className="grid grid-cols-2 gap-5">
            {[['Name',c.name],['Trade License',c.trade_license_no||'—'],['TRN',c.trn||'—'],['City',c.city],['Country',c.country],['Phone',c.phone||'—'],['Email',c.email||'—'],['Currency',c.currency],['VAT Rate',`${(c.vat_rate*100).toFixed(0)}%`]].map(([l,v])=>(
              <div key={l}><p className="text-xs text-slate-500">{l}</p><p className="font-medium text-slate-800 mt-0.5">{v}</p></div>
            ))}
          </div>}
        </CardBody></Card>
      </div>
    )
  }

  const companies = allData?.data
  return (
    <div className="space-y-5">
      <PageHeader title="Companies" subtitle={companies ? `${companies.total} companies` : undefined} />
      <Card>
        {allLoading ? <PageLoader /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{['Name','TRN','City','Currency','VAT','Status'].map(h=><th key={h} className="bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr></thead>
              <tbody>{companies?.results?.map((c:any)=>(
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-xs">{c.trn||'—'}</td>
                  <td className="px-4 py-3">{c.city}</td>
                  <td className="px-4 py-3">{c.currency}</td>
                  <td className="px-4 py-3">{(c.vat_rate*100).toFixed(0)}%</td>
                  <td className="px-4 py-3"><Badge className={c.is_active?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}>{c.is_active?'Active':'Inactive'}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
