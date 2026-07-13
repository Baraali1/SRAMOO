import { Router, type Request, type Response } from 'express'
import type { AddonManager } from '@sramo/core'
import { BuiltinAddon } from './builtin.js'
import type { ContentType } from '@sramo/core'

function p(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : (val ?? '')
}

export function createAddonRouter(addonManager: AddonManager): Router {
  const router = Router()
  const builtin = new BuiltinAddon()

  addonManager.registerFromManifest(builtin.manifest, { type: 'local', url: '' })

  router.get('/:id/manifest.json', (req: Request, res: Response) => {
    const addon = addonManager.getAddon(p(req.params.id))
    if (!addon) {
      res.status(404).json({ error: 'Addon not found' })
      return
    }
    res.json(addon.manifest)
  })

  router.get('/:id/catalog/:type/:catalogId.json', async (req: Request, res: Response) => {
    const id = p(req.params.id)
    const type = p(req.params.type) as ContentType
    const catalogId = p(req.params.catalogId)
    const addon = addonManager.getAddon(id)
    if (!addon) {
      res.status(404).json({ error: 'Addon not found' })
      return
    }

    try {
      const search = String(req.query.search ?? '')
      const extra = search ? { search } : undefined

      if (id === 'org.sramo.builtin') {
        const result = await builtin.getCatalog(type, catalogId)
        res.json(result)
        return
      }

      const client = addonManager.getClientFor(id)
      if (!client) {
        res.status(500).json({ error: 'No client for addon' })
        return
      }
      const result = await client.getCatalog(type, catalogId, extra)
      res.json(result)
    } catch (err) {
      console.error('Catalog fetch failed:', req.url, err)
      res.status(500).json({ error: 'Failed to fetch catalog' })
    }
  })

  router.get('/:id/meta/:type/:metaId.json', async (req: Request, res: Response) => {
    const id = p(req.params.id)
    const type = p(req.params.type) as ContentType
    const metaId = p(req.params.metaId)
    const addon = addonManager.getAddon(id)
    if (!addon) {
      res.status(404).json({ error: 'Addon not found' })
      return
    }

    try {
      if (id === 'org.sramo.builtin') {
        const result = await builtin.getMeta(type, metaId)
        if (!result) {
          res.status(404).json({ error: 'Not found' })
          return
        }
        res.json(result)
        return
      }

      const client = addonManager.getClientFor(id)
      if (!client) {
        res.status(500).json({ error: 'No client for addon' })
        return
      }
      const result = await client.getMeta(type, metaId)
      res.json(result)
    } catch (err) {
      console.error('Meta fetch failed:', req.url, err)
      res.status(500).json({ error: 'Failed to fetch metadata' })
    }
  })

  router.get('/:id/stream/:type/*fullPath', async (req: Request, res: Response) => {
    const id = p(req.params.id)
    const type = p(req.params.type) as ContentType
    const fp = req.params.fullPath
    const fullPath = (Array.isArray(fp) ? fp.join('/') : (fp ?? ''))
    const streamId = decodeURIComponent(fullPath.replace(/\.json$/, ''))
    const addon = addonManager.getAddon(id)
    if (!addon) {
      res.status(404).json({ error: 'Addon not found' })
      return
    }

    try {
      if (id === 'org.sramo.builtin') {
        const result = await builtin.getStream(type, streamId)
        res.json(result)
        return
      }

      const client = addonManager.getClientFor(id)
      if (!client) {
        res.status(500).json({ error: 'No client for addon' })
        return
      }
      const baseUrl = (client as any).baseUrl || 'unknown'
      const upstreamUrl = `${baseUrl}/stream/${type}/${streamId}.json`
      console.log(`[AddonRouter] Proxying stream: ${upstreamUrl}`)
      const result = await client.getStream(type, streamId)
      res.json(result)
    } catch (err) {
      console.error('Stream fetch failed:', req.url, err)
      res.status(500).json({ error: 'Failed to fetch streams' })
    }
  })

  router.get('/:addonId/subtitles/:type/:mediaId', async (req: Request, res: Response) => {
    const addonId = p(req.params.addonId)
    const type = p(req.params.type) as ContentType
    const mediaId = p(req.params.mediaId)
    const addon = addonManager.getAddon(addonId)
    if (!addon) { res.status(404).json({ error: 'Addon not found' }); return }

    try {
      if (addonId === 'org.sramo.builtin') {
        res.json({ subtitles: [] })
        return
      }
      const client = addonManager.getClientFor(addonId)
      if (!client) { res.status(500).json({ error: 'No client for addon' }); return }
      const result = await client.getSubtitles(type, mediaId)
      // Rewrite URLs through server proxy to avoid CORS
      if (result?.subtitles) {
        result.subtitles = result.subtitles.map((sub: any) => ({
          ...sub,
          url: sub.url?.startsWith('http')
            ? `/api/subtitle-file?url=${encodeURIComponent(sub.url)}`
            : sub.url,
        }))
      }
      res.json(result)
    } catch (err) {
      console.error('Subtitles fetch failed:', req.url, err)
      res.status(500).json({ error: 'Failed to fetch subtitles' })
    }
  })

  return router
}
