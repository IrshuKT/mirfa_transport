import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import {
  LayoutDashboard, Briefcase, FileText, Users, Building2,
  Truck, UserCheck, FolderOpen, Receipt, BookOpen,
  BarChart3, Settings, LogOut, ChevronDown, ChevronRight,
  AlertTriangle, CreditCard, FileSpreadsheet, Landmark,Wallet
} from 'lucide-react'
import { useState } from 'react'
import type { Role } from '@/types'

interface NavItem {
  label: string
  icon: React.ReactNode
  to?: string
  roles?: Role[]
  children?: NavItem[]
}

const NAV: NavItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    to: '/dashboard',
  },
  {
    label: 'Jobs',
    icon: <Briefcase size={18} />,
    to: '/jobs',
    roles: ['super_admin','company_admin','dispatcher','staff','driver'],
  },
  {
    label: 'Quotations',
    icon: <FileText size={18} />,
    to: '/quotations',
    roles: ['super_admin','company_admin','dispatcher','staff'],
  },
  {
    label: 'Customers',
    icon: <Users size={18} />,
    to: '/customers',
    roles: ['super_admin','company_admin','dispatcher','staff'],
  },
  {
    label: 'Vendors',
    icon: <Building2 size={18} />,
    to: '/vendors',
    roles: ['super_admin','company_admin','staff'],
  },
  {
    label: 'Fleet',
    icon: <Truck size={18} />,
    to: '/fleet',
    roles: ['super_admin','company_admin','dispatcher'],
  },
  {
    label: 'Employees',
    icon: <UserCheck size={18} />,
    to: '/employees',
    roles: ['super_admin','company_admin'],
  },
  {
    label: 'Documents',
    icon: <FolderOpen size={18} />,
    to: '/documents',
    roles: ['super_admin','company_admin','staff'],
  },
  {
    label: 'Accounting',
    icon: <BookOpen size={18} />,
    roles: ['super_admin','company_admin','accountant'],
    children: [
      { label: 'Invoices',      icon: <Receipt size={16} />,         to: '/accounting/invoices' },
      { label: 'Receipts',      icon: <CreditCard size={16} />,      to: '/accounting/receipts' },
      { label: 'Payments',      icon: <CreditCard size={16} />,      to: '/accounting/payments' },
      { label: 'Journals',      icon: <FileSpreadsheet size={16} />, to: '/accounting/journals' },
 { label: 'Cash Book', icon: <Wallet size={16} />, to: '/accounting/cash-book' },

      { label: 'Banks',         icon: <Landmark size={16} />,        to: '/accounting/banks' },
      { label: 'Chart of Accts',icon: <BookOpen size={16} />,        to: '/accounting/coa' },
      { label: 'Reports',       icon: <BarChart3 size={16} />,       to: '/accounting/reports' },
    ],
  },
  {
    label: 'Companies',
    icon: <Building2 size={18} />,
    to: '/companies',
    roles: ['super_admin'],
  },
  {
    label: 'Settings',
    icon: <Settings size={18} />,
    to: '/settings',
    roles: ['super_admin','company_admin'],
  },
]

function NavItemComponent({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const { user } = useAuthStore()
  const [open, setOpen] = useState(false)

  // Role check
  if (item.roles && user && !item.roles.includes(user.role)) return null

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors text-sm"
        >
          <span className="text-slate-400">{item.icon}</span>
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {open && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
            {item.children.map((child) => (
              <NavItemComponent key={child.to} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to!}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive
            ? 'bg-sky-600 text-white'
            : 'text-slate-300 hover:bg-slate-700/50 hover:text-white',
          depth > 0 && 'text-xs',
        )
      }
    >
      <span>{item.icon}</span>
      {item.label}
    </NavLink>
  )
}

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-slate-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
        <div className="h-8 w-8 rounded-lg bg-sky-600 flex items-center justify-center">
          <Truck size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white">Mirfa Transport</p>
          <p className="text-xs text-slate-400">Logistics Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map((item) => (
          <NavItemComponent key={item.to ?? item.label} item={item} />
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sky-700 flex items-center justify-center text-xs font-bold text-white uppercase">
            {user?.full_name?.charAt(0) ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
