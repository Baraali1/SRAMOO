import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

interface Profile {
  id: string
  name: string
  emoji: string
  color: string
}

interface Props {
  children: React.ReactNode
  profile: Profile
  onSwitchProfile: () => void
}

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/browse/movie', label: 'Movies' },
  { to: '/browse/series', label: 'TV Shows' },
  { to: '/library', label: 'My List' },
]

export function MainLayout({ children, profile, onSwitchProfile }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const navigate = useNavigate()
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="w-screen min-h-screen overflow-x-hidden" style={{ background: '#0b0c10' }}>
      {/* ── TOP HEADER NAV (Amazon Prime style) ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between transition-all duration-500"
        style={{
          height: 56,
          padding: '0 32px',
          background: scrolled ? 'rgba(15,23,42,0.95)' : 'rgba(11,12,16,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        }}
      >
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-8">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <span className="text-lg font-extrabold tracking-tight" style={{ color: '#1a98ff', letterSpacing: '-0.03em' }}>
              SRAMO
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                tabIndex={0}
                className={({ isActive }) =>
                  `px-3.5 py-2 text-[13px] font-medium rounded-md transition-all duration-200 ${
                    isActive ? 'text-white' : 'text-white/50 hover:text-white/80'
                  } tv-focus`
                }
                style={({ isActive }) =>
                  isActive ? { background: 'rgba(26,152,255,0.1)', color: '#1a98ff' } : {}
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Right: Search + Profile */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <button
            onClick={() => navigate('/search')}
            className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:bg-white/8"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>

          {/* Addons */}
          <button
            onClick={() => navigate('/addons')}
            className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:bg-white/8"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
            title="Addons"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </button>

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-1.5 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ background: 'transparent', border: 'none', padding: '2px 6px', borderRadius: 6 }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 30, height: 30, borderRadius: 6,
                  background: `rgba(26,152,255,0.1)`,
                  border: '1px solid rgba(26,152,255,0.15)',
                  fontSize: 14,
                }}
              >
                {profile.emoji}
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"
                style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showDropdown && (
              <div
                className="absolute top-full right-0 mt-2 animate-fade-up"
                style={{
                  background: 'rgba(15,23,42,0.96)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 8,
                  minWidth: 180,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div className="px-3 py-2">
                  <div className="text-[13px] font-semibold text-white">{profile.name}</div>
                  <div className="text-[10px] text-white/30 mt-0.5">Active profile</div>
                </div>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', margin: '4px 0' }} />
                <button onClick={() => { setShowDropdown(false); navigate('/settings') }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-white/50 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
                <button onClick={() => { setShowDropdown(false); onSwitchProfile() }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-white/50 hover:text-white hover:bg-white/[0.04] rounded-md transition-colors"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Switch profile
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className="w-full" style={{ paddingTop: 0 }}>
        {children}
      </main>
    </div>
  )
}
