PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  source      TEXT NOT NULL,
  tool        TEXT NOT NULL,
  actor       TEXT NOT NULL,
  status      TEXT NOT NULL,
  duration_ms INTEGER,
  payload_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_actor_ts   ON events (actor, ts);
CREATE INDEX IF NOT EXISTS idx_events_source_tool ON events (source, tool, ts);

CREATE TABLE IF NOT EXISTS actor_profile (
  actor          TEXT PRIMARY KEY,
  first_seen     TEXT NOT NULL,
  last_seen      TEXT NOT NULL,
  event_count    INTEGER NOT NULL DEFAULT 0,
  ok_count       INTEGER NOT NULL DEFAULT 0,
  err_count      INTEGER NOT NULL DEFAULT 0,
  recent_err_count INTEGER NOT NULL DEFAULT 0,
  score          REAL NOT NULL DEFAULT 100,
  tier           TEXT NOT NULL DEFAULT 'school' CHECK (tier IN ('school','practice','hold')),
  tier_changed_at TEXT NOT NULL,
  notes_json     TEXT
);

CREATE INDEX IF NOT EXISTS idx_actor_tier_score ON actor_profile (tier, score DESC);

CREATE TABLE IF NOT EXISTS routing_decisions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT NOT NULL,
  actor       TEXT NOT NULL,
  tool        TEXT NOT NULL,
  decision    TEXT NOT NULL CHECK (decision IN ('school','practice','hold')),
  reason      TEXT NOT NULL,
  decided_by  TEXT NOT NULL DEFAULT 'scorer'
);

CREATE INDEX IF NOT EXISTS idx_routing_actor_ts ON routing_decisions (actor, ts);
