import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { api, IMG } from '../api.js'
import { tmdb } from '../tmdb.js'

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}

interface SubItem { lang: string; url: string; label: string; source?: 'downloaded' | 'stream' | 'inband'; downloads?: number }
interface Cue { start: number; end: number; text: string }

const LANG_DISPLAY: Record<string, string> = {
  ara: 'العربية', eng: 'English', fre: 'Français', spa: 'Español',
  por: 'Português', rus: 'Русский', ger: 'Deutsch', ita: 'Italiano',
  jpn: '日本語', kor: '한국어', chi: '中文', dut: 'Nederlands',
  pol: 'Polski', swe: 'Svenska', dan: 'Dansk', nor: 'Norsk',
  fin: 'Suomi', cze: 'Čeština', hun: 'Magyar', rum: 'Română',
  tha: 'ไทย', vie: 'Tiếng Việt', ukr: 'Українська', ell: 'Ελληνικά',
  heb: 'עברית', hin: 'हिन्दी', tur: 'Türkçe', bul: 'Български',
  hrv: 'Hrvatski', srp: 'Српски', slv: 'Slovenščina', bos: 'Bosanski',
  per: 'فارسی', urd: 'اردو', ind: 'Bahasa Indonesia', may: 'Bahasa Melayu',
  tgl: 'Tagalog', cat: 'Català', baq: 'Euskara', glg: 'Galego',
  est: 'Eesti', lav: 'Latviešu', lit: 'Lietuvių', sq: 'Shqip',
  mac: 'Македонски', arm: 'Հայերեն', geo: 'ქართული', aze: 'Azərbaycan',
  bel: 'Беларуская', ice: 'Íslenska', gle: 'Gaeilge', mlt: 'Malti',
  wel: 'Cymraeg', ltz: 'Lëtzebuergesch', afr: 'Afrikaans',
  swa: 'Kiswahili', zul: 'isiZulu', xho: 'isiXhosa',
  ben: 'বাংলা', mal: 'മലയാളം', tam: 'தமிழ்', tel: 'తెలుగు',
  kan: 'ಕನ್ನಡ', guj: 'ગુજરાતી', pan: 'ਪੰਜਾਬੀ',
  kaz: 'Қазақ', kir: 'Кыргызча', tgk: 'Тоҷикӣ', tuk: 'Türkmen',
  uzb: "O'zbek", uig: 'ئۇيغۇرچە', mon: 'Монгол', nep: 'नेपाली',
  sin: 'සිංහල', khm: 'ភាសាខ្មែរ', lao: 'ລາວ', my: 'မြန်မာ',
}

const LANG_SEARCH: Record<string, string[]> = {
  ara: ['العربية', 'عربي', 'Arabic', 'arab'],
  eng: ['English', 'انجليزي', 'إنجليزي', 'english'],
  fre: ['Français', 'French', 'francais', 'فرنسي', 'فرنسية'],
  spa: ['Español', 'Spanish', 'espanol', 'إسباني', 'إسبانية'],
  por: ['Português', 'Portuguese', 'portugues', 'برتغالي', 'برتغالية'],
  rus: ['Русский', 'Russian', 'روسي', 'روسية'],
  ger: ['Deutsch', 'German', 'ألماني', 'ألمانية'],
  ita: ['Italiano', 'Italian', 'إيطالي', 'إيطالية'],
  jpn: ['日本語', 'Japanese', 'ياباني', 'يابانية'],
  kor: ['한국어', 'Korean', 'كوري', 'كورية'],
  chi: ['中文', 'Chinese', 'صيني', 'صينية'],
  dut: ['Nederlands', 'Dutch', 'هولندي', 'هولندية'],
  pol: ['Polski', 'Polish', 'بولندي', 'بولندية'],
  swe: ['Svenska', 'Swedish', 'سويدي', 'سويدية'],
  dan: ['Dansk', 'Danish', 'دنماركي', 'دنماركية'],
  nor: ['Norsk', 'Norwegian', 'نرويجي', 'نرويجية'],
  fin: ['Suomi', 'Finnish', 'فنلندي', 'فنلندية'],
  cze: ['Čeština', 'Czech', 'تشيكي', 'تشيكية'],
  hun: ['Magyar', 'Hungarian', 'مجري', 'مجرية'],
  rum: ['Română', 'Romanian', 'روماني', 'رومانية'],
  tha: ['ไทย', 'Thai', 'تايلندي', 'تايلندية'],
  vie: ['Tiếng Việt', 'Vietnamese', 'فيتنامي', 'فيتنامية'],
  ukr: ['Українська', 'Ukrainian', 'أوكراني', 'أوكرانية'],
  ell: ['Ελληνικά', 'Greek', 'يوناني', 'يونانية'],
  heb: ['עברית', 'Hebrew', 'عبري', 'عبرية'],
  hin: ['हिन्दी', 'Hindi', 'هندي', 'هندية'],
  tur: ['Türkçe', 'Turkish', 'تركي', 'تركية'],
  bul: ['Български', 'Bulgarian', 'بلغاري', 'بلغارية'],
  hrv: ['Hrvatski', 'Croatian', 'كرواتي', 'كرواتية'],
  srp: ['Српски', 'Serbian', 'صربي', 'صربية'],
  per: ['فارسی', 'Farsi', 'Persian', 'فارسي'],
  urd: ['اردو', 'Urdu', 'أردو'],
  ind: ['Bahasa Indonesia', 'Indonesian', 'إندونيسي', 'إندونيسية'],
}

function langName(code: string): string {
  return LANG_DISPLAY[code] || code.substring(0, 3).toUpperCase()
}
interface Cue { start: number; end: number; text: string }

function parseVTT(content: string): Cue[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const cues: Cue[] = []
  let cur: Partial<Cue> | null = null
  for (const line of lines) {
    const cleaned = line.replace(/,/g, '.')
    const m = cleaned.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
    if (m) {
      if (cur?.start != null && cur.end != null && cur.text) cues.push({ start: cur.start, end: cur.end, text: cur.text.trim() })
      const toS = (h: string, mm: string, s: string, ms: string) => parseInt(h)*3600 + parseInt(mm)*60 + parseInt(s) + parseInt(ms)/1000
      cur = { start: toS(m[1], m[2], m[3], m[4]), end: toS(m[5], m[6], m[7], m[8]), text: '' }
    } else if (cur && line.trim() && !line.startsWith('WEBVTT') && !line.startsWith('NOTE') && !/^\d+$/.test(line.trim())) {
      cur.text = (cur.text || '') + '\n' + line
    }
  }
  if (cur?.start != null && cur.end != null && cur.text) cues.push({ start: cur.start, end: cur.end, text: cur.text.trim() })
  return cues
}

type Phase = 'loading' | 'ready' | 'error'

export function Player() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const videoId = params.get('videoId') || ''
  const totalDuration = parseInt(params.get('duration') || '0') || 0
  const season = videoId.match(/S(\d+)/i)?.[1] ? parseInt(videoId.match(/S(\d+)/i)![1]) : undefined
  const episode = videoId.match(/E(\d+)/i)?.[1] ? parseInt(videoId.match(/E(\d+)/i)![1]) : undefined

  const videoRef = useRef<HTMLVideoElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [codecError, setCodecError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [vol, setVol] = useState(1)
  const [muted, setMuted] = useState(false)
  const [barVisible, setBarVisible] = useState(true)
  const [backdrop, setBackdrop] = useState('')
  const [metaName, setMetaName] = useState('')
  const [metaPoster, setMetaPoster] = useState('')
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTranscodeRef = useRef(false)
  const maxDisplayDurRef = useRef(0)
  const seekBaseUrlRef = useRef('')
  const seekOffsetRef = useRef(0)
  const fetchCtlRef = useRef<AbortController | null>(null)

  // Subtitle state
  const [subtitles, setSubtitles] = useState<SubItem[]>([])
  const [subsLoading, setSubsLoading] = useState(false)
  const [subsOn, setSubsOn] = useState(false)
  const [activeSub, setActiveSub] = useState<string | null>(null)
  const [expandedLang, setExpandedLang] = useState<string | null>(null)
  const [subOffset, setSubOffset] = useState(0)
  const [showSubMenu, setShowSubMenu] = useState(false)
  const [subFetchKey, setSubFetchKey] = useState(0)
  const [subFontSize, setSubFontSize] = useState(1.0)
  const [subShadow, setSubShadow] = useState(true)
  const [subLine, setSubLine] = useState(90)
  const [subSearch, setSubSearch] = useState('')
  const cueMap = useRef<Map<string, Cue[]>>(new Map())
  const activeTrack = useRef<TextTrack | null>(null)
  const isDragging = useRef(false)
  const saveProgressRef = useRef<() => void>(() => {})
  const subsFetchedRef = useRef<string>('')

  // Audio state
  const [audioTracks, setAudioTracks] = useState<{ label: string; idx: number }[]>([])
  const [activeAudio, setActiveAudio] = useState(0)
  const [showAudioMenu, setShowAudioMenu] = useState(false)

  // Torrent file picker
  const [torrentFiles, setTorrentFiles] = useState<{ name: string; idx: number; length: number }[]>([])
  const [showFileMenu, setShowFileMenu] = useState(false)

  // ── Parse streams list + build stream URL ──
  const allStreamsRaw: any[] = (() => { try { return JSON.parse(decodeURIComponent(params.get('streams') || '[]')) } catch { return [] } })()
  const allStreamsRef = useRef(allStreamsRaw)
  allStreamsRef.current = allStreamsRaw

  const [streamIdx, setStreamIdx] = useState(-1)

  function buildStreamUrl(idx: number): string {
    if (idx < 0) {
      return params.get('streamUrl')
        || (params.get('infoHash') ? `/api/stream/torrent/${params.get('infoHash')}?fileIdx=${params.get('fileIdx') || '0'}` : null)
        || (params.get('magnet')?.startsWith('magnet:?') ? `/api/stream/torrent/${params.get('magnet')!.match(/xt=urn:btih:([a-fA-F0-9]+)/)?.[1]?.toLowerCase()}?fileIdx=${params.get('fileIdx') || '0'}` : null)
        || params.get('magnet')
        || ''
    }
    const s = allStreamsRef.current[idx]
    if (!s) return ''
    if (s.infoHash) return `/api/stream/torrent/${s.infoHash}?fileIdx=${s.fileIdx ?? '0'}`
    if (s.magnet) {
      const hashMatch = s.magnet.match(/xt=urn:btih:([a-fA-F0-9]+)/)
      if (hashMatch) return `/api/stream/torrent/${hashMatch[1].toLowerCase()}?fileIdx=${s.fileIdx ?? '0'}`
    }
    if (s.url?.startsWith('magnet:?')) {
      const hashMatch = s.url.match(/xt=urn:btih:([a-fA-F0-9]+)/)
      if (hashMatch) return `/api/stream/torrent/${hashMatch[1].toLowerCase()}?fileIdx=${s.fileIdx ?? '0'}`
    }
    return s.url || ''
  }

  const [streamUrl, setStreamUrl] = useState(() => buildStreamUrl(-1))
  const streamUrlRef = useRef(streamUrl)
  streamUrlRef.current = streamUrl

  // Torrent status
  // Next Up
  const [nextUp, setNextUp] = useState<{ season: number; episode: number; countdown: number } | null>(null)

  // Binge mode
  const [bingeMode, setBingeMode] = useState(true)
  // Video speed
  const [playSpeed, setPlaySpeed] = useState(1)
  // Stats & Shortcuts
  const [showStats, setShowStats] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  // Double-tap seek
  const lastTapRef = useRef(0)

  useEffect(() => {
    if (!nextUp) return
    if (nextUp.countdown <= 0) {
      window.location.href = `/detail/${type}/${id}?autoNext=${nextUp.season}-${nextUp.episode}`
      return
    }
    const t = setTimeout(() => setNextUp(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null), 1000)
    return () => clearTimeout(t)
  }, [nextUp])

  const [torrentStatus, setTorrentStatus] = useState<any>(null)
  const infoHash = streamUrl?.match(/\/api\/stream\/torrent\/([a-f0-9]+)/i)?.[1] || null

  // Sync playback speed
  useEffect(() => { const v = videoRef.current; if (v) v.playbackRate = playSpeed }, [playSpeed])

  function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec >= 1024 * 1024) return (bytesPerSec / 1024 / 1024).toFixed(1) + ' MB/s'
    if (bytesPerSec >= 1024) return (bytesPerSec / 1024).toFixed(0) + ' KB/s'
    return bytesPerSec.toFixed(0) + ' B/s'
  }

  const tryNextStream = useCallback((reason?: string) => {
    const v = document.createElement('video')
    console.log(`[stream] tryNextStream called (idx=${streamIdx}, total=${allStreamsRef.current.length})${reason ? ' reason=' + reason : ''}`)

    let next = streamIdx + 1
    const supportsHEVC = v.canPlayType('video/mp4; codecs="hev1.1.6.L120.90"') !== ''
      || v.canPlayType('video/mp4; codecs="hvc1.1.6.L120.90"') !== ''
    while (next < allStreamsRef.current.length) {
      const codec = (allStreamsRef.current[next]?.codec || '').toLowerCase()
      if (!codec || (!codec.includes('h265') && !codec.includes('hevc')) || supportsHEVC) break
      next++
    }

    if (next >= allStreamsRef.current.length) {
      setPhase('error')
      setCodecError(false)
      setPlaying(false)
      setErrorMsg(reason === 'peers' ? 'No playable streams found' : 'Video codec unsupported. Try opening in VLC.')
      return
    }
    console.log(`[stream] switching to stream idx=${next}`)
    setStreamIdx(next)
    setStreamUrl(buildStreamUrl(next))
    setPhase('loading')
    setCodecError(false)
    setSubsLoading(true)
    setSubFetchKey(k => k + 1)
  }, [streamIdx])

  const vlcUrl = params.get('magnet') || params.get('streamUrl') || streamUrl || ''
  const title = params.get('videoId') || params.get('streamName') || id || ''
  const streamSubs: Record<string, string> = useMemo(() => {
    try { return JSON.parse(decodeURIComponent(params.get('streamSubs') || '{}')) } catch { return {} }
  }, [params.get('streamSubs')])
  const resumeTime = parseFloat(params.get('t') || '0')
  const [savedProgress, setSavedProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    api.getProgress(id, params.get('videoId') || undefined).then(p => {
      if (p?.progress && p.progress > 0) setSavedProgress(p.progress)
    }).catch(() => {})
  }, [id])

  const showBar = useCallback(() => {
    setBarVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (playing) hideTimer.current = setTimeout(() => setBarVisible(false), 3000)
  }, [playing])

  // ── Fetch backdrop & title for loading screen + history ──
  useEffect(() => {
    if (!id || !type) return
    tmdb.getDetails(id, type).then(d => {
      if (d) {
        setMetaName(d.name || '')
        if (d.poster) setMetaPoster(IMG.poster(d.poster))
        const bg = d.background || d.poster
        if (bg) setBackdrop(`https://image.tmdb.org/t/p/w1280${bg}`)
        // Save to continue-watching history with proper metadata
        const dur = d.runtime ? parseInt(d.runtime) * 60 : 0
        api.addToHistory({
          item_id: id, type, name: d.name || id,
          poster: d.poster ? IMG.poster(d.poster) : '',
          progress: 0, duration: dur || 0,
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [id, type])

  // ── Fetch subtitles (installed addons + provider → streamSubs → in-band) ──
  useEffect(() => {
    if (!id || !type) return
    const cacheKey = `${id}_${type}_${season ?? ''}_${episode ?? ''}`
    if (subsFetchedRef.current === cacheKey) return
    subsFetchedRef.current = cacheKey
    const mediaType = type
    const mediaId = id
    setSubsLoading(true)
    setSubtitles([])
    const safetyTimer = setTimeout(() => setSubsLoading(false), 25000)

    async function concurrentMap<T, R>(items: T[], fn: (item: T) => Promise<R>, limit: number): Promise<R[]> {
      const results: R[] = []
      for (let i = 0; i < items.length; i += limit) {
        const batch = items.slice(i, i + limit)
        const batchResults = await Promise.allSettled(batch.map(item => fn(item).catch(() => undefined as unknown as R)))
        for (const r of batchResults) { if (r.status === 'fulfilled') results.push(r.value) }
      }
      return results
    }

    async function loadSubs() {
      try {
        const allItems: SubItem[] = []

        // Fetch from built-in OpenSubtitles provider (sorted by download_count, most popular first)
        const imdbId = params.get('imdbId') || undefined
        console.log(`[subs] Fetching: type=${mediaType} id=${mediaId} season=${season} episode=${episode} infoHash=${params.get('infoHash')} fileIdx=${params.get('fileIdx')} imdbId=${imdbId}`)
        const provResult = await api.getProviderSubtitles(mediaType, mediaId, {
          season, episode,
          imdbId,
          infoHash: params.get('infoHash') || undefined,
          fileIdx: params.get('fileIdx') ? parseInt(params.get('fileIdx')!) : undefined,
        }).catch((e) => { console.error('[subs] API call failed:', e); return null })
        console.log('[subs] Provider result:', provResult ? `${provResult.subtitles?.length} subtitles` : 'null')

        // Retry once without infoHash if provider returned empty (bypass SubtitleAgent, hit OpenSubtitles directly)
        let provData = provResult?.subtitles
        if (!provData?.length && params.get('infoHash')) {
          console.log('[subs] Empty result, retrying without infoHash...')
          await new Promise(r => setTimeout(r, 2000))
          const retryResult = await api.getProviderSubtitles(mediaType, mediaId, {
            season, episode, imdbId,
            infoHash: undefined,
            fileIdx: undefined,
          }).catch(() => null)
          console.log('[subs] Retry result:', retryResult ? `${retryResult.subtitles?.length} subtitles` : 'null')
          if (retryResult?.subtitles?.length) provData = retryResult.subtitles
        }

        // Collect provider subtitles
        if (provData?.length) {
          for (const s of provData) {
            if (s.url && !allItems.some(i => i.url === s.url)) {
              allItems.push({ lang: s.lang || 'unk', url: s.url, label: s.name || s.lang || 'Unknown', source: 'downloaded', downloads: s.downloads })
            }
          }
          console.log(`[subs] +${provData.length} from provider`)
        }

        // 4. Stream-embedded subtitles
        const subKeys = Object.keys(streamSubs)
        if (subKeys.length > 0) {
          for (const lang of subKeys) {
            const url = streamSubs[lang]
            if (!allItems.some(i => i.lang === lang)) {
              allItems.push({ lang, url, label: lang === 'ar' ? 'Arabic' : lang === 'en' ? 'English' : lang, source: 'stream' })
            }
          }
        }

        console.log(`[subs] total items: ${allItems.length}`)
        if (allItems.length > 0) {
          setSubtitles(allItems)
          // Pre-fetch subtitle content with max 5 concurrent (skip OpenSubtitles proxy URLs to avoid daily download limit)
          await concurrentMap(allItems.filter(s => s.url && !s.url.startsWith('/api/subtitle-proxy')), async (s) => {
            const text = await fetch(s.url!).then(r => r.text()).catch(() => '')
            if (text) cueMap.current.set(s.url!, parseVTT(text))
          }, 5)
          console.log(`[subs] content loaded for ${allItems.length} items`)

          // Auto-select first Arabic (ara) or English (eng) subtitle
          const autoSelect = allItems.find(s => s.lang === 'ara' || s.lang.startsWith('ara')) || allItems.find(s => s.lang === 'eng' || s.lang.startsWith('eng'))
          if (autoSelect) {
            const autoUrl = autoSelect.url || autoSelect.lang
            // Fetch proxy URL content on-demand for auto-selected subtitle
            if (autoUrl.startsWith('/api/') && !cueMap.current.has(autoUrl)) {
              try {
                const text = await fetch(autoUrl).then(r => r.text())
                if (text) { const cues = parseVTT(text); if (cues.length) cueMap.current.set(autoUrl, cues) }
              } catch {}
            }
            setActiveSub(autoUrl)
            setSubsOn(true)
          }
        }
        clearTimeout(safetyTimer); setSubsLoading(false)
      } catch (e) {
        console.error('[subs] loadSubs error', e)
        clearTimeout(safetyTimer); setSubsLoading(false)
      }
    }
    loadSubs()
  }, [id, type, streamSubs, subFetchKey])

  // ── Detect audio tracks + in-band subtitle tracks from video ──
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const known = new Set<string>()
    const scanTracks = () => {
      const at = (v as any).audioTracks as any[] | undefined
      if (at?.length) setAudioTracks(at.map((_, i) => ({ label: (v as any).audioTracks[i]?.label || `Track ${i+1}`, idx: i })))
      const inBand: SubItem[] = []
      for (let i = 0; i < (v.textTracks?.length || 0); i++) {
        const t = v.textTracks[i]
        if (t && (t.kind === 'subtitles' || t.kind === 'captions') && t.language) {
          const l = t.language.split('-')[0]
          const key = `_inband_${l}_${i}`
          if (known.has(key)) continue
          known.add(key)
          inBand.push({ lang: key, url: '', label: `${t.label || t.language}`, source: 'inband' })
        }
      }
      if (inBand.length > 0) {
        setSubtitles(prev => [...prev, ...inBand])
      }
    }
    v.addEventListener('loadedmetadata', scanTracks)
    if (v.textTracks) v.textTracks.addEventListener('addtrack', scanTracks)
    if (v.readyState >= 2) scanTracks()
    const poll = setInterval(scanTracks, 3000)
    return () => {
      v.removeEventListener('loadedmetadata', scanTracks)
      if (v.textTracks) v.textTracks.removeEventListener('addtrack', scanTracks)
      clearInterval(poll)
    }
  }, [])

  // ── Select subtitle track ──
  const applySubs = useCallback(async (subUrl: string | null) => {
    const v = videoRef.current; if (!v) return
    for (let i = 0; i < (v.textTracks?.length || 0); i++) {
      const t = v.textTracks[i]
      if (t && (t.kind === 'subtitles' || t.kind === 'captions')) t.mode = 'disabled'
    }
    if (activeTrack.current) {
      activeTrack.current.mode = 'disabled'
      activeTrack.current = null
    }
    if (!subUrl || !subsOn) return
    if (subUrl.startsWith('_inband_')) {
      for (let i = 0; i < (v.textTracks?.length || 0); i++) {
        const t = v.textTracks[i]
        if (t && (t.kind === 'subtitles' || t.kind === 'captions') && subUrl === `_inband_${t.language?.split('-')[0]}_${i}`) {
          t.mode = 'showing'
          break
        }
      }
      return
    }
    let cues = cueMap.current.get(subUrl)
    // On-demand fetch for proxy URLs not yet in cueMap
    if (!cues?.length && subUrl.startsWith('/api/') && !cueMap.current.has(subUrl)) {
      try {
        const text = await fetch(subUrl).then(r => r.text())
        if (text) { cues = parseVTT(text); if (cues.length) cueMap.current.set(subUrl, cues) }
      } catch {}
    }
    if (!cues?.length) return
    const track = v.addTextTrack('subtitles', 'subtitles', '')
    track.mode = 'showing'
    activeTrack.current = track
    for (const c of cues) {
      try { const cue = new VTTCue(Math.max(0, c.start + subOffset), Math.max(0.1, c.end + subOffset), c.text); cue.line = subLine; cue.snapToLines = false; track.addCue(cue) } catch {}
    }
  }, [subsOn, subOffset, subLine])

  // ── Update offset/line on existing track without restarting ──
  const updateSubRender = useCallback(() => {
    const track = activeTrack.current; if (!track) return
    const activeUrl = activeSub; if (!activeUrl || activeUrl.startsWith('_inband_')) return
    const cues = cueMap.current.get(activeUrl); if (!cues?.length) return
    if (!track.cues) return
    while (track.cues.length) track.removeCue(track.cues[0])
    for (const c of cues) {
      try { const cue = new VTTCue(Math.max(0, c.start + subOffset), Math.max(0.1, c.end + subOffset), c.text); cue.line = subLine; cue.snapToLines = false; track.addCue(cue) } catch {}
    }
  }, [activeSub, subOffset, subLine])

  useEffect(() => { applySubs(activeSub).catch(() => {}) }, [activeSub, subsOn, applySubs, phase, streamUrl])
  useEffect(() => { if (activeSub && subsOn && !activeSub.startsWith('_inband_')) updateSubRender() }, [subOffset, subLine, updateSubRender])

  // ── Inject subtitle styling (font-size + text-shadow via ::cue) ──
  useEffect(() => {
    let el = document.getElementById('subtitle-cue-style') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'subtitle-cue-style'
      document.head.appendChild(el)
    }
    el.textContent = `video::cue { font-size: ${subFontSize}em; text-shadow: ${subShadow ? '2px 2px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)' : 'none'}; background: transparent; }`
  }, [subFontSize, subShadow])

  // ── Fetch torrent file list ──
  useEffect(() => {
    const m = streamUrl?.match(/\/api\/stream\/torrent\/([a-f0-9]+)/i)
    if (m) {
      fetch(`/api/torrent/${m[1]}/files`).then(r => r.json()).then(d => {
        if (d.files?.length > 1) setTorrentFiles(d.files)
      }).catch(() => {})
    } else {
      setTorrentFiles([])
    }
  }, [streamUrl])

  const selectFile = (idx: number) => {
    setShowFileMenu(false)
    const u = streamUrl
    if (!u) return
    const newUrl = u.replace(/fileIdx=\d+/, `fileIdx=${idx}`).replace(/(\?|&)fileIdx=\d+/, '$1fileIdx=' + idx)
    const finalUrl = newUrl.includes('fileIdx=') ? newUrl : newUrl + (newUrl.includes('?') ? '&' : '?') + `fileIdx=${idx}`
    setStreamUrl(finalUrl)
    window.history.replaceState(null, '', window.location.pathname + '?fileIdx=' + idx + window.location.search.replace(/[?&]fileIdx=\d+/g, ''))
  }

  const formatFileSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024
    return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb.toFixed(0) + ' MB'
  }

  // ── Playback engine ──
  useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) { setPhase('error'); setErrorMsg('No stream URL provided'); return }
    let cancelled = false

    async function probeAndPlay() {
      const probeUrl = streamUrl!
      const isTorrent = probeUrl.startsWith('/api/stream/torrent/') && !probeUrl.includes('/transcode')
      const transcodeBase = isTorrent
        ? (probeUrl.includes('?') ? probeUrl.replace('?', '/transcode?') : probeUrl + '/transcode')
        : probeUrl
      try {
        const ctl = new AbortController(); fetchCtlRef.current = ctl; const t = setTimeout(() => ctl.abort(), 5000)
        const res = await fetch(probeUrl, { headers: { Range: 'bytes=0-0' }, signal: ctl.signal }); clearTimeout(t)
        if (cancelled) return
        if (res.ok || res.status === 206) {
          const needsTranscode = isTorrent && res.headers.get('X-Needs-Transcode') === 'true'
          isTranscodeRef.current = needsTranscode
          const playUrl = needsTranscode ? transcodeBase : probeUrl
          if (needsTranscode) seekBaseUrlRef.current = playUrl.replace(/(&|\?)start=\d+/g, '')

            const v = video!
              v.onloadedmetadata = () => {
              if (cancelled) return
              setPhase('ready')
              setDuration(v.duration || 0)
              setCodecError(false)
              const restoreTime = resumeTime > 0 ? resumeTime : (savedProgress || 0)
              if (restoreTime > 0) {
                if (isTranscodeRef.current) {
                  seekInRange(restoreTime)
                } else {
                  v.currentTime = restoreTime
                }
              }
              audioCtxRef.current = null
              v.muted = false; v.volume = 1
              v.addEventListener('playing', () => console.log(`[audio] 'playing' event fired`), { once: true })
              v.addEventListener('timeupdate', () => console.log(`[audio] first timeupdate: currentTime=${v.currentTime.toFixed(2)}`), { once: true })
              v.play().then(() => setPlaying(true)).catch((e: any) => {
                console.log(`[audio] play() rejected: ${e?.message || e}`)
                setPlaying(false)
              })
              const checkAudio = (label: string) => {
                if (cancelled) return
                console.log(`[audio] [${label}] readyState=${v.readyState} muted=${v.muted} volume=${v.volume} paused=${v.paused} currentTime=${v.currentTime.toFixed(2)} error=${v.error?.message ?? 'none'} audioBytes=${(v as any).webkitAudioDecodedByteCount ?? 0}`)
              }
              setTimeout(() => checkAudio('5s'), 5000)
              setTimeout(() => checkAudio('12s'), 12000)
            }
            v.onerror = () => { if (cancelled) return; if (v.error?.code === 4) { tryNextStream() } }
            v.onended = () => {
              setPlaying(false)
              if (bingeMode && type === 'series' && season != null && episode != null) {
                const nextEp = episode + 1
                const qs = new URLSearchParams(window.location.search)
                const maxEp = parseInt(qs.get('totalEpisodes') || '0')
                if (maxEp > 0 && nextEp <= maxEp) {
                  setNextUp({ season, episode: nextEp, countdown: 10 })
                }
              }
            }
            v.src = playUrl; v.load()
            return
          }
          if (res.status !== 504) { if (!cancelled) { setPhase('error'); setErrorMsg(`Server error (${res.status})`) }; return }
          if (!cancelled) { tryNextStream('peers') }; return
        } catch (e) {
          if (!cancelled) { tryNextStream('peers') }; return
        }
    }
    probeAndPlay().catch(() => {})
    return () => {
      cancelled = true
      fetchCtlRef.current?.abort()
      audioCtxRef.current = null
      if (video) { video.pause(); video.removeAttribute('src'); video.load() }
    }
  }, [streamUrl])

  // ── Video events (debounced timeupdate to 1Hz) ──
  useEffect(() => {
    const v = videoRef.current; if (!v) return
    let last = 0
    const onTime = () => { const now = Date.now(); if (now - last < 800) return; last = now; setTime(v.currentTime) }
    const onDur = () => setDuration(prev => Math.max(prev, v.duration || 0))
    const onVol = () => { setVol(v.volume); setMuted(v.muted) }
    v.addEventListener('timeupdate', onTime); v.addEventListener('durationchange', onDur); v.addEventListener('volumechange', onVol)
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('durationchange', onDur); v.removeEventListener('volumechange', onVol) }
  }, [phase])

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const v = videoRef.current; if (!v) return
      switch (e.code) {
        case 'Space': e.preventDefault(); v.paused ? v.play().catch(()=>{}) : v.pause(); break
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.currentTime + 10, v.duration || 0); break
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(v.currentTime - 10, 0); break
        case 'KeyM': e.preventDefault(); v.muted = !v.muted; break
        case 'KeyF': e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : videoRef.current?.parentElement?.requestFullscreen(); break
        case 'Escape': e.preventDefault(); document.fullscreenElement ? document.exitFullscreen() : navigate(-1); break
        case 'BracketRight': case 'Period': e.preventDefault(); setPlaySpeed(s => Math.min(2, +(s + 0.25).toFixed(2))); break
        case 'BracketLeft': case 'Comma': e.preventDefault(); setPlaySpeed(s => Math.max(0.25, +(s - 0.25).toFixed(2))); break
        case 'KeyI': e.preventDefault(); setShowStats(p => !p); break
        case 'Slash': if (e.shiftKey) { e.preventDefault(); setShowShortcuts(p => !p) } break
        case 'KeyP': e.preventDefault(); if (document.pictureInPictureElement) document.exitPictureInPicture(); else videoRef.current?.requestPictureInPicture(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])

  const testTone = () => {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      gain.gain.value = 0.08
      osc.type = 'sine'; osc.frequency.value = 440
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(); osc.stop(ctx.currentTime + 0.15)
      console.log('[audio] test tone played (440Hz, 0.15s, 8% volume)')
    } catch (e) { console.log('[audio] test tone failed:', e) }
  }

  const handleVideoClick = useCallback((e: React.MouseEvent) => {
    const v = videoRef.current; if (!v) return
    const now = Date.now()
    if (now - lastTapRef.current < 350) {
      const mid = (e.currentTarget as HTMLElement).clientWidth / 2
      if ((e.clientX - (e.currentTarget as HTMLElement).getBoundingClientRect().left) > mid) {
        v.currentTime = Math.min(v.currentTime + 10, v.duration || 0)
      } else {
        v.currentTime = Math.max(v.currentTime - 10, 0)
      }
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
      if (v.paused) {
        v.play().then(() => setPlaying(true)).catch(() => {})
      } else { v.pause(); setPlaying(false) }
    }
    showBar()
  }, [showBar])

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return
    if (v.paused) {
      testTone()
      v.play().then(() => setPlaying(true)).catch(e => console.log('[audio] togglePlay play failed:', e))
    } else { v.pause(); setPlaying(false) }
    showBar()
  }, [showBar])

  const seekInRange = (target: number) => {
    const v = videoRef.current; if (!v) return
    if (isTranscodeRef.current) {
      for (let i = 0; i < v.buffered.length; i++) {
        if (target >= v.buffered.start(i) && target <= v.buffered.end(i)) {
          v.currentTime = target; showBar(); return
        }
      }
      const base = seekBaseUrlRef.current
      if (base) {
        const startSec = Math.floor(Math.max(0, target))
        seekOffsetRef.current = startSec
        v.src = base + (base.includes('?') ? '&' : '?') + 'start=' + startSec
        v.load()
      }
    } else {
      v.currentTime = target
    }
    showBar()
  }

  const seek = useCallback((d: number) => {
    const v = videoRef.current; if (!v || !duration) return
    const absTime = v.currentTime + seekOffsetRef.current + d
    const dur = totalDuration > 0 ? totalDuration : (isTranscodeRef.current ? Math.max(duration, v.currentTime + 60) : duration)
    seekInRange(Math.max(0, Math.min(absTime, dur)))
  }, [duration, totalDuration])

  const seekBar = (e: React.MouseEvent) => {
    const v = videoRef.current; const b = barRef.current; if (!v || !b || !duration) return
    const dur = totalDuration > 0 ? totalDuration : (isTranscodeRef.current ? Math.max(duration, v.currentTime + 60) : duration)
    seekInRange(Math.max(0, Math.min(1, (e.clientX - b.getBoundingClientRect().left) / b.getBoundingClientRect().width)) * dur)
  }

  const startDrag = (e: React.MouseEvent) => { e.preventDefault(); isDragging.current = true }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const v = videoRef.current; const b = barRef.current
      if (!v || !b || !duration) return
      const dur = totalDuration > 0 ? totalDuration : (isTranscodeRef.current ? Math.max(duration, v.currentTime + 60) : duration)
      seekInRange(Math.max(0, Math.min(1, (e.clientX - b.getBoundingClientRect().left) / b.getBoundingClientRect().width)) * dur)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [duration])

  // ── Progress save ──
  useEffect(() => {
    saveProgressRef.current = () => {
      const v = videoRef.current; if (!v || !id) return
      api.updateProgress(id, v.currentTime + seekOffsetRef.current, videoId).catch(() => {})
    }
  }, [id, videoId])

  useEffect(() => {
    const v = videoRef.current; if (!v) return
    const interval = setInterval(() => { if (!v.paused) saveProgressRef.current() }, 5000)
    const onPause = () => saveProgressRef.current()
    v.addEventListener('pause', onPause)
    const onBeforeUnload = () => saveProgressRef.current()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => { saveProgressRef.current(); clearInterval(interval); v.removeEventListener('pause', onPause); window.removeEventListener('beforeunload', onBeforeUnload) }
  }, [phase])

  const toggleMute = useCallback(() => { const v = videoRef.current; if (v) v.muted = !v.muted }, [])
  const toggleFS = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await videoRef.current?.parentElement?.requestFullscreen()
  }, [])
  const changeVol = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const v = videoRef.current; if (!v) return; v.volume = parseFloat(e.target.value); v.muted = false }, [])

  const selectSub = async (item: SubItem | null) => {
    if (!item) { setActiveSub(null); setSubsOn(false); setExpandedLang(null); setShowSubMenu(false); return }
    const url = item.url || item.lang
    // Fetch proxy URL content on-demand (not pre-fetched to avoid hitting OpenSubtitles download limit)
    if (url.startsWith('/api/') && !cueMap.current.has(url)) {
      try {
        const text = await fetch(url).then(r => r.text())
        if (text) { const cues = parseVTT(text); if (cues.length) cueMap.current.set(url, cues) }
      } catch {}
    }
    setActiveSub(url)
    setSubsOn(true)
    setExpandedLang(null)
    setShowSubMenu(false)
  }
  const selectAudio = (idx: number) => {
    const v = videoRef.current; if (!v) return
    const at = (v as any).audioTracks as any[] | undefined; if (!at) return
    for (let i = 0; i < at.length; i++) at[i].enabled = false
    if (at[idx]) at[idx].enabled = true
    setActiveAudio(idx); setShowAudioMenu(false)
  }

  const isTranscode = isTranscodeRef.current
  const hasTotalDur = totalDuration > 0
  const displayTime = time + seekOffsetRef.current
  if (isTranscode && !hasTotalDur) {
    const candidate = Math.max(duration, time + 60)
    if (candidate > maxDisplayDurRef.current) maxDisplayDurRef.current = candidate
  }
  const displayDur = hasTotalDur ? totalDuration : (isTranscode ? maxDisplayDurRef.current : duration)
  const pct = displayDur > 0 ? (displayTime / displayDur) * 100 : 0

  const sortedSubs = useMemo(() => {
    let filtered = subtitles
    if (subSearch.trim()) {
      const q = subSearch.trim().toLowerCase()
      filtered = subtitles.filter(s => {
        const label = s.label?.toLowerCase() || ''
        const terms = LANG_SEARCH[s.lang] || [langName(s.lang), s.lang]
        return terms.some(t => t.toLowerCase().includes(q)) || label.includes(q)
      })
    }
    return [...filtered].sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0) || (a.label || '').localeCompare(b.label || ''))
  }, [subtitles, subSearch])

  return (
    <div onMouseMove={showBar} onTouchStart={showBar}
      style={{ position: 'relative', width: '100%', height: '100vh', background: '#000', overflow: 'hidden', aspectRatio: '16 / 9' }}>

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <div className="loading-cinema" style={{ position:'absolute',inset:0,zIndex:10,overflow:'hidden' }}>
          {/* Backdrop image */}
          {backdrop && (
            <img src={backdrop} alt="" style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'blur(12px) brightness(0.3)',transform:'scale(1.05)' }} />
          )}
          {/* Gradient overlay */}
          <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)' }} />
          {/* Content */}
          <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24 }}>
            <div style={{ width:56,height:56,border:'3px solid rgba(255,255,255,0.06)',borderTopColor:'#1a98ff',borderRadius:'50%',animation:'spin-slow 0.7s linear infinite',marginBottom:24 }} />
            <p style={{ fontSize:22,fontWeight:800,color:'#fff',margin:'0 0 4px',textAlign:'center',letterSpacing:'-0.02em',textShadow:'0 2px 12px rgba(0,0,0,0.5)' }}>
              {metaName || title}
            </p>
            {torrentStatus && (
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:6,marginTop:12 }}>
                <div style={{ display:'flex',gap:16,fontSize:12,color:'rgba(255,255,255,0.4)' }}>
                  <span>👤 {torrentStatus.numPeers ?? 0} peers</span>
                  <span>⬇️ {formatSpeed(torrentStatus.downloadSpeed ?? 0)}</span>
                  {torrentStatus.done ? <span style={{ color:'#22c55e' }}>✓ Done</span> : (
                    <span>{Math.round((torrentStatus.progress ?? 0) * 100)}%</span>
                  )}
                </div>
                {!torrentStatus.done && (
                  <div style={{ width:200,height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden' }}>
                    <div style={{ height:'100%',width:`${(torrentStatus.progress ?? 0) * 100}%`,background:'#1a98ff',borderRadius:2,transition:'width 1s ease' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STATS OVERLAY ── */}
      {showStats && (
        <div onClick={() => setShowStats(false)} style={{ position:'absolute',inset:0,zIndex:15,display:'flex',alignItems:'flex-start',justifyContent:'flex-end',padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'16px 20px',fontSize:12,fontFamily:'monospace',color:'rgba(255,255,255,0.6)',lineHeight:1.8,minWidth:180 }}>
            <div style={{ color:'#1a98ff',fontWeight:600,marginBottom:6,fontSize:11,textTransform:'uppercase',letterSpacing:'0.06em' }}>Stats for Nerds</div>
            <div>Stream: {streamUrl?.includes('transcode') ? 'Transcoded' : 'Direct'}</div>
            <div>Resolution: {params.get('streamName') || '—'}</div>
            <div>Peers: {torrentStatus?.numPeers ?? 0}</div>
            <div>Speed: {formatSpeed(torrentStatus?.downloadSpeed ?? 0)}</div>
            <div>Progress: {torrentStatus ? Math.round(torrentStatus.progress * 100) + '%' : '—'}</div>
            <div>Duration: {formatTime(displayDur)}</div>
          </div>
        </div>
      )}

      {/* ── SHORTCUTS CHEATSHEET ── */}
      {showShortcuts && (
        <div onClick={() => setShowShortcuts(false)} style={{ position:'absolute',inset:0,zIndex:15,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.6)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background:'rgba(7,7,12,0.96)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'24px 28px',minWidth:260 }}>
            <div style={{ fontSize:14,fontWeight:700,color:'#fff',marginBottom:16 }}>Keyboard Shortcuts</div>
            {[
              ['Space', 'Play / Pause'],
              ['← / →', 'Seek -10 / +10s'],
              [', / .', 'Speed -0.25 / +0.25'],
              ['M', 'Mute'],
              ['F', 'Fullscreen'],
              ['P', 'Picture in Picture'],
              ['I', 'Stats for Nerds'],
              ['?', 'Show shortcuts'],
              ['Esc', 'Exit fullscreen / Back'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:11,color:'rgba(255,255,255,0.4)' }}>{desc}</span>
                <span style={{ fontSize:11,fontWeight:600,color:'#fff',background:'rgba(255,255,255,0.06)',padding:'2px 8px',borderRadius:4 }}>{key}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NEXT UP OVERLAY ── */}
      {nextUp && (
        <div style={{ position:'absolute',inset:0,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',animation:'fadeIn 0.3s ease' }}>
          <p style={{ fontSize:12,color:'rgba(255,255,255,0.3)',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:8 }}>Next Up</p>
          <p style={{ fontSize:24,fontWeight:700,color:'#fff',margin:'0 0 4px' }}>S{String(nextUp.season).padStart(2,'0')}E{String(nextUp.episode).padStart(2,'0')}</p>
          <p style={{ fontSize:14,color:'rgba(255,255,255,0.5)',margin:'0 0 24px' }}>Starting in {nextUp.countdown}s</p>
          <div style={{ width:200,height:3,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden',marginBottom:32 }}>
            <div style={{ height:'100%',width:`${(nextUp.countdown / 10) * 100}%`,background:'#1a98ff',borderRadius:2,transition:'width 1s linear' }} />
          </div>
          <div style={{ display:'flex',gap:12 }}>
            <button onClick={() => setNextUp(null)} className="btn-micro" style={{ padding:'10px 24px',borderRadius:8,border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:13,fontWeight:600 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {phase === 'error' && (
        <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#0a0a0f',zIndex:10 }}>
          <div style={{ width:64,height:64,borderRadius:'50%',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.15)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h2 style={{ fontSize:20,fontWeight:700,color:'#fff',margin:'0 0 8px' }}>Playback Error</h2>
          <p style={{ fontSize:13,color:'#888',margin:0,textAlign:'center',maxWidth:320 }}>{errorMsg}</p>
          <div style={{ display:'flex',gap:8,marginTop:20,flexWrap:'wrap',justifyContent:'center' }}>
            <button onClick={() => navigate(-1)} style={{ padding:'10px 22px',borderRadius:10,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#ccc',fontSize:14,fontWeight:600,cursor:'pointer' }}>Go Back</button>
            <button onClick={() => { const u = streamUrl?.startsWith('/') ? window.location.origin + streamUrl : streamUrl; if (u) window.open('vlc://' + encodeURI(u), '_blank') }} style={{ padding:'10px 22px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#1a98ff,#0d7ae6)',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 16px rgba(26,152,255,0.3)' }}>Open in VLC</button>
            <button onClick={() => { const u = streamUrl?.startsWith('/') ? window.location.origin + streamUrl : streamUrl; if (u) { navigator.clipboard.writeText(u).then(() => { const b = document.activeElement as HTMLElement; if (b) { const t = b.textContent; b.textContent = 'Copied!'; setTimeout(() => { b.textContent = t }, 2000) } }) } }} style={{ padding:'10px 22px',borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.04)',color:'#aaa',fontSize:14,fontWeight:600,cursor:'pointer' }}>Copy Link</button>
            {streamUrl && <button onClick={() => window.open(streamUrl, '_blank')} style={{ padding:'10px 22px',borderRadius:10,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#ccc',fontSize:14,fontWeight:600,cursor:'pointer' }}>Download</button>}
          </div>
        </div>
      )}

      {/* ── VIDEO ── */}
      <video ref={videoRef} playsInline preload="auto" onClick={handleVideoClick} crossOrigin="anonymous"
        style={{ width:'100%',height:'100%',objectFit:'contain',background:'#000',cursor:'pointer',display:phase==='ready'?'block':'none' }} />

      {/* Center play button (ready only) */}
      {phase === 'ready' && !playing && (
        <button onClick={togglePlay} style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:5,width:84,height:84,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.1)',background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }} aria-label="Play">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      )}

      {/* Bottom bar */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,zIndex:5,padding:'48px 24px 20px',background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',opacity:barVisible?1:0,transition:'opacity 0.35s ease',pointerEvents:barVisible?'auto':'none' }}>

          {/* Progress bar */}
            <div ref={barRef} onClick={seekBar} style={{ height:24,display:'flex',alignItems:'flex-end',cursor:'pointer',marginBottom:12,paddingBottom:8 }}>
              <div className="progress-glow" style={{ width:'100%',height:4,background:'rgba(255,255,255,0.12)',borderRadius:2,position:'relative',overflow:'visible' }}>
                <div style={{ position:'absolute',top:0,left:0,height:'100%',width:`${pct}%`,background:'#1a98ff',borderRadius:2,transition:isDragging.current?'none':'width 0.1s linear' }} />
                <div onMouseDown={startDrag} style={{ position:'absolute',top:'50%',left:`${pct}%`,width:14,height:14,borderRadius:'50%',background:'#fff',border:'2px solid #1a98ff',transform:'translate(-50%,-50%)',cursor:'pointer',zIndex:2,transition:isDragging.current?'none':'left 0.1s linear' }} />
              </div>
            </div>

          {/* Controls row */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
            {/* Left: play + rewind/forward + time */}
            <div style={{ display:'flex',alignItems:'center',gap:12 }}>
              {/* Rewind 10s */}
              <button onClick={() => seek(-10)} className="btn-micro" aria-label="Rewind 10s" style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'rgba(255,255,255,0.7)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              </button>

              {/* Play/Pause */}
              <button onClick={togglePlay} className="btn-micro" aria-label={playing?'Pause':'Play'} style={{ width:48,height:48,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.06)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                {playing ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>

              {/* Forward 10s */}
              <button onClick={() => seek(10)} className="btn-micro" aria-label="Forward 10s" style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'rgba(255,255,255,0.7)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>

              <span style={{ fontSize:13,fontWeight:500,color:'rgba(255,255,255,0.5)',fontVariantNumeric:'tabular-nums',userSelect:'none' }}>{formatTime(displayTime)}{displayDur > 0 ? ` / ${formatTime(displayDur)}` : ''}</span>
            </div>

            {/* Right: subs + audio + volume + fullscreen */}
            <div style={{ display:'flex',alignItems:'center',gap:4 }}>

              {/* Subtitles dropdown */}
              <div style={{ position:'relative' }}>
                <button onClick={() => { setShowSubMenu(!showSubMenu); setShowAudioMenu(false); setShowFileMenu(false); if (!showSubMenu) setSubSearch('') }} aria-label="Subtitles"
                  style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:subsOn?'#1a98ff':'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="14" y2="16"/></svg>
                </button>
                {showSubMenu && (
                  <div style={{ position:'absolute',bottom:'100%',right:0,marginBottom:8,background:'rgba(7,7,12,0.94)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:8,minWidth:200,zIndex:10,maxHeight:400,overflowY:'auto' }}>
                    <div style={{ fontSize:10,fontWeight:700,color:'#666',textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 10px',marginBottom:4 }}>Subtitles</div>

                    <button onClick={() => selectSub(null)} style={{ display:'flex',alignItems:'center',width:'100%',padding:'6px 10px',border:'none',background:!activeSub?'rgba(26,152,255,0.08)':'transparent',fontSize:12,color:!activeSub?'#1a98ff':'rgba(255,255,255,0.6)',borderRadius:6,cursor:'pointer' }}>Off</button>

                    {subsLoading && (
                      <div style={{ display:'flex',alignItems:'center',justifyContent:'center',padding:'6px 0',gap:8 }}>
                        <div style={{ width:12,height:12,border:'2px solid rgba(255,255,255,0.06)',borderTopColor:'#1a98ff',borderRadius:'50%',animation:'spin-slow 0.6s linear infinite' }} />
                        <span style={{ fontSize:11,color:'#555' }}>Loading...</span>
                      </div>
                    )}

                    {/* Language search */}
                    <input type="text" placeholder="Search language..."
                      value={subSearch} onChange={e => setSubSearch(e.target.value)}
                      style={{ width:'100%',padding:'6px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.04)',color:'#fff',fontSize:12,outline:'none',marginBottom:4 }}
                    />

                    {sortedSubs.map(s => (
                        <button key={s.url || s.lang} onClick={() => selectSub(s)}
                          style={{ display:'flex',alignItems:'center',width:'100%',padding:'6px 10px',border:'none',background:(s.url || s.lang) === activeSub?'rgba(26,152,255,0.08)':'transparent',fontSize:11,color:(s.url || s.lang) === activeSub?'#1a98ff':'rgba(255,255,255,0.6)',borderRadius:6,cursor:'pointer',gap:6 }}>
                          <span style={{ flex:1,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{s.label}</span>
                          {s.downloads != null && (
                            <span style={{ fontSize:9,color:'#666',whiteSpace:'nowrap' }}>
                              {s.downloads > 999 ? `${(s.downloads / 1000).toFixed(1)}k` : s.downloads}
                            </span>
                          )}
                        </button>
                      ))}

                    {!subsLoading && subtitles.length === 0 && (
                      <div style={{ padding:'6px 10px' }}>
                        <p style={{ fontSize:11,color:'#555',margin:'0 0 6px' }}>No subtitles found</p>
                        <button onClick={() => setSubFetchKey(k => k + 1)}
                          style={{ width:'100%',padding:'6px 10px',borderRadius:6,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'#1a98ff',fontSize:11,cursor:'pointer' }}>
                          Retry
                        </button>
                      </div>
                    )}

                    {subsOn && activeSub && <div style={{ height:1,background:'rgba(255,255,255,0.06)',margin:'6px 0' }} />}

                    {subsOn && activeSub && (
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                        <span style={{ fontSize:11,color:'#666' }}>Offset</span>
                        <span style={{ fontSize:11,color:'#999',marginRight:'auto' }}>{subOffset > 0 ? '+' : ''}{subOffset.toFixed(1)}s</span>
                        <button onClick={() => setSubOffset(p => Math.max(-30, p - 0.25))} style={{ width:24,height:24,borderRadius:4,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.04)',color:'#aaa',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                        <button onClick={() => setSubOffset(p => Math.min(30, p + 0.25))} style={{ width:24,height:24,borderRadius:4,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.04)',color:'#aaa',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
                      </div>
                    )}

                    {subsOn && activeSub && (
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4 }}>
                        <span style={{ fontSize:11,color:'#666' }}>Size</span>
                        <div style={{ flex:1,display:'flex',gap:2 }}>
                          {[0.8, 1.0, 1.2, 1.5, 2.0].map(sz => (
                            <button key={sz} onClick={() => setSubFontSize(sz)} style={{ flex:1,padding:'2px 0',borderRadius:4,border:'none',background:Math.abs(subFontSize - sz) < 0.01?'rgba(26,152,255,0.15)':'rgba(255,255,255,0.04)',color:Math.abs(subFontSize - sz) < 0.01?'#1a98ff':'#888',cursor:'pointer',fontSize:10 }}>{sz}x</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {subsOn && activeSub && (
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontSize:11,color:'#666' }}>Shadow</span>
                        <button onClick={() => setSubShadow(p => !p)} style={{ padding:'2px 10px',borderRadius:4,border:'1px solid rgba(255,255,255,0.06)',background:subShadow?'rgba(26,152,255,0.15)':'rgba(255,255,255,0.04)',color:subShadow?'#1a98ff':'#888',cursor:'pointer',fontSize:11 }}>{subShadow ? 'ON' : 'OFF'}</button>
                      </div>
                    )}

                    {subsOn && activeSub && (
                      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                        <span style={{ fontSize:11,color:'#666' }}>Position</span>
                        <span style={{ fontSize:11,color:'#999',marginRight:'auto' }}>{subLine}%</span>
                        <button onClick={() => setSubLine(p => Math.max(10, p - 5))} style={{ width:24,height:24,borderRadius:4,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.04)',color:'#aaa',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                        <button onClick={() => setSubLine(p => Math.min(95, p + 5))} style={{ width:24,height:24,borderRadius:4,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.04)',color:'#aaa',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Audio tracks dropdown */}
              {audioTracks.length > 1 && (
                <div style={{ position:'relative' }}>
                  <button onClick={() => { setShowAudioMenu(!showAudioMenu); setShowSubMenu(false); setShowFileMenu(false) }} aria-label="Audio"
                    style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  </button>
                  {showAudioMenu && (
                    <div style={{ position:'absolute',bottom:'100%',right:0,marginBottom:8,background:'rgba(7,7,12,0.94)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:8,minWidth:160,zIndex:10 }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'#666',textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 10px',marginBottom:4 }}>Audio</div>
                      {audioTracks.map(t => (
                        <button key={t.idx} onClick={() => selectAudio(t.idx)} style={{ display:'flex',alignItems:'center',width:'100%',padding:'6px 10px',border:'none',background:t.idx===activeAudio?'rgba(26,152,255,0.08)':'transparent',fontSize:12,color:t.idx===activeAudio?'#1a98ff':'rgba(255,255,255,0.6)',borderRadius:6,cursor:'pointer' }}>{t.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Torrent file picker */}
              {torrentFiles.length > 1 && (
                <div style={{ position:'relative' }}>
                  <button onClick={() => setShowFileMenu(f => !f)} aria-label="Files"
                    style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  </button>
                  {showFileMenu && (
                    <div style={{ position:'absolute',bottom:'100%',right:0,marginBottom:8,background:'rgba(7,7,12,0.94)',backdropFilter:'blur(16px)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:8,minWidth:220,zIndex:10 }}>
                      <div style={{ fontSize:10,fontWeight:700,color:'#666',textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 10px',marginBottom:4 }}>Files</div>
                      {torrentFiles.map(f => (
                        <button key={f.idx} onClick={() => selectFile(f.idx)} style={{ display:'flex',alignItems:'center',gap:8,width:'100%',padding:'6px 10px',border:'none',background:streamUrl?.includes(`fileIdx=${f.idx}`)?'rgba(26,152,255,0.08)':'transparent',fontSize:12,color:streamUrl?.includes(`fileIdx=${f.idx}`)?'#1a98ff':'rgba(255,255,255,0.6)',borderRadius:6,cursor:'pointer',textAlign:'left' }}>
                          <span style={{ overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1 }}>{f.name}</span>
                          <span style={{ fontSize:10,color:'#555',flexShrink:0 }}>{formatFileSize(f.length)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Playback Speed */}
              <select value={playSpeed} onChange={e => setPlaySpeed(parseFloat(e.target.value))}
                style={{ fontSize:11,fontWeight:600,background:'transparent',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',outline:'none',width:36 }}>
                {[0.25,0.5,0.75,1,1.25,1.5,2].map(s => <option key={s} value={s} style={{background:'#111'}}>{s}x</option>)}
              </select>

              {/* PiP */}
              <button onClick={() => { if (document.pictureInPictureElement) document.exitPictureInPicture(); else videoRef.current?.requestPictureInPicture() }} aria-label="Picture in Picture"
                style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="11" y="8" width="9" height="7" rx="1" fill="currentColor" fillOpacity="0.3"/></svg>
              </button>

              {/* Stats */}
              <button onClick={() => setShowStats(p => !p)} aria-label="Stats"
                style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:showStats?'#1a98ff':'rgba(255,255,255,0.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700 }}>
                ⓘ
              </button>

              {/* Binge mode */}
              <button onClick={() => setBingeMode(p => !p)} aria-label="Binge mode"
                style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:bingeMode?'#1a98ff':'rgba(255,255,255,0.3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>
                {bingeMode ? '🔁' : '⏹'}
              </button>

              {/* Volume */}
              <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                <button onClick={toggleMute} aria-label="Volume" style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  {muted || vol===0 ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                  )}
                </button>
                <input type="range" min="0" max="1" step="0.05" value={muted?0:vol} onChange={changeVol} style={{ width:64,height:4,accentColor:'#1a98ff',cursor:'pointer' }} />
              </div>

              {/* Fullscreen */}
              <button onClick={toggleFS} aria-label="Fullscreen" style={{ width:44,height:44,borderRadius:'50%',border:'none',background:'transparent',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              </button>
            </div>
          </div>
        </div>
    </div>
  )
}
