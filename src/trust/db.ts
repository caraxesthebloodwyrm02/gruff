import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = existsSync(join(__dirname, "../package.json"))
  ? resolve(__dirname, "..")
  : resolve(__dirname, "../..");

export type Tier = "school" | "practice" | "hold";

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
  notes_json: string | null;
}

export interface RoutingDecision {
  id: number;
  ts: string;
  actor: string;
  tool: string;
  decision: Tier;
  reason: string;
  decided_by: string;
}

const GRUFF_DIR = join(homedir(), ".gruff");

let _db: Database.Database | null = null;

function trustDbPath(): string {
  if (process.env.GRUFF_TRUST_SQLITE) {
    return process.env.GRUFF_TRUST_SQLITE;
  }
  return join(GRUFF_DIR, "trust.sqlite");
}

/** @internal test harness only */
export function __resetTrustDbForTests(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = trustDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  const schema = readFileSync(join(PKG_ROOT, "src/trust/schema.sql"), "utf8");
  _db.exec(schema);
  return _db;
}

export function getReadonlyDb(): Database.Database {
  const dbPath = trustDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });
  if (!existsSync(dbPath)) {
    // If it doesn't exist, we can't open it read-only.
    // Open it read-write once to create it, or just return the main db.
    return getDb();
  }
  const db = new Database(dbPath, { readonly: true });
  db.pragma("journal_mode = WAL");
  return db;
}

export function lookupTier(actor: string): Tier {
  try {
    const db = getReadonlyDb();
    const row = db.prepare("SELECT tier FROM actor_profile WHERE actor = ?").get(actor) as
      | Pick<ActorProfile, "tier">
      | undefined;
    return row?.tier ?? "school";
  } catch {
    return "school";
  }
}

export function getActorProfile(actor: string): ActorProfile | undefined {
  const db = getReadonlyDb();
  return db.prepare("SELECT * FROM actor_profile WHERE actor = ?").get(actor) as
    | ActorProfile
    | undefined;
}

export function listActors(limit = 50): ActorProfile[] {
  const db = getReadonlyDb();
  return db
    .prepare("SELECT * FROM actor_profile ORDER BY score DESC LIMIT ?")
    .all(limit) as ActorProfile[];
}

export function queryRaw(sql: string): unknown[] {
  if (!/^\s*SELECT/i.test(sql)) {
    throw new Error("Only SELECT statements are allowed via --sql");
  }
  const db = getReadonlyDb();
  return db.prepare(sql).all();
}

export function recordRoutingDecision(
  actor: string,
  tool: string,
  decision: Tier,
  reason: string,
  decidedBy = "proxy-server",
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO routing_decisions (ts, actor, tool, decision, reason, decided_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(new Date().toISOString(), actor, tool, decision, reason, decidedBy);
}

export function ingestAuditEvent(event: {
  ts: string;
  source: string;
  tool: string;
  actor: string;
  status: string;
  duration_ms?: number | null;
  payload_json?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO events (ts, source, tool, actor, status, duration_ms, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    event.ts,
    event.source,
    event.tool,
    event.actor,
    event.status,
    event.duration_ms ?? null,
    event.payload_json ?? null,
  );
}
