export type ResourceType = 'catalog' | 'meta' | 'stream' | 'subtitles' | 'addon_catalog'

export type ResourceEntry = ResourceType | { name: string; types?: string[]; idPrefixes?: string[] }

export interface Manifest {
  id: string
  version: string
  name: string
  description?: string
  logo?: string
  background?: string
  resources: ResourceEntry[]
  types: ContentType[]
  catalogs: CatalogDescriptor[]
  behaviorHints?: {
    adult?: boolean
    configurable?: boolean
    configurationRequired?: boolean
  }
}

export type ContentType = 'movie' | 'series' | 'channel' | 'tv'

export interface CatalogDescriptor {
  type: ContentType
  id: string
  name: string
  genres?: { name: string; slug: string }[]
  extra?: ExtraOption[]
}

export interface ExtraOption {
  name: string
  isRequired?: boolean
  options?: string[]
  optionsLimit?: number
}

export interface ExtraRequired {
  name: string
  isRequired?: boolean
}

export interface MetaItem {
  id: string
  type: ContentType
  name: string
  aliases?: string[]
  poster?: string
  posterShape?: 'poster' | 'landscape' | 'square'
  background?: string
  logo?: string
  description?: string
  releaseInfo?: string
  imdbRating?: string
  runtime?: string
  genres?: string[]
  cast?: { name: string; role?: string }[]
  director?: string[]
  writer?: string[]
  trailerStreams?: { title: string; url: string }[]
  videos?: VideoMeta[]
  links?: { name: string; category: string; url: string }[]
  behaviorHints?: {
    defaultVideoId?: string
    hasScheduledVideos?: boolean
  }
}

export interface VideoMeta {
  id: string
  title: string
  season?: number
  episode?: number
  released?: string
  thumbnail?: string
  overview?: string
  trailerStreams?: { title: string; url: string }[]
}

export interface Stream {
  url?: string
  infoHash?: string
  fileIdx?: number
  name?: string
  source?: string
  description?: string
  subtitles?: Record<string, string>
  behaviorHints?: {
    notWebReady?: boolean
    bingeGroup?: string
    proxyHeaders?: Record<string, string>
    videoHash?: string
    videoSize?: number
    filename?: string
  }
}

export interface Subtitle {
  id: string
  url: string
  lang: string
  name?: string
  downloads?: number
}

export interface AddonTransport {
  type: 'http' | 'local'
  url: string
}

export interface InstalledAddon {
  manifest: Manifest
  transport: AddonTransport
  installedAt: number
  system?: boolean
}
