import type { Stream, ContentType } from '@sramo/core'

const APIBAY_URL = 'https://apibay.org/q.php'
const YTS_URL = 'https://yts.ag/api/v2/list_movies.json'
const TMDB_URL = 'https://api.themoviedb.org/3'

interface ApibayResult {
  id: string
  name: string
  info_hash: string
  seeders: string
  leechers: string
  size: string
  imdb: string
}

interface YtsTorrent {
  hash: string
  quality: string
  seeds: number
  size: string
  type: string
}

interface YtsMovie {
  imdb_code: string
  title: string
  year: number
  torrents: YtsTorrent[]
}

async function httpJSON<T>(url: string, timeoutMs: number): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export function parseStremioId(id: string): { imdbId: string; season?: number; episode?: number } {
  const clean = id.trim()
  const m = clean.match(/^(tt\d+)(?::(\d+):(\d+))?$/i)
  if (m) {
    return {
      imdbId: m[1].toLowerCase(),
      season: m[2] != null ? parseInt(m[2], 10) : undefined,
      episode: m[3] != null ? parseInt(m[3], 10) : undefined,
    }
  }
  return { imdbId: clean.startsWith('tt') ? clean : `tt${clean.replace(/\D/g, '')}` }
}

async function resolveTitle(
  imdbId: string,
  type: ContentType,
): Promise<{ title: string; year?: number } | null> {
  const key = process.env.TMDB_API_KEY
  if (!key) return null
  try {
    const data = await httpJSON<any>(
      `${TMDB_URL}/find/${imdbId}?external_source=imdb_id&api_key=${key}&language=en`,
      6000,
    )
    if (type === 'series') {
      const tv = data?.tv_results?.[0]
      if (tv?.name) {
        const year = tv.first_air_date ? parseInt(String(tv.first_air_date).slice(0, 4), 10) : undefined
        return { title: tv.name, year }
      }
    } else {
      const mv = data?.movie_results?.[0]
      if (mv?.title) {
        const year = mv.release_date ? parseInt(String(mv.release_date).slice(0, 4), 10) : undefined
        return { title: mv.title, year }
      }
    }
  } catch (err: any) {
    console.warn('[Scraper] TMDB lookup failed:', err?.message || err)
  }
  return null
}

function extractQuality(name: string): string {
  const m = name.match(/\b(2160p|1080p|720p|480p|360p)\b/i)
  if (m) return m[1].toLowerCase()
  if (/\b(4k|uhd)\b/i.test(name)) return '2160p'
  return 'unknown'
}

function formatSize(bytes: number): string {
  if (!bytes || Number.isNaN(bytes)) return ''
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  return `${Math.round(bytes / 1024 ** 2)} MB`
}

function toStream(r: { infoHash: string; name: string; seeders: number; size: number; source: string }): Stream {
  const quality = extractQuality(r.name)
  const sizeStr = formatSize(r.size)
  const descParts = [
    quality !== 'unknown' ? quality.toUpperCase() : '',
    sizeStr,
    `Seeders: ${r.seeders}`,
    r.name,
  ].filter(Boolean)
  return {
    infoHash: r.infoHash.toLowerCase(),
    name: `[${r.source}] ${quality} | 🌱${r.seeders}`,
    source: r.source,
    description: descParts.join(' • '),
    behaviorHints: {
      bingeGroup: `${r.source.toLowerCase().replace(/\s+/g, '-')}|${quality}`,
      filename: r.name,
      ...(r.size > 0 ? { videoSize: r.size } : {}),
    },
  }
}

async function searchApibay(query: string, type: ContentType, season?: number, episode?: number): Promise<Stream[]> {
  const url = `${APIBAY_URL}?q=${encodeURIComponent(query)}`
  const results = await httpJSON<ApibayResult[]>(url, 10000)
  if (!Array.isArray(results) || results.length === 0) return []
  if (results.length === 1 && results[0].id === '0') return []

  let alive = results.filter(
    (r) => r?.info_hash && /^[a-f0-9]{40}$/i.test(r.info_hash) && parseInt(r.seeders || '0', 10) > 0,
  )
  if (alive.length === 0) return []

  if (type === 'series' && season != null && episode != null) {
    const paddedS = String(season).padStart(2, '0')
    const paddedE = String(episode).padStart(2, '0')
    const epPat = new RegExp(`S\\s?${season}\\s?E\\s?${episode}\\b|S\\s?${paddedS}\\s?E\\s?${paddedE}\\b|${season}x${episode}\\b`, 'i')
    const epMatches = alive.filter((r) => epPat.test(r.name))
    if (epMatches.length > 0) alive = epMatches
  }

  alive.sort((a, b) => parseInt(b.seeders || '0', 10) - parseInt(a.seeders || '0', 10))

  return alive.slice(0, 20).map((r) =>
    toStream({
      infoHash: r.info_hash,
      name: r.name,
      seeders: parseInt(r.seeders || '0', 10),
      size: parseInt(r.size || '0', 10),
      source: 'PirateBay',
    }),
  )
}

async function searchYts(imdbId: string): Promise<Stream[]> {
  try {
    const data = await httpJSON<{ status?: string; data?: { movies?: YtsMovie[] } }>(
      `${YTS_URL}?query_term=${encodeURIComponent(imdbId.replace(/^tt/, ''))}&limit=5`,
      8000,
    )
    const movies = data?.data?.movies
    if (!Array.isArray(movies)) return []
    const movie = movies.find((m) => m.imdb_code?.toLowerCase() === imdbId.toLowerCase())
    if (!movie?.torrents?.length) return []
    return movie.torrents
      .filter((t) => t.hash && /^[a-f0-9]{40}$/i.test(t.hash) && (t.seeds ?? 0) > 0)
      .sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
      .map((t) =>
        toStream({
          infoHash: t.hash,
          name: `${movie.title} (${movie.year}) ${t.quality} ${t.type}`,
          seeders: t.seeds ?? 0,
          size: parseInt(String(t.size || '').replace(/[^\d]/g, ''), 10) || 0,
          source: 'YTS',
        }),
      )
  } catch {
    return []
  }
}

export async function getScraperStreams(type: ContentType, id: string): Promise<Stream[]> {
  const { imdbId, season, episode } = parseStremioId(id)
  if (!/^tt\d+$/i.test(imdbId)) {
    console.warn('[Scraper] Unsupported id:', id)
    return []
  }

  const meta = await resolveTitle(imdbId, type)
  if (!meta?.title) {
    console.warn('[Scraper] Could not resolve title for', imdbId)
    return []
  }

  let query = meta.title
  if (type === 'series' && season != null && episode != null) {
    query += ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
  } else if (meta.year) {
    query += ` ${meta.year}`
  }

  console.log(`[Scraper] "${imdbId}" → searching: "${query}"`)

  const streams: Stream[] = []
  try {
    const apibay = await searchApibay(query, type, season, episode)
    streams.push(...apibay)
    console.log(`[Scraper] PirateBay: ${apibay.length} streams`)
  } catch (err: any) {
    console.warn('[Scraper] PirateBay failed:', err?.message || err)
  }

  if (type !== 'series' && streams.length < 5) {
    try {
      const yts = await searchYts(imdbId)
      const seen = new Set(streams.map((s) => s.infoHash))
      const fresh = yts.filter((s) => !seen.has(s.infoHash))
      streams.push(...fresh)
      console.log(`[Scraper] YTS: ${fresh.length} streams`)
    } catch (err: any) {
      console.warn('[Scraper] YTS failed:', err?.message || err)
    }
  }

  return streams
}
