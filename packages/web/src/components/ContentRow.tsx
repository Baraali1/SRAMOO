import { memo } from 'react'
import { Link } from 'react-router-dom'
import { PosterCard } from './PosterCard.js'
import type { MetaItem } from '../api.js'

interface ContentRowProps {
  title: string
  items: MetaItem[]
  onLoadMore?: () => void
  onShowMore?: () => void
  loadingMore?: boolean
  hasMore?: boolean
  seeAllTo?: string
}

export const ContentRow = memo(function ContentRow({ title, items, onLoadMore, onShowMore, loadingMore, hasMore, seeAllTo }: ContentRowProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="content-row section-wrap">
      <div className="content-row-header">
        <h2 className="content-row-title">{title}</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {onShowMore && hasMore && (
            <button onClick={onShowMore} className="show-more-btn">
              Show More &rarr;
            </button>
          )}
          {seeAllTo && !onShowMore && (
            <Link to={seeAllTo} className="show-more-btn">
              See All &rarr;
            </Link>
          )}
        </div>
      </div>
      <div className="scroll-fade-right" style={{ position: 'relative' }}>
        <div className="content-row-scroll">
          {items.map((item, i) => (
            <PosterCard
              key={item.id}
              id={item.id}
              type={item.type || 'movie'}
              name={item.name}
              poster={item.poster}
              imdbRating={item.imdbRating}
              releaseInfo={item.releaseInfo}
              description={item.description}
              className={`animate-fade-up stagger-${(i % 8) + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
})
