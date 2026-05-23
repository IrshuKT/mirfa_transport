import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api/services'
import {
  Button, Card, CardHeader, Table, Th, Td,
  PageHeader, SearchInput, Badge, EmptyState, PageLoader,
} from '@/components/ui'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye } from 'lucide-react'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => customersApi.list({ page, page_size: 25, search }),
  })
  const customers = data?.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        subtitle={customers ? `${customers.total} customers` : undefined}
        actions={
          <Button icon={<Plus size={16} />} onClick={() => navigate('/customers/new')}>
            New Customer
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <SearchInput
            value={search}
            onChange={(v: string) => { setSearch(v); setPage(1) }}
            placeholder="Search customers..."
          />
        </CardHeader>

        {isLoading ? <PageLoader /> : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Code</Th>
                <Th>Type</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Credit Days</Th>
                <Th>Portal</Th>
                <Th>Status</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {!customers?.results?.length ? (
                <tr><td colSpan={9}><EmptyState title="No customers found" /></td></tr>
              ) : customers.results.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <p className="font-medium text-slate-900">{c.name}</p>
                  </Td>
                  <Td>
                    <span className="text-xs font-mono text-slate-500">{c.code || '—'}</span>
                  </Td>
                  <Td>
                    <Badge className="bg-slate-100 text-slate-600 capitalize">
                      {c.customer_type}
                    </Badge>
                  </Td>
                  <Td>{c.email || '—'}</Td>
                  <Td>{c.phone || c.mobile || '—'}</Td>
                  <Td>{c.credit_days} days</Td>
                  <Td>
                    {c.portal_user_id ? (
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-400">No Access</Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge className={c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Eye size={14} />}
                      onClick={() => navigate(`/customers/${c.id}/edit`)}
                    >
                      View
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {customers && customers.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {customers.pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= customers.pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}