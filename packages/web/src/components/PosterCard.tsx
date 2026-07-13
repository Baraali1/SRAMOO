import { Link } from 'react-router-dom'
import { memo, useState, useCallback, useRef, useMemo, useId } from 'react'

const FALLBACK_POSTER = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" fill="%23141425"><rect width="300" height="450"/><text x="150" y="225" text-anchor="middle" fill="%23505068" font-size="16">No Poster</text></svg>'

interface PosterCardProps {
  id: string
  type: string
  name: string
  poster?: string
  imdbRating?: string
  releaseInfo?: string
  description?: string
  progress?: number
  duration?: number
  to?: string
  className?: string
  style?: React.CSSProperties
  showRatingBadge?: boolean
}

const PosterCardInner = memo(function PosterCardInner({
  id, type, name, poster, imdbRating, releaseInfo, description, progress, duration, to, className = '', style, showRatingBadge = true
}: PosterCardProps) {
  const pct = progress != null && duration ? Math.min((progress / duration) * 100, 100) : 0
  const linkTo = to || `/detail/${type}/${id}`
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [expandDir, setExpandDir] = useState<'center' | 'left' | 'right'>('center')
  const cardRef = useRef<HTMLAnchorElement>(null)
  const imgSrc = poster || FALLBACK_POSTER
  const uid = useId()

  const handleLoad = useCallback(() => setImgLoaded(true), [])
  const handleError = useCallback(() => { setImgError(true); setImgLoaded(true) }, [])

  // Edge detection: decide expansion direction based on card's viewport position
  const handleMouseEnter = useCallback(() => {
    const el = cardRef.current
    if (!el) { setExpandDir('center'); return }
    const rect = el.getBoundingClientRect()
    const cardCenter = rect.left + rect.width / 2
    const viewWidth = window.innerWidth
    const expandWidth = 280
    const halfExpand = expandWidth / 2

    if (cardCenter - halfExpand < 16) {
      setExpandDir('left')
    } else if (cardCenter + halfExpand > viewWidth - 16) {
      setExpandDir('right')
    } else {
      setExpandDir('center')
    }
  }, [])

  const expandClass = useMemo(() => {
    if (expandDir === 'left') return ' expand-left'
    if (expandDir === 'right') return ' expand-right'
    return ''
  }, [expandDir])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { return }
  }, [])

  return (
    <Link
      ref={cardRef}
      to={linkTo}
      title={name}
      tabIndex={0}
      className={`poster-card-wrap group ${className}`}
      style={style}
      onMouseEnter={handleMouseEnter}
      onKeyDown={handleKeyDown}
    >
      {/* Dual-layer loader: grayscale blurred placeholder → color reveal */}
      <div className="poster-img-container">
        {!imgLoaded && !imgError && (
          <div className="poster-placeholder">
            <div className="poster-placeholder-shimmer" />
          </div>
        )}
        <img
          src={imgSrc}
          alt={name}
          loading="lazy"
          className={`poster-img ${imgLoaded ? 'loaded' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          style={{ display: imgError ? 'none' : 'block' }}
        />
        {imgError && (
          <div className="poster-fallback">{name.charAt(0).toUpperCase()}</div>
        )}
      </div>

      {/* Play overlay */}
      <div className="play-overlay">
        <div className="play-overlay-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </div>
      </div>

      {/* Rating badge */}
      {showRatingBadge && imdbRating && (
        <span className="rating-badge">★ {imdbRating}</span>
      )}

      {/* Progress bar */}
      {progress != null && duration != null && pct > 0 && (
        <div className="poster-progress">
          <div className="poster-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Info bar (only when NOT hovered) */}
      <div className="poster-info group-hover:opacity-0">
        <div className="poster-title">{name}</div>
        {releaseInfo && <div className="poster-sub">{releaseInfo}</div>}
      </div>

      {/* ═══ Prime Video expanding detail card ═══ */}
      <div className={`poster-hover-overlay hidden sm:block${expandClass}`}>
        {/* Top half: poster image */}
        <img className="hover-poster" src={imgSrc} alt={name} loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />

        {/* Bottom half: detail panel */}
        <div className="hover-details">
          <div className="hover-title">{name}</div>

          <div className="hover-meta">
            {imdbRating && <span className="meta-tag meta-tag-rating">★ {imdbRating}</span>}
            {releaseInfo && <span className="meta-tag meta-tag-rank">{releaseInfo}</span>}
            {type === 'series' && <span className="meta-tag meta-tag-maturity">Series</span>}
          </div>

          {description && <div className="hover-synopsis">{description}</div>}

          <div className="hover-actions">
            <Link to={linkTo} className="hover-play-btn" onClick={(e) => e.stopPropagation()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Play
            </Link>
            <button className="hover-icon-btn" title="Add to Library"
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            <button className="hover-icon-btn" title="More Info"
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
})

export { PosterCardInner as PosterCard }
