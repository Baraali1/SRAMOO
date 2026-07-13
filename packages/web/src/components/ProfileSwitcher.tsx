import { useState } from 'react'

const PROFILES = [
  { id: 1, name: 'You', emoji: '🎬', color: '135, 116, 230' },
  { id: 2, name: 'Guest', emoji: '🍿', color: '34, 179, 101' },
  { id: 3, name: 'Kids', emoji: '🧸', color: '245, 197, 24' },
]

interface Props {
  onSelect: () => void
}

export function ProfileSwitcher({ onSelect }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="profile-screen">
      <div className="profile-content">
        <h1 className="profile-title">Who is watching?</h1>
        <div className="profile-grid">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              className={`profile-card ${selected === p.id ? 'active' : ''}`}
              onClick={() => { setSelected(p.id); setTimeout(onSelect, 400) }}
            >
              <div
                className="profile-avatar"
                style={{ '--profile-color': `rgba(${p.color}, 0.2)`, '--profile-glow': `rgba(${p.color}, 0.5)` } as React.CSSProperties}
              >
                <span className="profile-emoji">{p.emoji}</span>
              </div>
              <span className="profile-name">{p.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
