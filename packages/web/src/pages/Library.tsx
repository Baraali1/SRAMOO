import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api, type MetaItem } from '../api.js'
import { PosterCard } from '../components/PosterCard.js'
import { SkeletonRow } from '../components/Skeleton.js'

type TabId = 'library' | 'bookmarks' | 'history'

const TABS: { id: TabId; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'bookmarks', label: 'Bookmarks' },
  { id: 'history', label: 'History' },
]

export function Library() {
  const [tab, setTab] = useState<TabId>('library')
  const [library, setLibrary] = useState<MetaItem[]>([])
  const [bookmarks, setBookmarks] = useState<MetaItem[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getLibrary().catch(() => [] as MetaItem[]),
      api.getBookmarks().catch(() => [] as MetaItem[]),
      api.getHistory().catch(() => [] as string[]),
    ]).then(([lib, bm, hist]) => {
      setLibrary(lib)
      setBookmarks(bm)
      setHistory(hist)
    }).finally(() => setLoading(false))
  }, [])

  const currentItems = tab === 'library' ? library : tab === 'bookmarks' ? bookmarks : []

  return (
    <div className="pt-4">
      <div className="flex items-center gap-3 px-6 mb-4">
        <h1 className="text-lg font-bold">Library</h1>
      </div>

      <div className="section-wrap" style={{ marginBottom: 20 }}>
        <div className="glass-tab-bar">
          {TABS.map((t) => (
            <button key={t.id} className={`glass-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {tab === t.id && (
                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.04)' }}>
                  {t.id === 'library' ? library.length : t.id === 'bookmarks' ? bookmarks.length : history.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <SkeletonRow />
      ) : (
        <>
          {tab === 'history' ? (
            history.length === 0 ? (
              <div className="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <h3>No History Yet</h3>
                <p>Watched content will appear here.</p>
                <Link to="/" className="btn-primary" style={{ marginTop: 16 }}>Explore Content</Link>
              </div>
            ) : (
              <div className="px-6 space-y-1">
                {history.map((id) => (
                  <Link key={id} to={`/detail/movie/${id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover-lift card-subtle"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted shrink-0">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span className="text-sm">{id}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted ml-auto"><polyline points="9 18 15 12 9 6"/></svg>
                  </Link>
                ))}
              </div>
            )
          ) : currentItems.length === 0 ? (
            <div className="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                {tab === 'bookmarks' ? (
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                ) : (
                  <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>
                )}
              </svg>
              <h3>{tab === 'library' ? 'Library Is Empty' : 'No Bookmarks'}</h3>
              <p>{tab === 'library' ? 'Add content to your library to see it here.' : 'Bookmark content to find it quickly.'}</p>
              <Link to={tab === 'bookmarks' ? '/browse/movie' : '/'} className="btn-primary" style={{ marginTop: 16 }}>Browse Content</Link>
            </div>
          ) : (
            <div className="section-wrap">
              <div className="full-grid">
                {currentItems.map((item, i) => (
                  <div key={item.id} className="relative group">
                    <PosterCard id={item.id} type={item.type || 'movie'} name={item.name} poster={item.poster} imdbRating={item.imdbRating} releaseInfo={item.releaseInfo} className={`animate-fade-up stagger-${(i % 8) + 1}`} />
                    <button onClick={async (e) => { e.preventDefault(); if (tab === 'library') { await api.removeFromLibrary(item.id); setLibrary(p => p.filter(x => x.id !== item.id)) } else { await api.removeBookmark(item.id); setBookmarks(p => p.filter(x => x.id !== item.id)) } }}
                      style={{ position:'absolute',top:8,right:8,zIndex:10,width:36,height:36,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.6)',color:'rgba(255,255,255,0.6)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}
                      className="hover:!bg-red-500/80 hover:!text-white"
                      >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
