PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    source TEXT NOT NULL,
    tool TEXT NOT NULL,
    actor TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INTEGER,
    payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_actor_ts ON events(actor, ts DESC);

CREATE TABLE IF NOT EXISTS actor_profile (
    actor TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    ok_count INTEGER NOT NULL DEFAULT 0,
    err_count INTEGER NOT NULL DEFAULT 0,
    recent_err_count INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'hold',
    tier_changed_at TEXT NOT NULL,
    notes_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS routing_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    tool TEXT NOT NULL,
    tier TEXT NOT NULL,
    decided_at TEXT NOT NULL,
    notes_json TEXT NOT NULL DEFAULT '{}'
);
