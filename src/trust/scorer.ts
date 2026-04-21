import type Database from "better-sqlite3";
import type { Tier } from "./db.js";

const RECENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SCHOOL_THRESHOLD = 75;
const PRACTICE_THRESHOLD = 40;
const SCHOOL_STICKY_MS = 24 * 60 * 60 * 1000; // 24h

interface RawCounts {
  event_count: number;
  ok_count: number;
  failure_count: number;
  recent_failure_count: number;
}

function computeScore(counts: RawCounts): number {
  const base = 100 * (counts.ok_count / Math.max(1, counts.ok_count + counts.failure_count));
  const penalty = 10 * counts.recent_failure_count;
  return Math.max(0, Math.min(100, base - penalty));
}

function scoreToTier(score: number): Tier {
  if (score >= SCHOOL_THRESHOLD) return "school";
  if (score >= PRACTICE_THRESHOLD) return "practice";
  return "hold";
}

export function recomputeActor(
  db: Database.Database,
  actor: string,
  overrides?: { banned?: boolean; promoted?: boolean },
): void {
  // System actor is always school, no profile needed
  if (actor === "mcp:system") return;

  const now = new Date().toISOString();
  const recentCutoff = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();

  const counts = db
    .prepare(
      `SELECT
        COUNT(*) AS event_count,
        SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) AS ok_count,
        SUM(CASE WHEN status IN ('failure', 'error') THEN 1 ELSE 0 END) AS failure_count,
        SUM(CASE WHEN status IN ('failure', 'error') AND ts >= ? THEN 1 ELSE 0 END) AS recent_failure_count
       FROM events WHERE actor = ?`,
    )
    .get(recentCutoff, actor) as RawCounts;

  const score = computeScore(counts);
  const firstSeen =
    (db.prepare("SELECT MIN(ts) as f FROM events WHERE actor = ?").get(actor) as any)?.f ?? now;

  let tier: Tier = scoreToTier(score);
  let notes: Record<string, unknown> = { score_basis: counts };

  if (overrides?.banned) {
    tier = "hold";
    notes.override = "grid.admission_bannered";
  } else if (overrides?.promoted) {
    const existing = db
      .prepare("SELECT tier, tier_changed_at FROM actor_profile WHERE actor = ?")
      .get(actor) as { tier: Tier; tier_changed_at: string } | undefined;
    const stickyExpiry = existing
      ? new Date(existing.tier_changed_at).getTime() + SCHOOL_STICKY_MS
      : 0;
    if (Date.now() < stickyExpiry && existing?.tier === "school") {
      tier = "school";
      notes.override = "eligibility.promote_gate_sticky";
    }
  }

  const existing = db
    .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
    .get(actor) as { tier: Tier } | undefined;
  const tierChanged = !existing || existing.tier !== tier;

  db.prepare(
    `INSERT INTO actor_profile
       (actor, first_seen, last_seen, event_count, ok_count, err_count, recent_err_count, score, tier, tier_changed_at, notes_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(actor) DO UPDATE SET
       last_seen         = excluded.last_seen,
       event_count       = excluded.event_count,
       ok_count          = excluded.ok_count,
       err_count         = excluded.err_count,
       recent_err_count  = excluded.recent_err_count,
       score             = excluded.score,
       tier              = excluded.tier,
       tier_changed_at   = CASE WHEN excluded.tier != actor_profile.tier THEN excluded.tier_changed_at ELSE actor_profile.tier_changed_at END,
       notes_json        = excluded.notes_json`,
  ).run(
    actor,
    firstSeen,
    now,
    counts.event_count,
    counts.ok_count,
    counts.failure_count,
    counts.recent_failure_count,
    score,
    tier,
    tierChanged ? now : (existing ? now : now),
    JSON.stringify(notes),
  );
}
