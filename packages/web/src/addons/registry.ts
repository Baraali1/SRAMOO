const STORAGE_KEY = 'sramo_addons_registry'

export interface RegistryEntry {
  url: string
  manifest: {
    id: string
    name: string
    version?: string
    description?: string
    logo?: string
    types: string[]
    resources: string[]
  }
  enabled: boolean
  installedAt: number
}

export class AddonRegistry {
  private addons: RegistryEntry[] = []

  constructor() {
    this.load()
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      this.addons = raw ? JSON.parse(raw) : []
    } catch {
      this.addons = []
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.addons))
    } catch {}
  }

  getAll(): RegistryEntry[] {
    return [...this.addons]
  }

  getEnabled(): RegistryEntry[] {
    return this.addons.filter(a => a.enabled)
  }

  getByResource(resource: string, type?: string): RegistryEntry[] {
    return this.addons.filter(a => {
      if (!a.enabled) return false
      if (type && !a.manifest.types.includes(type)) return false
      return a.manifest.resources.includes(resource)
    })
  }

  isInstalled(manifestId: string): boolean {
    return this.addons.some(a => a.manifest.id === manifestId)
  }

  install(url: string, manifest: any) {
    const id = manifest.id || url
    // Remove old entry if exists
    this.addons = this.addons.filter(a => a.manifest.id !== id)
    this.addons.push({
      url,
      manifest: {
        id: manifest.id || url,
        name: manifest.name || 'Unknown',
        version: manifest.version,
        description: manifest.description,
        logo: manifest.logo,
        types: manifest.types || [],
        resources: (manifest.resources || []).map((r: any) => typeof r === 'string' ? r : r.name),
      },
      enabled: true,
      installedAt: Date.now(),
    })
    this.save()
  }

  toggle(id: string, enabled: boolean) {
    const entry = this.addons.find(a => a.manifest.id === id)
    if (entry) {
      entry.enabled = enabled
      this.save()
    }
  }

  remove(id: string) {
    this.addons = this.addons.filter(a => a.manifest.id !== id)
    this.save()
  }
}

// Singleton
let instance: AddonRegistry | null = null
export function getAddonRegistry(): AddonRegistry {
  if (!instance) instance = new AddonRegistry()
  return instance
}
