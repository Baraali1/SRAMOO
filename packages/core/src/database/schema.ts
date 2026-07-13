export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS library_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  poster TEXT,
  added_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS watch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  poster TEXT,
  watched_at INTEGER NOT NULL,
  progress REAL DEFAULT 0,
  duration INTEGER DEFAULT 0,
  video_id TEXT,
  stream_info_hash TEXT,
  stream_file_idx INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS installed_addons (
  id TEXT PRIMARY KEY,
  transport_url TEXT NOT NULL,
  transport_type TEXT NOT NULL DEFAULT 'http',
  manifest TEXT NOT NULL,
  installed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  poster TEXT,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`
