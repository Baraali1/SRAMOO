import type { SubtitleProvider, Subtitle } from '@sramo/core'
import type { ContentType } from '@sramo/core'

const V3_ADDON = 'https://opensubtitles-v3.strem.io'

const LANG_MAP: Record<string, string> = {
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

function langToCode(lang: string): string {
  const key = lang.toLowerCase().substring(0, 3)
  return LANG_MAP[key] || key
}

export const v3addonSubtitleProvider: SubtitleProvider = {
  name: 'OpenSubtitles v3',
  version: '1.0.0',

  async getSubtitles(type: ContentType, id: string, opts?: { season?: number; episode?: number; lang?: string; imdbId?: string }): Promise<Subtitle[]> {
    let imdbId = opts?.imdbId && opts.imdbId.startsWith('tt') ? opts.imdbId : (id.startsWith('tt') ? id : null)
    if (!imdbId) return []

    let url: string
    if (type === 'series' && opts?.season != null && opts?.episode != null) {
      url = `${V3_ADDON}/subtitles/series/${imdbId}:${opts.season}:${opts.episode}.json`
    } else {
      url = `${V3_ADDON}/subtitles/movie/${imdbId}.json`
    }

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SRAMO/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.log(`[v3addon] API returned ${res.status} for ${imdbId}`)
        return []
      }
      const data: any = await res.json()
      if (!data?.subtitles?.length) {
        return []
      }

      const subs: Subtitle[] = []
      for (const item of data.subtitles) {
        if (!item.lang || !item.url) continue
        const lang = langToCode(item.lang)
        subs.push({
          id: `v3:${imdbId}:${lang}:${item.id || '0'}`,
          url: item.url,
          lang,
          name: `${item.lang} (OpenSubtitles)`,
          downloads: parseInt(item.g || '0'),
        })
      }

      subs.sort((a, b) => {
        const priority = (l: string) => l === 'ara' ? 0 : l === 'eng' ? 1 : 2
        return priority(a.lang) - priority(b.lang)
      })

      console.log(`[v3addon] Found ${subs.length} subtitles for ${imdbId}${type === 'series' && opts?.season != null ? ` S${opts.season}E${opts.episode}` : ''}`)
      return subs
    } catch (err) {
      console.log(`[v3addon] Fetch failed for ${imdbId}:`, err instanceof Error ? err.message : err)
      return []
    }
  },
}
