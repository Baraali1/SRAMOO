import type { SubtitleProvider, Subtitle } from '@sramo/core'
import type { ContentType } from '@sramo/core'

const LANG_MAP: Record<string, string> = {
  ar: 'ara', en: 'eng', fr: 'fre', es: 'spa', de: 'ger', it: 'ita', pt: 'por',
  ru: 'rus', ja: 'jpn', ko: 'kor', zh: 'chi', tr: 'tur', nl: 'dut', pl: 'pol',
  sv: 'swe', da: 'dan', fi: 'fin', no: 'nor', cs: 'cze', hu: 'hun', ro: 'ron',
  th: 'tha', vi: 'vie', uk: 'ukr', el: 'ell', he: 'heb', hi: 'hin',
}

const LANG_NAMES: Record<string, string> = {
  eng: 'English', ara: 'Arabic', fre: 'French', spa: 'Spanish', deu: 'German',
  ita: 'Italian', por: 'Portuguese', rus: 'Russian', jpn: 'Japanese', kor: 'Korean',
  zho: 'Chinese', tur: 'Turkish', nld: 'Dutch', pol: 'Polish', swe: 'Swedish',
  dan: 'Danish', fin: 'Finnish', nor: 'Norwegian', ces: 'Czech', hun: 'Hungarian',
  ron: 'Romanian', tha: 'Thai', vie: 'Vietnamese', ukr: 'Ukrainian', ell: 'Greek',
  heb: 'Hebrew', hin: 'Hindi',
}

function getTmdbKey(): string {
  return process.env.TMDB_API_KEY || 'e9679fc6d9259e2e2d3f592733fb29a4'
}

async function httpGet(url: string, headers?: Record<string, string>): Promise<{ status: number; body: string } | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 8000)
  try {
    const res = await fetch(url, { signal: ctl.signal, headers, redirect: 'follow' })
    const body = await res.text()
    return { status: res.status, body }
  } catch { return null }
  finally { clearTimeout(t) }
}

async function resolveToImdbId(tmdbId: string, type: ContentType): Promise<string | null> {
  if (tmdbId.startsWith('tt')) return tmdbId
  try {
    const url = `https://api.themoviedb.org/3/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/external_ids?api_key=${getTmdbKey()}`
    const res = await httpGet(url)
    if (res?.status === 200) {
      const data = JSON.parse(res.body)
      if (data.imdb_id) return data.imdb_id
    }
  } catch {}
  return null
}

async function getTmdbInfo(tmdbId: string, type: ContentType): Promise<{ title: string; year: string } | null> {
  try {
    const mediaType = type === 'series' ? 'tv' : 'movie'
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${getTmdbKey()}&language=en`
    const res = await httpGet(url)
    if (res?.status === 200) {
      const data = JSON.parse(res.body)
      return {
        title: data.title || data.name || '',
        year: (data.release_date || data.first_air_date || '').slice(0, 4),
      }
    }
  } catch {}
  return null
}

/** Search podnapisi.net for subtitles (public API, no auth) */
async function searchPodnapisi(imdbId: string, _info: { title: string; year: string }): Promise<Subtitle[]> {
  const subs: Subtitle[] = []
  const numericId = imdbId.replace(/^tt/, '')
  // Podnapisi uses a simple search URL
  const ua = 'SRAMO v1.0 (https://github.com)'
  
  // Try XML API
  const xmlBody = `<?xml version="1.0" encoding="utf-8"?><xml><search><imdbid>${numericId}</imdbid><sublanguageid>eng,ara,all</sublanguageid></search></xml>`
  try {
    const res = await fetch('https://api.podnapisi.net/subtitles/search/old', {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml', 'User-Agent': ua },
      body: xmlBody,
      signal: AbortSignal.timeout(8000),
    })
    if (res.ok) {
      const text = await res.text()
      // Parse XML: <subtitle><id>...</id><url>...</url><language>...</language><title>...</title></subtitle>
      const subRegex = /<subtitle>([\s\S]*?)<\/subtitle>/g
      let match
      while ((match = subRegex.exec(text)) !== null) {
        const block = match[1]
        const langMatch = block.match(/<language>(\w+)<\/language>/)
        const urlMatch = block.match(/<url>([^<]+)<\/url>/)
        if (langMatch && urlMatch) {
          const lang = langMatch[1].toLowerCase()
          const lang3 = LANG_MAP[lang] || lang
          subs.push({
            id: `podnapisi:${lang}`,
            url: urlMatch[1],
            lang: lang3,
            name: LANG_NAMES[lang3] || lang,
          })
        }
      }
    }
  } catch {}
  
  return subs
}

/** Search opensubtitles.org website for direct download links */
async function searchOpensubtitlesWeb(imdbId: string): Promise<Subtitle[]> {
  const subs: Subtitle[] = []
  const numericId = imdbId.replace(/^tt/, '')
  const ua = 'Mozilla/5.0 (compatible; SRAMO/1.0)'
  
  try {
    // Use the mobile-friendly search page which is simpler
    const res = await httpGet(
      `https://www.opensubtitles.org/en/search/imdbid-${numericId}/sublanguageid-all/moviename-`,
      { 'User-Agent': ua, 'Accept': 'text/html', 'Accept-Language': 'en' }
    )
    if (res?.status === 200) {
      // Extract file IDs from download links: /en/subtitleserve/sub/123456
      const idRegex = /\/subtitleserve\/sub\/(\d+)/g
      const langRegex = /<td[^>]*>(\w+)<\/td>/gi
      let idMatch
      const seen = new Set<string>()
      while ((idMatch = idRegex.exec(res.body)) !== null) {
        const fileId = idMatch[1]
        if (seen.has(fileId)) continue
        seen.add(fileId)
        // Determine language from nearby context - default to English
        subs.push({
          id: `os:${fileId}`,
          url: `https://dl.opensubtitles.org/en/download/sub/${fileId}`,
          lang: 'eng',
          name: `Subtitle ${fileId}`,
        })
      }
    }
  } catch {}
  
  return subs
}

export const subtitleProvider: SubtitleProvider = {
  name: 'OpenSubtitles / Podnapisi',
  version: '1.0.0',

  async getSubtitles(type: ContentType, id: string): Promise<Subtitle[]> {
    // Resolve to IMDB ID
    const imdbId = id.startsWith('tt') ? id : (await resolveToImdbId(id, type))
    if (!imdbId) {
      console.warn(`[Subs] Could not resolve IMDB ID for ${type}/${id}`)
      return []
    }
    console.log(`[Subs] Resolved ${id} → ${imdbId}`)

    // Strategy 1: Podnapisi XML API (free, no auth)
    const info = await getTmdbInfo(id, type) || { title: '', year: '' }
    let subs = await searchPodnapisi(imdbId, info)
    if (subs.length > 0) {
      // Sort: Arabic first, then English, then others
      subs.sort((a, b) => {
        const priority = (l: string) => l === 'ara' ? 0 : l === 'eng' ? 1 : 2
        return priority(a.lang) - priority(b.lang)
      })
      console.log(`[Subs] Found ${subs.length} subtitles via Podnapisi (ar/en prioritized)`)
      return subs
    }

    // Strategy 2: OpenSubtitles website (direct download links)
    subs = await searchOpensubtitlesWeb(imdbId)
    if (subs.length > 0) {
      console.log(`[Subs] Found ${subs.length} subtitles via OpenSubtitles`)
      return subs
    }

    console.warn(`[Subs] No subtitles found for IMDB ${imdbId}`)
    return []
  },
}
