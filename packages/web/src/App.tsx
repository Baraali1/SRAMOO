import { Routes, Route, useLocation, Link, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import { AppProvider } from './AppContext.js'
import { ToastProvider } from './components/Toast.js'
import { AuthProvider, useAuth } from './auth/AuthContext.js'
import { MainLayout } from './components/MainLayout.js'
import { Home } from './pages/Home.js'
import { Browse } from './pages/Browse.js'
import { Detail } from './pages/Detail.js'
const Player = lazy(() => import('./pages/Player.js').then(m => ({ default: m.Player })))
import { Library } from './pages/Library.js'
import { Addons } from './pages/Addons.js'
import { Search } from './pages/Search.js'
import { SettingsPage } from './pages/Settings.js'
import { CalendarPage } from './pages/Calendar.js'
import { Login } from './pages/Login.js'
import { Register } from './pages/Register.js'
import { useKeyboard } from './hooks/useKeyboard.js'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center" style={{ minHeight: '60vh' }}>
      <div className="w-16 h-16 mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(26,152,255,0.08)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2">Page Not Found</h2>
      <p className="text-sm mb-8 text-secondary">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary">Go Home</Link>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, login, register, logout } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(() => {
    // If user is logged in via token, try localStorage profile first
    if (token) {
      const stored = localStorage.getItem('sramo_profile')
      if (stored) return JSON.parse(stored)
      // If no stored profile yet, user starts without profile (will be prompted later)
      return null
    }
    // If not logged in, check localStorage profile as before
    try { return JSON.parse(localStorage.getItem('sramo_active_profile') || 'null') } catch { return null }
  })

  useEffect(() => {
    // Sync auth state with localStorage
    if (token) {
      localStorage.setItem('sramo_token', token)
      localStorage.setItem('sramo_profile', JSON.stringify(profile))
    } else {
      localStorage.removeItem('sramo_token')
      localStorage.removeItem('sramo_profile')
    }
  }, [token, profile])

  useEffect(() => {
    if (darkMode) document.body.classList.add('dark')
    else document.body.classList.remove('dark')
  }, [darkMode])

  useKeyboard({
    '/': () => {
      const input = document.querySelector<HTMLInputElement>('.search-bar-glass input')
      if (input) { input.focus(); return }
      navigate('/search')
    },
  })

  const handleProfileSelect = useCallback((p: Profile) => {
    localStorage.setItem('sramo_profile', JSON.stringify(p))
    setProfile(p)
  }, [])

  const handleSwitchProfile = useCallback(() => {
    localStorage.removeItem('sramo_profile')
    setProfile(null)
  }, [])

  // Authentication check - show login if not authenticated
  if (!token) {
    return (
      <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </AppProvider>
      </AuthProvider>
    )
  }

  // If authenticated but no profile selected, show profile selection
  if (!profile) {
    return (
      <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <ProfileSelection onSelect={handleProfileSelect} />
        </ToastProvider>
      </AppProvider>
      </AuthProvider>
    )
  }

  const isPlayerRoute = location.pathname.startsWith('/player/')

  return (
    <AuthProvider>
    <AppProvider>
      <ToastProvider>
        {isPlayerRoute ? (
          <Routes>
            <Route path="/player/:type/:id" element={<Suspense fallback={null}><Player /></Suspense>} />
          </Routes>
        ) : (
          <MainLayout profile={profile} onSwitchProfile={handleProfileSelect}>
            <div className="bg-orb bg-orb-purple" />
            <div className="bg-orb bg-orb-green" />
            <div className="main-content">
              <ScrollToTop />
              <div key={location.pathname} className="page-enter">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/browse/:type" element={<Browse />} />
                  <Route path="/detail/:type/:id" element={<Detail />} />
                  <Route path="/player/:type/:id" element={<Suspense fallback={null}><Player /></Suspense>} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/addons" element={<Addons />} />
                  <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/search" element={<Search />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </div>
          </MainLayout>
        )}
      </ToastProvider>
    </AppProvider>
    </AuthProvider>
  )
}