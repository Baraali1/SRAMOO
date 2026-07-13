import type { SubtitleProvider, Subtitle } from '@sramo/core'
import type { ContentType } from '@sramo/core'

const API_BASE = 'https://sub.wyzie.io'
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
  tg: 'tgk', tk: 'tuk', uz: 'uzb', ug: 'uig',
}

function getApiKey(): string | null {
  return process.env.WYZIE_API_KEY || null
}

function langToCode(lang: string): string {
  const key = lang.toLowerCase().replace(/-.*$/, '').substring(0, 2)
  return LANG_MAP[key] || key.substring(0, 3)
}

export const wyzieSubtitleProvider: SubtitleProvider = {
  name: 'Wyzie Subs',
  version: '1.0.0',

  async getSubtitles(type: ContentType, id: string, opts?: { season?: number; episode?: number; lang?: string; imdbId?: string }): Promise<Subtitle[]> {
    const apiKey = getApiKey()
    if (!apiKey) {
      return []
    }

    const imdbId = opts?.imdbId && opts.imdbId.startsWith('tt') ? opts.imdbId : (id.startsWith('tt') ? id : null)
    if (!imdbId) {
      return []
    }

    let url = `${API_BASE}/search?id=${imdbId}&key=${apiKey}&source=all`
    if (type === 'series' && opts?.season != null && opts?.episode != null) {
      url += `&season=${opts.season}&episode=${opts.episode}`
    }

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SRAMO/1.0', Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        console.log(`[Wyzie] API returned ${res.status} for ${imdbId}`)
        return []
      }
      const data: any = await res.json()
      if (!Array.isArray(data)) {
        console.log(`[Wyzie] Unexpected response format for ${imdbId}`)
        return []
      }

      const subs: Subtitle[] = []
      for (const item of data) {
        if (!item.language || !item.url) continue
        const lang = langToCode(item.language)
        subs.push({
          id: `wyzie:${imdbId}:${lang}:${item.id || '0'}`,
          url: item.url,
          lang,
          name: item.display || item.language,
          downloads: item.downloadCount ?? 0,
        })
      }

      subs.sort((a, b) => {
        const priority = (l: string) => l === 'ara' ? 0 : l === 'eng' ? 1 : 2
        return priority(a.lang) - priority(b.lang)
      })

      console.log(`[Wyzie] Found ${subs.length} subtitles for ${imdbId}${type === 'series' && opts?.season != null ? ` S${opts.season}E${opts.episode}` : ''}`)
      return subs
    } catch (err) {
      console.log(`[Wyzie] Fetch failed for ${imdbId}:`, err instanceof Error ? err.message : err)
      return []
    }
  },
}
