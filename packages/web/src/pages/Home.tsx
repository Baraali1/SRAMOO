import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type MetaItem } from '../api.js'
import { tmdb } from '../tmdb.js'
import { MediaRow } from '../components/MediaRow.js'
import { MediaCard } from '../components/MediaCard.js'
import { SkeletonRow } from '../components/Skeleton.js'
import { ContinueWatching } from '../components/ContinueWatching.js'

interface SectionDef {
  title: string
  type: 'movie' | 'tv'
  category: 'trending' | 'popular' | 'topRated' | 'nowPlaying' | 'upcoming'
  window?: 'day' | 'week'
  variant?: 'portrait' | 'landscape'
}

interface SectionState {
  title: string
  items: MetaItem[]
  variant: 'portrait' | 'landscape'
  sectionIndex: number
}

const ALL_SECTIONS: SectionDef[] = [
  { title: 'Prime — Trending Now', type: 'movie', category: 'trending', window: 'day', variant: 'landscape' },
  { title: 'Now Playing', type: 'movie', category: 'nowPlaying' },
  { title: 'Prime — Popular Movies', type: 'movie', category: 'popular' },
  { title: 'Prime — Top TV Shows', type: 'tv', category: 'trending', window: 'week' },
  { title: 'Action & Adventure', type: 'movie', category: 'topRated' },
  { title: 'Popular TV Shows', type: 'tv', category: 'popular' },
  { title: 'Recently Added', type: 'movie', category: 'upcoming' },
]

function getPagesLoader(section: SectionDef, pages: number): Promise<MetaItem[]> {
  switch (section.category) {
    case 'trending':   return tmdb.getTrendingPages(section.type, section.window || 'day', pages)
    case 'popular':    return tmdb.getPopularPages(section.type, pages)
    case 'topRated':   return tmdb.getTopRatedPages(section.type, pages)
    case 'nowPlaying': return tmdb.getNowPlayingPages(pages)
    case 'upcoming':   return tmdb.getUpcomingPages(pages)
  }
}

export function Home() {
  const navigate = useNavigate()
  const [sections, setSections] = useState<SectionState[]>([])
  const [continueWatching, setContinueWatching] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [heroItems, setHeroItems] = useState<MetaItem[]>([])
  const [heroIndex, setHeroIndex] = useState(0)
  const loadId = useRef(0)
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const id = ++loadId.current
    setLoading(true)
    try {
      const [history, ...results] = await Promise.allSettled([
        api.getContinueWatching().catch(() => []),
        ...ALL_SECTIONS.map((sec) => getPagesLoader(sec, 1)),
      ])
      if (id !== loadId.current) return
      const historyVal = history.status === 'fulfilled' ? history.value : []
      setContinueWatching(historyVal)

      const nextSections: SectionState[] = results.map((r, i) => {
        const items = r.status === 'fulfilled' ? r.value : []
        return {
          title: ALL_SECTIONS[i].title,
          items: items.slice(0, 20),
          variant: ALL_SECTIONS[i].variant || 'portrait',
          sectionIndex: i,
        }
      })

      setSections(nextSections)

      // Hero from first section
      for (const sec of nextSections) {
        if (sec.items.length > 0) {
          setHeroItems(sec.items.slice(0, 6))
          break
        }
      }
    } catch (err) {
      console.error('[Home] Failed to load:', err)
    } finally {
      if (id === loadId.current) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (heroItems.length <= 1) return
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroItems.length)
    }, 7000)
    return () => { if (heroTimerRef.current) clearInterval(heroTimerRef.current) }
  }, [heroItems.length])

  const hero = heroItems[heroIndex]

  return (
    <div>
      {/* ── HERO BILLBOARD ── */}
      {hero && !loading && (
        <div className="relative w-full overflow-hidden" style={{ height: '85vh', minHeight: 500, maxHeight: 800 }}>
          <img
            src={`https://image.tmdb.org/t/p/w1280${hero.background || hero.poster || ''}`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          {/* Gradient overlays */}
          <div className="absolute inset-0" style={{
            background: `
              radial-gradient(ellipse 60% 40% at 30% 60%, transparent 0%, rgba(11,12,16,0.5) 60%, rgba(11,12,16,0.85) 90%),
              linear-gradient(to right, rgba(11,12,16,0.7) 0%, transparent 50%, rgba(11,12,16,0.4) 100%),
              linear-gradient(to top, rgba(11,12,16,1) 0%, transparent 40%)
            `,
          }} />

          {/* Hero content */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-4 sm:px-8 lg:px-12 pb-24 max-w-2xl">
            {hero.logo ? (
              <img src={hero.logo} alt={hero.name} className="max-w-[280px] max-h-[100px] object-contain mb-4" />
            ) : (
              <h1 className="text-5xl font-extrabold text-white tracking-tight leading-tight mb-3 drop-shadow-lg">
                {hero.name}
              </h1>
            )}
            <div className="flex items-center gap-3 mb-3 text-sm">
              {hero.imdbRating && (
                <span className="flex items-center gap-1 font-bold text-yellow-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  {hero.imdbRating}
                </span>
              )}
              {hero.releaseInfo && <span className="text-white/60">{hero.releaseInfo}</span>}
              {hero.runtime && <span className="text-white/60">{hero.runtime}</span>}
              {hero.genres?.slice(0, 2).map((g: string) => (
                <span key={g} className="px-2 py-0.5 text-[11px] rounded border border-white/20 text-white/60">{g}</span>
              ))}
            </div>
            {hero.description && (
              <p className="text-sm text-white/50 leading-relaxed line-clamp-3 mb-5">{hero.description}</p>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/detail/${hero.type || 'movie'}/${hero.id}`)}
                className="flex items-center gap-2 px-8 py-3 rounded-md text-sm font-bold text-black transition-all hover:opacity-90"
                style={{ background: '#fff' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Play
              </button>
              <button
                onClick={() => navigate(`/detail/${hero.type || 'movie'}/${hero.id}`)}
                className="flex items-center gap-2 px-8 py-3 rounded-md text-sm font-bold text-white transition-all hover:bg-white/10"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              >
                More Info
              </button>
            </div>
          </div>

          {/* Hero dot indicators */}
          {heroItems.length > 1 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2">
              {heroItems.slice(0, 6).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === heroIndex ? 24 : 8,
                    height: 8,
                    background: i === heroIndex ? '#1a98ff' : 'rgba(255,255,255,0.2)',
                    border: 'none', cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONTENT ROWS ── */}
      {loading ? (
        <div className="mt-6">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div className="pb-20">
          {continueWatching.length > 0 && <ContinueWatching items={continueWatching} />}
          {sections.map((section) =>
            section.items.length > 0 ? (
              <MediaRow
                key={section.sectionIndex}
                title={section.title}
                items={section.items}
                variant={section.variant}
                seeAllTo={section.sectionIndex < 3 ? `/browse/${section.items[0]?.type || 'movie'}` : undefined}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
