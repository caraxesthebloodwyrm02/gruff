import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  computeScore,
  scoreToTier,
  recomputeActor,
  recomputeAllActors,
  resolveRoutePolicy,
  SCHOOL_THRESHOLD,
  PRACTICE_THRESHOLD,
  RECENT_WINDOW_MS,
  SCHOOL_STICKY_MS,
} from "./scorer.js";
import { getActorProfile, getDb, resetDb } from "./db.js";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("scorer.ts - Score computation & tier logic", () => {
  let tempDir: string;
  let tempDbPath: string;

  beforeEach(() => {
    resetDb();
    tempDir = mkdtempSync(join(tmpdir(), "gruff-scorer-test-"));
    tempDbPath = join(tempDir, "trust.sqlite");
    process.env.GRUFF_TRUST_SQLITE = tempDbPath;
  });

  afterEach(() => {
    resetDb();
    delete process.env.GRUFF_TRUST_SQLITE;
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should have correct threshold constants", () => {
    assert.strictEqual(SCHOOL_THRESHOLD, 75);
    assert.strictEqual(PRACTICE_THRESHOLD, 40);
    assert.ok(RECENT_WINDOW_MS >= 0);
    assert.ok(SCHOOL_STICKY_MS >= 0);
  });

  it("should compute score correctly", () => {
    // 8 ok, 2 err = 100*(8/10) - 10*1 = 80 - 10 = 70
    const counts = { event_count: 10, ok_count: 8, failure_count: 2, recent_failure_count: 1 };
    const score = computeScore(counts);
    assert.strictEqual(score, 70);
  });

  it("should compute score with zero failures", () => {
    const counts = { event_count: 10, ok_count: 10, failure_count: 0, recent_failure_count: 0 };
    const score = computeScore(counts);
    assert.strictEqual(score, 100); // 100*(10/10) - 0 = 100
  });

  it("should compute score with all failures", () => {
    const counts = { event_count: 5, ok_count: 0, failure_count: 5, recent_failure_count: 3 };
    const score = computeScore(counts);
    // 100*(0/5) - 10*3 = 0 - 30 = -30, but Math.max(0, ...) returns 0
    assert.strictEqual(score, 0);
  });

  it("should map score to tier: school >= 75", () => {
    assert.strictEqual(scoreToTier(100), "school");
    assert.strictEqual(scoreToTier(75), "school");
    assert.strictEqual(scoreToTier(80), "school");
  });

  it("should map score to tier: practice 40-74", () => {
    assert.strictEqual(scoreToTier(74), "practice");
    assert.strictEqual(scoreToTier(40), "practice");
    assert.strictEqual(scoreToTier(50), "practice");
  });

  it("should map score to tier: hold < 40", () => {
    assert.strictEqual(scoreToTier(39), "hold");
    assert.strictEqual(scoreToTier(0), "hold");
    assert.strictEqual(scoreToTier(-10), "hold");
  });

  it("should resolve route policy for unknown actor", () => {
    const result = resolveRoutePolicy("some-tool", "unknown-actor-12345");
    assert.ok(result);
    assert.strictEqual(result.actor, "unknown-actor-12345");
    assert.ok(["hold", "practice", "school"].includes(result.tier));
    assert.ok(result.score >= 0);
  });

  it("should recompute actor (no-op for non-existent actor)", () => {
    // Should not throw for non-existent actor
    assert.doesNotThrow(() => {
      recomputeActor("non-existent-actor-xyz");
    });
    // Should still not exist in DB
    const profile = getActorProfile("non-existent-actor-xyz");
    assert.strictEqual(profile, null);
  });

  it("should recompute all actors (no-op on empty)", () => {
    assert.doesNotThrow(() => {
      recomputeAllActors();
    });
  });

  it("should apply banned override", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO events (ts, source, tool, actor, status, duration_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(new Date().toISOString(), "test", "tool", "banned-actor", "success", 10, "{}");

    recomputeActor("banned-actor", { banned: true });

    const profile = getActorProfile("banned-actor");
    assert.ok(profile);
    assert.strictEqual(profile?.tier, "hold");
  });

  it("should keep school tier during promoted sticky window", () => {
    const db = getDb();
    const actor = "sticky-actor";
    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO events (ts, source, tool, actor, status, duration_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(now, "test", "tool", actor, "success", 10, "{}");
    db.prepare(`
      INSERT INTO actor_profile (actor, first_seen, last_seen, event_count, ok_count, err_count, recent_err_count, score, tier, tier_changed_at, notes_json)
      VALUES (?, ?, ?, 1, 1, 0, 0, 100, 'school', ?, '{}')
    `).run(actor, now, now, now);

    recomputeActor(actor, { promoted: true });

    const profile = getActorProfile(actor);
    assert.ok(profile);
    assert.strictEqual(profile?.tier, "school");
  });

  it("should recompute all actors from event history", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO events (ts, source, tool, actor, status, duration_ms, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(new Date().toISOString(), "test", "tool", "bulk-actor", "success", 10, "{}");

    recomputeAllActors();

    const profile = getActorProfile("bulk-actor");
    assert.ok(profile);
    assert.strictEqual(profile?.score, 100);
  });
});
