import { memo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

interface MediaCardProps {
  id: string
  type: string
  name: string
  poster?: string
  imdbRating?: string
  releaseInfo?: string
  description?: string
  genres?: string[]
  progress?: number
  duration?: number
  variant?: 'portrait' | 'landscape'
}

export const MediaCard = memo(function MediaCard({
  id, type, name, poster, imdbRating, releaseInfo, description, genres,
  progress, duration, variant = 'portrait',
}: MediaCardProps) {
  const linkTo = `/detail/${type || 'movie'}/${id}`
  const pct = progress != null && duration ? Math.min((progress / duration) * 100, 100) : 0
  const isLandscape = variant === 'landscape'
  const width = isLandscape ? 'w-[300px]' : 'w-[180px] md:w-[220px]'
  const aspect = isLandscape ? 'aspect-[16/9]' : 'aspect-[2/3]'
  const cardRef = useRef<HTMLAnchorElement>(null)
  const matchRating = imdbRating ? Math.round(parseFloat(imdbRating) * 10) : null

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2
    const y = ((e.clientY - r.top) / r.height - 0.5) * -2
    el.style.transform = `perspective(600px) rotateY(${x * 8}deg) rotateX(${y * 8}deg) scale3d(1.1,1.1,1.1)`
  }, [])
  const handleMouseLeave = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current; if (!el) return
    el.style.transform = ''
  }, [])

  return (
    <Link
      ref={cardRef}
      to={linkTo}
      title={name}
      tabIndex={0}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative ${width} ${aspect} flex-shrink-0 rounded-md overflow-hidden cursor-pointer
        transition-transform duration-200 ease-out will-change-transform
        hover:scale-110 focus-visible:scale-110 hover:z-30 focus-visible:z-30
        hover:shadow-2xl focus-visible:shadow-2xl hover:shadow-black/60 focus-visible:shadow-black/60`}
    >
      {/* Poster image */}
      <img
        src={poster || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" fill="%23141425"><rect width="300" height="450"/></svg>'}
        alt={name}
        loading="lazy"
        className="w-full h-full object-cover img-reveal"
        onLoad={(e) => (e.target as HTMLImageElement).classList.add('loaded')}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />

      {/* Progress bar */}
      {pct > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-10">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${pct}%`, background: '#1a98ff' }}
          />
        </div>
      )}

      {/* Rating badge */}
      {imdbRating && (
        <span className="absolute top-2 right-2 z-10 px-1.5 py-0.5 text-[10px] font-bold rounded bg-black/60 text-yellow-400">
          ★ {imdbRating}
        </span>
      )}

      {/* ── Hover info overlay ── */}
      <div className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }}>
        <div className="p-3 pb-4">
          {/* Title */}
          <p className="text-[13px] font-bold text-white truncate mb-1 leading-tight">{name}</p>
          {/* Meta row */}
          <div className="flex items-center gap-2 text-[10px]">
            {matchRating && (
              <span className="text-green-400 font-bold">{matchRating}% Match</span>
            )}
            {releaseInfo && (
              <span className="text-white/60">{releaseInfo}</span>
            )}
          </div>
          {/* Genres */}
          {genres && genres.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              {genres.slice(0, 2).map((g) => (
                <span key={g} className="text-[9px] text-white/40 px-1.5 py-0.5 rounded border border-white/10">{g}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
})
