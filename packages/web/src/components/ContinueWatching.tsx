import { memo, useMemo } from 'react'
import { Link } from 'react-router-dom'

interface ContinueWatchingItem {
  item_id: string
  type: string
  name: string
  poster?: string
  progress: number
  duration: number
  releaseInfo?: string
  stream_info_hash?: string
  stream_file_idx?: number
  updated_at?: string
}

interface Props {
  items: ContinueWatchingItem[]
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function timeRemaining(progress: number, duration: number): string {
  const remaining = Math.max(0, duration - progress)
  if (remaining >= 3600) {
    const h = Math.floor(remaining / 3600)
    const m = Math.floor((remaining % 3600) / 60)
    return `${h}h ${m}m left`
  }
  return `${formatTime(remaining)} left`
}

export const ContinueWatching = memo(function ContinueWatching({ items }: Props) {
  const sorted = useMemo(() => {
    if (!items?.length) return []
    const filtered = items.filter((h) => {
      if (h.duration <= 0 || h.progress <= 0) return false
      if (h.duration < 60) return false
      if (h.progress < 30) return false
      if (h.progress / h.duration < 0.01) return false
      return true
    })
    return [...filtered].sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
      if (bTime !== aTime) return bTime - aTime
      return (b.progress / b.duration) - (a.progress / a.duration)
    })
  }, [items])

  if (sorted.length === 0) return null

  return (
    <section className="content-row section-wrap">
      <div className="content-row-header">
        <h2 className="content-row-title">Continue Watching</h2>
        <Link to="/library" className="show-more-btn">See All &rarr;</Link>
      </div>
      <div className="scroll-fade-right" style={{ position: 'relative' }}>
        <div className="content-row-scroll">
          {sorted.map((item, i) => {
            const params = new URLSearchParams()
            if (item.stream_info_hash) params.set('infoHash', item.stream_info_hash)
            if (item.stream_file_idx != null) params.set('fileIdx', String(item.stream_file_idx))
            const qs = params.toString()
            const to = `/player/${item.type}/${item.item_id}${qs ? `?${qs}` : '?'}${qs ? '&' : ''}t=${Math.floor(item.progress)}`
            const pct = Math.min((item.progress / item.duration) * 100, 100)
            const completed = item.duration > 0 && pct >= 98

            return (
              <div key={`${item.item_id}-${i}`} className={`animate-fade-up stagger-${(i % 8) + 1}`} style={{ width: 150, flexShrink: 0 }}>
                <Link to={to} className="poster-card-wrap" title={item.name}>
                  {item.poster ? (
                    <img src={item.poster} alt={item.name} loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.querySelector('.poster-fallback-gradient')!.classList.remove('hidden') }}
                    />
                  ) : null}
                  <div className={`${item.poster ? 'hidden' : ''} poster-fallback-gradient`} style={{ position: 'absolute', inset: 0 }}>
                    {item.name}
                  </div>
                  <div className="play-overlay">
                    <div className="play-overlay-btn">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                  {/* Progress bar on poster */}
                  {item.progress != null && item.duration != null && pct > 0 && (
                    <div className="poster-progress">
                      <div className="poster-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  <div className="poster-info">
                    <div className="poster-title">{item.name}</div>
                    <div className="poster-sub">{Math.round(pct)}% watched</div>
                  </div>
                </Link>
                {/* Progress tracker bar below poster */}
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: completed ? 'linear-gradient(90deg, var(--accent-green), #2dd4bf)' : 'linear-gradient(90deg, var(--accent), #a78bfa)',
                      borderRadius: '0 2px 2px 0',
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  {!completed && (
                    <div className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
                      {timeRemaining(item.progress, item.duration)}
                    </div>
                  )}
                </div>
                {completed && (
                  <div className="cw-badge-complete" style={{ marginTop: 4 }}>✓ Watched</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
})
