import type { InstalledAddon, Manifest, AddonTransport, MetaItem, Stream, Subtitle, ContentType, ResourceEntry } from './types.js'

export interface AddonProtocolClient {
  getManifest(): Promise<Manifest>
  getCatalog(type: ContentType, id: string, extra?: Record<string, string>): Promise<{ metas: MetaItem[] }>
  getMeta(type: ContentType, id: string): Promise<{ meta: MetaItem }>
  getStream(type: ContentType, id: string): Promise<{ streams: Stream[] }>
  getSubtitles(type: ContentType, id: string): Promise<{ subtitles: Subtitle[] }>
}

export class HttpAddonClient implements AddonProtocolClient {
  constructor(private baseUrl: string) {}

  private async fetchJson<T>(path: string): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      })
      if (!res.ok) throw new Error(`Addon error: ${res.status} ${res.statusText}`)
      return res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async getManifest(): Promise<Manifest> {
    return this.fetchJson<Manifest>('/manifest.json')
  }

  async getCatalog(type: ContentType, id: string, extra?: Record<string, string>): Promise<{ metas: MetaItem[] }> {
    let path = `/catalog/${type}/${id}.json`
    if (extra && Object.keys(extra).length > 0) {
      const qs = new URLSearchParams(extra).toString()
      path += `?${qs}`
    }
    return this.fetchJson<{ metas: MetaItem[] }>(path)
  }

  async getMeta(type: ContentType, id: string): Promise<{ meta: MetaItem }> {
    return this.fetchJson<{ meta: MetaItem }>(`/meta/${type}/${id}.json`)
  }

  async getStream(type: ContentType, id: string): Promise<{ streams: Stream[] }> {
    return this.fetchJson<{ streams: Stream[] }>(`/stream/${type}/${id}.json`)
  }

  async getSubtitles(type: ContentType, id: string): Promise<{ subtitles: Subtitle[] }> {
    return this.fetchJson<{ subtitles: Subtitle[] }>(`/subtitles/${type}/${id}.json`)
  }
}

export class AddonManager {
  private addons: Map<string, InstalledAddon> = new Map()
  private clients: Map<string, AddonProtocolClient> = new Map()

  getInstalledAddons(): InstalledAddon[] {
    return Array.from(this.addons.values())
  }

  getAddon(id: string): InstalledAddon | undefined {
    return this.addons.get(id)
  }

  registerFromManifest(manifest: Manifest, transport: AddonTransport, system = false): void {
    const resourceNames = manifest.resources.map((r: ResourceEntry) => typeof r === 'string' ? r : r.name)
    const cleanTransport = transport.type === 'http'
      ? { ...transport, url: transport.url.replace(/\/manifest\.json$/i, '').replace(/\/$/, '') }
      : transport
    console.log(`[AddonManager] Registered manifest — ID: ${manifest.id}, Name: ${manifest.name}, Resources: [${resourceNames.join(', ')}], Types: [${manifest.types.join(', ')}]`)
    this.addons.set(manifest.id, { manifest, transport: cleanTransport, installedAt: Date.now(), system })
    if (cleanTransport.type === 'http') {
      this.clients.set(manifest.id, new HttpAddonClient(cleanTransport.url))
      console.log(`[AddonManager] Client created for ${manifest.id} -> ${cleanTransport.url}`)
    }
  }

  async installRemote(url: string): Promise<Manifest> {
    const cleanUrl = url.replace(/\/manifest\.json$/i, '').replace(/\/$/, '')
    const client = new HttpAddonClient(cleanUrl)
    const manifest = await client.getManifest()
    const resourceNames = manifest.resources.map((r: ResourceEntry) => typeof r === 'string' ? r : r.name)
    console.log(`[AddonManager] Installed remote — ID: ${manifest.id}, Name: ${manifest.name}, Resources: [${resourceNames.join(', ')}], URL: ${url}`)
    this.addons.set(manifest.id, {
      manifest,
      transport: { type: 'http', url: client['baseUrl'] },
      installedAt: Date.now(),
    })
    this.clients.set(manifest.id, client)
    return manifest
  }

  uninstall(id: string): boolean {
    const addon = this.addons.get(id)
    if (addon?.system) return false
    this.addons.delete(id)
    this.clients.delete(id)
    return true
  }

  isSystemAddon(id: string): boolean {
    return this.addons.get(id)?.system === true
  }

  getClientFor(id: string): AddonProtocolClient | undefined {
    return this.clients.get(id)
  }

  private hasResource(manifest: Manifest, resource: string): boolean {
    return manifest.resources.some((r: ResourceEntry) => typeof r === 'string' ? r === resource : r.name === resource)
  }

  async getStreams(type: ContentType, id: string): Promise<{ addonName: string; streams: Stream[] }[]> {
    const results: { addonName: string; streams: Stream[] }[] = []
    for (const [addonId, addon] of this.addons) {
      if (!this.hasResource(addon.manifest, 'stream')) continue
      if (!addon.manifest.types.includes(type)) continue
      try {
        const client = this.clients.get(addonId)
        if (!client) continue
        const { streams } = await client.getStream(type, id)
        if (streams && streams.length > 0) {
          results.push({ addonName: addon.manifest.name, streams })
        }
      } catch {
        // Silently skip addons that error
      }
    }
    return results
  }

  async getSubtitles(type: ContentType, id: string): Promise<{ addonName: string; subtitles: Subtitle[] }[]> {
    const results: { addonName: string; subtitles: Subtitle[] }[] = []
    for (const [addonId, addon] of this.addons) {
      if (!this.hasResource(addon.manifest, 'subtitles')) continue
      if (!addon.manifest.types.includes(type)) continue
      try {
        const client = this.clients.get(addonId)
        if (!client) continue
        const { subtitles } = await client.getSubtitles(type, id)
        if (subtitles && subtitles.length > 0) {
          results.push({ addonName: addon.manifest.name, subtitles })
        }
      } catch (e) {
        console.error(`[AddonManager] getSubtitles failed for ${addonId}:`, e)
      }
    }
    return results
  }

  async searchAll(query: string): Promise<{ addonName: string; results: MetaItem[] }[]> {
    const results: { addonName: string; results: MetaItem[] }[] = []
    for (const [addonId, addon] of this.addons) {
      if (!this.hasResource(addon.manifest, 'catalog')) continue
      const client = this.clients.get(addonId)
      if (!client) continue
      const searchable = addon.manifest.catalogs.find((c) =>
        c.extra?.some((e) => e.name === 'search')
      )
      const catalogs = searchable ? [searchable] : addon.manifest.catalogs.slice(0, 2)
      for (const cat of catalogs) {
        try {
          const { metas } = await client.getCatalog(cat.type, cat.id, { search: query })
          if (metas && metas.length > 0) {
            results.push({ addonName: addon.manifest.name, results: metas })
            break
          }
        } catch {
          continue
        }
      }
    }
    return results
  }
}
