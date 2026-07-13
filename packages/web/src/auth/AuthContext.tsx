import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

interface User {
  id: number
  name: string
  email: string
}

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (name: string, email: string, password: string) => Promise<string | null>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

const TOKEN_KEY = 'sramo_token'
const USER_KEY = 'sramo_user'

function loadAuth(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    return { token, user }
  } catch { return { token: null, user: null } }
}

function saveAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function apiCall(url: string, body?: any) {
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const saved = loadAuth()
  const [user, setUser] = useState<User | null>(saved.user)
  const [token, setToken] = useState<string | null>(saved.token)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    setLoading(true)
    try {
      const data = await apiCall('/api/auth/login', { email, password })
      setToken(data.token)
      setUser(data.user)
      saveAuth(data.token, data.user)
      return null
    } catch (err: any) {
      return err.message
    } finally { setLoading(false) }
  }, [])

  const register = useCallback(async (name: string, email: string, password: string): Promise<string | null> => {
    setLoading(true)
    try {
      const data = await apiCall('/api/auth/register', { name, email, password })
      setToken(data.token)
      setUser(data.user)
      saveAuth(data.token, data.user)
      return null
    } catch (err: any) {
      return err.message
    } finally { setLoading(false) }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    clearAuth()
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
