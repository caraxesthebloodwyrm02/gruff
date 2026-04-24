// src/trust/db.ts
// SQLite wrapper for trust.sqlite
// Supports: read replica (sharable), prepared statement cache, WAL concurrency

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = existsSync(join(__dirname, "../package.json"))
  ? resolve(__dirname, "..")
  : resolve(__dirname, "../..");


// ─── Exports ──────────────────────────────────────────────────────────────────

export const TIER_ORDER = ["hold", "practice", "school"] as const;
export type Tier = (typeof TIER_ORDER)[number];

export interface ActorProfile {
  actor: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  ok_count: number;
  err_count: number;
  recent_err_count: number;
  score: number;
  tier: Tier;
  tier_changed_at: string;
  notes_json: string;
}

export interface RoutingDecision {
  id: number;
  actor: string;
  tool: string;
  tier: Tier;
  reason_code: string;
  decided_at: string;
  notes_json: string;
}

export interface ActorSession {
  id: number;
  actor: string;
  session_id: string;
  started_at: string;
  last_seen: string;
  turn_count: number;
  ok_count: number;
  err_count: number;
  active: number;
  closed_at: string | null;
  exit_reason: string | null;
  notes_json: string;
}

// ─── Path resolution ───────────────────────────────────────────────────────────

export function trustDbPath(): string {
  if (process.env.GRUFF_TRUST_SQLITE?.trim()) {
    return process.env.GRUFF_TRUST_SQLITE.trim();
  }
  return join(homedir(), ".gruff", "trust.sqlite");
}

// ─── Connection factory ────────────────────────────────────────────────────────

let _primaryDb: Database.Database | null = null;

// ─── DB Reset (for testing) ───────────────────────────────────────────

export function resetDb(): void {
  if (_primaryDb) {
    try { _primaryDb.close(); } catch {}
    _primaryDb = null;
  }
  _stmtCache.clear();
}

const _readReplicas: Database.Database[] = [];
const _stmtCache = new Map<string, Database.Statement>();

function buildConnection(path: string, readonly = false): Database.Database {
  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path, {
    readonly,
    fileMustExist: readonly,
  });

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = -64000");      // 64 MB
  db.pragma("temp_store = MEMORY");
  db.pragma("mmap_size = 268435456");    // 256 MB
  db.pragma("read_uncommitted = 1");

  return db;
}

function applySchema(db: Database.Database): void {
  const schema = readFileSync(join(PKG_ROOT, "src/trust/schema.sql"), "utf8");
  db.exec(schema);
  // Ensure backward-compat column exists
  ensureRoutingDecisionColumns(db);
}

export function getDb(): Database.Database {
  if (_primaryDb) return _primaryDb;
  const dbPath = trustDbPath();
  _primaryDb = buildConnection(dbPath);
  applySchema(_primaryDb);
  return _primaryDb;
}

/** Sharable read replica. Caller must NOT write. Caller releases with replica.close(). */
export function getReadReplica(): Database.Database {
  const path = trustDbPath();
  if (!existsSync(path)) return getDb(); // fallback to primary
  const db = buildConnection(path, true);
  // WAL mode allows concurrent reads against a WAL-mode primary
  return db;
}

export function releaseReplica(db: Database.Database): void {
  try { db.close(); } catch { /* ignore */ }
}

function ensureRoutingDecisionColumns(db: Database.Database): void {
  const cols = db.prepare("PRAGMA table_info(routing_decisions)").all() as { name: string }[];
  const names = new Set(cols.map(c => c.name));
  if (!names.has("reason_code")) {
    db.exec("ALTER TABLE routing_decisions ADD COLUMN reason_code TEXT NOT NULL DEFAULT 'policy.default'");
  }
}

// ─── Prepared statement cache (avoids re-compilation on hot paths) ─────────────

export function stmt(db: Database.Database, sql: string): Database.Statement {
  const key = sql; // per-db cache key
  if (!_stmtCache.has(key)) {
    _stmtCache.set(key, db.prepare(sql));
  }
  return _stmtCache.get(key)!;
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

export function getActorProfile(actor: string): ActorProfile | null {
  const db = getDb();
  return (stmt(db, "SELECT * FROM actor_profile WHERE actor = ?").get(actor) as ActorProfile) ?? null;
}

export function listActors(limit = 50): ActorProfile[] {
  const db = getDb();
  return stmt(db, "SELECT * FROM actor_profile ORDER BY score DESC LIMIT ?").all(limit) as ActorProfile[];
}

export function getOpenSessions(actor?: string): ActorSession[] {
  const db = getDb();
  const sql = actor
    ? "SELECT * FROM actor_sessions WHERE actor = ? AND active = 1 ORDER BY last_seen DESC"
    : "SELECT * FROM actor_sessions WHERE active = 1 ORDER BY last_seen DESC";
  return actor
    ? stmt(db, sql).all(actor) as ActorSession[]
    : stmt(db, sql).all() as ActorSession[];
}

export function queryRaw(sql: string): unknown[] {
  if (!/^\s*SELECT/i.test(sql)) throw new Error("Only SELECT allowed via --sql");
  const db = getDb();
  return stmt(db, sql).all();
}

// ─── Session management (catch/release pattern) ────────────────────────────────

export function startSession(
  actor: string,
  sessionId: string,
  notes: Record<string, unknown> = {},
): void {
  const db = getDb();
  const now = new Date().toISOString();
  stmt(db, `
    INSERT INTO actor_sessions (actor, session_id, started_at, last_seen, notes_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(actor, session_id) DO NOTHING
  `).run(actor, sessionId, now, now, JSON.stringify(notes));
}

export function heartbeatSession(actor: string, sessionId: string): void {
  const db = getDb();
  stmt(db, `
    UPDATE actor_sessions SET last_seen = ?, turn_count = turn_count + 1
    WHERE actor = ? AND session_id = ? AND active = 1
  `).run(new Date().toISOString(), actor, sessionId);
}

export function closeSession(
  actor: string,
  sessionId: string,
  reason: "timeout" | "completed" | "evicted" | "error",
): void {
  const db = getDb();
  const now = new Date().toISOString();
  stmt(db, `
    UPDATE actor_sessions
    SET active = 0, closed_at = ?, exit_reason = ?
    WHERE actor = ? AND session_id = ? AND active = 1
  `).run(now, reason, actor, sessionId);
}

export function recordSessionOutcome(
  actor: string,
  sessionId: string,
  ok: boolean,
): void {
  const db = getDb();
  stmt(db, `
    UPDATE actor_sessions
    SET
      ok_count = ok_count + ?,
      err_count = err_count + ?
    WHERE actor = ? AND session_id = ? AND active = 1
  `).run(ok ? 1 : 0, ok ? 0 : 1, actor, sessionId);
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export function logRoutingDecision(
  actor: string,
  tool: string,
  tier: Tier,
  reasonCode: string,
  notes: Record<string, unknown> = {},
): boolean {
  const db = getDb();
  stmt(db, `
    INSERT INTO routing_decisions (actor, tool, tier, reason_code, decided_at, notes_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actor, tool, tier, reasonCode, new Date().toISOString(), JSON.stringify(notes));
  return true;
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

export function tierRank(tier: Tier | string): number {
  const idx = TIER_ORDER.indexOf(tier as Tier);
  return idx === -1 ? 0 : idx;
}

export function clampTier(requested: Tier, maxAllowed: Tier): Tier {
  return tierRank(requested) <= tierRank(maxAllowed) ? requested : maxAllowed;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function pruneFingerprints(olderThanDays = 7): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const result = stmt(db, "DELETE FROM event_fingerprints WHERE seen_at < ?").run(cutoff);
  return result.changes;
}
