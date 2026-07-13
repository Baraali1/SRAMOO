import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import fs from 'node:fs'
import { SCHEMA_SQL } from './schema.js'
import type { InstalledAddon, Manifest } from '../addons/types.js'

export interface WatchHistoryEntry {
  id?: number
  item_id: string
  type: string
  name: string
  poster?: string
  watched_at: number
  progress: number
  duration: number
  video_id?: string
  stream_info_hash?: string
  stream_file_idx?: number
}

export interface LibraryItem {
  id: string
  type: string
  name: string
  poster?: string
  added_at: number
  updated_at: number
}

export class AppDatabase {
  private db!: SqlJsDatabase
  private dbPath: string
  private ready: Promise<void>

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath
    this.ready = this.init()
  }

  private async init(): Promise<void> {
    const SQL = await initSqlJs()
    if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
    }
    this.db.run(SCHEMA_SQL)
    this.migrate()
    this.save()
  }

  private migrate(): void {
    const columns = this.queryAll("PRAGMA table_info('watch_history')")
    const names = columns.map((c: any) => c.name)
    if (!names.includes('stream_info_hash')) {
      this.run("ALTER TABLE watch_history ADD COLUMN stream_info_hash TEXT")
    }
    if (!names.includes('stream_file_idx')) {
      this.run("ALTER TABLE watch_history ADD COLUMN stream_file_idx INTEGER DEFAULT 0")
    }
  }

  private save(): void {
    if (this.dbPath !== ':memory:') {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      fs.writeFileSync(this.dbPath, buffer)
    }
  }

  async waitReady(): Promise<void> {
    await this.ready
  }

  private queryAll(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    const results: any[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  }

  private queryOne(sql: string, params: any[] = []): any | undefined {
    const results = this.queryAll(sql, params)
    return results[0]
  }

  private run(sql: string, params: any[] = []): void {
    this.db.run(sql, params)
    this.save()
  }

  close(): void {
    this.db.close()
  }

  // --- Settings ---
  getSetting(key: string): string | undefined {
    const row = this.queryOne('SELECT value FROM settings WHERE key = ?', [key])
    return row?.value
  }

  setSetting(key: string, value: string): void {
    this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  }

  // --- Library ---
  getLibrary(): LibraryItem[] {
    return this.queryAll('SELECT * FROM library_items ORDER BY updated_at DESC')
  }

  addToLibrary(item: LibraryItem): void {
    this.run(
      'INSERT OR REPLACE INTO library_items (id, type, name, poster, added_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [item.id, item.type, item.name, item.poster ?? null, item.added_at, item.updated_at],
    )
  }

  removeFromLibrary(id: string): void {
    this.run('DELETE FROM library_items WHERE id = ?', [id])
  }

  isInLibrary(id: string): boolean {
    const row = this.queryOne('SELECT 1 as v FROM library_items WHERE id = ?', [id])
    return !!row
  }

  // --- Watch History ---
  getHistory(limit = 50): WatchHistoryEntry[] {
    return this.queryAll('SELECT * FROM watch_history ORDER BY watched_at DESC LIMIT ?', [limit])
  }

  addToHistory(entry: WatchHistoryEntry): void {
    this.run(
      'INSERT INTO watch_history (item_id, type, name, poster, watched_at, progress, duration, video_id, stream_info_hash, stream_file_idx) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [entry.item_id, entry.type, entry.name, entry.poster ?? null, entry.watched_at, entry.progress, entry.duration, entry.video_id ?? null, entry.stream_info_hash ?? null, entry.stream_file_idx ?? null],
    )
  }

  updateProgress(itemId: string, videoId: string | undefined, progress: number): void {
    if (videoId) {
      this.run(
        'UPDATE watch_history SET progress = ? WHERE item_id = ? AND video_id = ?',
        [progress, itemId, videoId],
      )
    } else {
      this.run(
        'UPDATE watch_history SET progress = ? WHERE item_id = ?',
        [progress, itemId],
      )
    }
  }

  getProgress(itemId: string, videoId?: string): { progress: number; duration: number } | undefined {
    if (videoId) {
      return this.queryOne(
        'SELECT progress, duration FROM watch_history WHERE item_id = ? AND video_id = ? ORDER BY watched_at DESC LIMIT 1',
        [itemId, videoId],
      )
    }
    return this.queryOne(
      'SELECT progress, duration FROM watch_history WHERE item_id = ? ORDER BY watched_at DESC LIMIT 1',
      [itemId],
    )
  }

  // --- Bookmarks ---
  getBookmarks(): LibraryItem[] {
    return this.queryAll('SELECT id, type, name, poster, added_at as added_at, added_at as updated_at FROM bookmarks ORDER BY added_at DESC')
  }

  addBookmark(id: string, type: string, name: string, poster?: string): void {
    this.run('INSERT OR REPLACE INTO bookmarks (id, type, name, poster, added_at) VALUES (?, ?, ?, ?, ?)',
      [id, type, name, poster ?? null, Date.now()])
  }

  removeBookmark(id: string): void {
    this.run('DELETE FROM bookmarks WHERE id = ?', [id])
  }

  isBookmarked(id: string): boolean {
    return !!this.queryOne('SELECT 1 as v FROM bookmarks WHERE id = ?', [id])
  }

  // --- Addons ---
  saveAddon(addon: InstalledAddon): void {
    this.run(
      'INSERT OR REPLACE INTO installed_addons (id, transport_url, transport_type, manifest, installed_at) VALUES (?, ?, ?, ?, ?)',
      [addon.manifest.id, addon.transport.url, addon.transport.type, JSON.stringify(addon.manifest), addon.installedAt],
    )
  }

  getSavedAddons(): InstalledAddon[] {
    const rows = this.queryAll('SELECT * FROM installed_addons') as {
      id: string
      transport_url: string
      transport_type: string
      manifest: string
      installed_at: number
    }[]
    return rows.map((r) => ({
      manifest: JSON.parse(r.manifest) as Manifest,
      transport: { type: r.transport_type as 'http' | 'local', url: r.transport_url },
      installedAt: r.installed_at,
    }))
  }

  removeAddon(id: string): void {
    this.run('DELETE FROM installed_addons WHERE id = ?', [id])
  }

  // ── Users ──
  createUser(name: string, email: string, hashedPassword: string): { id: number; name: string; email: string } {
    const now = Date.now()
    this.run('INSERT INTO users (name, email, password, created_at) VALUES (?, ?, ?, ?)', [name, email, hashedPassword, now])
    const created = this.queryOne('SELECT id FROM users WHERE email = ?', [email])
    return { id: created?.id || 0, name, email }
  }

  getUserByEmail(email: string): { id: number; name: string; email: string; password: string } | null {
    return this.queryOne('SELECT * FROM users WHERE email = ?', [email]) || null
  }

  getUserById(id: number): { id: number; name: string; email: string } | null {
    return this.queryOne('SELECT id, name, email FROM users WHERE id = ?', [id]) || null
  }
}
