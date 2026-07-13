import { createManifest, type Manifest, type ContentType, type MetaItem, type Stream } from '@sramo/core'

export class BuiltinAddon {
  manifest: Manifest

  constructor() {
    this.manifest = createManifest({
      id: 'org.sramo.builtin',
      name: 'SRAMO Library',
      version: '1.0.0',
      description: 'Built-in local library and discovery addon',
      resources: ['catalog', 'meta', 'stream'],
      types: ['movie', 'series'],
      catalogs: [
        {
          type: 'movie',
          id: 'library_movies',
          name: 'From Your Library',
        },
        {
          type: 'series',
          id: 'library_series',
          name: 'From Your Library',
        },
        {
          type: 'movie',
          id: 'trending_movies',
          name: 'Trending Movies',
        },
        {
          type: 'series',
          id: 'trending_series',
          name: 'Trending Series',
        },
      ],
    })
  }

  async getCatalog(type: ContentType, id: string): Promise<{ metas: MetaItem[] }> {
    if (id.startsWith('library_')) {
      // Return empty catalog - frontend will populate from local DB
      return { metas: [] }
    }
    return { metas: [] }
  }

  async getMeta(type: ContentType, id: string): Promise<{ meta: MetaItem } | null> {
    return null
  }

  async getStream(type: ContentType, id: string): Promise<{ streams: Stream[] }> {
    return { streams: [] }
  }
}
