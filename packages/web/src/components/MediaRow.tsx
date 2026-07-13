import { useRef, useState, useCallback, memo } from 'react'
import { Link } from 'react-router-dom'
import { MediaCard } from './MediaCard.js'
import type { MetaItem } from '../api.js'

interface MediaRowProps {
  title: string
  items: MetaItem[]
  variant?: 'portrait' | 'landscape'
  seeAllTo?: string
}

export const MediaRow = memo(function MediaRow({ title, items, variant = 'portrait', seeAllTo }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setShowLeft(el.scrollLeft > 10)
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10)
  }, [])

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.75
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }, [])

  if (!items?.length) return null

  return (
    <section
      className="relative group/row px-4 sm:px-8 lg:px-12 py-6"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-white tracking-tight">{title}</h2>
        {seeAllTo && (
          <Link to={seeAllTo} className="text-[12px] font-semibold text-[#1a98ff] hover:text-[#5cb4ff] transition-colors">
            See more &rarr;
          </Link>
        )}
      </div>

      {/* Scroll container */}
      <div className="relative">
        {/* Left arrow */}
        {(isHovered || true) && showLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 flex items-center px-2 transition-opacity duration-200 opacity-100"
            style={{ background: 'linear-gradient(to right, rgba(11,12,16,0.9) 0%, transparent 100%)' }}
            aria-label="Scroll left"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-black/70 transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </div>
          </button>
        )}

        {/* Cards */}
        <div
          ref={scrollRef}
          onScroll={updateArrows}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item, i) => (
            <MediaCard
              key={item.id}
              id={item.id}
              type={item.type || 'movie'}
              name={item.name}
              poster={item.poster}
              imdbRating={item.imdbRating}
              releaseInfo={item.releaseInfo}
              description={item.description}
              genres={item.genres}
              variant={variant}
            />
          ))}
          {/* Spacer at end for scroll comfort */}
          <div className="flex-shrink-0 w-1" />
        </div>

        {/* Right arrow */}
        {(isHovered || true) && showRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 flex items-center px-2 transition-opacity duration-200 opacity-100"
            style={{ background: 'linear-gradient(to left, rgba(11,12,16,0.9) 0%, transparent 100%)' }}
            aria-label="Scroll right"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-sm border border-white/10 text-white/80 hover:text-white hover:bg-black/70 transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        )}
      </div>
    </section>
  )
})
