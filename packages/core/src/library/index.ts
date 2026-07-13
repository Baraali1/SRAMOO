import type { MetaItem, ContentType } from '../addons/types.js'
import type { AppDatabase } from '../database/index.js'

export interface ContinueWatchingItem {
  id: string
  type: string
  name: string
  poster?: string
  progress: number
  duration: number
  videoId?: string
}

export class LibraryManager {
  constructor(private db: AppDatabase) {}

  getContinueWatching(limit = 20): ContinueWatchingItem[] {
    return this.db
      .getHistory(limit)
      .filter((h) => h.progress > 0 && h.progress < h.duration - 60)
      .map((h) => ({
        id: h.item_id,
        type: h.type,
        name: h.name,
        poster: h.poster,
        progress: h.progress,
        duration: h.duration,
        videoId: h.video_id,
      }))
  }

  addToLibrary(item: MetaItem): void {
    this.db.addToLibrary({
      id: item.id,
      type: item.type,
      name: item.name,
      poster: item.poster,
      added_at: Date.now(),
      updated_at: Date.now(),
    })
  }

  removeFromLibrary(id: string): void {
    this.db.removeFromLibrary(id)
  }

  getLibrary() {
    return this.db.getLibrary()
  }

  isInLibrary(id: string): boolean {
    return this.db.isInLibrary(id)
  }
}
