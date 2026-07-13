import { useState, useEffect } from 'react'
import { api } from '../api.js'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
]
const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]
const QUALITIES = [
  { value: 'auto', label: 'Auto' },
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
]

function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div>
          <div className="settings-card-label">{label}</div>
          {desc && <div className="settings-card-desc">{desc}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string | undefined> | null>(null)

  useEffect(() => {
    api.getSettings().then(s => setSettings(s as Record<string, string | undefined>)).catch(() => {})
  }, [])

  const update = (key: string, value: string) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    api.updateSetting(key, value).catch(() => {})
  }

  if (!settings) {
    return (
      <div className="settings-page">
        <h1>Settings</h1>
        <div className="settings-card">
          <div className="skeleton" style={{ height: 20, width: 140 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <SettingRow label="Language" desc="Interface language">
        <select className="settings-select" value={settings.language || 'en'} onChange={e => update('language', e.target.value)}>
          {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </SettingRow>

      <SettingRow label="Theme" desc="Appearance mode">
        <select className="settings-select" value={settings.theme || 'dark'} onChange={e => update('theme', e.target.value)}>
          {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </SettingRow>

      <SettingRow label="Stream Quality" desc="Preferred streaming quality">
        <select className="settings-select" value={settings.streamQuality || 'auto'} onChange={e => update('streamQuality', e.target.value)}>
          {QUALITIES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>
      </SettingRow>

      <SettingRow label="Auto-play" desc="Automatically start playing next episode">
        <label className="toggle-switch">
          <input type="checkbox" checked={settings.autoPlay === 'true'} onChange={e => update('autoPlay', String(e.target.checked))} />
          <span className="toggle-slider" />
        </label>
      </SettingRow>

      <div className="divider-subtle" />

      <div className="text-center">
        <div className="text-secondary" style={{ fontSize: 12 }}>Sramo v1.0.0</div>
      </div>
    </div>
  )
}
