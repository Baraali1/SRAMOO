import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.js'

export function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const { register, loading } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }

    const err = await register(name.trim(), email.trim(), password)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0b0c10' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 30% 40% at 50% 40%, rgba(26,152,255,0.04) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 w-full max-w-[400px] mx-4 animate-fade-up">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-extrabold tracking-tight" style={{ color: '#1a98ff', textDecoration: 'none', letterSpacing: '-0.03em' }}>
            SRAMO
          </Link>
          <h1 className="text-2xl font-bold text-white mt-4 mb-1">Create Account</h1>
          <p className="text-sm text-white/30">Start streaming with SRAMO</p>
        </div>

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: 32,
        }}>
          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 16, borderRadius: 10,
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
              fontSize: 13, color: '#ef4444',
            }}>
              {error}
            </div>
          )}

          {/* Name */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder:text-white/15 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(26,152,255,0.3)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder:text-white/15 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(26,152,255,0.3)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder:text-white/15 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(26,152,255,0.3)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-3 rounded-lg text-[14px] text-white placeholder:text-white/15 outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(26,152,255,0.3)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.06)' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-[15px] font-bold text-white transition-all"
            style={{ background: loading ? 'rgba(26,152,255,0.4)' : '#1a98ff', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-[13px] text-white/30 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: '#1a98ff', textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
