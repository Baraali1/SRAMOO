import type { Request, Response } from 'express'
import { spawn } from 'child_process'

let client: any = null
let initPromise: Promise<void> | null = null

const MAX_ACTIVE_TORRENTS = 20
const MAX_CONCURRENT_TRANSCODES = 5
let activeTranscodes = 0
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'C:\\Users\\albar\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe'
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'C:\\Users\\albar\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffprobe.exe'

async function ensureClient(): Promise<void> {
  if (client) return
  if (initPromise) return initPromise
  initPromise = (async () => {
    const wt = await import('webtorrent')
    const WebTorrent = wt.default || wt
    client = new WebTorrent({
      dht: {
        bootstrap: ['router.bittorrent.com:6881', 'dht.transmissionbt.com:6881', 'router.utorrent.com:6881']
      }
    })
    client.on('error', (e: any) => console.error('[WebTorrent] Client error:', e.message))
  })()
  return initPromise
}

const activeTorrents = new Map<string, any>()

export function getActiveTorrent(infoHash: string): any {
  return activeTorrents.get(infoHash.toLowerCase())
}
const torrentAccessTime = new Map<string, number>()

const TRACKERS = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.fastcast.nz',
  'wss://tracker.henker.com',
  'wss://tracker.bear.sh',
  'wss://tracker.nickkolok.com',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.webtorrent.dev',
  'wss://tracker.frosty.kiwi:443/announce',
  'wss://tracker.currant.io:443/announce',
  'wss://tracker.leechers-paradise.org:443/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.leechers-paradise.org:6969/announce',
  'udp://tracker.pirateparty.gr:6969/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://tracker.dler.org:6969/announce',
]

function magnetURI(infoHash: string, filename?: string): string {
  let uri = `magnet:?xt=urn:btih:${infoHash}`
  if (filename) uri += `&dn=${encodeURIComponent(filename)}`
  for (const tr of TRACKERS) {
    uri += `&tr=${encodeURIComponent(tr)}`
  }
  return uri
}

function evictLRU(): void {
  if (activeTorrents.size < MAX_ACTIVE_TORRENTS) return
  let oldest = ''
  let oldestTime = Infinity
  for (const [hash, _time] of torrentAccessTime) {
    if (_time < oldestTime) {
      oldestTime = _time
      oldest = hash
    }
  }
  if (oldest && activeTorrents.has(oldest)) {
    try { activeTorrents.get(oldest).destroy() } catch {}
    activeTorrents.delete(oldest)
    torrentAccessTime.delete(oldest)
  }
}

const MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  ts: 'video/mp2t',
  ogv: 'video/ogg',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
}

function mimeType(filename?: string): string {
  if (!filename) return 'video/mp4'
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return MIME_TYPES[ext] || 'video/mp4'
}

function extractInfoHash(magnet?: string): string {
  if (!magnet) return ''
  const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]+)/)
  return match ? match[1].toLowerCase() : ''
}

function pickBestFile(files: any[], preferredIdx: number): { file: any; idx: number } {
  if (files.length === 0) return { file: null, idx: -1 }
  if (preferredIdx >= 0 && preferredIdx < files.length) {
    const f = files[preferredIdx]
    if (f.length > 1024 * 1024) return { file: f, idx: preferredIdx }
  }
  // Score each file by container + audio codec + size
  let best = files[0]
  let bestIdx = 0
  let bestScore = -1
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const name = f.name || ''
    let score = 0
    // Container preference: mp4/m4v/webm > mkv > others
    if (/\.(mp4|m4v|webm)$/i.test(name)) score += 100
    else if (/\.mkv$/i.test(name)) score += 50
    else score += 10
    // Audio codec preference: AAC/Opus > PCM/FLAC/MP3 > AC3/EAC3 > DTS/TrueHD (unsupported in browser)
    if (/\b(aac|opus)\b/i.test(name)) score += 100
    else if (/\b(pcm|flac|mp3)\b/i.test(name)) score += 40
    else if (/\b(ac3|eac3|ddp)\b/i.test(name)) score -= 30
    else if (/\b(truehd|dts|dts-hd|dts:x|dts-es)\b/i.test(name)) score -= 200
    // Prefer larger files among same score
    score += Math.min(f.length / (1024 * 1024), 50) / 50 * 10
    if (score > bestScore) {
      best = f; bestIdx = i; bestScore = score
    }
  }
  return { file: best, idx: bestIdx }
}

function needsTranscode(filename: string): boolean {
  return /\b(truehd|dts|dts-hd|dts:x|dts-es|ac3|eac3|ddp)\b/i.test(filename)
}

function peerCount(torrent: any): number {
  return torrent.numPeers ?? (torrent.wires?.length ?? 0)
}

export function getTorrentFiles(infoHash: string): { name: string; idx: number; length: number }[] {
  const torrent = getActiveTorrent(infoHash)
  if (!torrent || !torrent.files) return []
  return torrent.files.map((f: any, idx: number) => ({ name: f.name || 'Unknown', idx, length: f.length }))
 }

export function getTorrentStatus(infoHash: string): any | null {
  const torrent = getActiveTorrent(infoHash)
  if (!torrent) return null
  return {
    infoHash,
    progress: torrent.progress ?? 0,
    downloadSpeed: torrent.downloadSpeed ?? 0,
    uploadSpeed: torrent.uploadSpeed ?? 0,
    numPeers: peerCount(torrent),
    timeRemaining: torrent.timeRemaining ?? 0,
    downloaded: torrent.downloaded ?? 0,
    length: torrent.length ?? 0,
    ready: !!torrent.ready,
    done: !!torrent.done,
  }
}

export async function streamTorrentHandler(req: Request, res: Response): Promise<void> {
  const magnetParam = req.query.magnet as string | undefined
  let infoHash = String(req.params.infoHash ?? '').toLowerCase()
  if (!infoHash && magnetParam) {
    infoHash = extractInfoHash(magnetParam)
  }
  let fileIdx = parseInt(req.query.fileIdx as string) || 0

  if (!infoHash) {
    res.status(400).json({ error: 'Missing infoHash or magnet query parameter' })
    return
  }

  const logId = infoHash.slice(0, 8)

  try {
    await ensureClient()
    let torrent = activeTorrents.get(infoHash)
    if (!torrent) {
      evictLRU()
      const uri = magnetURI(infoHash, req.query.filename as string)
      console.log(`[Torrent ${logId}] Adding new torrent: ${uri.slice(0, 80)}...`)
      try {
        torrent = client.add(uri)
        torrent.once('error', (e: any) => console.error(`[Torrent ${logId}] Torrent error:`, e?.message || e))
      } catch (addErr) {
        console.error(`[Torrent ${logId}] client.add() threw:`, addErr)
        res.status(500).json({ error: 'Failed to add torrent: ' + String(addErr) })
        return
      }
      activeTorrents.set(infoHash, torrent)
    }
    torrentAccessTime.set(infoHash, Date.now())

    let settled = false

    let peerLogInterval: ReturnType<typeof setInterval> | null = null

    const failWithError = (status: number, msg: string) => {
      settled = true
      if (peerLogInterval) clearInterval(peerLogInterval)
      console.error(`[Torrent ${logId}] ${msg}`)
      if (!res.headersSent) {
        res.status(status).json({ error: msg })
      }
    }

      const peerTimeout = setTimeout(() => {
        if (settled) return
        failWithError(504, 'No peers found after 8 seconds. The torrent may be dead or the file is unavailable.')
      }, 8000)

    peerLogInterval = setInterval(() => {
      if (torrent.ready && peerCount(torrent) > 0 && !settled) {
        clearTimeout(peerTimeout)
        clearInterval(peerLogInterval!)
        settled = true
        proceedStream()
      }
    }, 2000)

    function cleanup() {
      if (settled) return
      settled = true
      if (peerLogInterval) clearInterval(peerLogInterval)
      clearTimeout(peerTimeout)
    }

    function proceedStream(): void {
      if (res.destroyed) return
      const { file, idx } = pickBestFile(torrent.files, fileIdx)
      if (!file) {
        if (!res.headersSent) res.status(404).json({ error: 'No suitable video file found in torrent' })
        return
      }
      if (idx !== fileIdx) {
        fileIdx = idx
      }
      console.log(`[Torrent ${logId}] Selected file: #${idx} "${file.name}" (${(file.length / 1024 / 1024).toFixed(1)} MB)`)

      const range = req.headers.range
      const fileSize = file.length
      const filename = file.name || (req.query.filename as string) || ''
      const mime = mimeType(filename)
      const isIOSClient = /iPad|iPhone|iPod/i.test(req.headers['user-agent'] || '')
      const fileNeedsTranscode = needsTranscode(filename) || isIOSClient

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = end - start + 1

        if (chunkSize <= 1) {
          // Build transcode URL for probe response header
          const proto = req.headers['x-forwarded-proto'] || req.protocol
          const host = req.headers['x-forwarded-host'] || req.headers.host || ''
          const pathBase = `/api/stream/torrent/${infoHash}/transcode?fileIdx=${fileIdx}`
          const transcodeUrl = pathBase

          if (fileNeedsTranscode) console.log(`[Torrent ${logId}] File has unsupported audio, offering transcode URL`)

          const stream = file.createReadStream({ start: 0, end: 0 })
          let probeSettled = false
          const probeDone = () => {
            if (probeSettled) return
            probeSettled = true
            clearTimeout(probeTimeout)
            stream.destroy()
            cleanup()
          }
          const probeTimeout = setTimeout(() => {
            if (probeSettled) return
            console.log(`[Torrent ${logId}] Probe timed out after 10s`)
            probeDone()
            if (!res.headersSent) res.status(504).json({ error: 'Probe timed out' })
      }, 15000)
          stream.once('data', (chunk: Buffer) => {
            if (probeSettled) return
            probeDone()
            if (!res.headersSent) {
              const headers: Record<string, string | number> = {
                'Content-Range': `bytes 0-0/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': 1,
                'Content-Type': mime,
              }
              if (fileNeedsTranscode) {
                headers['X-Needs-Transcode'] = 'true'
                headers['X-Transcode-Url'] = transcodeUrl
              }
              res.writeHead(206, headers)
            }
            res.end(chunk.slice(0, 1))
          })
          stream.once('end', () => {
            if (probeSettled) return
            probeDone()
            if (!res.headersSent) {
              const headers: Record<string, string | number> = {
                'Content-Range': `bytes 0-0/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': 1,
                'Content-Type': mime,
              }
              if (fileNeedsTranscode) {
                headers['X-Needs-Transcode'] = 'true'
                headers['X-Transcode-Url'] = transcodeUrl
              }
              res.writeHead(206, headers)
            }
            res.end(Buffer.alloc(1))
          })
          stream.once('error', () => {
            if (probeSettled) return
            probeDone()
            if (!res.headersSent) res.status(500).json({ error: 'Stream read error' })
          })
          res.on('close', () => {
            stream.destroy()
            if (!probeSettled) { probeSettled = true; clearTimeout(probeTimeout); cleanup() }
          })
          return
        }

        if (!res.headersSent) {
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mime,
          })
        }

        const stream = file.createReadStream({ start, end })
        stream.pipe(res)
        stream.on('error', (err: Error) => {
          console.error(`[Torrent ${logId}] Stream error (range):`, err.message)
          if (!res.destroyed) res.destroy()
        })
        res.on('close', () => {
          stream.destroy()
          cleanup()
        })
      } else {
        if (!res.headersSent) {
          const headers: Record<string, string | number> = {
            'Content-Length': fileSize,
            'Content-Type': mime,
            'Accept-Ranges': 'bytes',
          }
          if (fileNeedsTranscode) {
            headers['X-Needs-Transcode'] = 'true'
            headers['X-Transcode-Url'] = `/api/stream/torrent/${infoHash}/transcode?fileIdx=${fileIdx}`
          }
          res.writeHead(200, headers)
        }

        const stream = file.createReadStream()
        stream.pipe(res)
        stream.on('error', (err: Error) => {
          console.error(`[Torrent ${logId}] Stream error (full):`, err.message)
          if (!res.destroyed) res.destroy()
        })
        res.on('close', () => {
          stream.destroy()
          cleanup()
        })
      }
    }

    req.on('close', () => {
      if (settled) return
      cleanup()
      console.log(`[Torrent ${logId}] Client disconnected`)
    })

    const onError = (err: Error) => {
      if (settled) return
      cleanup()
      console.error(`[Torrent ${logId}] Error:`, err.message)
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) })
      }
    }

    const onMetadata = () => {
      if (settled) return
      if (peerCount(torrent) > 0) {
        clearTimeout(peerTimeout)
        clearInterval(peerLogInterval!)
        settled = true
        proceedStream()
      }
    }

    if (torrent.ready) {
      onMetadata()
    } else {
      torrent.once('metadata', onMetadata)
    }
    torrent.once('error', onError)
  } catch (err) {
    console.error(`[Torrent ${logId}] Stream handler error:`, err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' })
    }
  }
}

export function transcodeTorrentHandler(req: Request, res: Response): void {
  const magnetParam = req.query.magnet as string | undefined
  let infoHash = String(req.params.infoHash ?? '').toLowerCase()
  if (!infoHash && magnetParam) {
    infoHash = extractInfoHash(magnetParam)
  }
  let fileIdx = parseInt(req.query.fileIdx as string) || 0

  if (!infoHash) {
    res.status(400).json({ error: 'Missing infoHash' })
    return
  }

  const logId = infoHash.slice(0, 8)

  ;(async () => {
    try {
      await ensureClient()
      let torrent = activeTorrents.get(infoHash)
      if (!torrent) {
        evictLRU()
        const uri = magnetURI(infoHash, req.query.filename as string)
        console.log(`[Transcode ${logId}] Adding torrent: ${uri.slice(0, 80)}...`)
        torrent = client.add(uri)
        torrent.once('error', (e: any) => console.error(`[Transcode ${logId}] Torrent error:`, e?.message || e))
        torrent.on('warning', (e: any) => console.warn(`[Transcode ${logId}] Warning:`, e?.message || e))
        torrent.on('peer', () => {
          console.log(`[Transcode ${logId}] New peer connected, total peers: ${peerCount(torrent)}`)
        })
        let readyLogged = false
        torrent.on('ready', () => {
          readyLogged = true
          console.log(`[Transcode ${logId}] Torrent ready, ${torrent.files.length} files, ${(torrent.length / 1024 / 1024).toFixed(0)} MB`)
        })
        setTimeout(() => {
          if (!readyLogged) console.log(`[Transcode ${logId}] Still not ready after 10s, wires=${torrent.wires?.length ?? 0}, numPeers=${torrent.numPeers ?? 0}`)
        }, 10000)
        activeTorrents.set(infoHash, torrent)
      }
      torrentAccessTime.set(infoHash, Date.now())

      let settled = false

      const failWithError = (status: number, msg: string) => {
        settled = true
        console.error(`[Transcode ${logId}] ${msg}`)
        if (!res.headersSent) res.status(status).json({ error: msg })
      }

      let metaWaitLogged = false
      const metaTimeout = setTimeout(() => {
        if (settled) return
        if (torrent.ready) {
          console.log(`[Transcode ${logId}] No peers but metadata ready, proceeding anyway`)
          settled = true
          proceedTranscode()
        } else {
          failWithError(504, 'Torrent metadata not available after 15 seconds')
        }
      }, 10000)

      let peerLogs = 0
      const peerInterval = setInterval(() => {
        const pc = peerCount(torrent)
        const ready = torrent.ready
        if (peerLogs < 5 || (ready && pc > 0)) {
          console.log(`[Transcode ${logId}] Poll: ready=${ready} peers=${pc}`)
          peerLogs++
        }
        if (ready && pc > 0 && !settled) {
          clearTimeout(metaTimeout)
          clearInterval(peerInterval)
          settled = true
          proceedTranscode()
        } else if (ready && !settled && pc > 0 === false) {
          metaWaitLogged = true
        }
      }, 2000)

      const cleanup = () => {
        if (settled) return
        settled = true
        clearInterval(peerInterval)
        clearTimeout(metaTimeout)
      }

      async function proceedTranscode(): Promise<void> {
        if (res.destroyed) return
        if (activeTranscodes >= MAX_CONCURRENT_TRANSCODES) {
          console.log(`[Transcode ${logId}] Too many active transcodes (${activeTranscodes}), queuing`)
          failWithError(503, 'Too many concurrent transcodes, try again')
          return
        }
        const { file, idx } = pickBestFile(torrent.files, fileIdx)
        if (!file) {
          if (!res.headersSent) res.status(404).json({ error: 'No suitable video file found' })
          return
        }
        if (idx !== fileIdx) fileIdx = idx
        console.log(`[Transcode ${logId}] File: #${idx} "${file.name}" (${(file.length / 1024 / 1024).toFixed(1)} MB)`)

        const range = req.headers.range
        // Probe request: respond with 1 byte (no transcode)
        if (range) {
          const parts = range.replace(/bytes=/, '').split('-')
          const start = parseInt(parts[0], 10)
          const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1
          const chunkSize = end - start + 1
          if (chunkSize <= 1) {
            const s = file.createReadStream({ start: 0, end: 0 })
            let done = false
            const markDone = () => { if (!done) { done = true; clearTimeout(pt); s.destroy(); cleanup() } }
            const pt = setTimeout(() => { markDone(); if (!res.headersSent) res.status(504).json({ error: 'Probe timed out' }) }, 10000)
            s.once('data', (chunk: Buffer) => { if (!done) { markDone(); if (!res.headersSent) { res.writeHead(206, { 'Content-Range': `bytes 0-0/${file.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': 1, 'Content-Type': 'video/mp4' }) } res.end(chunk.slice(0, 1)) } })
            s.once('end', () => { if (!done) { markDone(); if (!res.headersSent) { res.writeHead(206, { 'Content-Range': `bytes 0-0/${file.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': 1, 'Content-Type': 'video/mp4' }) } res.end(Buffer.alloc(1)) } })
            s.once('error', () => { if (!done) { markDone(); if (!res.headersSent) res.status(500).json({ error: 'Stream read error' }) } })
            res.on('close', () => { s.destroy(); if (!done) { done = true; clearTimeout(pt); cleanup() } })
            return
          }
          // Ignore large range requests — serve full transcoded stream
        }

        // Spawn ffmpeg: copy video, convert audio to AAC, output fragmented MP4
        const startTime = parseFloat(req.query.start as string) || 0
        let readStream
        if (startTime > 0) {
          // Probe file duration via piped stream (timeout 5s)
          const probeStream = file.createReadStream({ start: 0, end: Math.min(file.length - 1, 2 * 1024 * 1024) })
          const duration = await Promise.race([
            new Promise<number>((resolve) => {
              const p = spawn(FFPROBE_PATH, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'pipe:0'], { stdio: ['pipe', 'pipe', 'pipe'] })
              let out = ''
              p.stdout.on('data', (d: Buffer) => { out += d.toString() })
              p.on('close', () => resolve(parseFloat(out) || 0))
              probeStream.pipe(p.stdin)
              probeStream.on('error', () => p.stdin.end())
            }),
            new Promise<number>(resolve => setTimeout(() => { probeStream.destroy(); resolve(0) }, 3000)),
          ])
          if (duration > 0) {
            const ratio = startTime / duration
            let byteOffset = Math.floor(ratio * file.length)
            const margin = Math.min(Math.floor(file.length * 0.03), 5 * 1024 * 1024)
            byteOffset = Math.max(0, byteOffset - margin)
            readStream = file.createReadStream({ start: byteOffset })
            console.log(`[Transcode ${logId}] Fast seek to ${startTime}s (offset ${byteOffset} / ${file.length}, dur=${duration.toFixed(1)}s)`)
          } else {
            readStream = file.createReadStream()
          }
        } else {
          readStream = file.createReadStream()
        }
        const forceVideoTranscode = /iPad|iPhone|iPod/i.test(req.headers['user-agent'] || '')
        const ffmpegArgs: string[] = [
          '-re', '-i', 'pipe:0',
          ...(forceVideoTranscode ? ['-c:v', 'h264_nvenc', '-preset', 'p1', '-cq', '28', '-profile:v', 'main', '-level', '41', '-pix_fmt', 'yuv420p', '-g', '24', '-keyint_min', '24', '-bf', '0'] : ['-c:v', 'copy']),
          '-c:a', 'aac', '-b:a', '256k', '-f', 'mp4', '-movflags', '+frag_keyframe+empty_moov', '-max_muxing_queue_size', '1024', '-y', 'pipe:1',
        ]
        const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

        let ffmpegStderr = ''
        ffmpeg.stderr.on('data', (d: Buffer) => { ffmpegStderr += d.toString() })
        ffmpeg.on('error', (e: Error) => {
          console.error(`[Transcode ${logId}] FFmpeg error:`, e.message)
          if (!res.headersSent) res.status(500).json({ error: 'FFmpeg failed: ' + e.message })
        })
        ffmpeg.on('close', (code) => {
          if (code !== 0 && !res.headersSent) {
            console.error(`[Transcode ${logId}] FFmpeg exited with code ${code}:\n${ffmpegStderr.slice(-500)}`)
            res.status(500).json({ error: `FFmpeg exited with code ${code}` })
          }
        })

        console.log(`[Transcode ${logId}] Streaming through ffmpeg (${forceVideoTranscode ? 'video→NVENC H.264 + audio→AAC' : 'audio→AAC'})`)

        if (!res.headersSent) {
          res.writeHead(200, {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'none',
            'X-Transcode': forceVideoTranscode ? 'full' : 'aac',
          })
        }
        ffmpeg.stdout.pipe(res)
        if (readStream) readStream.pipe(ffmpeg.stdin)

        activeTranscodes++
        console.log(`[Transcode ${logId}] Active transcodes: ${activeTranscodes}`)

        const safeCleanup = () => {
          try { ffmpeg.kill('SIGKILL') } catch {}
          try { readStream?.destroy() } catch {}
          cleanup()
          activeTranscodes = Math.max(0, activeTranscodes - 1)
        }
        const onClientClose = safeCleanup
        res.on('close', onClientClose)
        res.on('error', onClientClose)
        readStream.on('error', (e: Error) => {
          console.error(`[Transcode ${logId}] Read error:`, e.message)
          safeCleanup()
        })
      }

      req.on('close', () => { if (!settled) { cleanup() } })

      const onError = (err: Error) => {
        if (settled) return
        cleanup()
        console.error(`[Transcode ${logId}] Error:`, err.message)
        if (!res.headersSent) res.status(500).json({ error: String(err) })
      }

      torrent.once('error', onError)
    } catch (err) {
      console.error(`[Transcode ${logId}] Handler error:`, err)
      if (!res.headersSent) res.status(500).json({ error: 'Transcoding failed' })
    }
  })()
}

setInterval(() => {
  const now = Date.now()
  for (const [hash, lastAccess] of torrentAccessTime) {
    if (now - lastAccess > 600000) {
      try { activeTorrents.get(hash)?.destroy() } catch {}
      activeTorrents.delete(hash)
      torrentAccessTime.delete(hash)
    }
  }
}, 300000)
