import type { MetaItem, Stream, Subtitle, ContentType } from '../addons/types.js'

export interface MetadataProvider {
  name: string
  version: string
  getMeta(type: ContentType, id: string): Promise<MetaItem | null>
  search(query: string, type?: ContentType): Promise<MetaItem[]>
}

export interface StreamProvider {
  name: string
  version: string
  getStreams(type: ContentType, id: string): Promise<Stream[]>
}

export interface SubtitleProvider {
  name: string
  version: string
  getSubtitles(type: ContentType, id: string, opts?: { season?: number; episode?: number; lang?: string; infoHash?: string; fileIdx?: number; imdbId?: string }): Promise<Subtitle[]>
}

export interface StreamResolver {
  resolve(stream: Stream): { url: string; mime: string } | null
}
