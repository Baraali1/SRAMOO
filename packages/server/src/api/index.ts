// @ts-nocheck
import { Router, Request, Response } from 'express';
import { streamTorrentHandler, transcodeTorrentHandler, getTorrentFiles, getTorrentStatus, getActiveTorrent } from '../streaming/torrent.js';
import { downloadSubtitle } from '../providers/subtitles-opensubtitles.js';
import fs from 'fs';
import path from 'path';
const SUB_CACHE_DIR = path.resolve(import.meta.dirname, '../../cache/subs');
function p(val: any): string {
    if (typeof val === 'string')
        return val;
    if (Array.isArray(val))
        return String(val[0] ?? '');
    return '';
}
function convertSrtToVtt(srt: string): string {
    const vtt = srt
        .replace(/\r\n/g, '\n')
        .replace(/(\d{2}:\d{2}:\d{2})[,.](\d{3})/g, '$1.$2');
    return `WEBVTT\n\n${vtt}`;
}
function cleanSubtitleText(text: string): string {
    const adPatterns = [
        /www\.osdb\.link\S*/gi,
        /watch\s+online\s+(movies|series|films?)\s+(and|for)\s+free/gi,
        /subtitles?\s+(by|powered\s+by|provided\s+by|from)\s+\S+/gi,
        /download(ed)?\s+(from|at)\s+\S+/gi,
        /visit\s+us\s+at\s+\S+/gi,
        /opensubtitles/i,
        /open\s+subtitles/i,
        /\S+\.org\/en\/(subtitles|search)/gi,
        /please\s+(visit|check|see)\s+\S+/gi,
    ];
    const lines = text.split('\n');
    const cleaned = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed)
            return true;
        for (const pattern of adPatterns) {
            if (pattern.test(trimmed)) {
                pattern.lastIndex = 0;
                return false;
            }
        }
        return true;
    });
    return cleaned.join('\n');
}
export function createApiRouter(addonManager: any, db: any, registry: any) {
    const router = Router();

    // Torrent status (direct route on app handles this, this is fallback)
    router.get('/torrent/:infoHash/status', (req, res) => {
        try {
            const ih = String(req.params.infoHash || '');
            const status = getTorrentStatus(ih);
            res.json(status || { infoHash: ih, progress: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, timeRemaining: 0, downloaded: 0, length: 0, ready: false, done: false });
        } catch { res.json({ infoHash: String(req.params.infoHash || ''), progress: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, timeRemaining: 0, downloaded: 0, length: 0, ready: false, done: false }) }
    });

    router.get('/torrent/:infoHash/files', (req, res) => {
        const files = getTorrentFiles(p(req.params.infoHash));
        res.json({ files });
    });

    // --- Library ---
    router.get('/library', (_req, res) => {
        res.json(db.getLibrary());
    });
    router.post('/library', (req, res) => {
        const { id, type, name, poster } = req.body;
        if (!id || !type || !name) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        db.addToLibrary({ id, type, name, poster, added_at: Date.now(), updated_at: Date.now() });
        res.json({ success: true });
    });
    router.delete('/library/:id', (req, res) => {
        db.removeFromLibrary(p(req.params.id));
        res.json({ success: true });
    });
    router.get('/library/:id', (req, res) => {
        res.json({ inLibrary: db.isInLibrary(p(req.params.id)) });
    });
    // --- Watch History ---
    router.get('/history', (_req, res) => {
        res.json(db.getHistory());
    });
    router.post('/history', (req, res) => {
        const { item_id, type, name, poster, progress = 0, duration = 0, video_id, stream_info_hash, stream_file_idx } = req.body;
        db.addToHistory({
            item_id,
            type,
            name,
            poster,
            watched_at: Date.now(),
            progress,
            duration,
            video_id,
            stream_info_hash,
            stream_file_idx: stream_file_idx != null ? Number(stream_file_idx) : undefined,
        });
        res.json({ success: true });
    });
    router.put('/history/:itemId/progress', (req, res) => {
        const { progress, video_id } = req.body;
        db.updateProgress(p(req.params.itemId), video_id, progress);
        res.json({ success: true });
    });
    router.get('/history/:itemId/progress', (req, res) => {
        const videoId = p(req.query.video_id) || undefined;
        const progress = db.getProgress(p(req.params.itemId), videoId);
        res.json(progress ?? { progress: 0, duration: 0 });
    });
    // --- Bookmarks ---
    router.get('/bookmarks', (_req, res) => {
        res.json(db.getBookmarks());
    });
    router.post('/bookmarks', (req, res) => {
        const { id, type, name, poster } = req.body;
        if (!id || !type || !name) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        db.addBookmark(id, type, name, poster);
        res.json({ success: true });
    });
    router.delete('/bookmarks/:id', (req, res) => {
        db.removeBookmark(p(req.params.id));
        res.json({ success: true });
    });
    router.get('/bookmarks/:id', (req, res) => {
        res.json({ bookmarked: db.isBookmarked(p(req.params.id)) });
    });
    // --- Addons ---
    router.get('/addons', (_req, res) => {
        const addons = addonManager.getInstalledAddons();
        res.json(addons.map((a) => ({ ...a.manifest, system: a.system || false })));
    });
    router.post('/addons/install', async (req, res) => {
        const { url } = req.body;
        if (!url) {
            res.status(400).json({ error: 'URL is required' });
            return;
        }
        try {
            const manifest = await addonManager.installRemote(url);
            db.saveAddon(addonManager.getAddon(manifest.id));
            res.json({ success: true, manifest });
        }
        catch (err) {
            console.error('Install addon failed:', url, err);
            res.status(500).json({ error: String(err) });
        }
    });
    router.delete('/addons/:id', (req, res) => {
        const id = p(req.params.id);
        if (addonManager.isSystemAddon(id)) {
            res.status(403).json({ error: 'Cannot uninstall system addon' });
            return;
        }
        addonManager.uninstall(id);
        db.removeAddon(id);
        res.json({ success: true });
    });
    // --- Streams ---
    router.get('/streams/:type/:id', async (req, res) => {
        try {
            const streams = await addonManager.getStreams(p(req.params.type), p(req.params.id));
            res.json({ streams });
        }
        catch (err) {
            console.error('Get streams failed:', p(req.params.type), p(req.params.id), err);
            res.status(500).json({ error: 'Failed to get streams' });
        }
    });
    // --- Smart stream grouping: best per quality tier ---
    router.get('/streams/best/:type/:id', async (req, res) => {
        try {
            const all = await addonManager.getStreams(p(req.params.type), p(req.params.id));
            const flat = all.flatMap((g) => (g.streams || []).map((s) => ({ ...s, _addon: g.addonName })));
            const qualityRegex = { uhd: /\b(2160p|4k|uhd)\b/i, hd: /\b(1080p|fhd)\b/i, sd: /\b(720p|hd|480p|sd|360p)\b/i, hdr: /\b(hdr|dolby.?vision|dv)\b/i };
            const sizeRegex = /\b(\d+(?:[.,]\d+)?)\s*(GB|GiB|MB|MiB)\b/i;
            const seedRegex = /(?:👤|seeds?|☠|↑)\s*:?\s*(\d+)/i;
            function parseMeta(s) {
                const text = [s.name, s.description, s.source, s.behaviorHints?.filename].filter(Boolean).join(' ');
                const size = text.match(sizeRegex);
                const seeds = text.match(seedRegex);
                return {
                    ...s,
                    _size: size ? `${size[1]}${size[2]}` : null,
                    _seeds: seeds ? parseInt(seeds[1]) : 0,
                    _is4K: qualityRegex.uhd.test(text),
                    _isHD: qualityRegex.hd.test(text),
                    _isHDR: qualityRegex.hdr.test(text),
                };
            }
            const parsed = flat.map(parseMeta).filter((s) => s.infoHash || s.url);
            const pick = (filter) => {
                const candidates = parsed.filter(filter).sort((a, b) => b._seeds - a._seeds);
                return candidates[0] || null;
            };
            const result = { streams: [] };
            const uhd = pick((s) => s._is4K);
            if (uhd)
                result.uhd = { infoHash: uhd.infoHash, fileIdx: uhd.fileIdx, url: uhd.url, name: uhd.name, quality: uhd._isHDR ? '4K HDR' : '4K', size: uhd._size, seeds: uhd._seeds, addon: uhd._addon };
            const hd = pick((s) => s._isHD && !s._is4K);
            if (hd)
                result.hd = { infoHash: hd.infoHash, fileIdx: hd.fileIdx, url: hd.url, name: hd.name, quality: '1080p', size: hd._size, seeds: hd._seeds, addon: hd._addon };
            const sd = pick((s) => !s._is4K && !s._isHD);
            if (sd)
                result.sd = { infoHash: sd.infoHash, fileIdx: sd.fileIdx, url: sd.url, name: sd.name, quality: '720p', size: sd._size, seeds: sd._seeds, addon: sd._addon };
            result.streams = parsed.slice(0, 20).map((s) => ({
                infoHash: s.infoHash, fileIdx: s.fileIdx, url: s.url, name: s.name, quality: s._is4K ? '4K' : s._isHD ? '1080p' : '720p',
                size: s._size, seeds: s._seeds, addon: s._addon,
            }));
            res.json(result);
        }
        catch (err) {
            console.error('Best streams failed:', err);
            res.status(500).json({ error: 'Failed to get streams' });
        }
    });
    // --- Subtitles ---
    router.get('/subtitles/:type/:id', async (req, res) => {
        try {
            const subtitles = await addonManager.getSubtitles(p(req.params.type), p(req.params.id));
            res.json({ subtitles });
        }
        catch (err) {
            console.error('Get subtitles failed:', p(req.params.type), p(req.params.id), err);
            res.status(500).json({ error: 'Failed to get subtitles' });
        }
    });
    // --- Subtitle Proxy (convert subtitle provider URLs to local) ---
    router.get('/subtitle-file', async (req, res) => {
        const url = String(req.query.url ?? '');
        if (!url) {
            res.status(400).json({ error: 'Missing url' });
            return;
        }
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) {
                res.status(502).json({ error: 'Failed to fetch subtitle' });
                return;
            }
            // Handle ZIP files (e.g. YIFY subtitles)
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('zip') || url.endsWith('.zip')) {
                const buffer = Buffer.from(await response.arrayBuffer());
                const { default: yauzl } = await import('yauzl');
                const srtText = await new Promise((resolve, reject) => {
                    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
                        if (err || !zipfile) {
                            reject(err || new Error('No zipfile'));
                            return;
                        }
                        zipfile.readEntry();
                        zipfile.on('entry', (entry) => {
                            if (!entry.fileName.endsWith('.srt')) {
                                zipfile.readEntry();
                                return;
                            }
                            const chunks = [];
                            zipfile.openReadStream(entry, (err2, readStream) => {
                                if (err2) {
                                    reject(err2);
                                    return;
                                }
                                readStream.on('data', (chunk) => chunks.push(chunk));
                                readStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
                                readStream.on('error', reject);
                            });
                        });
                        zipfile.on('end', () => reject(new Error('No SRT file found in ZIP')));
                        zipfile.on('error', reject);
                    });
                });
                const vtt = convertSrtToVtt(cleanSubtitleText(srtText));
                res.set('Content-Type', 'text/vtt; charset=utf-8');
                res.set('Access-Control-Allow-Origin', '*');
                res.send(vtt);
                return;
            }
            const text = await response.text();
            res.set('Content-Type', 'text/vtt; charset=utf-8');
            res.set('Access-Control-Allow-Origin', '*');
            const cleaned = cleanSubtitleText(text);
            res.send(cleaned.startsWith('WEBVTT') ? cleaned : convertSrtToVtt(cleaned));
        }
        catch (err) {
            res.status(502).json({ error: String(err) });
        }
    });
    // --- Provider-based endpoints ---
    if (registry) {
        router.get('/providers/subtitles/:type/:id', async (req, res) => {
            try {
                const subsArr = await Promise.race([
                    registry.getSubtitles(p(req.params.type), p(req.params.id), {
                        season: req.query.season ? parseInt(String(req.query.season)) : undefined,
                        episode: req.query.episode ? parseInt(String(req.query.episode)) : undefined,
                        lang: p(req.query.lang) || undefined,
                        infoHash: p(req.query.infoHash) || undefined,
                        fileIdx: req.query.fileIdx ? parseInt(String(req.query.fileIdx)) : undefined,
                        imdbId: p(req.query.imdbId) || undefined,
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), 8000)),
                ]);
                const flat = subsArr.flatMap((s) => s.subtitles.map((sub) => ({
                    ...sub,
                    url: sub.url?.startsWith('http')
                        ? `/api/subtitle-file?url=${encodeURIComponent(sub.url || '')}`
                        : (sub.url || ''),
                })));
                res.json({ subtitles: flat });
            }
            catch (err) {
                console.error('Provider subtitles failed:', p(req.params.type), p(req.params.id), err);
                res.status(500).json({ error: 'Failed to fetch subtitles' });
            }
        });
        router.get('/providers/meta/:type/:id', async (req, res) => {
            try {
                const meta = await registry.getMeta(p(req.params.type), p(req.params.id));
                res.json({ meta });
            }
            catch (err) {
                console.error('Provider meta failed:', p(req.params.type), p(req.params.id), err);
                res.status(500).json({ error: 'Failed to fetch metadata' });
            }
        });
        router.get('/providers/streams/:type/:id', async (req, res) => {
            try {
                const results = await registry.getStreams(p(req.params.type), p(req.params.id));
                const flat = results.flatMap((r) => r.streams);
                res.json({ streams: flat });
            }
            catch (err) {
                console.error('Provider streams failed:', p(req.params.type), p(req.params.id), err);
                res.status(500).json({ error: 'Failed to fetch streams' });
            }
        });
        router.get('/providers/search', async (req, res) => {
            const query = String(req.query.q ?? '');
            if (!query || query.length < 2) {
                res.json({ results: [] });
                return;
            }
            try {
                const results = await registry.search(query);
                res.json({ results });
            }
            catch (err) {
                console.error('Provider search failed:', query, err);
                res.status(500).json({ error: 'Search failed' });
            }
        });
    }
    // --- Continue Watching ---
    router.get('/continue-watching', (_req, res) => {
        try {
            const history = db.getHistory(50);
            const continueWatching = history
                .filter((h) => {
                if (h.progress <= 0)
                    return false;
                if (!h.duration || h.duration <= 0)
                    h.duration = Math.max(h.progress + 60, 60);
                if (h.duration < 60)
                    return false;
                if (h.progress < 15)
                    return false;
                if (h.progress / h.duration < 0.01)
                    return false;
                if (h.progress >= Math.max(h.duration - 60, h.duration * 0.95))
                    return false;
                return true;
            })
                .slice(0, 20);
            res.json(continueWatching);
        }
        catch (err) {
            console.error('Failed to load continue watching:', err);
            res.status(500).json({ error: 'Failed to load continue watching' });
        }
    });
    // --- Torrent Streaming ---
    router.get('/stream/torrent/:infoHash', async (req, res) => {
        try {
            await streamTorrentHandler(req, res);
        }
        catch (err) {
            console.error('[Torrent] Route handler error:', err?.message || err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Torrent streaming failed: ' + (err?.message || 'unknown error') });
            }
        }
    });
    router.get('/stream/torrent/:infoHash/transcode', async (req, res) => {
        try {
            transcodeTorrentHandler(req, res);
        }
        catch (err) {
            console.error('[Transcode] Route handler error:', err?.message || err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Transcoding failed: ' + (err?.message || 'unknown error') });
            }
        }
    });
    // --- Search ---
    router.get('/search', async (req, res) => {
        const query = String(req.query.q ?? '');
        if (!query || query.length < 2) {
            res.json({ results: [] });
            return;
        }
        try {
            const results = await addonManager.searchAll(query);
            res.json({ results });
        }
        catch (err) {
            console.error('Search failed:', query, err);
            res.status(500).json({ error: 'Search failed' });
        }
    });
    // --- TMDB Proxy with in-memory cache (5 min TTL) ---
    const tmdbCache = new Map();
    const TMDB_CACHE_TTL = 5 * 60 * 1000;
    setInterval(() => { const now = Date.now(); for (const [k, v] of tmdbCache) {
        if (now > v.expires)
            tmdbCache.delete(k);
    } }, 60000);
    router.get('/tmdb-proxy', async (req, res) => {
        const path = String(req.query.path || '');
        if (!path) {
            res.status(400).json({ error: 'Missing path query parameter (e.g. trending/movie/day)' });
            return;
        }
        const key = process.env.TMDB_API_KEY;
        if (!key) {
            console.error('[TMDB-Proxy] API key not configured');
            res.status(500).json({ error: 'TMDB API key not configured' });
            return;
        }
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(req.query)) {
            if (k === 'path')
                continue;
            if (Array.isArray(v))
                v.forEach(item => qs.append(k, String(item)));
            else if (v !== undefined)
                qs.append(k, String(v));
        }
        qs.set('api_key', key);
        const cacheKey = path + '?' + qs.toString();
        const cached = tmdbCache.get(cacheKey);
        if (cached && Date.now() < cached.expires) {
            console.log('[TMDB-Proxy] Cache HIT:', path);
            res.json(cached.data);
            return;
        }
        const sep = path.includes('?') ? '&' : '?';
        const targetUrl = `https://api.themoviedb.org/3/${path}${sep}${qs.toString()}`;
        console.log('[TMDB-Proxy] Fetching:', targetUrl.replace(key, '***'));
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(targetUrl, { signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) {
                console.error('[TMDB-Proxy] HTTP', response.status, 'from TMDB');
                res.status(response.status).json({ error: `TMDB API error: ${response.status}` });
                return;
            }
            const data = await response.json();
            tmdbCache.set(cacheKey, { data, expires: Date.now() + TMDB_CACHE_TTL });
            res.json(data);
        }
        catch (err) {
            console.error('[TMDB-Proxy] Failed:', err);
            res.status(502).json({ error: 'TMDB proxy failed', detail: String(err) });
        }
    });
    // --- Addon Proxy (routes browser addon fetches through the server to avoid CORS) ---
    // Client calls: /api/addon-proxy?url=https://torrentio.strem.fun/stream/series/tt1234567.json
    router.get('/addon-proxy', async (req, res) => {
        const targetUrl = String(req.query.url || '');
        if (!targetUrl) {
            res.status(400).json({ error: 'Missing url parameter' });
            return;
        }
        console.log('[Addon-Proxy] Fetching:', targetUrl);
        // Try with fallback: add `?` query to bypass CDN caching if needed
        const fetchUrl = targetUrl.includes('?') ? targetUrl : targetUrl;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            const response = await fetch(fetchUrl, { signal: controller.signal });
            clearTimeout(timer);
            if (!response.ok) {
                const body = await response.text().catch(() => '');
                console.error('[Addon-Proxy] HTTP', response.status, 'from addon — body:', body.slice(0, 200));
                res.status(response.status).json({ error: `Addon proxy error: ${response.status}`, url: targetUrl, detail: body.slice(0, 200) });
                return;
            }
            const data = await response.json();
            res.json(data);
        }
        catch (err) {
            console.error('[Addon-Proxy] Failed:', targetUrl, err);
            res.status(502).json({ error: 'Addon proxy failed', url: targetUrl, detail: String(err) });
        }
    });
    // --- Diagnostics ---
    router.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            addons: addonManager.getInstalledAddons().length,
            providers: registry ? {
                metadata: registry.getMetadataProviders().map(p => p.name),
                streams: registry.getStreamProviders().map(p => p.name),
                subtitles: registry.getSubtitleProviders().map(p => p.name),
            } : null,
            memory: process.memoryUsage(),
        });
    });
    // --- Settings ---
    router.get('/settings', (_req, res) => {
        const keys = ['language', 'theme', 'streaming_quality', 'downloads_path'];
        const settings = {};
        for (const key of keys) {
            settings[key] = db.getSetting(key);
        }
        res.json(settings);
    });
    // --- Torrent Subtitle (serves subtitle files directly from torrent data) ---
    router.get('/torrent-subtitle', async (req, res) => {
        const infoHash = p(req.query.infoHash);
        const fileIdx = parseInt(p(req.query.fileIdx));
        if (!infoHash || isNaN(fileIdx)) {
            res.status(400).json({ error: 'Missing infoHash or fileIdx' });
            return;
        }
        const torrent = getActiveTorrent(infoHash);
        if (!torrent || !torrent.files || !torrent.files[fileIdx]) {
            res.status(404).json({ error: 'File not found' });
            return;
        }
        const file = torrent.files[fileIdx];
        const stream = file.createReadStream();
        let data = Buffer.alloc(0);
        stream.on('data', (chunk) => { data = Buffer.concat([data, chunk]); });
        stream.on('end', () => {
            const text = data.toString('utf-8');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(text);
        });
        stream.on('error', () => { res.status(500).json({ error: 'Stream error' }); });
    });
    // --- Subtitle Proxy (fetches subtitle content from OpenSubtitles download API, avoids CORS + daily limit issues) ---
    router.get('/subtitle-proxy', async (req, res) => {
        const fileId = parseInt(p(req.query.file_id));
        if (isNaN(fileId)) {
            res.status(400).json({ error: 'Missing file_id parameter' });
            return;
        }
        // Check cache
        const cacheFile = path.join(SUB_CACHE_DIR, `${fileId}.srt`);
        if (fs.existsSync(cacheFile)) {
            const cached = fs.readFileSync(cacheFile, 'utf-8');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(cached);
            return;
        }
        const result = await downloadSubtitle(fileId);
        if (!result) {
            res.status(502).json({ error: 'Failed to download subtitle' });
            return;
        }
        try {
            const subRes = await fetch(result.link, { signal: AbortSignal.timeout(15000) });
            if (!subRes.ok) {
                res.status(502).json({ error: 'Subtitle download failed' });
                return;
            }
            const text = await subRes.text();
            // Cache to disk
            try {
                if (!fs.existsSync(SUB_CACHE_DIR))
                    fs.mkdirSync(SUB_CACHE_DIR, { recursive: true });
                fs.writeFileSync(cacheFile, text, 'utf-8');
            }
            catch { /* cache write failure is non-fatal */ }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send(text);
        }
        catch {
            res.status(502).json({ error: 'Subtitle fetch failed' });
        }
    });
    router.put('/settings/:key', (req, res) => {
        db.setSetting(p(req.params.key), String(req.body.value));
        res.json({ success: true });
    });
    return router;
}
//# sourceMappingURL=index.js.map
