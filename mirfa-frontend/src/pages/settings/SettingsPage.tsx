import { useState } from 'react'
import { authApi } from '@/api/services'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardBody, PageHeader, Input, Button } from '@/components/ui'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirm) { toast.error('Passwords do not match'); return }
    setLoading(true)
    try {
      await authApi.changePassword(currentPw, newPw, confirm)
      toast.success('Password changed!')
      setCurrentPw(''); setNewPw(''); setConfirm('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <PageHeader title="Settings" />
      <Card><CardBody>
        <h3 className="font-semibold text-slate-800 mb-4">Profile</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-slate-500">Full Name</p><p className="font-medium">{user?.full_name}</p></div>
          <div><p className="text-xs text-slate-500">Email</p><p className="font-medium">{user?.email}</p></div>
          <div><p className="text-xs text-slate-500">Role</p><p className="font-medium capitalize">{user?.role?.replace(/_/g,' ')}</p></div>
          <div><p className="text-xs text-slate-500">2FA</p><p className={`font-medium ${user?.totp_enabled?'text-green-600':'text-red-500'}`}>{user?.totp_enabled?'Enabled':'Disabled'}</p></div>
        </div>
      </CardBody></Card>
      <Card><CardBody>
        <h3 className="font-semibold text-slate-800 mb-4">Change Password</h3>
        <form onSubmit={handleChange} className="space-y-4">
          <Input label="Current Password" type="password" value={currentPw} onChange={e=>setCurrentPw(e.target.value)} required />
          <Input label="New Password" type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} required />
          <Input label="Confirm New Password" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required />
          <Button type="submit" loading={loading}>Update Password</Button>
        </form>
      </CardBody></Card>
    </div>
  )
}
