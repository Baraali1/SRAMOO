import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { type MetaItem } from '../api.js'
import { tmdb } from '../tmdb.js'
import { ContentRow } from '../components/ContentRow.js'
import { PosterCard } from '../components/PosterCard.js'
import { SkeletonRow } from '../components/Skeleton.js'

const CURRENT_YEAR = new Date().getFullYear()
const GENRES = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction','Thriller','War','Western']
const YEAR_STEP = 20
const YEAR_BATCH = 30

const TMDB_GENRE_MAP: Record<string, number> = {
  'Action': 28, 'Adventure': 12, 'Animation': 16, 'Comedy': 35, 'Crime': 80,
  'Documentary': 99, 'Drama': 18, 'Family': 10751, 'Fantasy': 14, 'History': 36,
  'Horror': 27, 'Music': 10402, 'Mystery': 9648, 'Romance': 10749,
  'Science Fiction': 878, 'Thriller': 53, 'War': 10752, 'Western': 37,
}

type SortKey = 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc' | 'original_title.asc'
type ViewMode = 'grid' | 'list'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularity' },
  { value: 'vote_average.desc', label: 'Rating' },
  { value: 'primary_release_date.desc', label: 'Release Date' },
  { value: 'original_title.asc', label: 'Title A-Z' },
]

function sortParamForTV(sort: SortKey): string {
  if (sort === 'primary_release_date.desc') return 'first_air_date.desc'
  if (sort === 'original_title.asc') return 'name.asc'
  return sort
}

export function Browse() {
  const { type } = useParams<{ type: string }>()
  const [sections, setSections] = useState<{ title: string; items: MetaItem[] }[]>([])
  const [genreItems, setGenreItems] = useState<MetaItem[]>([])
  const [yearItems, setYearItems] = useState<MetaItem[]>([])
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR)
  const [loading, setLoading] = useState(true)
  const [genreLoading, setGenreLoading] = useState(false)
  const [yearLoading, setYearLoading] = useState(false)
  const [mode, setMode] = useState<'catalogs' | 'genre' | 'year'>('catalogs')
  const [yearRangeStart, setYearRangeStart] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('popularity.desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const typeLabel = type === 'series' ? 'Series' : 'Movies'
  const ALL_YEARS = Array.from({ length: CURRENT_YEAR - 1920 + 1 }, (_, i) => CURRENT_YEAR - i)
  const visibleYears = ALL_YEARS.slice(yearRangeStart, yearRangeStart + YEAR_BATCH)
  const isTV = type === 'series' || type === 'tv'

  useEffect(() => {
    async function loadCatalogs() {
      if (mode !== 'catalogs') return
      setLoading(true)
      try {
        const [popular, topRated] = await Promise.all([
          tmdb.discover(type || 'movie', { sort_by: sortBy }, 3),
          tmdb.discover(type || 'movie', { sort_by: isTV ? 'vote_average.desc' : 'vote_average.desc', 'vote_count.gte': '200' }, 3),
        ])
        const results: { title: string; items: MetaItem[] }[] = []
        if (popular.items.length) results.push({ title: 'Popular ' + typeLabel, items: popular.items })
        if (topRated.items.length) results.push({ title: 'Top Rated ' + typeLabel, items: topRated.items })
        setSections(results)
      } catch {} finally { setLoading(false) }
    }
    loadCatalogs()
  }, [type, mode, sortBy, isTV, typeLabel])

  useEffect(() => {
    async function loadGenre() {
      if (mode !== 'genre' || !selectedGenre) return
      setGenreLoading(true)
      const genreId = TMDB_GENRE_MAP[selectedGenre]
      if (!genreId) { setGenreLoading(false); setGenreItems([]); return }
      const params: Record<string, string> = { with_genres: String(genreId), sort_by: isTV ? sortParamForTV(sortBy) : sortBy, 'page': String(page) }
      const { items, totalPages: tp } = await tmdb.discover(type || 'movie', params, 3)
      setGenreItems(items)
      setTotalPages(tp)
      setGenreLoading(false)
    }
    loadGenre()
  }, [type, mode, selectedGenre, page, sortBy, isTV])

  useEffect(() => {
    async function loadYear() {
      if (mode !== 'year') return
      setYearLoading(true)
      const param = isTV ? 'first_air_date_year' : 'primary_release_year'
      const params: Record<string, string> = { [param]: String(selectedYear), sort_by: isTV ? sortParamForTV(sortBy) : sortBy, 'page': String(page) }
      const { items, totalPages: tp } = await tmdb.discover(type || 'movie', params, 3)
      setYearItems(items)
      setTotalPages(tp)
      setYearLoading(false)
    }
    loadYear()
  }, [type, mode, selectedYear, page, sortBy, isTV])

  useEffect(() => { setYearRangeStart(0) }, [type])
  useEffect(() => { setPage(1); setTotalPages(1) }, [mode, selectedGenre, selectedYear, type, sortBy])

  const currentItems = mode === 'genre' ? genreItems : mode === 'year' ? yearItems : []

  return (
    <div className="pt-4">
      <div className="flex items-center gap-3 px-6 mb-2">
        <h1 className="text-lg font-bold">{typeLabel}</h1>
      </div>

      {/* Glass filter bar */}
      <div className="px-6 mb-4 flex flex-wrap items-center gap-3">
        <div className="glass-tab-bar">
          <button className={`glass-tab${mode === 'catalogs' ? ' active' : ''}`} onClick={() => setMode('catalogs')}>Featured</button>
          <button className={`glass-tab${mode === 'genre' ? ' active' : ''}`} onClick={() => setMode('genre')}>Genres</button>
          <button className={`glass-tab${mode === 'year' ? ' active' : ''}`} onClick={() => setMode('year')}>By Year</button>
        </div>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="sort-select">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="view-toggle">
          <button onClick={() => setViewMode('grid')} className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} title="Grid view">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>
          <button onClick={() => setViewMode('list')} className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} title="Compact list">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {mode === 'genre' && (
        <div className="px-6 mb-8">
          <div className="flex flex-wrap gap-2 mb-6">
            {GENRES.map((genre) => (
              <button key={genre} onClick={() => { setSelectedGenre(genre); setPage(1) }}
                className={`glass-pill${selectedGenre === genre ? ' active' : ''}`}>
                {genre}
              </button>
            ))}
          </div>
          {selectedGenre && (
            genreLoading ? (
              <SkeletonRow />
            ) : genreItems.length === 0 ? (
              <div className="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <h3>No {typeLabel} found for {selectedGenre}</h3>
              </div>
            ) : viewMode === 'list' ? (
              <ResultsGrid items={genreItems} viewMode="list" loadingMore={false} hasMore={false} onLoadMore={undefined} />
            ) : (
              <ResultsGrid items={genreItems} viewMode={viewMode} loadingMore={false} hasMore={false} onLoadMore={undefined} />
            )
          )}
        </div>
      )}

      {mode === 'year' && (
        <div className="px-6 mb-8">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {yearRangeStart > 0 && (
              <button onClick={() => setYearRangeStart((p) => Math.max(p - YEAR_STEP, 0))}
                className="glass-pill">←</button>
            )}
            {visibleYears.map((year) => (
              <button key={year} onClick={() => { setSelectedYear(year); setPage(1) }}
                className={`glass-pill${selectedYear === year ? ' active' : ''}`}>
                {year}
              </button>
            ))}
            {yearRangeStart + YEAR_BATCH < ALL_YEARS.length && (
              <button onClick={() => setYearRangeStart((p) => Math.min(p + YEAR_STEP, ALL_YEARS.length - YEAR_BATCH))}
                className="glass-pill">→</button>
            )}
          </div>

          {yearLoading ? (
            <div className="mt-6"><SkeletonRow /></div>
          ) : yearItems.length === 0 ? (
            <div className="empty-state mt-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <h3>No {typeLabel} found for {selectedYear}</h3>
            </div>
          ) : (
            <div className="mt-6">
              <ResultsGrid items={yearItems} viewMode={viewMode} loadingMore={false} hasMore={false} onLoadMore={undefined} />
            </div>
          )}
        </div>
      )}

      {mode === 'catalogs' && (
        loading ? (
          <><SkeletonRow /><SkeletonRow /></>
        ) : sections.length === 0 ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <h3>No {typeLabel} Found</h3>
            <p>Check your connection or try a different category.</p>
          </div>
        ) : sections.map((section, i) => (
          <ContentRow key={i} title={section.title} items={section.items} />
        ))
      )}
    </div>
  )
}

function ResultsGrid({ items, viewMode, loadingMore, hasMore, onLoadMore }: { items: MetaItem[]; viewMode: ViewMode; loadingMore: boolean; hasMore: boolean; onLoadMore: (() => void) | undefined }) {
  if (viewMode === 'list') {
    return (
      <>
        <div className="space-y-1">
          {items.map((item) => (
            <Link key={item.id} to={`/detail/${item.type || 'movie'}/${item.id}`}
              className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover-lift card-subtle"
            >
              <img src={item.poster || ''} alt="" className="w-10 h-14 rounded object-cover shrink-0 bg-card" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.releaseInfo && <span className="text-xs text-muted">{item.releaseInfo}</span>}
                  {item.imdbRating && <span className="text-xs text-accent-yellow">★ {item.imdbRating}</span>}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
        {onLoadMore && hasMore && (
          <button onClick={onLoadMore} disabled={loadingMore} className="load-more-btn mt-4">
            {loadingMore ? <div className="sramo-spinner w-4 h-4" /> : 'Load More'}
          </button>
        )}
      </>
    )
  }

  return (
    <>
      <div className="full-grid">
        {items.map((item, i) => (
          <PosterCard key={item.id} id={item.id} type={item.type || 'movie'} name={item.name} poster={item.poster} imdbRating={item.imdbRating} releaseInfo={item.releaseInfo} className={`animate-fade-up stagger-${(i % 8) + 1}`} />
        ))}
      </div>
      {onLoadMore && hasMore && (
        <button onClick={onLoadMore} disabled={loadingMore} className="load-more-btn mt-6">
          {loadingMore ? <div className="sramo-spinner w-4 h-4" /> : 'Load More'}
        </button>
      )}
    </>
  )
}
