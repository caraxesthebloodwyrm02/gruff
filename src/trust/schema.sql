PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;           -- 64 MB page cache
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;         -- 256 MB memory-mapped I/O

-- Read replica pragma: enable sharable read connections
-- Use: db.prepare(...).all() on replicas, writes go to primary
PRAGMA read_uncommitted = 1;

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,                 -- ISO-8601, indexed for time-range queries
    source TEXT NOT NULL,             -- e.g. "echoes", "gruff", "mcp:system"
    tool TEXT NOT NULL,               -- tool identifier
    actor TEXT NOT NULL,              -- resolved actor identity
    status TEXT NOT NULL,             -- 'success' | 'failure' | 'error' | 'timeout'
    duration_ms INTEGER,              -- execution time for latency analysis
    payload_json TEXT                 -- serialized metadata
);

CREATE INDEX IF NOT EXISTS idx_events_actor_ts ON events(actor, ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_status  ON events(status, ts DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedupe
ON events(ts, source, tool, actor, status, payload_json);

-- Actor profile: computed on ingest, read on route decisions
-- Note: err_count = cumulative failures; failure_count is the computed alias used at write time
CREATE TABLE IF NOT EXISTS actor_profile (
    actor TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0,
    ok_count INTEGER NOT NULL DEFAULT 0,
    err_count INTEGER NOT NULL DEFAULT 0,   -- cumulative failures (matches failure_count write)
    recent_err_count INTEGER NOT NULL DEFAULT 0,
    score REAL NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'hold',       -- 'school' | 'practice' | 'hold'
    tier_changed_at TEXT NOT NULL,
    notes_json TEXT NOT NULL DEFAULT '{}'
);

-- Session tracking for interactive actors (pull-based agents)
-- Enables: session length, turn counts, context windows, catch-release cycles
CREATE TABLE IF NOT EXISTS actor_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    session_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    turn_count INTEGER NOT NULL DEFAULT 0,
    ok_count INTEGER NOT NULL DEFAULT 0,
    err_count INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,      -- 1=alive, 0=closed
    closed_at TEXT,                          -- NULL until session ends
    exit_reason TEXT,                      -- 'timeout' | 'completed' | 'evicted' | 'error'
    notes_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE(actor, session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_actor_active ON actor_sessions(actor, active DESC, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_open         ON actor_sessions(last_seen DESC) WHERE active = 1;

-- Routing decisions: audit log of all route resolutions
-- Written by CLI, read by TUI agency panel
CREATE TABLE IF NOT EXISTS routing_decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    tool TEXT NOT NULL,
    tier TEXT NOT NULL,
    reason_code TEXT NOT NULL DEFAULT 'policy.default',
    decided_at TEXT NOT NULL,
    notes_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_decisions_actor     ON routing_decisions(actor, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_actor_tool ON routing_decisions(actor, tool, decided_at DESC);

-- Event fingerprints: dedup set (SHA256 of canonical event shape)
-- Prune fingerprints older than 7 days to prevent unbounded growth
CREATE TABLE IF NOT EXISTS event_fingerprints (
    fingerprint TEXT PRIMARY KEY,
    seen_at TEXT NOT NULL               -- ISO-8601, prune target
);
