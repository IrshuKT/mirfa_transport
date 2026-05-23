import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Role } from '@/types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  isAuthenticated: boolean
  forcePasswordChange: boolean

  setTokens: (access: string, refresh: string) => void
  
  setUser: (user: User) => void
  setForcePasswordChange: (v: boolean) => void
  logout: () => void

  // helpers
  hasRole: (...roles: Role[]) => boolean
  isAdmin: () => boolean
  isAccountant: () => boolean
  isDispatcher: () => boolean
  isDriver: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      forcePasswordChange: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh, isAuthenticated: true,forcePasswordChange: false, }),

      setUser: (user) => set({ user }),
      setForcePasswordChange: (v) => set({ forcePasswordChange: v }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false ,forcePasswordChange: false}),

      hasRole: (...roles) => {
        const role = get().user?.role
        return role ? roles.includes(role) : false
      },

      isAdmin: () =>
        get().hasRole('super_admin', 'company_admin'),

      isAccountant: () =>
        get().hasRole('super_admin', 'company_admin', 'accountant'),

      isDispatcher: () =>
        get().hasRole('super_admin', 'company_admin', 'dispatcher', 'staff'),

      isDriver: () => get().hasRole('driver'),
    }),
    {
      name: 'mirfa-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        forcePasswordChange: state.forcePasswordChange,
      }),
    }
  )
)
