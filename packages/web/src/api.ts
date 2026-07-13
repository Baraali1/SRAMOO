const API_BASE = '/api'

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...opts,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || res.statusText)
    }
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

export interface MetaItem {
  id: string
  type: string
  name: string
  poster?: string
  background?: string
  logo?: string
  description?: string
  releaseInfo?: string
  runtime?: string
  imdbRating?: string
  genres?: string[]
  cast?: (string | { name: string; role?: string })[]
  director?: string[]
  writer?: string[]
  videos?: { id: string; title: string; season?: number; episode?: number; released?: string; thumbnail?: string; overview?: string }[]
  trailerStreams?: { title: string; url: string }[]
}

export interface StreamInfo {
  infoHash?: string
  fileIdx?: number
  url?: string
  name?: string
  quality?: string
  size?: string
  seeds?: number
  addon?: string
}

export interface Stream {
  url?: string
  infoHash?: string
  fileIdx?: number
  name?: string
  source?: string
  description?: string
  subtitles?: Record<string, string>
  behaviorHints?: {
    notWebReady?: boolean
    bingeGroup?: string
    proxyHeaders?: Record<string, string>
    videoHash?: string
    videoSize?: number
    filename?: string
  }
}

export interface Subtitle {
  id: string
  url: string
  lang: string
  name?: string
}

export type ResourceEntry = string | { name: string; types?: string[]; idPrefixes?: string[] }

export interface Manifest {
  id: string
  version: string
  name: string
  description?: string
  logo?: string
  resources: ResourceEntry[]
  types: string[]
  catalogs: { type: string; id: string; name: string; genres?: { name: string; slug: string }[]; extra?: { name: string; isRequired?: boolean; options?: string[]; optionsLimit?: number }[] }[]
  system?: boolean
}

// Library
export const api = {
  getLibrary: () => fetchJson<any[]>('/library'),
  addToLibrary: (item: { id: string; type: string; name: string; poster?: string }) =>
    fetchJson('/library', { method: 'POST', body: JSON.stringify(item) }),
  removeFromLibrary: (id: string) => fetchJson(`/library/${id}`, { method: 'DELETE' }),
  isInLibrary: (id: string) => fetchJson<{ inLibrary: boolean }>(`/library/${id}`),

  // History
  getHistory: () => fetchJson<any[]>('/history'),
  addToHistory: (entry: any) => fetchJson('/history', { method: 'POST', body: JSON.stringify(entry) }),
  updateProgress: (itemId: string, progress: number, videoId?: string) =>
    fetchJson(`/history/${itemId}/progress`, { method: 'PUT', body: JSON.stringify({ progress, video_id: videoId }) }),
  getProgress: (itemId: string, videoId?: string) =>
    fetchJson<{ progress: number; duration: number }>(`/history/${itemId}/progress${videoId ? `?video_id=${encodeURIComponent(videoId)}` : ''}`),

  // Bookmarks
  getBookmarks: () => fetchJson<any[]>('/bookmarks'),
  addBookmark: (item: { id: string; type: string; name: string; poster?: string }) =>
    fetchJson('/bookmarks', { method: 'POST', body: JSON.stringify(item) }),
  removeBookmark: (id: string) => fetchJson(`/bookmarks/${id}`, { method: 'DELETE' }),
  isBookmarked: (id: string) => fetchJson<{ bookmarked: boolean }>(`/bookmarks/${id}`),

  // Addons
  getAddons: () => fetchJson<Manifest[]>('/addons'),
  installAddon: (url: string) => fetchJson<{ success: boolean; manifest: Manifest }>('/addons/install', { method: 'POST', body: JSON.stringify({ url }) }),
  uninstallAddon: (id: string) => fetchJson(`/addons/${id}`, { method: 'DELETE' }),

  // Streams
  getStreams: (type: string, id: string) =>
    fetchJson<{ streams: { addonName: string; streams: Stream[] }[] }>(`/streams/${type}/${encodeURIComponent(id)}`),

  // Smart streams: best per quality tier
  getBestStreams: (type: string, id: string) =>
    fetchJson<{ uhd?: StreamInfo; hd?: StreamInfo; sd?: StreamInfo; streams: StreamInfo[] }>(`/streams/best/${type}/${encodeURIComponent(id)}`),

  // Subtitles (addon-based)
  getSubtitles: (type: string, id: string) =>
    fetchJson<{ subtitles: { addonName: string; subtitles: Subtitle[] }[] }>(`/subtitles/${type}/${encodeURIComponent(id)}`),

  // Subtitles (built-in provider fallback)
  getProviderSubtitles: (type: string, id: string, opts?: { season?: number; episode?: number; lang?: string; infoHash?: string; fileIdx?: number; imdbId?: string }) => {
    let url = `/providers/subtitles/${type}/${encodeURIComponent(id)}`
    const params = new URLSearchParams()
    if (opts?.season != null) { params.set('season', String(opts.season)); params.set('episode', String(opts.episode)) }
    if (opts?.lang) params.set('lang', opts.lang)
    if (opts?.infoHash) params.set('infoHash', opts.infoHash)
    if (opts?.fileIdx != null) params.set('fileIdx', String(opts.fileIdx))
    if (opts?.imdbId) params.set('imdbId', opts.imdbId)
    const qs = params.toString()
    if (qs) url += `?${qs}`
    return fetchJson<{ subtitles: { id: string; url: string; lang: string; name?: string; downloads?: number }[] }>(url)
  },

  // Continue Watching
  getContinueWatching: () => fetchJson<any[]>('/continue-watching'),

  // Settings
  getSettings: () => fetchJson<Record<string, string | undefined>>('/settings'),
  updateSetting: (key: string, value: string) => fetchJson(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
}

// Addon protocol helpers
export async function fetchAddonCatalog(addonId: string, type: string, catalogId: string, extra?: Record<string, string>): Promise<{ metas: MetaItem[] }> {
  let url = `/addon/${addonId}/catalog/${type}/${catalogId}.json`
  if (extra && Object.keys(extra).length > 0) {
    url += '?' + new URLSearchParams(extra).toString()
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return { metas: [] }
    return res.json()
  } catch {
    return { metas: [] }
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchAddonMeta(addonId: string, type: string, id: string): Promise<{ meta: MetaItem } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`/addon/${addonId}/meta/${type}/${id}.json`, { signal: controller.signal })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function cleanId(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

export async function fetchStreamFromAddon(addonId: string, type: string, id: string, season?: number, episode?: number): Promise<{ addonName: string; streams: Stream[] }> {
  const clean = cleanId(id)
  const streamPath = (season != null && episode != null) ? `${clean}:${season}:${episode}` : clean
  const fullUrl = `${window.location.origin}/addon/${addonId}/stream/${type}/${streamPath}.json`
  console.log(`[API] Fetching streams from addon: ${fullUrl}`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const res = await fetch(`/addon/${addonId}/stream/${type}/${streamPath}.json`, { signal: controller.signal })
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(errBody.error || `HTTP ${res.status}`)
    }
    const data: { streams: Stream[] } = await res.json()
    return { addonName: addonId, streams: data.streams || [] }
  } finally {
    clearTimeout(timer)
  }
}

export async function resolveToImdbId(inputId: string, mediaType?: string): Promise<string> {
  const clean = cleanId(inputId)
  if (/^tt\d+$/.test(clean)) {
    console.log(`[API] resolveToImdbId: already IMDb ID — ${clean}`)
    return clean
  }
  const numeric = clean.replace(/^tt/, '')
  if (!/^\d+$/.test(numeric)) {
    console.warn(`[API] resolveToImdbId: non-numeric ID, passing through — ${clean}`)
    return clean
  }
  const tmdbType = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie'
  try {
    const res = await fetch(`/api/tmdb-proxy?path=${tmdbType}/${numeric}/external_ids`)
    if (!res.ok) {
      console.warn(`[API] resolveToImdbId: TMDB returned ${res.status} for ${numeric}, using raw ID`)
      return clean
    }
    const data = await res.json()
    const resolved = data.imdb_id || clean
    console.log(`[API] resolveToImdbId: ${clean} → ${resolved}`)
    return resolved
  } catch (err) {
    console.warn(`[API] resolveToImdbId: fetch failed for ${numeric}`, err)
    return clean
  }
}

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
export const IMG = {
  poster: (path?: string, size: 'w342' | 'w500' | 'w780' = 'w780') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : '',
  backdrop: (path?: string, size: 'w780' | 'w1280' = 'w1280') =>
    path ? `${TMDB_IMAGE_BASE}/${size}${path}` : '',
}
