import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { api, type Manifest, type MetaItem } from './api.js'

interface AppState {
  addons: Manifest[]
  settings: Record<string, string>
  refreshKey: number
  refreshCatalogs: () => void
  refreshAddons: () => void
  updateSettings: (key: string, value: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [addons, setAddons] = useState<Manifest[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const cacheBust = useRef(0)

  const refreshAddons = useCallback(async () => {
    try {
      const data = await api.getAddons()
      setAddons(data)
    } catch {}
  }, [])

  const refreshCatalogs = useCallback(() => {
    cacheBust.current++
    const key = cacheBust.current + Math.random()
    localStorage.setItem('sramo_cache_bust', String(key))
    setRefreshKey(key)
    refreshAddons()
  }, [refreshAddons])

  const updateSettings = useCallback(async (key: string, value: string) => {
    try {
      await api.updateSetting(key, value)
      setSettings(prev => ({ ...prev, [key]: value }))
      refreshCatalogs()
    } catch {}
  }, [refreshCatalogs])

  useEffect(() => {
    refreshAddons()
    api.getSettings().then(s => setSettings(s as Record<string, string>)).catch(() => {})
    const interval = setInterval(refreshAddons, 30000)
    return () => clearInterval(interval)
  }, [refreshAddons])

  useEffect(() => {
    const handler = () => {
      const bust = localStorage.getItem('sramo_cache_bust')
      if (bust) setRefreshKey(Number(bust) || 0)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <AppContext.Provider value={{ addons, settings, refreshKey, refreshCatalogs, refreshAddons, updateSettings }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

export { AppContext }
