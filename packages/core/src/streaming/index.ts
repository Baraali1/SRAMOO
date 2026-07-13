export interface TorrentStreamOpts {
  infoHash: string
  fileIdx?: number
  name?: string
}

export interface StreamServer {
  url: string
  infoHash?: string
}

// Torrent streaming engine abstraction
// In browser: uses WebTorrent (client-side)
// In Node.js: uses torrent-stream or webtorrent-hybrid

export function parseMagnet(uri: string): { infoHash: string; name?: string; trackers: string[] } | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'magnet:') return null
    const params = new URLSearchParams(url.pathname.slice(1))
    const xt = params.get('xt')
    if (!xt) return null
    const infoHash = xt.replace('urn:btih:', '').toLowerCase()
    const name = params.get('dn') || undefined
    const trackers = params.getAll('tr')
    return { infoHash, name, trackers }
  } catch {
    return null
  }
}

export function isTorrentStream(stream: { url?: string; infoHash?: string }): boolean {
  return !!(stream.infoHash || (stream.url && parseMagnet(stream.url)))
}

export function getStreamUrl(stream: { url?: string; infoHash?: string; fileIdx?: number }): string | null {
  if (stream.url) return stream.url
  if (stream.infoHash) {
    // Will be proxied through local server
    return `/api/stream/torrent/${stream.infoHash}${stream.fileIdx !== undefined ? `?fileIdx=${stream.fileIdx}` : ''}`
  }
  return null
}
