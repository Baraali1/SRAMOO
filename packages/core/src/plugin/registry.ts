import type { MetadataProvider, StreamProvider, SubtitleProvider } from './types.js'
import type { MetaItem, Stream, Subtitle, ContentType } from '../addons/types.js'

export class ProviderRegistry {
  private metaProviders: Map<string, MetadataProvider> = new Map()
  private streamProviders: Map<string, StreamProvider> = new Map()
  private subtitleProviders: Map<string, SubtitleProvider> = new Map()

  registerMetadata(provider: MetadataProvider): void {
    this.metaProviders.set(provider.name, provider)
    console.log(`[ProviderRegistry] Metadata provider registered: ${provider.name} v${provider.version}`)
  }

  registerStream(provider: StreamProvider): void {
    this.streamProviders.set(provider.name, provider)
    console.log(`[ProviderRegistry] Stream provider registered: ${provider.name} v${provider.version}`)
  }

  registerSubtitles(provider: SubtitleProvider): void {
    this.subtitleProviders.set(provider.name, provider)
    console.log(`[ProviderRegistry] Subtitle provider registered: ${provider.name} v${provider.version}`)
  }

  async getMeta(type: ContentType, id: string): Promise<MetaItem | null> {
    for (const [, provider] of this.metaProviders) {
      try {
        const result = await provider.getMeta(type, id)
        if (result) return result
      } catch (err) {
        console.warn(`[ProviderRegistry] Meta provider ${provider.name} failed:`, err)
      }
    }
    return null
  }

  async search(query: string, type?: ContentType): Promise<MetaItem[]> {
    const results: MetaItem[] = []
    for (const [, provider] of this.metaProviders) {
      try {
        const items = await provider.search(query, type)
        results.push(...items)
      } catch (err) {
        console.warn(`[ProviderRegistry] Search provider ${provider.name} failed:`, err)
      }
    }
    return results
  }

  async getStreams(type: ContentType, id: string): Promise<{ providerName: string; streams: Stream[] }[]> {
    const results: { providerName: string; streams: Stream[] }[] = []
    for (const [, provider] of this.streamProviders) {
      try {
        const streams = await provider.getStreams(type, id)
        if (streams.length > 0) {
          results.push({ providerName: provider.name, streams })
        }
      } catch (err) {
        console.warn(`[ProviderRegistry] Stream provider ${provider.name} failed:`, err)
      }
    }
    return results
  }

  async getSubtitles(type: ContentType, id: string, opts?: { season?: number; episode?: number; lang?: string; infoHash?: string; fileIdx?: number; imdbId?: string }): Promise<{ providerName: string; subtitles: Subtitle[] }[]> {
    const results: { providerName: string; subtitles: Subtitle[] }[] = []
    for (const [, provider] of this.subtitleProviders) {
      try {
        const subs = await provider.getSubtitles(type, id, opts)
        console.log(`[ProviderRegistry] ${provider.name}: ${subs.length} subtitles`)
        if (subs.length > 0) {
          results.push({ providerName: provider.name, subtitles: subs })
          return results // first provider with subtitles wins
        }
      } catch (err) {
        console.warn(`[ProviderRegistry] Subtitle provider ${provider.name} failed:`, err)
      }
    }
    console.log(`[ProviderRegistry] All providers returned 0 subtitles for ${type}/${id}`)
    return results
  }

  getMetadataProviders(): MetadataProvider[] {
    return Array.from(this.metaProviders.values())
  }

  getStreamProviders(): StreamProvider[] {
    return Array.from(this.streamProviders.values())
  }

  getSubtitleProviders(): SubtitleProvider[] {
    return Array.from(this.subtitleProviders.values())
  }
}
