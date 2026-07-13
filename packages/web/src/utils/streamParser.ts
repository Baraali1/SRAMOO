import type { Stream } from '../api.js'

export interface ParsedStream extends Stream {
  quality?: '4K' | '1080p' | '720p' | '480p' | '360p' | string
  size?: string
  bytes?: number
  seeds?: number
  peers?: number
  language?: string
  codec?: string
  isHDR?: boolean
  isDubbed?: boolean
}

const QUALITY_PATTERNS = [
  { match: /\b(2160p|4k|uhd)\b/i, label: '4K' },
  { match: /\b(1080p|[^1]080[p]?|fhd)\b/i, label: '1080p' },
  { match: /\b(720p|hd)\b/i, label: '720p' },
  { match: /\b(480p|sd)\b/i, label: '480p' },
  { match: /\b(360p)\b/i, label: '360p' },
]

const SIZE_PATTERN = /\b(\d+(?:[.,]\d+)?)\s*(gb|gib|mb|mib)\b/i
const SEED_PATTERN = /\b(?:👤|seed(?:er)?s?|☠|↑)\s*:?\s*(\d+)\b/i
const PEER_PATTERN = /\b(?:peer(?:s)?|↓)\s*:?\s*(\d+)\b/i
const LANGUAGE_PATTERNS = [
  { match: /\b(arabic|عربي|ar)\b/i, label: 'Arabic' },
  { match: /\b(english|en)\b/i, label: 'English' },
  { match: /\b(french|fr|français)\b/i, label: 'French' },
  { match: /\b(german|de|deutsch)\b/i, label: 'German' },
  { match: /\b(spanish|es|español)\b/i, label: 'Spanish' },
  { match: /\b(turkish|tr|türkçe)\b/i, label: 'Turkish' },
  { match: /\b(hindi|hi)\b/i, label: 'Hindi' },
  { match: /\b(japanese|ja)\b/i, label: 'Japanese' },
  { match: /\b(korean|ko)\b/i, label: 'Korean' },
  { match: /\b(chinese|zh)\b/i, label: 'Chinese' },
  { match: /\b(russian|ru)\b/i, label: 'Russian' },
  { match: /\b(italian|it)\b/i, label: 'Italian' },
  { match: /\b(polish|pl)\b/i, label: 'Polish' },
  { match: /\b(dutch|nl)\b/i, label: 'Dutch' },
  { match: /\b(portuguese|pt)\b/i, label: 'Portuguese' },
]

const CODEC_PATTERNS = [
  { match: /\b(x265|hevc|h\.?265)\b/i, label: 'x265' },
  { match: /\b(x264|avc|h\.?264)\b/i, label: 'x264' },
  { match: /\b(av1)\b/i, label: 'AV1' },
  { match: /\b(vp9)\b/i, label: 'VP9' },
  { match: /\b(xvid|divx)\b/i, label: 'XviD' },
]

const HDR_PATTERN = /\b(hdr(?:10)?|dolby\s*vision|dv|hlg)\b/i
const DUBBED_PATTERN = /\b(dub(?:bed)?|مدبلج)\b/i

function extractText(stream: Stream): string {
  return [stream.name, stream.source, stream.description, stream.behaviorHints?.filename]
    .filter(Boolean)
    .join(' ')
}

export function parseStream(stream: Stream): ParsedStream {
  const text = extractText(stream)

  const quality = QUALITY_PATTERNS.find(p => p.match.test(text))
  const language = LANGUAGE_PATTERNS.find(p => p.match.test(text))
  const codec = CODEC_PATTERNS.find(p => p.match.test(text))
  const sizeMatch = text.match(SIZE_PATTERN)
  const seedsMatch = text.match(SEED_PATTERN)
  const peersMatch = text.match(PEER_PATTERN)

  let size: string | undefined
  if (sizeMatch) {
    const val = parseFloat(sizeMatch[1].replace(',', '.'))
    const unit = sizeMatch[2].toLowerCase()
    if (unit === 'gb' || unit === 'gib') size = `${val.toFixed(val % 1 === 0 ? 0 : 1)}GB`
    else if (unit === 'mb' || unit === 'mib') size = `${Math.round(val)}MB`
  }

  return {
    ...stream,
    quality: quality?.label,
    size,
    seeds: seedsMatch ? parseInt(seedsMatch[1], 10) : undefined,
    peers: peersMatch ? parseInt(peersMatch[1], 10) : undefined,
    language: language?.label,
    codec: codec?.label,
    isHDR: HDR_PATTERN.test(text),
    isDubbed: DUBBED_PATTERN.test(text),
  }
}
