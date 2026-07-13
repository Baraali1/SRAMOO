import type { SubtitleProvider, Subtitle } from '@sramo/core'
import type { ContentType } from '@sramo/core'

// Lookup function set by server to access active torrents
let getTorrent: ((infoHash: string) => any) | null = null
export function setTorrentLookup(fn: (infoHash: string) => any): void { getTorrent = fn }

const SUB_EXTS = new Set(['srt', 'vtt', 'ass', 'ssa', 'sub', 'smi'])
const VIDEO_EXTS = new Set(['mp4', 'mkv', 'm4v', 'webm', 'avi', 'mov', 'ts', 'ogv', 'wmv', 'flv', 'mpg', 'mpeg'])

const LANG_FROM_FILE: Record<string, string> = {
  ar: 'ara', ara: 'ara', arabic: 'ara',
  en: 'eng', eng: 'eng', english: 'eng',
  fr: 'fre', fre: 'fre', french: 'fre',
  es: 'spa', spa: 'spa', spanish: 'spa',
  de: 'ger', ger: 'ger', german: 'ger',
  it: 'ita', ita: 'ita', italian: 'ita',
  pt: 'por', por: 'por', portuguese: 'por',
  ru: 'rus', rus: 'rus', russian: 'rus',
  ja: 'jpn', jpn: 'jpn', japanese: 'jpn',
  ko: 'kor', kor: 'kor', korean: 'kor',
  zh: 'chi', chi: 'chi', chinese: 'chi',
  tr: 'tur', tur: 'tur', turkish: 'tur',
  nl: 'dut', dut: 'dut', dutch: 'dut',
  pl: 'pol', pol: 'pol', polish: 'pol',
  sv: 'swe', swe: 'swe', swedish: 'swe',
  da: 'dan', dan: 'dan', danish: 'dan',
  fi: 'fin', fin: 'fin', finnish: 'fin',
  no: 'nor', nor: 'nor', norwegian: 'nor',
}

function detectLang(filename: string): string {
  const lower = filename.replace(/\.[^.]+$/, '').toLowerCase()
  // Split by common delimiters
  const parts = lower.split(/[. _\-]+/)
  for (const part of parts) {
    if (LANG_FROM_FILE[part]) return LANG_FROM_FILE[part]
  }
  // Check for language codes embedded like "Movie.ara.srt" or "Movie.English.srt"
  for (const [key, code] of Object.entries(LANG_FROM_FILE)) {
    if (lower.endsWith('.' + key) || lower.includes('.' + key + '.')) return code
  }
  return 'unk'
}

function stripExt(path: string): string {
  const name = path.split(/[/\\]/).pop() || path
  return name.replace(/\.[^.]+$/, '')
}

function getExt(path: string): string {
  return (path.split('.').pop() || '').toLowerCase()
}

function langPriority(lang: string): number {
  if (lang === 'ara') return 0  // Arabic first
  if (lang === 'eng') return 1  // English second
  if (lang === 'unk') return 3  // Unknown last
  return 2                      // Other languages
}

export const subtitleAgentProvider: SubtitleProvider = {
  name: 'Local File Agent',
  version: '1.0.0',

  async getSubtitles(type: ContentType, id: string, opts?: { season?: number; episode?: number; lang?: string; infoHash?: string; fileIdx?: number }): Promise<Subtitle[]> {
    const infoHash = opts?.infoHash
    const fileIdx = opts?.fileIdx ?? 0

    if (!infoHash || !getTorrent) return []

    const torrent = getTorrent(infoHash.toLowerCase())
    if (!torrent || !torrent.files || torrent.files.length === 0) return []

    const videoFile = torrent.files[fileIdx]
    if (!videoFile) return []

    const videoName = videoFile.name || ''
    const videoBase = stripExt(videoName)
    const videoExt = getExt(videoName)

    // Only process if video file
    if (!VIDEO_EXTS.has(videoExt)) return []

    console.log(`[SubAgent] Scanning torrent files for "${videoBase}" subtitles...`)

    const found: { name: string; idx: number; length: number; lang: string; base: string }[] = []
    const allSubs: { name: string; idx: number; length: number; lang: string; base: string }[] = []

    for (let i = 0; i < torrent.files.length; i++) {
      const f = torrent.files[i]
      const fname = f.name || ''
      const fext = getExt(fname)

      if (!SUB_EXTS.has(fext)) continue

      const fbase = stripExt(fname)
      const lang = detectLang(fname)
      const entry = { name: fname, idx: i, length: f.length, lang, base: fbase }

      allSubs.push(entry)

      // Exact match: same base name (e.g., movie.mp4 → movie.srt)
      const strippedVideo = videoBase.replace(/[. _\-]+/g, '').toLowerCase()
      const strippedSub = fbase.replace(/[. _\-]+/g, '').toLowerCase()

      // Check if sub filename starts with or contains video base name
      if (strippedSub.startsWith(strippedVideo) || strippedSub.includes(strippedVideo)) {
        found.push(entry)
      }
    }

    console.log(`[SubAgent] Found ${allSubs.length} subtitle files in torrent, ${found.length} matched to video`)

    // If no exact match, use ALL subtitle files (user can pick from menu)
    const candidates = found.length > 0 ? found : allSubs

    // Sort: matched by base name first, then Arabic priority
    const matchedSet = new Set(found.map(e => e.idx))
    candidates.sort((a, b) => {
      const aMatch = matchedSet.has(a.idx) ? 0 : 1
      const bMatch = matchedSet.has(b.idx) ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return langPriority(a.lang) - langPriority(b.lang)
    })

    const subs: Subtitle[] = candidates.map((entry, _i) => {
      const langLabel = entry.lang === 'ara' ? 'Arabic' : entry.lang === 'eng' ? 'English' : entry.lang
      return {
        id: `local:${infoHash}:${entry.idx}`,
        url: `/api/torrent-subtitle?infoHash=${infoHash}&fileIdx=${entry.idx}`,
        lang: entry.lang,
        name: `${langLabel} (torrent)`,
        downloads: 0,
      }
    })

    // De-duplicate by language, preferring matched entries
    const seenLangs = new Set<string>()
    const deduped: Subtitle[] = []
    for (const s of subs) {
      const key = s.lang
      if (seenLangs.has(key)) continue
      seenLangs.add(key)
      deduped.push(s)
    }

    if (deduped.length > 0) {
      console.log(`[SubAgent] Returning ${deduped.length} local subtitles (${deduped.map(s => s.lang).join(', ')})`)
    }

    return deduped
  },
}
