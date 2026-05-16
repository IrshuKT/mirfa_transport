import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Truck, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/services'
import { useAuthStore } from '@/stores/authStore'
import { Button, Input } from '@/components/ui'
import toast from 'react-hot-toast'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  totp_code: z.string().optional(),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const { data: tokenData } = await authApi.login(data.email, data.password, data.totp_code)

      if (tokenData.totp_required) {
        setTotpRequired(true)
        toast('Enter your 2FA code to continue', { icon: '🔐' })
        setLoading(false)
        return
      }

      setTokens(tokenData.access_token, tokenData.refresh_token)

      // Fetch user profile
      const { data: user } = await authApi.me()
      setUser(user)

      toast.success(`Welcome back, ${user.full_name}!`)

      // Role-based redirect
      if (user.role === 'driver') navigate('/driver')
      else navigate('/dashboard')
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Login failed. Check your credentials.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 shadow-lg mb-4">
            <Truck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Mirfa Transport</h1>
          <p className="text-slate-400 text-sm mt-1">Logistics Management Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            {totpRequired ? 'Two-Factor Authentication' : 'Sign in to your account'}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {!totpRequired ? (
              <>
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@company.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="block w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm placeholder-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="bg-sky-50 rounded-lg p-4 text-sm text-sky-700">
                  Open your authenticator app and enter the 6-digit code.
                </div>
                <Input
                  label="Authentication Code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  error={errors.totp_code?.message}
                  {...register('totp_code')}
                />
              </div>
            )}

            <Button type="submit" className="w-full mt-2" loading={loading} size="lg">
              {totpRequired ? 'Verify Code' : 'Sign In'}
            </Button>

            {totpRequired && (
              <button
                type="button"
                onClick={() => setTotpRequired(false)}
                className="w-full text-sm text-slate-500 hover:text-slate-700 mt-2"
              >
                ← Back to login
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          UAE Logistics Platform · Powered by Mirfa Transport
        </p>
      </div>
    </div>
  )
}
