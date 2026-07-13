import { useState, useEffect, useRef } from 'react'
import { PosterCard } from '../components/PosterCard.js'
import { tmdb } from '../tmdb.js'
import type { MetaItem } from '../api.js'

const RECENT_KEY = 'sramo_recent_searches'
const MAX_RECENT = 8

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function saveRecent(q: string) {
  const arr = loadRecent().filter(s => s !== q)
  arr.unshift(q)
  if (arr.length > MAX_RECENT) arr.pop()
  localStorage.setItem(RECENT_KEY, JSON.stringify(arr))
}
function clearRecent() {
  localStorage.removeItem(RECENT_KEY)
}

export function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MetaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<string[]>(loadRecent())
  const [trending, setTrending] = useState<MetaItem[]>([])
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    tmdb.discover('movie', { sort_by: 'popularity.desc' }).then(r => {
      const items = r.items || []
      if (items.length > 0) setTrending(items.slice(0, 12))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await tmdb.search(query)
        const items = Array.isArray(data) ? data : []
        let filtered = items
        if (type === 'movie') filtered = items.filter(i => i.type === 'movie' || i.type === 'movie')
        else if (type === 'series') filtered = items.filter(i => i.type === 'series' || i.type === 'tv')
        setResults(filtered.slice(0, 30))
        saveRecent(query.trim())
        setRecent(loadRecent())
      } catch { setResults([]) }
      setLoading(false)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, type])

  const handleRecentClick = (q: string) => {
    setQuery(q)
  }

  return (
    <div className="search-page">
      <div className="search-header">
        <h1>Search</h1>
        <div className="flex justify-center">
          <div className="search-bar-glass">
            <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search movies & series..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery('')} className="search-bar-clear">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>
        <div className="search-type-tabs">
          {(['all', 'movie', 'series'] as const).map(t => (
            <button key={t} onClick={() => setType(t)} className={`search-type-tab ${type === t ? 'active' : ''}`}>
              {t === 'all' ? 'All' : t === 'movie' ? 'Movies' : 'Series'}
            </button>
          ))}
        </div>
      </div>

      {!query.trim() && recent.length > 0 && (
        <div>
          <div className="search-section-header">
            Recent searches
            <button onClick={() => { clearRecent(); setRecent([]) }} className="search-clear-btn" style={{ marginLeft: 10 }}>Clear</button>
          </div>
          <div className="recent-search">
            {recent.map(q => (
              <button key={q} onClick={() => handleRecentClick(q)} className="glass-chip">{q}</button>
            ))}
          </div>
        </div>
      )}

      {!query.trim() && trending.length > 0 && (
        <div>
          <div className="search-section-header">Trending</div>
          <div className="full-grid">
            {trending.map((item, i) => (
              <PosterCard
                key={item.id}
                id={item.id}
                type={item.type || 'movie'}
                name={item.name}
                poster={item.poster}
                imdbRating={item.imdbRating}
                releaseInfo={item.releaseInfo}
                className={`animate-fade-up stagger-${(i % 8) + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {query.trim() && (
        <div className="search-results">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="sramo-spinner" />
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <h3>No results</h3>
              <p>Try a different search term.</p>
            </div>
          ) : (
            <div className="full-grid">
              {results.map((item, i) => (
                <PosterCard
                  key={item.id}
                  id={item.id}
                  type={item.type || 'movie'}
                  name={item.name}
                  poster={item.poster}
                  imdbRating={item.imdbRating}
                  releaseInfo={item.releaseInfo}
                  className={`animate-fade-up stagger-${(i % 8) + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
