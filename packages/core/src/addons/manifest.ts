import type { Manifest, ContentType, ResourceType } from './types.js'

const DEFAULT_RESOURCES: ResourceType[] = ['catalog', 'meta', 'stream']
const DEFAULT_TYPES: ContentType[] = ['movie', 'series']

export function createManifest(partial: Partial<Manifest> & { id: string; name: string; version: string }): Manifest {
  return {
    description: '',
    logo: '',
    background: '',
    resources: DEFAULT_RESOURCES,
    types: DEFAULT_TYPES,
    catalogs: [],
    ...partial,
  }
}
