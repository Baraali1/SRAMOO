import type { SubtitleProvider, Subtitle } from '@sramo/core'
import type { ContentType } from '@sramo/core'

const V3_ADDON = 'https://opensubtitles-v3.strem.io'
const API_BASE = 'https://api.opensubtitles.com/api/v1'
const API_KEY = 'mpldTjhifMLrli0QyEcigVJ6yyyb73b6'

const V3_LANG_MAP: Record<string, string> = {
  ara: 'ara', eng: 'eng', fre: 'fre', spa: 'spa', ger: 'ger', ita: 'ita',
  por: 'por', rus: 'rus', jpn: 'jpn', kor: 'kor', zho: 'chi', chi: 'chi',
  dut: 'dut', pol: 'pol', swe: 'swe', dan: 'dan', fin: 'fin', nor: 'nor',
  cze: 'cze', hun: 'hun', rum: 'rum', tha: 'tha', vie: 'vie', ukr: 'ukr',
  ell: 'gre', heb: 'heb', hin: 'hin', tur: 'tur', bul: 'bul', hrv: 'hrv',
  srp: 'srp', slo: 'slo', slv: 'slv', bos: 'bos', per: 'per', urd: 'urd',
  ind: 'ind', may: 'may', tgl: 'tgl', cat: 'cat', baq: 'baq', glg: 'glg',
  est: 'est', lav: 'lav', lit: 'lit', alb: 'alb', mac: 'mac', arm: 'arm',
  geo: 'geo', aze: 'aze', bel: 'bel', ice: 'ice', gle: 'gle', mlt: 'mlt',
  wel: 'wel', ltz: 'ltz', afr: 'afr', swa: 'swa', zul: 'zul', xho: 'xho',
  sot: 'sot', tsn: 'tsn', ssw: 'ssw', twi: 'twi', hau: 'hau', yor: 'yor',
  ibo: 'ibo', khm: 'khm', lao: 'lao', bur: 'bur', mon: 'mon', nep: 'nep',
  sin: 'sin', tam: 'tam', tel: 'tel', mal: 'mal', kan: 'kan', guj: 'guj',
  pan: 'pan', ben: 'ben', ori: 'ori', asm: 'asm', kaz: 'kaz', kir: 'kir',
  tgk: 'tgk', tuk: 'tuk', uzb: 'uzb', uig: 'uig', pob: 'por', spl: 'spa',
  kur: 'kur',
}

const LANG_MAP: Record<string, string> = {
  ar: 'ara', en: 'eng', fr: 'fre', es: 'spa', de: 'ger', it: 'ita',
  pt: 'por', ru: 'rus', ja: 'jpn', ko: 'kor', zh: 'chi', nl: 'dut',
  pl: 'pol', sv: 'swe', da: 'dan', fi: 'fin', no: 'nor', cs: 'cze',
  hu: 'hun', ro: 'rum', th: 'tha', vi: 'vie', uk: 'ukr', el: 'gre',
  he: 'heb', hi: 'hin', tr: 'tur', bg: 'bul', hr: 'hrv', sr: 'srp',
  sk: 'slo', sl: 'slv', bs: 'bos', fa: 'per', ur: 'urd', id: 'ind',
  ms: 'may', tl: 'tgl', ca: 'cat', eu: 'baq', gl: 'glg', et: 'est',
  lv: 'lav', lt: 'lit', sq: 'alb', mk: 'mac', hy: 'arm', ka: 'geo',
  az: 'aze', be: 'bel', is: 'ice', ga: 'gle', mt: 'mlt', cy: 'wel',
  lb: 'ltz', af: 'afr', sw: 'swa', zu: 'zul', xh: 'xho', st: 'sot',
  tn: 'tsn', ss: 'ssw', nso: 'sot', tw: 'twi', ha: 'hau', yo: 'yor',
  ig: 'ibo', km: 'khm', lo: 'lao', my: 'bur', mn: 'mon', ne: 'nep',
  si: 'sin', ta: 'tam', te: 'tel', ml: 'mal', kn: 'kan', gu: 'guj',
  pa: 'pan', bn: 'ben', or: 'ori', as: 'asm', kk: 'kaz', ky: 'kir',
  tg: 'tgk', tk: 'tuk', uz: 'uzb', ug: 'uig', arz: 'ara', eng: 'eng',
}

const LANG_DISPLAY: Record<string, string> = {
  ara: 'Arabic', eng: 'English', fre: 'French', spa: 'Spanish',
  ger: 'German', ita: 'Italian', por: 'Portuguese', rus: 'Russian',
  jpn: 'Japanese', kor: 'Korean', chi: 'Chinese', dut: 'Dutch',
  pol: 'Polish', swe: 'Swedish', dan: 'Danish', fin: 'Finnish',
  nor: 'Norwegian', cze: 'Czech', hun: 'Hungarian', rum: 'Romanian',
  tha: 'Thai', vie: 'Vietnamese', ukr: 'Ukrainian', gre: 'Greek',
  heb: 'Hebrew', hin: 'Hindi', tur: 'Turkish', bul: 'Bulgarian',
  per: 'Persian', pob: 'Portuguese (BR)',
}

function langToCode(lang: string | null | undefined): string {
  if (!lang) return 'unk'
  const key = lang.toLowerCase().replace(/-.*$/, '')
  return LANG_MAP[key] || key.substring(0, 3)
}

function v3LangToCode(lang: string): string {
  const key = lang.toLowerCase().substring(0, 3)
  return V3_LANG_MAP[key] || key
}

function getTmdbKey(): string {
  return process.env.TMDB_API_KEY || 'e9679fc6d9259e2e2d3f592733fb29a4'
}

async function resolveImdb(id: string, type: ContentType, season?: number, episode?: number): Promise<string | null> {
  if (id.startsWith('tt')) return id
  const tmdbKey = getTmdbKey()
  try {
    if (type === 'series' && season != null && episode != null) {
      const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}/episode/${episode}/external_ids?api_key=${tmdbKey}`
      const res = await fetch(url, { headers: { 'User-Agent': 'SRAMO/1.0' } })
      if (res.ok) {
        const data = await res.json()
        if (data.imdb_id) return data.imdb_id
      }
    }
    const mediaType = type === 'series' ? 'tv' : 'movie'
    const url = `https://api.themoviedb.org/3/${mediaType}/${id}/external_ids?api_key=${tmdbKey}`
    const res = await fetch(url, { headers: { 'User-Agent': 'SRAMO/1.0' } })
    if (res.ok) {
      const data = await res.json()
      if (data.imdb_id) return data.imdb_id
    }
  } catch {}
  return null
}

async function apiFetch<T>(path: string): Promise<T | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 15000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: ctl.signal,
      headers: {
        'Api-Key': API_KEY,
        'User-Agent': 'SRAMO/1.0',
        'Accept': 'application/json',
      },
    })
    if (!res.ok) { console.log(`[OpenSubtitles.com] API fetch failed: ${res.status} ${path}`); return null }
    return res.json()
  } catch { return null }
  finally { clearTimeout(t) }
}

export async function downloadSubtitle(fileId: number): Promise<{ link: string; fileName: string } | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 15000)
  try {
    const res = await fetch(`${API_BASE}/download`, {
      method: 'POST',
      signal: ctl.signal,
      headers: {
        'Api-Key': API_KEY,
        'User-Agent': 'SRAMO/1.0',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ file_id: fileId }),
    })
    if (!res.ok) { console.log(`[OpenSubtitles.com] Download API failed: ${res.status} for file_id=${fileId}`); return null }
    const data = await res.json()
    if (!data.link) return null
    return { link: data.link, fileName: data.file_name || '' }
  } catch { return null }
  finally { clearTimeout(t) }
}

async function searchV3Addon(imdbId: string, type: ContentType, season?: number, episode?: number): Promise<Subtitle[]> {
  let url: string
  if (type === 'series' && season != null && episode != null) {
    url = `${V3_ADDON}/subtitles/series/${imdbId}:${season}:${episode}.json`
  } else {
    url = `${V3_ADDON}/subtitles/movie/${imdbId}.json`
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SRAMO/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const data: any = await res.json()
    if (!data?.subtitles?.length) return []

    const subs: Subtitle[] = []
    for (const item of data.subtitles) {
      if (!item.lang || !item.url) continue
      const lang = v3LangToCode(item.lang)
      if (lang !== 'ara' && lang !== 'eng') continue
      const displayName = LANG_DISPLAY[lang] || lang
      const downloads = parseInt(item.g) || 0
      subs.push({
        id: `v3:${imdbId}:${lang}:${item.id || '0'}`,
        url: item.url,
        lang,
        name: displayName,
        downloads,
      })
    }

    subs.sort((a, b) => {
      const priority = (l: string) => l === 'ara' ? 0 : l === 'eng' ? 1 : 2
      const pa = priority(a.lang), pb = priority(b.lang)
      if (pa !== pb) return pa - pb
      return (b.downloads || 0) - (a.downloads || 0)
    })

    console.log(`[OpenSubtitles.com] v3 addon: ${subs.length} subtitles for ${imdbId}`)
    return subs
  } catch {
    return []
  }
}

export const opensubtitlesProvider: SubtitleProvider = {
  name: 'OpenSubtitles.com',
  version: '1.0.0',

  async getSubtitles(type: ContentType, id: string, opts?: { season?: number; episode?: number; lang?: string; imdbId?: string }): Promise<Subtitle[]> {
    let imdbId: string | undefined | null = opts?.imdbId
    if (!imdbId) {
      imdbId = await resolveImdb(id, type, opts?.season, opts?.episode)
      if (!imdbId && id.match(/^\d+$/)) imdbId = id
    }
    console.log(`[OpenSubtitles.com] resolveImdb(${id}) → ${imdbId}${opts?.imdbId ? ' (from client)' : ''}`)

    // Strategy 1: Try v3 addon (returns working subs5.strem.io download URLs)
    if (imdbId?.startsWith('tt')) {
      const v3Subs = await searchV3Addon(imdbId, type, opts?.season, opts?.episode)
      if (v3Subs.length > 0) {
        return v3Subs
      }
      console.log(`[OpenSubtitles.com] v3 addon returned 0 results, falling back to regular API`)
    }

    // Strategy 2: Regular OpenSubtitles API (search works, but download may fail)
    let url = `/subtitles?order_by=download_count&order_direction=desc&limit=50`
    if (imdbId?.startsWith('tt')) {
      const apiType = type === 'series' ? 'episode' : 'movie'
      url += `&imdb_id=${imdbId}&type=${apiType}`
    } else {
      url += `&tmdb_id=${imdbId || id}&type=${type === 'series' ? 'episode' : 'movie'}`
    }
    if (type === 'series' && opts?.season != null) url += `&season_number=${opts.season}`
    if (type === 'series' && opts?.episode != null) url += `&episode_number=${opts.episode}`
    if (opts?.lang) url += `&subtitle_language=${opts.lang}`

    console.log(`[OpenSubtitles.com] Searching: ${url}`)

    const searchResult = await apiFetch<{
      total_count: number
      data: {
        id: number
        attributes: {
          language: string
          legacy_subtitle_id?: number
          release_name?: string
          download_count?: number
          files: { file_id: number }[]
        }
      }[]
    }>(url)

    if (!searchResult?.data?.length) {
      console.log(`[OpenSubtitles.com] Search returned 0 results for ${imdbId} (${type})`)
      return []
    }

    console.log(`[OpenSubtitles.com] Search returned ${searchResult.data.length} results (total_count: ${searchResult.total_count})`)

    const subs: Subtitle[] = []

    for (const item of searchResult.data) {
      if (!item.attributes.language) continue
      const lang = langToCode(item.attributes.language)
      const legacyId = item.attributes.legacy_subtitle_id
      const fileId = item.attributes.files?.[0]?.file_id

      const name = item.attributes.release_name
        ? `${item.attributes.language} (${item.attributes.release_name.substring(0, 30)})`
        : item.attributes.language

      let subUrl: string | null = null
      if (fileId) {
        subUrl = `/api/subtitle-proxy?file_id=${fileId}`
      } else if (legacyId) {
        subUrl = `https://dl.opensubtitles.org/en/download/sub/${legacyId}`
      }

      if (!subUrl) {
        console.log(`[OpenSubtitles.com] Skipping item ${item.id}: no legacy_subtitle_id or file_id`)
        continue
      }

      subs.push({
        id: `os:${imdbId}:${lang}:${item.id}`,
        url: subUrl,
        lang,
        name,
        downloads: item.attributes.download_count ?? 0,
      })
    }

    console.log(`[OpenSubtitles.com] Returning ${subs.length} subtitles for ${imdbId}`)
    return subs
  },
}
