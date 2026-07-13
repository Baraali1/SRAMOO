import { useState } from 'react'

const PROFILES = [
  { id: 'you', name: 'You', emoji: '👤', color: '#1a98ff' },
  { id: 'kids', name: 'Kids', emoji: '🧸', color: '#22b365' },
  { id: 'guest', name: 'Guest', emoji: '👋', color: '#f59e0b' },
  { id: 'admin', name: 'Admin', emoji: '🛡️', color: '#ef4444' },
]

interface Props {
  onSelect: (profile: typeof PROFILES[0]) => void
}

export function ProfileSelection({ onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center" style={{ background: '#0b0c10' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 30% 40% at 50% 30%, rgba(26,152,255,0.06) 0%, transparent 60%), radial-gradient(ellipse 40% 30% at 80% 70%, rgba(26,152,255,0.04) 0%, transparent 50%)',
      }} />

      <div className="relative z-10 flex flex-col items-center animate-fade-up">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2" style={{ color: '#fff', letterSpacing: '-0.03em' }}>
          Who's watching?
        </h1>
        <p className="text-sm mb-12" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Choose a profile to get started
        </p>

        <div className="flex gap-10 flex-wrap justify-center">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setSelected(p.id)
                setTimeout(() => onSelect(p), 350)
              }}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              className="flex flex-col items-center gap-5 group"
              style={{ width: 140 }}
            >
              {/* Avatar */}
              <div
                className="flex items-center justify-center transition-all duration-300 ease-out"
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 8,
                  background: selected === p.id
                    ? `linear-gradient(135deg, ${p.color}22, ${p.color}0d)`
                    : 'rgba(255,255,255,0.02)',
                  border: selected === p.id
                    ? `2px solid ${p.color}55`
                    : hovered === p.id
                    ? '2px solid rgba(255,255,255,0.15)'
                    : '2px solid rgba(255,255,255,0.06)',
                  boxShadow: hovered === p.id || selected === p.id
                    ? `0 0 30px ${p.color}22`
                    : 'none',
                  transform: hovered === p.id ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                <span style={{ fontSize: 44 }}>{p.emoji}</span>
              </div>

              {/* Name */}
              <span
                className="text-sm font-semibold transition-colors duration-300"
                style={{
                  color: hovered === p.id || selected === p.id ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
              >
                {p.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
