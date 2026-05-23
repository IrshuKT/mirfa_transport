import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/services'
import { useAuthStore } from '@/stores/authStore'
import { Button, Input } from '@/components/ui'
import toast from 'react-hot-toast'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { setForcePasswordChange, user } = useAuthStore()
  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showNew, setShowNew]       = useState(false)
  const [loading, setLoading]       = useState(false)

  const checks = [
    { label: '8+ characters',   ok: newPw.length >= 8 },
    { label: '1 uppercase',     ok: /[A-Z]/.test(newPw) },
    { label: '1 number',        ok: /[0-9]/.test(newPw) },
    { label: 'Passwords match', ok: newPw === confirm && confirm.length > 0 },
  ]
  const allOk = checks.every(c => c.ok)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!allOk) { toast.error('Please meet all password requirements'); return }
    setLoading(true)
    try {
      await authApi.changePassword(currentPw, newPw, confirm)
      setForcePasswordChange(false)  // 👈 clear the flag
      toast.success('Password changed! Welcome 🎉')
      if (user?.role === 'driver') navigate('/driver')
      else navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 shadow-lg mb-4">
            <Truck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Mirfa Transport</h1>
          <p className="text-slate-400 text-sm mt-1">Please set a new password to continue</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm text-amber-700">
            ⚠️ You must change your temporary password before continuing.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Temporary Password" type="password"
              value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />

            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">New Password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  required />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <Input label="Confirm New Password" type="password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />

            {(newPw || confirm) && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-1.5">
                {checks.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={c.ok ? 'text-green-500' : 'text-slate-300'}>{c.ok ? '✓' : '○'}</span>
                    <span className={c.ok ? 'text-green-700' : 'text-slate-500'}>{c.label}</span>
                  </div>
                ))}
              </div>
            )}

            <Button type="submit" loading={loading} disabled={!allOk || !currentPw} className="w-full">
              Set New Password & Continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}