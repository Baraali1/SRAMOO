import type { MetadataProvider } from '@sramo/core'
import type { MetaItem, ContentType } from '@sramo/core'

const TMDB_API = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p'
function apiKey(): string { return process.env.TMDB_API_KEY || '' }

async function fetchJSON(url: string): Promise<any> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function mapMeta(tmdb: any, type: ContentType): MetaItem | null {
  if (!tmdb) return null
  return {
    id: `tmdb:${tmdb.id}`,
    type,
    name: tmdb.title || tmdb.name || 'Unknown',
    poster: tmdb.poster_path ? `${TMDB_IMG}/w780${tmdb.poster_path}` : undefined,
    background: tmdb.backdrop_path ? `${TMDB_IMG}/w1280${tmdb.backdrop_path}` : undefined,
    description: tmdb.overview || undefined,
    releaseInfo: (tmdb.release_date || tmdb.first_air_date || '').split('-')[0],
    imdbRating: tmdb.vote_average ? String(tmdb.vote_average) : undefined,
    genres: tmdb.genres?.map((g: any) => g.name) || undefined,
    cast: tmdb.credits?.cast?.slice(0, 10).map((c: any) => ({
      name: c.name,
      role: c.character,
    })) || undefined,
    director: tmdb.credits?.crew?.filter((c: any) => c.job === 'Director').map((c: any) => c.name) || undefined,
  }
}

export const tmdbProvider: MetadataProvider = {
  name: 'TMDB',
  version: '1.0.0',

  async getMeta(type: ContentType, id: string): Promise<MetaItem | null> {
    const key = apiKey()
    if (!key) return null

    // id can be 'tmdb:12345' or 'tt1234567' (IMDB)
    let tmdbId = id.replace(/^tmdb:/, '')
    let tmdbType = type === 'series' ? 'tv' : 'movie'

    // If it's an IMDB ID, resolve it to TMDB ID first
    if (tmdbId.startsWith('tt')) {
      const find = await fetchJSON(`${TMDB_API}/find/${tmdbId}?api_key=${key}&external_source=imdb_id`)
      const results = tmdbType === 'tv' ? find?.tv_results : find?.movie_results
      if (!results?.length) return null
      const resolved = await fetchJSON(`${TMDB_API}/${tmdbType}/${results[0].id}?api_key=${key}&append_to_response=credits`)
      return mapMeta(resolved, type)
    }

    const data = await fetchJSON(`${TMDB_API}/${tmdbType}/${tmdbId}?api_key=${key}&append_to_response=credits`)
    return mapMeta(data, type)
  },

  async search(query: string, type?: ContentType): Promise<MetaItem[]> {
    const key = apiKey()
    if (!key || query.length < 2) return []

    const tmdbType = type === 'series' ? 'tv' : type === 'movie' ? 'movie' : 'multi'
    const data = await fetchJSON(`${TMDB_API}/search/${tmdbType}?api_key=${key}&query=${encodeURIComponent(query)}`)

    if (!data?.results) return []

    const contentType: ContentType = type || 'movie'
    return data.results.map((r: any) => mapMeta(r, contentType)).filter(Boolean)
  },
}
