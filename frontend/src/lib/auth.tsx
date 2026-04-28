import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getAccessToken, setAccessToken } from './api'

export type UserRole =
  | 'MANAGING_PARTNER'
  | 'PARTNER'
  | 'BRANCH_HEAD'
  | 'SENIOR_ARTICLE'
  | 'ARTICLE'
  | 'ACCOUNTANT'

export interface CurrentUser {
  id: string
  firmId: string
  firmName: string
  firmLogoDataUrl: string | null
  branchId: string | null
  branchName: string | null
  name: string
  email: string
  role: UserRole
}

interface AuthContextValue {
  user: CurrentUser | null
  isLoading: boolean
  setSession: (token: string) => Promise<void>
  logout: () => void
  /** Refetch /auth/me — used after a firm setting like name or logo changes. */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function loadMe() {
    try {
      const { data } = await api.get<CurrentUser>('/auth/me')
      setUser(data)
    } catch {
      setAccessToken(null)
      setUser(null)
    }
  }

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    loadMe().finally(() => setIsLoading(false))
  }, [])

  async function setSession(token: string) {
    setAccessToken(token)
    await loadMe()
  }

  function logout() {
    setAccessToken(null)
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, setSession, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const ROLE_LABELS: Record<UserRole, string> = {
  MANAGING_PARTNER: 'Managing Partner',
  PARTNER: 'Partner',
  BRANCH_HEAD: 'Branch Head',
  SENIOR_ARTICLE: 'Senior Article',
  ARTICLE: 'Article',
  ACCOUNTANT: 'Accountant',
}
