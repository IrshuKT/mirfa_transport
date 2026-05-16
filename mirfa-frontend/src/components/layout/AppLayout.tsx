import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export function AppLayout() {
  const { user } = useAuthStore()
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
            </button>
            <div className="text-sm text-slate-600">
              Welcome, <span className="font-medium text-slate-900">{user?.full_name}</span>
            </div>
          </div>
        </header>
        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
