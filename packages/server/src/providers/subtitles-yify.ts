import type { SubtitleProvider, Subtitle } from '@sramo/core'
import type { ContentType } from '@sramo/core'

const LANG_MAP: Record<string, string> = {
  arabic: 'ara', english: 'eng', french: 'fre', spanish: 'spa',
  german: 'ger', italian: 'ita', portuguese: 'por', 'brazilian portuguese': 'por',
  russian: 'rus', japanese: 'jpn', korean: 'kor', chinese: 'chi',
  turkish: 'tur', dutch: 'dut', polish: 'pol', swedish: 'swe',
  danish: 'dan', finnish: 'fin', norwegian: 'nor', czech: 'cze',
  hungarian: 'hun', romanian: 'ron', thai: 'tha', vietnamese: 'vie',
  ukrainian: 'ukr', greek: 'ell', hebrew: 'heb', hindi: 'hin',
  bengali: 'ben', bulgarian: 'bul', croatian: 'hrv', 'farsi/persian': 'fas',
  indonesian: 'ind',
}

function getTmdbKey(): string {
  return process.env.TMDB_API_KEY || 'e9679fc6d9259e2e2d3f592733fb29a4'
}

async function httpGet(url: string): Promise<string | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 10000)
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'SRAMO/1.0', Accept: 'text/html' },
    })
    return await res.text()
  } catch { return null }
  finally { clearTimeout(t) }
}

async function resolveToImdbId(tmdbId: string, type: ContentType): Promise<string | null> {
  if (tmdbId.startsWith('tt')) return tmdbId
  try {
    const url = `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${getTmdbKey()}`
    const res = await httpGet(url)
    if (res) {
      const data = JSON.parse(res)
      if (data.imdb_id) return data.imdb_id
    }
  } catch {}
  return null
}

function langNameToCode(name: string): string {
  const key = name.trim().toLowerCase()
  return LANG_MAP[key] || key.substring(0, 3)
}

export const yifySubtitleProvider: SubtitleProvider = {
  name: 'YIFY Subtitles',
  version: '1.0.0',

  async getSubtitles(type: ContentType, id: string): Promise<Subtitle[]> {
    const imdbId = id.startsWith('tt') ? id : await resolveToImdbId(id, type)
    if (!imdbId) {
      console.warn('[YIFY] Could not resolve IMDB ID for', type, id)
      return []
    }
    console.log('[YIFY] Resolved', id, '→', imdbId)

    const html = await httpGet(`https://yts-subs.com/movie-imdb/${imdbId}`)
    if (!html) {
      console.warn('[YIFY] Failed to fetch list page for', imdbId)
      return []
    }

    const subs: Subtitle[] = []
    const rowRegex = /<tr data-id="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g
    let rowMatch
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[2]

      const langMatch = rowHtml.match(/class="sub-lang">([^<]+)</)
      if (!langMatch) continue
      const langName = langMatch[1].trim()
      const langCode = langNameToCode(langName)

      const hrefMatch = rowHtml.match(/href="(\/subtitles\/[^"]+)"/)
      if (!hrefMatch) continue
      const href = hrefMatch[1]

      const idSuffix = href.split('-').pop() || '0'

      subs.push({
        id: `yify:${imdbId}:${langCode}:${idSuffix}`,
        url: `https://subtitles.yts-subs.com${href}.zip`,
        lang: langCode,
        name: `${langName} (YIFY)`,
      })
    }

    subs.sort((a, b) => {
      const prio = (l: string) => l === 'ara' ? 0 : l === 'eng' ? 1 : 2
      return prio(a.lang) - prio(b.lang)
    })

    console.log('[YIFY] Found', subs.length, 'subtitles')
    return subs
  },
}
