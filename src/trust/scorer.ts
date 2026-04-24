// src/trust/scorer.ts
// Computes actor trust score and tier from event history.
// Called by the ingester after each batch of events is written.

import type { Tier } from "./db.js";
import { getDb, stmt, getActorProfile } from "./db.js";

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const SCHOOL_THRESHOLD = 75;
export const PRACTICE_THRESHOLD = 40;
export const RECENT_WINDOW_MS = 60 * 60 * 1_000; // 1 hour
export const SCHOOL_STICKY_MS = 24 * 60 * 60 * 1_000; // 24 hours

// ─── Score computation ────────────────────────────────────────────────────────

export interface ScoreCounts {
  event_count: number;
  ok_count: number;
  failure_count: number;   // failures within RECENT_WINDOW_MS
  recent_failure_count: number;
}

export function computeScore(counts: ScoreCounts): number {
  const base = 100 * (counts.ok_count / Math.max(1, counts.ok_count + counts.failure_count));
  const penalty = 10 * counts.recent_failure_count;
  return Math.max(0, Math.min(100, base - penalty));
}

export function scoreToTier(score: number): Tier {
  if (score >= SCHOOL_THRESHOLD) return "school";
  if (score >= PRACTICE_THRESHOLD) return "practice";
  return "hold";
}

// ─── Per-actor recompute ─────────────────────────────────────────────────────

export interface RecomputeOptions {
  banned?: boolean;
  promoted?: boolean;
}

export function recomputeActor(
  actor: string,
  overrides: RecomputeOptions = {},
): void {
  if (actor === "mcp:system") return; // system events do not affect scoring

  const db = getDb();
  const now = new Date().toISOString();
  const recentCutoff = new Date(Date.now() - RECENT_WINDOW_MS).toISOString();

  // Get profile before (for sticky-tier check)
  const profileBefore = stmt(db,
    "SELECT tier, tier_changed_at FROM actor_profile WHERE actor = ?"
  ).get(actor) as { tier: Tier; tier_changed_at: string } | undefined;

  // Aggregate counts from events table — fix: use failure_count, not err_count
  const counts = stmt(db, `
    SELECT
      COUNT(*)                  AS event_count,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS ok_count,
      SUM(CASE WHEN status IN ('failure','error') THEN 1 ELSE 0 END) AS failure_count,
      SUM(
        CASE WHEN status IN ('failure','error') AND ts >= ? THEN 1 ELSE 0 END
      ) AS recent_failure_count
    FROM events
    WHERE actor = ?
  `).get(recentCutoff, actor) as ScoreCounts;

  const score = computeScore(counts);
  const firstSeen = (
    stmt(db, "SELECT MIN(ts) as f FROM events WHERE actor = ?").get(actor) as { f: string | null }
  )?.f ?? now;

  let tier: Tier = scoreToTier(score);
  const notes: Record<string, unknown> = { score_basis: counts };

  // Override hooks
  if (overrides.banned) {
    tier = "hold";
    notes.override = "grid.admission_banned";
  } else if (overrides.promoted) {
    // Sticky school: once promoted, stays school for SCHOOL_STICKY_MS
    if (profileBefore) {
      const expiry = new Date(profileBefore.tier_changed_at).getTime() + SCHOOL_STICKY_MS;
      if (Date.now() < expiry && profileBefore.tier === "school") {
        tier = "school";
        notes.override = "eligibility.promote_gate_sticky";
      }
    }
  }

  const tierChanged = !profileBefore || profileBefore.tier !== tier;
  const tierChangedAt = tierChanged ? now : profileBefore?.tier_changed_at ?? now;

  // Upsert: err_count = failure_count (the schema uses err_count as cumulative failures)
  stmt(db, `
    INSERT INTO actor_profile
      (actor, first_seen, last_seen, event_count, ok_count, err_count,
       recent_err_count, score, tier, tier_changed_at, notes_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(actor) DO UPDATE SET
      last_seen         = excluded.last_seen,
      event_count       = excluded.event_count,
      ok_count          = excluded.ok_count,
      err_count         = excluded.err_count,
      recent_err_count  = excluded.recent_err_count,
      score             = excluded.score,
      tier              = excluded.tier,
      tier_changed_at   = CASE
        WHEN excluded.tier != actor_profile.tier THEN excluded.tier_changed_at
        ELSE actor_profile.tier_changed_at
      END,
      notes_json        = excluded.notes_json
  `).run(
    actor,
    firstSeen,
    now,
    counts.event_count,
    counts.ok_count,
    counts.failure_count,    // err_count = failure_count
    counts.recent_failure_count,
    score,
    tier,
    tierChangedAt,
    JSON.stringify(notes),
  );
}

// ─── Route policy resolution ────────────────────────────────────────────────

export function resolveRoutePolicy(
  _tool: string,
  actor: string,
): { actor: string; tier: Tier; score: number } {
  const profile = getActorProfile(actor);
  if (!profile) {
    return { actor, tier: "hold" as Tier, score: 0 };
  }
  return { actor, tier: profile.tier, score: profile.score };
}

// ─── Bulk recompute (called on startup or schema migration) ──────────────────

export function recomputeAllActors(): void {
  const db = getDb();
  const actors = stmt(db,
    "SELECT DISTINCT actor FROM events WHERE actor != 'mcp:system'"
  ).all() as { actor: string }[];

  for (const { actor } of actors) {
    recomputeActor(actor);
  }
}
