import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { api, fetchStreamFromAddon, resolveToImdbId, type MetaItem, type Stream, type Manifest, IMG } from '../api.js'
import { tmdb } from '../tmdb.js'
import { LoadingPage } from '../components/Skeleton.js'
import { parseStream, type ParsedStream } from '../utils/streamParser.js'
import { useToast } from '../components/Toast.js'

function hasStream(m: Manifest, mediaType: string): boolean {
  return m.resources.some((r) => (typeof r === 'string' ? r : r.name) === 'stream') && m.types.includes(mediaType)
}

function sizeToTag(size: string): { label: string; cls: string } | null {
  const m = size?.match(/^([\d.]+)\s*(GB|MB)/i)
  if (!m) return null
  const v = parseFloat(m[1]), u = m[2].toUpperCase()
  if (u === 'GB') return { label: size, cls: v >= 3 ? 'xl' : 'lg' }
  return { label: size, cls: v >= 500 ? 'md' : 'sm' }
}

function StreamRowCompact({ stream }: { stream: ParsedStream }) {
  const s = stream.size ? sizeToTag(stream.size) : null
  return (
    <div className="stream-row" tabIndex={0} onKeyDown={(e) => { if (e.key==='Enter') (e.target as HTMLElement).click() }}>
      <div className="stream-provider">{stream.name || stream.source || 'Stream'}</div>
      <div className="stream-tags">
        {stream.quality && <span className={`pill-tag ${stream.quality==='4K'?'pill-tag-4k':stream.quality==='1080p'?'pill-tag-1080p':'pill-tag-720p'}`}>{stream.quality}</span>}
        {stream.isHDR && <span className="pill-tag pill-tag-hdr">HDR</span>}
        {s && <span className={`stream-size-tag ${s.cls}`}>{s.label}</span>}
      </div>
      {stream.seeds != null && <span className="stream-seeds">👥 {stream.seeds}</span>}
      <svg className="stream-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  )
}

function EpisodeRow({ ep, season, isSelected, isLast, onSelect }: { ep: any; season: number; isSelected: boolean; isLast?: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={`episode-row flex gap-4 py-4 border-b cursor-pointer transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#1a98ff] focus-visible:ring-inset rounded-lg ${isSelected ? 'bg-white/[0.02] -mx-4 px-4 rounded-lg border-transparent' : 'border-white/[0.04] hover:bg-white/[0.01]'}`}
      style={{ borderBottomColor: isSelected ? 'transparent' : undefined }}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-[120px] md:w-[180px] aspect-[16/9] rounded-md overflow-hidden group/ep">
        {ep.still_path ? (
          <img src={`https://image.tmdb.org/t/p/w780${ep.still_path}`} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.02] text-white/20 text-3xl font-bold">
            {ep.episode_number}
          </div>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/ep:opacity-100 transition-opacity duration-200" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/15 backdrop-blur-sm border border-white/20">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
        {/* Progress bar */}
        {ep.progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div className="h-full" style={{ width: `${Math.min((ep.progress / (ep.duration || 1)) * 100, 100)}%`, background: '#ef4444' }} />
          </div>
        )}
      </div>

      {/* Episode info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px] font-bold text-white">
            {ep.episode_number}. {ep.name}
          </span>
          {isSelected && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#1a98ff]/15 text-[#1a98ff]">Selected</span>}
          {isLast && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#f59e0b]/15 text-amber-400">🔥 Season Finale</span>}
        </div>
        <p className="text-[12px] text-white/40 leading-relaxed line-clamp-2">
          {ep.overview || ep.air_date ? `Aired ${ep.air_date}` : 'No description available.'}
        </p>
        {ep.runtime && <span className="text-[10px] text-white/25 mt-1">{ep.runtime} min</span>}
      </div>
    </div>
  )
}

export function Detail() {
  const { type, id } = useParams<{ type: string; id: string }>()
  const navigate = useNavigate()
  const [meta, setMeta] = useState<(MetaItem & { imdb_id?: string; number_of_seasons?: number; number_of_episodes?: number }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [inLibrary, setInLibrary] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const [streams, setStreams] = useState<Stream[]>([])
  const [streamGroups, setStreamGroups] = useState<{ addonName: string; streams: ParsedStream[] }[]>([])
  const [streamError, setStreamError] = useState<string | null>(null)
  const [installedAddons, setInstalledAddons] = useState<Manifest[]>([])
  const [showSeasonPicker, setShowSeasonPicker] = useState(false)
  const [showTrailer, setShowTrailer] = useState(false)
  const [showCount, setShowCount] = useState(10)
  const [recommended, setRecommended] = useState<any[]>([])
  const { toast } = useToast()

  const isSeries = type === 'series' || type === 'tv'
  const [searchParams] = useSearchParams()
  const [seasons, setSeasons] = useState<any[]>([])
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const autoNextRef = useRef(searchParams.get('autoNext') || '')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [details, addons] = await Promise.all([
          id ? tmdb.getDetails(id, type) : null,
          api.getAddons().catch(() => [] as Manifest[]),
        ])
        if (details) setMeta(details)
        setInstalledAddons(addons.filter((a: Manifest) => hasStream(a, isSeries ? 'series' : (type || 'movie'))))
        if (id) {
          api.isInLibrary(id).then(r => setInLibrary(r.inLibrary)).catch(() => {})
        }
        if (isSeries && id) {
          const sl = await tmdb.getSeasons(id)
          setSeasons(sl)
          if (sl.length > 0) setSelectedSeason(sl[0].season_number)
        }
      } catch (err) {
        console.error('[Detail] Failed:', err)
        if (id && type) tmdb.getRecommendations(id, type).then(r => setRecommended(r)).catch(() => {})
    } finally { setLoading(false) }
    }
    load()
  }, [type, id])

  useEffect(() => {
    if (!isSeries || !id || !selectedSeason) return
    setEpisodesLoading(true)
    setSelectedEpisode(null)
    setStreams([]); setStreamGroups([]); setStreamError(null)
    tmdb.getEpisodes(id, selectedSeason).then(eps => {
      setEpisodes(eps)
      if (eps.length > 0) {
        if (autoNextRef.current) {
          const parts = autoNextRef.current.split('-')
          const epNum = parseInt(parts[1] || parts[0])
          const found = eps.find((e: any) => e.episode_number === epNum)
          setSelectedEpisode(found ? epNum : eps[0].episode_number)
        } else {
          setSelectedEpisode(eps[0].episode_number)
        }
      }
    }).finally(() => setEpisodesLoading(false))
  }, [id, selectedSeason, isSeries])

  useEffect(() => {
    if (!isSeries || !id || !selectedEpisode || installedAddons.length === 0) return
    playFromAllAddons()
  }, [selectedEpisode, installedAddons.length, isSeries])

  useEffect(() => {
    if (isSeries || !id || !meta || installedAddons.length === 0) return
    playFromAllAddons()
  }, [meta, installedAddons.length, isSeries])

  const toggleLibrary = useCallback(async () => {
    if (!meta || !id) return
    if (inLibrary) { await api.removeFromLibrary(id); setInLibrary(false); toast('Removed', 'info') }
    else { await api.addToLibrary({ id, type: type || 'movie', name: meta.name, poster: meta.poster }); setInLibrary(true); toast('Added', 'success') }
  }, [inLibrary, meta, id, type, toast])

  const playFromAllAddons = useCallback(async () => {
    setPlaying('all'); setStreamError(null); setStreams([]); setStreamGroups([])
    try {
      const imdbId = await resolveToImdbId(id || '', type)
      const results = await Promise.allSettled(
        installedAddons.map(a => fetchStreamFromAddon(a.id, isSeries ? 'series' : (type || 'movie'), imdbId,
          isSeries ? selectedSeason : undefined, isSeries ? (selectedEpisode ?? undefined) : undefined)
        )
      )
      const seen = new Set<string>()
      const allParsed: ParsedStream[] = []
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (r.status !== 'fulfilled') continue
        for (const s of r.value.streams) {
          const key = s.infoHash || s.url || ''
          if (key && seen.has(key)) continue
          if (key) seen.add(key)
          allParsed.push(parseStream({ ...s, name: s.name || r.value.addonName }))
        }
      }
      if (allParsed.length === 0) { setStreamError('No streams found from any addon'); return }
      setStreams(allParsed)
      setStreamGroups([{ addonName: 'Sources', streams: allParsed }])
    } catch (err: any) { setStreamError(err?.message || 'Failed to fetch streams') }
    finally { setPlaying(null) }
  }, [id, type, isSeries, selectedSeason, selectedEpisode, installedAddons])

  const allStreams = streamGroups.flatMap(g => g.streams)

  // Auto-play on autoNext
  useEffect(() => {
    if (!autoNextRef.current || !isSeries || !id || !selectedEpisode || !allStreams.length) return
    autoNextRef.current = ''
    const best = allStreams[0] || null
    if (best) setTimeout(() => playStream(best), 300)
  }, [selectedEpisode, allStreams])

  const playStream = useCallback((s: Stream) => {
    const params = new URLSearchParams()
    if (s.infoHash) { params.set('infoHash', s.infoHash); if (s.fileIdx != null) params.set('fileIdx', String(s.fileIdx)) }
    else if (s.url) { s.url.startsWith('magnet:?') ? params.set('magnet', s.url) : params.set('streamUrl', s.url) }
    params.set('streamName', s.name || s.source || 'Stream')
    if (isSeries && selectedEpisode != null) params.set('videoId', `S${String(selectedSeason).padStart(2,'0')}E${String(selectedEpisode).padStart(2,'0')}`)
    // Pass IMDB ID if available (so subtitle API can skip TMDB resolution)
    if (meta?.imdb_id) params.set('imdbId', meta.imdb_id)
    // Pass episode/movie runtime for transcode progress bar
    let runtimeMinutes: number | null = null
    if (isSeries && selectedEpisode != null) {
      const ep = episodes.find(e => e.episode_number === selectedEpisode)
      if (ep?.runtime) runtimeMinutes = parseInt(String(ep.runtime))
    } else if (meta?.runtime) {
      runtimeMinutes = parseInt(String(meta.runtime))
    }
    if (runtimeMinutes) params.set('duration', String(runtimeMinutes * 60))
    if (isSeries && episodes.length > 0) params.set('totalEpisodes', String(episodes.length))
    if (s.subtitles && Object.keys(s.subtitles).length > 0) {
      params.set('streamSubs', encodeURIComponent(JSON.stringify(s.subtitles)))
    }
    const sorted = [...allStreams].sort((a, b) => (b.seeds ?? 0) - (a.seeds ?? 0))
    const streamData = sorted.map(st => ({
      url: st.url, infoHash: st.infoHash, fileIdx: st.fileIdx,
      quality: st.quality, codec: st.codec, name: st.name, seeds: st.seeds ?? 0,
      magnet: st.url?.startsWith('magnet:?') ? st.url : undefined,
    }))
    params.set('streams', encodeURIComponent(JSON.stringify(streamData)))
    navigate(`/player/${type}/${id}?${params.toString()}`)
  }, [navigate, type, id, meta, isSeries, selectedSeason, selectedEpisode, allStreams, episodes])

  if (loading) return <LoadingPage />
  if (!meta) return <div className="empty-state" style={{ marginTop: 60 }}><h3>Content Not Found</h3><p>Could not load from TMDB.</p></div>

  const backdrop = meta.background || meta.poster
  const uhd = allStreams.find(s => s.quality === '4K')
  const hd = allStreams.find(s => s.quality === '1080p')
  const bestStream = uhd || hd || allStreams[0]

  return (
    <div className="relative" style={{ minHeight: '100vh', background: '#0b0c10' }}>
      {/* ── HERO BACKDROP ── */}
      {backdrop && (
        <div className="relative w-full overflow-hidden" style={{ height: '70vh', minHeight: 420 }}>
          <img src={IMG.backdrop(backdrop)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(11,12,16,0.2) 0%, rgba(11,12,16,0.6) 40%, rgba(11,12,16,0.95) 80%, #0b0c10 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 60%, transparent 0%, rgba(11,12,16,0.4) 60%, rgba(11,12,16,0.85) 100%)' }} />
        </div>
      )}

      {/* ── CONTENT ── */}
      <div className="relative z-10 px-4 sm:px-8 lg:px-12" style={{ marginTop: '-40vh', maxWidth: 1400, margin: '-40vh auto 0' }}>
        <div className="flex flex-col lg:flex-row gap-10">
          {/* ── LEFT: Info ── */}
          <div className="flex-1 min-w-0">
            {/* Back */}
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/80 transition-colors mb-6" style={{ background:'none',border:'none',cursor:'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>

            {/* Title + Meta */}
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
              {meta.name}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="flex items-center gap-1 text-sm font-bold text-yellow-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {meta.imdbRating || '—'}
              </span>
              {meta.releaseInfo && <span className="text-sm text-white/50">{meta.releaseInfo}</span>}
              {meta.runtime && <span className="text-sm text-white/50">{meta.runtime}</span>}
              {isSeries && meta.number_of_seasons && (
                <span className="text-sm text-white/50">{meta.number_of_seasons} season{meta.number_of_seasons !== 1 ? 's' : ''}</span>
              )}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded border border-white/15 text-white/40">16+</span>
            </div>

            {/* Genres */}
            {meta.genres && (
              <div className="flex flex-wrap gap-2 mb-5">
                {meta.genres.slice(0, 5).map((g: string) => (
                  <span key={g} className="text-[11px] px-3 py-1 rounded-full border border-white/[0.06] text-white/40 bg-white/[0.02]">{g}</span>
                ))}
              </div>
            )}

            {/* Synopsis */}
            {meta.description && (
              <p className="text-[15px] text-white/50 leading-relaxed max-w-2xl mb-6">
                {meta.description}
              </p>
            )}

            {/* Cast with profile photos */}
            {meta.cast && meta.cast.length > 0 && (
              <div className="mb-6">
                <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-3 block">Cast</span>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth:'none',msOverflowStyle:'none' }}>
                  {meta.cast.slice(0, 10).map((c: any) => (
                    <div key={c.name} className="flex-shrink-0 text-center" style={{ width: 80 }}>
                      <div style={{ width:64,height:64,margin:'0 auto 6px',borderRadius:'50%',overflow:'hidden',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)' }}>
                        {c.profile ? (
                          <img src={c.profile} alt={c.name} loading="lazy" className="w-full h-full object-cover img-reveal" onLoad={e => (e.target as HTMLImageElement).classList.add('loaded')}
                            onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                        ) : (
                          <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'rgba(255,255,255,0.15)',fontWeight:700 }}>
                            {c.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.6)',lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.name}</div>
                      {c.role && <div style={{ fontSize:9,color:'rgba(255,255,255,0.25)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.role}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 mb-8 flex-wrap">
              {bestStream && (
                <button onClick={() => playStream(bestStream)} tabIndex={0} className="flex items-center gap-2 px-8 py-3.5 rounded-md text-[15px] font-bold text-black bg-white hover:opacity-90 focus-visible:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  {isSeries ? `Play S${String(selectedSeason).padStart(2,'0')}E${String(selectedEpisode || 1).padStart(2,'0')}` : 'Play'}
                </button>
              )}
              {meta.videos && meta.videos.length > 0 && (
                <button onClick={() => setShowTrailer(true)}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-md text-[14px] font-bold text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Trailer
                </button>
              )}
              <button onClick={toggleLibrary} className={`flex items-center gap-2 px-6 py-3.5 rounded-md text-[14px] font-bold transition-all ${inLibrary ? 'text-[#1a98ff] bg-[#1a98ff]/10 border border-[#1a98ff]/20' : 'text-white/60 bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                {inLibrary ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                )}
                {inLibrary ? 'Saved' : 'Watchlist'}
              </button>
            </div>

            {/* ── SEASON SELECTOR (Series only) ── */}
            {isSeries && seasons.length > 0 && (
              <div className="mb-6 relative">
                <button
                  onClick={() => setShowSeasonPicker(!showSeasonPicker)}
                  className="flex items-center gap-3 px-5 py-3 rounded-lg text-[14px] font-semibold text-white bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all"
                  style={{ background: 'transparent', cursor: 'pointer' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Season {selectedSeason}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showSeasonPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {showSeasonPicker && (
                  <div className="absolute top-full left-0 mt-2 z-20 bg-[#0f172a] border border-white/[0.06] rounded-xl p-2 min-w-[200px] shadow-2xl animate-fade-up"
                    style={{ backdropFilter: 'blur(20px)', background: 'rgba(15,23,42,0.96)' }}>
                    {seasons.map((s) => (
                      <button
                        key={s.season_number}
                        onClick={() => { setSelectedSeason(s.season_number); setShowSeasonPicker(false); setStreams([]); setStreamError(null) }}
                        className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] transition-all ${
                          selectedSeason === s.season_number ? 'text-[#1a98ff] bg-[#1a98ff]/8 font-semibold' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.03]'
                        }`}
                        style={{ border: 'none', cursor: 'pointer', background: selectedSeason === s.season_number ? 'rgba(26,152,255,0.08)' : 'transparent' }}
                      >
                        {s.name || `Season ${s.season_number}`}
                        <span className="text-white/20 ml-2">({s.episode_count || '?'} ep)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── EPISODE LIST (Series only) ── */}
            {isSeries && (
              <div className="mb-8">
                <h3 className="text-[15px] font-semibold text-white/70 mb-4 flex items-center gap-2">
                  Episodes
                  {episodesLoading && <div className="w-4 h-4 border-2 border-white/10 border-t-[#1a98ff] rounded-full animate-spin" />}
                </h3>
                {!episodesLoading && (
                  <div>
                    {episodes.slice(0, showCount).map((ep, idx) => (
                      <EpisodeRow
                        key={ep.episode_number}
                        ep={ep}
                        season={selectedSeason}
                        isSelected={selectedEpisode === ep.episode_number}
                        isLast={idx === episodes.length - 1}
                        onSelect={() => { setSelectedEpisode(ep.episode_number); setStreams([]); setStreamError(null) }}
                      />
                    ))}
                    {episodes.length > showCount && (
                      <button onClick={() => setShowCount(c => Math.min(c + 10, episodes.length))}
                        className="btn-micro"
                        style={{ width:'100%',padding:'10px',marginTop:8,borderRadius:8,border:'1px solid rgba(255,255,255,0.06)',background:'rgba(255,255,255,0.02)',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:12,fontWeight:600 }}>
                        Show More (+{episodes.length - showCount})
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: Quality Selector ── */}
          <div className="lg:w-[340px] flex-shrink-0">
            <div className="stream-sidebar sticky" style={{ top: 20 }}>
              <div className="stream-sidebar-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                {isSeries && selectedEpisode != null ? `S${String(selectedSeason).padStart(2,'0')}E${String(selectedEpisode).padStart(2,'0')}` : 'Watch'}
                {allStreams.length > 0 && <span className="badge">{allStreams.length}</span>}
              </div>

              {/* Quality buttons */}
              {streamGroups.length > 0 && (
                <div style={{ display:'flex',flexDirection:'column',gap:8,marginBottom:12 }}>
                  {uhd && (
                    <button onClick={() => playStream(uhd)} tabIndex={0} className="quality-btn quality-uhd">
                      <div className="quality-btn-icon">4K</div>
                      <div className="quality-btn-info"><div className="quality-btn-label">Watch in UHD</div><div className="quality-btn-meta">{uhd.size||''} {uhd.seeds?`· ${uhd.seeds} seeds`:''}</div></div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                  )}
                  {hd && (
                    <button onClick={() => playStream(hd)} tabIndex={0} className="quality-btn quality-hd">
                      <div className="quality-btn-icon">HD</div>
                      <div className="quality-btn-info"><div className="quality-btn-label">Watch in HD</div><div className="quality-btn-meta">{hd.size||''} {hd.seeds?`· ${hd.seeds} seeds`:''}</div></div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                  )}
                  {!uhd && !hd && bestStream && (
                    <button onClick={() => playStream(bestStream)} tabIndex={0} className="quality-btn quality-sd">
                      <div className="quality-btn-icon">▶</div>
                      <div className="quality-btn-info"><div className="quality-btn-label">Watch Now</div><div className="quality-btn-meta">{bestStream.size||''}</div></div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                  )}
                  {allStreams.length > 3 && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>{allStreams.length} sources</summary>
                      <div style={{ display:'flex',flexDirection:'column',gap:4,marginTop:6,maxHeight:280,overflowY:'auto' }}>
                        {allStreams.map((s,i) => <div key={i} onClick={() => playStream(s)}><StreamRowCompact stream={s} /></div>)}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {streamGroups.length === 0 && playing && (
                <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                  {[1,2,3].map(i => <div key={i} className="stream-shimmer"><div className="stream-shimmer-line" style={{width:'70%'}}/><div className="stream-shimmer-line" style={{width:'40%'}}/></div>)}
                </div>
              )}

              {streamError && <div style={{ marginBottom:12,padding:'8px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',borderRadius:8,fontSize:12,color:'#ef4444' }}>{streamError}</div>}

              {streamGroups.length > 0 && (
                <button onClick={() => { setStreamGroups([]);setStreams([]);setStreamError(null) }} className="glass-btn" style={{ width:'100%',justifyContent:'center',marginBottom:12,fontSize:12 }}>← Change source</button>
              )}

              {streamGroups.length === 0 && !playing && installedAddons.length === 0 && (
                <div style={{ padding:'12px 0',textAlign:'center' }}><p style={{ fontSize:12,color:'var(--text-muted)' }}>No stream addons. Add one below.</p></div>
              )}
            </div>
          </div>
        </div>

        {/* ── RECOMMENDED ── */}
        {recommended.length > 0 && (
          <div className="px-4 sm:px-8 lg:px-12" style={{ maxWidth: 1400, margin: '0 auto', paddingTop: 48, paddingBottom: 48 }}>
            <h2 className="content-row-title" style={{ fontSize: 22, marginBottom: 20 }}>More Like This</h2>
            <div className="content-row-scroll" style={{ display:'flex', gap: 16, overflowX:'auto', paddingBottom: 8 }}>
              {recommended.map((item: any) => (
                <div key={item.id} style={{ minWidth: 160, cursor:'pointer' }} onClick={() => navigate(`/detail/${item.type}/${item.id}`)} className="card-glow">
                  <div style={{ width: 160, aspectRatio:'2/3', borderRadius: 10, overflow:'hidden', background:'rgba(255,255,255,0.02)', marginBottom: 8 }}>
                    {item.poster ? (
                      <img src={item.poster} alt={item.name} loading="lazy" className="w-full h-full object-cover img-reveal"
                        onLoad={e => (e.target as HTMLImageElement).classList.add('loaded')}
                        onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                    ) : (
                      <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'rgba(255,255,255,0.1)' }}>{item.name?.charAt(0)}</div>
                    )}
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
                  {item.releaseInfo && <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:2 }}>{item.releaseInfo}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── TRAILER MODAL ── */}
      {showTrailer && meta.videos && meta.videos.length > 0 && (
        <div onClick={() => setShowTrailer(false)}
          style={{ position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',backdropFilter:'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ position:'relative',width:'90%',maxWidth:960,aspectRatio:'16/9',borderRadius:16,overflow:'hidden',boxShadow:'0 32px 80px rgba(0,0,0,0.7)' }}>
            <iframe
              src={`https://www.youtube.com/embed/${meta.videos[0].id}?autoplay=1&rel=0&modestbranding=1`}
              title={meta.videos[0].title}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ width:'100%',height:'100%',border:'none' }}
            />
            <button onClick={() => setShowTrailer(false)}
              style={{ position:'absolute',top:12,right:12,width:36,height:36,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.6)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
