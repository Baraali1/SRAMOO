import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AddonManager, AppDatabase, HttpAddonClient, ProviderRegistry } from '@sramo/core'
import { createAddonRouter } from './addons/router.js'
import { createApiRouter } from './api/index.js'
import { createAuthRouter } from './auth/routes.js'
import { connectDB } from './database/mongo.js'
import { tmdbProvider } from './providers/tmdb.js'
import { subtitleProvider } from './providers/subtitles.js'
import { yifySubtitleProvider } from './providers/subtitles-yify.js'
import { opensubtitlesProvider } from './providers/subtitles-opensubtitles.js'
import { subtitleAgentProvider, setTorrentLookup } from './providers/subtitles-agent.js'
import { wyzieSubtitleProvider } from './providers/subtitles-wyzie.js'
import { getActiveTorrent, getTorrentStatus } from './streaming/torrent.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load TMDB API key from config.js (created by the manual setup)
const configPath = path.join(__dirname, '../../../tmdb-client/config.js')
try {
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const match = configContent.match(/API_KEY:\s*'([^']+)'/)
  if (match) {
    process.env.TMDB_API_KEY = match[1]
    console.log('TMDB API key loaded from config.js')
  }
} catch {
  console.log('No config.js found at', configPath, '— TMDB provider will be inactive')
}

export interface SramoServerOpts {
  port?: number
  dbPath?: string
  webDistPath?: string
}

export class SramoServer {
  private app = express()
  private port: number
  private server: any
  private addonManager = new AddonManager()
  private db: AppDatabase
  private providerRegistry = new ProviderRegistry()

  constructor(opts: SramoServerOpts = {}) {
    this.port = opts.port || parseInt(process.env.PORT || '13470')
    this.db = new AppDatabase(opts.dbPath || path.join(__dirname, '../../..', 'sramo.db'))

    // Register providers (priority order: local agent → YIFY → v3 addon → Wyzie → OpenSubtitles → legacy)
    this.providerRegistry.registerMetadata(tmdbProvider)
    this.providerRegistry.registerSubtitles(subtitleAgentProvider)
    this.providerRegistry.registerSubtitles(yifySubtitleProvider)
    this.providerRegistry.registerSubtitles(wyzieSubtitleProvider)
    this.providerRegistry.registerSubtitles(opensubtitlesProvider)
    this.providerRegistry.registerSubtitles(subtitleProvider)

    // Connect SubtitleAgent to torrent module
    setTorrentLookup(getActiveTorrent)

    this.app.use(cors({ origin: '*', credentials: true }))
    this.app.use((_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
      next()
    })

    // Direct status endpoint (BEFORE json parser to rule out middleware issues)
    this.app.get('/api/torrent/:infoHash/status', (req, res) => {
      console.log('[Status] Handling status request for', req.params.infoHash)
      try {
        const ih = String(req.params.infoHash || '')
        const status = getTorrentStatus(ih)
        res.json(status || { infoHash: ih, progress: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, timeRemaining: 0, downloaded: 0, length: 0, ready: false, done: false })
      } catch (err: any) {
        console.error('[Status Direct Error]', err?.message || err)
        res.json({ infoHash: String(req.params.infoHash || ''), progress: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, timeRemaining: 0, downloaded: 0, length: 0, ready: false, done: false })
      }
    })

    this.app.use(express.json())

    // Request logging
    this.app.use((req, _res, next) => {
      console.log(`${req.method} ${req.url}`)
      next()
    })

    // Addon protocol router (Stremio-compatible)
    this.app.use('/addon', createAddonRouter(this.addonManager))

    // Auth router (MongoDB)
    this.app.use('/api/auth', createAuthRouter())

    // API router
    this.app.use('/api', createApiRouter(this.addonManager, this.db, this.providerRegistry))

    // Serve tmdb-client at /client
    const tmdbClientPath = path.join(__dirname, '../../../tmdb-client')
    this.app.use('/client', express.static(tmdbClientPath))

    // Serve web app (React build), fallback to tmdb-client at root
    const webDist = opts.webDistPath || path.join(process.cwd(), 'packages/web/dist')
    // If web dist doesn't exist locally, try the dev fallback
    const webDistFallback = path.join(__dirname, '../../web/dist')
    const finalWebDist = fs.existsSync(webDist) ? webDist : (fs.existsSync(webDistFallback) ? webDistFallback : webDist)
    this.app.use(express.static(finalWebDist))
    this.app.use((_req, res, next) => {
      const filePath = path.join(finalWebDist, 'index.html')
      res.sendFile(filePath, (err) => {
        if (err) {
          // Fallback: serve tmdb-client/index.html at root
          const fallback = path.join(tmdbClientPath, 'index.html')
          res.sendFile(fallback, (err2) => {
            if (err2) next()
          })
        }
      })
    })

    // Error handler
    this.app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error('Server error:', err)
      res.status(500).json({ error: String(err.message || err) })
    })
  }

  private async restoreAddons(): Promise<void> {
    try {
      await this.db.waitReady()
      const saved = this.db.getSavedAddons()
      for (const addon of saved) {
        this.addonManager.registerFromManifest(addon.manifest, addon.transport)
      }
    } catch {
      console.log('No saved addons to restore')
    }
  }

  private async ensureDefaultAddons(): Promise<void> {
    const defaults: { id: string; urls: string[]; name: string }[] = [
      {
        id: 'com.stremio.torrentio.addon',
        urls: ['https://torrentio.strem.fun', 'https://torrentio.whatever', 'https://torrentio.stremio.baby'],
        name: 'Torrentio',
      },
      {
        id: 'com.stremio.knightcrawler',
        urls: ['https://knightcrawler.elfhosted.com'],
        name: 'KnightCrawler',
      },
      {
        id: 'org.stremio.opensubtitles',
        urls: ['https://opensubtitles.strem.io', 'https://opensubtitles-v3.strem.io'],
        name: 'OpenSubtitles',
      },
    ]

    for (const addon of defaults) {
      if (this.addonManager.getAddon(addon.id)) continue
      if (this.addonManager.isSystemAddon(addon.id)) continue

      let loaded = false
      for (const url of addon.urls) {
        const cleanUrl = url.replace(/\/$/, '')
        console.log(`[Server] Trying system addon: ${addon.name} (${cleanUrl})`)
        try {
          const client = new HttpAddonClient(cleanUrl)
          const manifest = await client.getManifest()
          console.log(`[Server] System addon manifest received — ${addon.name}: resources=[${manifest.resources.map((r: any) => typeof r === 'string' ? r : r.name).join(',')}]`)
          this.addonManager.registerFromManifest(manifest, { type: 'http', url: cleanUrl }, true)
          console.log(`[Server] System addon registered: ${addon.name} @ ${cleanUrl}`)
          loaded = true
          break
        } catch (err) {
          console.warn(`[Server] Mirror failed for ${addon.name} (${cleanUrl}):`, err instanceof Error ? err.message : err)
        }
      }

      if (!loaded) {
        console.error(`[Server] All mirrors exhausted for system addon ${addon.name}`)
      }
    }
  }

  async start(): Promise<void> {
    await connectDB()
    await this.db.waitReady()
    await this.restoreAddons()
    await this.ensureDefaultAddons()

    const registered = this.addonManager.getInstalledAddons()
    console.log(`[Server] Registered addons (${registered.length}):`)
    for (const a of registered) {
      const resources = a.manifest.resources.map((r: any) => typeof r === 'string' ? r : r.name).join(', ')
      console.log(`  ${a.manifest.id} — resources=[${resources}] system=${!!a.system}`)
    }

    this.server = this.app.listen(this.port, () => {
      console.log(`SRAMO running on http://localhost:${this.port}`)
      console.log(`API: http://localhost:${this.port}/api`)
    })
    this.server.on('error', (err: Error) => {
      console.error('Server error:', err)
    })
  }

  stop(): void {
    if (this.server) this.server.close()
    this.db.close()
  }
}

// Start if run directly
const isMainModule = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))
process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason)
})

process.on('uncaughtException', (err: Error) => {
  console.error('Uncaught Exception:', err)
})

if (isMainModule) {
  const server = new SramoServer({ port: parseInt(process.env.PORT || '13470') })
  server.start().catch((err) => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}
