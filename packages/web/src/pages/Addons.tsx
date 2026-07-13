import { useState, useEffect, useCallback, useMemo } from 'react'
import { api, type Manifest } from '../api.js'
import { useToast } from '../components/Toast.js'
import { getAddonRegistry, type RegistryEntry } from '../addons/registry.js'

function resourceName(r: any): string { return typeof r === 'string' ? r : r.name || '' }
const resourceLabels: Record<string, string> = { catalog: 'Catalog', meta: 'Metadata', stream: 'Stream', subtitles: 'Subtitles', addon_catalog: 'Addons' }

function AddonCard({ addon, installed, localEnabled, onInstall, onRemove, onToggle }: {
  addon: any
  installed: boolean
  localEnabled: boolean
  onInstall: () => void
  onRemove: () => void
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div className="addon-card">
      <div className="addon-body">
        <div className="addon-icon">
          <span className={`status-dot ${installed ? 'status-dot-active' : 'status-dot-inactive'}`} style={{ position:'absolute',top:2,right:2 }} />
          {addon.logo || '🧩'}
        </div>
        <div className="addon-info">
          <div className="addon-name">{addon.name}</div>
          <div className="addon-desc">{addon.description || 'No description'}</div>
          <div className="addon-resources">
            {(addon.resources || []).map((r: any) => (
              <span key={resourceName(r)} className="addon-resource">{resourceLabels[resourceName(r)] || resourceName(r)}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="addon-footer">
        <span className="text-[0.55rem] font-medium" style={{ color:'var(--text-muted)' }}>
          {addon.version ? `v${addon.version}` : (addon.types || []).join(', ')}
        </span>
        {installed && (
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <label className="toggle-switch" style={{ transform:'scale(0.75)' }}>
              <input type="checkbox" checked={localEnabled} onChange={e => onToggle(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
            <button onClick={onRemove} className="btn-remove" style={{ fontSize:10 }}>Remove</button>
          </div>
        )}
        {!installed && (
          <button onClick={onInstall} className="btn-install" style={{ fontSize:11 }}>Install</button>
        )}
      </div>
    </div>
  )
}

export function Addons() {
  const { toast } = useToast()
  const [serverAddons, setServerAddons] = useState<Manifest[]>([])
  const [loading, setLoading] = useState(true)
  const [installUrl, setInstallUrl] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const registry = useMemo(() => getAddonRegistry(), [tick])

  const loadAddons = useCallback(async () => {
    try { setServerAddons(await api.getAddons()) } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAddons() }, [loadAddons])

  const install = useCallback(async (rawUrl: string) => {
    const url = rawUrl.replace(/\/manifest\.json$/i, '').replace(/\/$/, '')
    setInstalling(url); setError(null)
    try {
      const result = await api.installAddon(url)
      // Also store in client-side registry
      if (result.manifest) {
        registry.install(url, result.manifest)
      }
      await loadAddons()
      setTick(t => t + 1)
      toast('Addon installed', 'success')
      setInstallUrl('')
    } catch (err) {
      toast('Failed to install', 'error')
      setError(String(err))
    } finally { setInstalling(null) }
  }, [loadAddons, registry, toast])

  const uninstall = useCallback(async (id: string) => {
    try {
      await api.uninstallAddon(id)
      registry.remove(id)
      setTick(t => t + 1)
      setServerAddons(prev => prev.filter(a => a.id !== id))
      toast('Addon removed', 'info')
    } catch { toast('Failed to remove', 'error') }
  }, [registry, toast])

  const isInstalled = useCallback((manifestId: string) =>
    serverAddons.some(a => a.id === manifestId) || registry.isInstalled(manifestId),
  [serverAddons, registry])

  const toggleLocal = useCallback((id: string, enabled: boolean) => {
    registry.toggle(id, enabled)
    setTick(t => t + 1)
    toast(enabled ? `${id} enabled` : `${id} disabled`, 'info')
  }, [registry, toast])

  const userAddons = serverAddons.filter(a => !a.system)
  const systemAddons = serverAddons.filter(a => a.system)

  if (loading) {
    return <div className="flex justify-center py-20"><div className="sramo-spinner" /></div>
  }

  return (
    <div className="pt-6">
      <div className="px-4 sm:px-8 md:px-12 w-full" style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 className="text-xl font-bold mb-1">Addons</h1>
        <p className="text-sm mb-8" style={{ color:'var(--text-secondary)' }}>
          Paste a Stremio addon manifest URL to install subtitles, catalogs, or streaming sources.
        </p>

        {/* Install from URL */}
        <div className="glass-panel" style={{ padding: 24, marginBottom: 24 }}>
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:'var(--accent)' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Install from URL
          </h2>
          <div className="flex gap-2">
            <input type="text" value={installUrl} onChange={e => setInstallUrl(e.target.value)}
              placeholder="Paste addon manifest URL..."
              className="glass-input"
              style={{ fontSize: 13 }}
              onKeyDown={e => e.key === 'Enter' && install(installUrl.trim())} />
            <button onClick={() => install(installUrl.trim())}
              disabled={installing !== null || !installUrl.trim()}
              className="btn-primary shrink-0" style={{ fontSize: 13, padding: '10px 20px' }}>
              {installing === installUrl.trim() ? 'Installing...' : 'Install'}
            </button>
          </div>
          {error && <p className="text-xs mt-2" style={{ color:'#ff6b6b' }}>{error}</p>}
        </div>

        {/* System addons */}
        {systemAddons.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:'var(--accent)' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              System <span style={{ color:'var(--text-muted)',fontWeight:400 }}>{systemAddons.length} addon{systemAddons.length!==1?'s':''}</span>
            </h2>
            <div className="space-y-2">
              {systemAddons.map(addon => (
                <div key={addon.id} className="addon-card" style={{ flexDirection:'row',alignItems:'center',gap:12 }}>
                  <div className="addon-icon" style={{ width:40,height:40,borderRadius:10 }}>
                    <span className="status-dot status-dot-active" style={{ position:'absolute',top:2,right:2 }} />
                    {addon.logo ? <img src={addon.logo} alt="" style={{width:20,height:20}} /> : '🧩'}
                  </div>
                  <div className="addon-info">
                    <div className="addon-name">{addon.name}</div>
                    <div className="addon-desc">{addon.description || 'Built-in system addon'}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md" style={{ background:'rgba(123,91,245,0.1)',color:'var(--accent)',flexShrink:0 }}>System</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User addons */}
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color:'var(--accent)' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Installed <span style={{ color:'var(--text-muted)',fontWeight:400 }}>{userAddons.length} addon{userAddons.length!==1?'s':''}</span>
        </h2>

        {userAddons.length === 0 ? (
          <div className="empty-state glass-panel" style={{ padding:'40px 24px',marginBottom:48,borderRadius:16 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <h3 style={{ fontSize:15,fontWeight:600,margin:'12px 0 4px',color:'var(--text-secondary)' }}>No addons installed</h3>
            <p style={{ fontSize:12,color:'var(--text-muted)',maxWidth:300 }}>Paste a Stremio addon URL above to add subtitles or streaming sources.</p>
          </div>
        ) : (
          <div className="addon-grid mb-12">
            {userAddons.map(addon => (
              <AddonCard
                key={addon.id}
                addon={{ ...addon, resources: addon.resources || [] }}
                installed={true}
                localEnabled={registry.getAll().find(a => a.manifest.id === addon.id)?.enabled ?? true}
                onInstall={() => {}}
                onRemove={() => uninstall(addon.id)}
                onToggle={(enabled) => toggleLocal(addon.id, enabled)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
