import { memo } from 'react'
import { PosterCard } from './PosterCard.js'
import { VirtuosoGrid } from 'react-virtuoso'
import type { MetaItem } from '../api.js'

interface Props {
  items: MetaItem[]
  onEndReached?: () => void
}

function GridContainer({ style, children, ...props }: any) {
  return <div className="full-grid" style={style} {...props}>{children}</div>
}

export const VirtualGrid = memo(function VirtualGrid({ items, onEndReached }: Props) {
  return (
    <VirtuosoGrid
      useWindowScroll
      totalCount={items.length}
      itemContent={(index) => {
        const item = items[index]
        if (!item) return null
        return (
          <PosterCard
            id={item.id}
            type={item.type || 'movie'}
            name={item.name}
            poster={item.poster}
            imdbRating={item.imdbRating}
            releaseInfo={item.releaseInfo}
            description={item.description}
          />
        )
      }}
      endReached={onEndReached}
      overscan={300}
      components={{ List: GridContainer }}
      style={{ minHeight: '80vh' }}
    />
  )
})
