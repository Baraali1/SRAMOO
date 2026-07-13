import { type MetaItem } from './api.js'

const BASE_URL = '/api/tmdb-proxy'
let _connectionOk = false

function proxyUrl(pathWithQuery: string): string {
  const cleaned = pathWithQuery.replace(/^\/+/, '')
  const qIndex = cleaned.indexOf('?')
  if (qIndex === -1) {
    return BASE_URL + '?path=' + encodeURIComponent(cleaned)
  }
  const path = cleaned.substring(0, qIndex)
  const query = cleaned.substring(qIndex + 1)
  return BASE_URL + '?path=' + encodeURIComponent(path) + '&' + query
}

export async function verifyTmdbConnection(): Promise<boolean> {
  console.log('[TMDB] Verifying connection to TMDB proxy...')
  try {
    const res = await fetch(proxyUrl('movie/popular') + '&language=en-US&page=1', {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error('[TMDB] Connection FAILED — HTTP', res.status)
      _connectionOk = false
      return false
    }
    const data = await res.json()
    if (!data.results || data.results.length === 0) {
      console.error('[TMDB] Connection FAILED — empty response')
      _connectionOk = false
      return false
    }
    _connectionOk = true
    console.log('[TMDB] Connection OK —', data.results.length, 'items in sample')
    return true
  } catch (err: any) {
    console.error('[TMDB] Connection FAILED —', err?.message || err)
    _connectionOk = false
    return false
  }
}

export function isTmdbConnected(): boolean {
  return _connectionOk
}

function sanitize<T extends { id?: any; title?: string; name?: string; poster_path?: string }>(items: T[], sourceName: string): T[] {
  const seen = new Set<string>()
  const valid = items.filter(item => {
    if (!item) return false
    const id = String(item.id || '')
    const title = item.title || item.name || ''
    const poster = item.poster_path || ''
    if (!id || !title || !poster) return false
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  const removed = items.length - valid.length
  console.log(`[TMDB] ${sourceName}: fetched ${items.length}, valid ${valid.length}${removed ? ` (${removed} removed)` : ''}`)
  return valid
}

async function fetchResults(path: string, sourceName: string): Promise<{ items: any[]; totalPages: number }> {
  const url = proxyUrl(path)
  console.log('[TMDB] Fetching:', url)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.warn('[TMDB] HTTP', res.status, '—', path)
      return { items: [], totalPages: 0 }
    }
    const data = await res.json()
    return {
      items: sanitize(data.results || [], sourceName),
      totalPages: data.total_pages || 0,
    }
  } catch (err: any) {
    console.warn('[TMDB] Failed:', path, err?.message || err)
    return { items: [], totalPages: 0 }
  }
}

async function fetchPages(
  basePath: string,
  sourceName: string,
  pages = 5,
): Promise<any[]> {
  const allResults: any[] = []
  const seen = new Set<string>()
  let maxPages = pages
  for (let p = 1; p <= maxPages; p++) {
    const { items, totalPages } = await fetchResults(`${basePath}&page=${p}`, `${sourceName}_p${p}`)
    if (p === 1 && totalPages > 0) maxPages = Math.min(pages, totalPages)
    for (const item of items) {
      const id = String(item.id || '')
      if (!seen.has(id)) {
        seen.add(id)
        allResults.push(item)
      }
    }
    if (items.length < 20) break
  }
  return allResults
}

function toMetaItem(item: any, mediaType?: string): MetaItem {
  return {
    id: String(item.id),
    type: mediaType || (item.media_type === 'tv' ? 'series' : 'movie'),
    name: item.title || item.name || 'Unknown',
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w780${item.poster_path}` : '',
      background: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
    description: item.overview || '',
    releaseInfo: (item.release_date || item.first_air_date || '').split('-')[0] || '',
    imdbRating: item.vote_average ? String(Math.round(item.vote_average * 10) / 10) : '',
    genres: item.genre_ids || [],
  }
}

function report(sectionName: string, items: MetaItem[]) {
  console.log(`[TMDB] ${sectionName}: ${items.length} items`)
}

export const tmdb = {
  async getTrending(type = 'movie', window = 'day', page = 1) {
    const { items } = await fetchResults(`trending/${type}/${window}?language=en-US&page=${page}`, 'getTrending')
    const result = items.map(r => toMetaItem(r, type === 'tv' ? 'series' : 'movie'))
    report('getTrending', result)
    return result
  },

  async getTrendingPages(type = 'movie', window = 'day', pages = 5) {
    const results = await fetchPages(`trending/${type}/${window}?language=en-US`, 'getTrendingPages', pages)
    const items = results.map(r => toMetaItem(r, type === 'tv' ? 'series' : 'movie'))
    report('getTrendingPages', items)
    return items
  },

  async getPopular(type = 'movie', page = 1) {
    const { items } = await fetchResults(`${type}/popular?language=en-US&page=${page}`, 'getPopular')
    const result = items.map(r => toMetaItem(r, type === 'tv' ? 'series' : 'movie'))
    report('getPopular', result)
    return result
  },

  async getPopularPages(type = 'movie', pages = 5) {
    const results = await fetchPages(`${type}/popular?language=en-US`, 'getPopularPages', pages)
    const items = results.map(r => toMetaItem(r, type === 'tv' ? 'series' : 'movie'))
    report('getPopularPages', items)
    return items
  },

  async getTopRated(type = 'movie', page = 1) {
    const { items } = await fetchResults(`${type}/top_rated?language=en-US&page=${page}`, 'getTopRated')
    const result = items.map(r => toMetaItem(r, type === 'tv' ? 'series' : 'movie'))
    report('getTopRated', result)
    return result
  },

  async getTopRatedPages(type = 'movie', pages = 5) {
    const results = await fetchPages(`${type}/top_rated?language=en-US`, 'getTopRatedPages', pages)
    const items = results.map(r => toMetaItem(r, type === 'tv' ? 'series' : 'movie'))
    report('getTopRatedPages', items)
    return items
  },

  async getNowPlaying(page = 1) {
    const { items } = await fetchResults(`movie/now_playing?language=en-US&page=${page}`, 'getNowPlaying')
    const result = items.map(r => toMetaItem(r, 'movie'))
    report('getNowPlaying', result)
    return result
  },

  async getNowPlayingPages(pages = 5) {
    const results = await fetchPages(`movie/now_playing?language=en-US`, 'getNowPlayingPages', pages)
    const items = results.map(r => toMetaItem(r, 'movie'))
    report('getNowPlayingPages', items)
    return items
  },

  async getUpcoming(page = 1) {
    const { items } = await fetchResults(`movie/upcoming?language=en-US&page=${page}`, 'getUpcoming')
    const result = items.map(r => toMetaItem(r, 'movie'))
    report('getUpcoming', result)
    return result
  },

  async getUpcomingPages(pages = 5) {
    const results = await fetchPages(`movie/upcoming?language=en-US`, 'getUpcomingPages', pages)
    const items = results.map(r => toMetaItem(r, 'movie'))
    report('getUpcomingPages', items)
    return items
  },

  async getTrendingTV(window = 'day', pages = 5) {
    return this.getTrendingPages('tv', window, pages)
  },

  async getRecommendations(id: string, type: string) {
    const mediaType = type === 'series' || type === 'tv' ? 'tv' : 'movie'
    try {
      const { items } = await fetchResults(`${mediaType}/${id}/recommendations?language=en-US&page=1`, 'getRecommendations')
      return items.slice(0, 12).map(r => toMetaItem(r, mediaType === 'tv' ? 'series' : 'movie'))
    } catch { return [] }
  },

  async search(query: string) {
    if (!query || query.length < 2) return []
    const { items } = await fetchResults(`search/multi?query=${encodeURIComponent(query)}&language=en-US&page=1`, 'search')
    const result = items
      .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
      .map((r: any) => toMetaItem(r))
    report('search', result)
    return result
  },

  async discover(type: string, params: Record<string, string>, pages = 1) {
    const typePath = type === 'series' || type === 'tv' ? 'tv' : 'movie'
    const startPage = parseInt(params.page) || 1
    const search = new URLSearchParams({ language: 'en-US', ...params }).toString()

    const first = await fetchResults(`discover/${typePath}?${search}`, `discover_p1`)
    const totalPages = first.totalPages

    let allItems = [...first.items]
    const maxPages = Math.min(pages, totalPages || pages)
    for (let p = 1; p < maxPages; p++) {
      const pageNum = startPage + p
      if (pageNum > (totalPages || 1)) break
      const { items } = await fetchResults(`discover/${typePath}?language=en-US&${search.replace(/&?page=\d+/,'')}&page=${pageNum}`, `discover_p${pageNum}`)
      allItems = [...allItems, ...items]
    }

    const items = allItems.map(r => toMetaItem(r, typePath === 'tv' ? 'series' : 'movie'))
    report('discover', items)
    return { items, totalPages }
  },

  async getSeasons(tmdbId: string): Promise<{ season_number: number; name: string; episode_count: number; poster_path: string }[]> {
    const type = 'tv'
    const url = proxyUrl(`${type}/${tmdbId}`) + '&language=en-US'
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return []
      const data = await res.json()
      return (data.seasons || []).filter((s: any) => s.season_number > 0).map((s: any) => ({
        season_number: s.season_number,
        name: s.name || `Season ${s.season_number}`,
        episode_count: s.episode_count || 0,
        poster_path: s.poster_path || '',
      }))
    } catch { return [] }
  },

  async getEpisodes(tmdbId: string, seasonNumber: number): Promise<{ episode_number: number; name: string; still_path: string; overview: string; air_date: string; runtime?: number }[]> {
    const url = proxyUrl(`tv/${tmdbId}/season/${seasonNumber}`) + '&language=en-US'
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return []
      const data = await res.json()
      return (data.episodes || []).map((e: any) => ({
        episode_number: e.episode_number,
        name: e.name || `Episode ${e.episode_number}`,
        still_path: e.still_path || '',
        overview: e.overview || '',
        air_date: e.air_date || '',
        runtime: e.runtime,
      }))
    } catch { return [] }
  },

  async getDetails(tmdbId: string, mediaType?: string) {
    const type = mediaType === 'series' || mediaType === 'tv' ? 'tv' : 'movie'
    const url = proxyUrl(`${type}/${tmdbId}`) + '&language=en-US&append_to_response=credits,videos,external_ids'
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return null
      const data = await res.json()
      if (!data.id || (!data.title && !data.name)) return null
      return {
        id: String(data.id),
        type: type === 'tv' ? 'series' : 'movie',
        name: data.title || data.name || 'Unknown',
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w780${data.poster_path}` : '',
        background: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : '',
        description: data.overview || '',
        releaseInfo: (data.release_date || data.first_air_date || '').split('-')[0] || '',
        runtime: data.runtime ? `${data.runtime} min` : undefined,
        imdbRating: data.vote_average ? String(Math.round(data.vote_average * 10) / 10) : '',
        genres: (data.genres || []).map((g: any) => g.name),
        cast: (data.credits?.cast || []).slice(0, 15).map((c: any) => ({
          name: c.name,
          role: c.character,
          profile: c.profile_path ? `https://image.tmdb.org/t/p/w342${c.profile_path}` : '',
        })),
        director: (data.credits?.crew || [])
          .filter((c: any) => c.job === 'Director')
          .map((c: any) => c.name),
        writer: (data.credits?.crew || [])
          .filter((c: any) => c.job === 'Writer' || c.job === 'Screenplay')
          .map((c: any) => c.name),
        videos: (data.videos?.results || [])
          .filter((v: any) => v.site === 'YouTube' && v.type === 'Trailer')
          .map((v: any) => ({
            id: v.key,
            title: v.name,
            released: v.published_at,
          })),
        trailerStreams: (data.videos?.results || [])
          .filter((v: any) => v.site === 'YouTube' && v.type === 'Trailer')
          .map((v: any) => ({
            title: v.name,
            url: `https://www.youtube.com/watch?v=${v.key}`,
          })),
        imdb_id: data.external_ids?.imdb_id || undefined,
      } as MetaItem & { imdb_id?: string }
    } catch {
      return null
    }
  },
}
