import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import Database from "better-sqlite3";
import {
  getDb,
  trustDbPath,
  listActors,
  getActorProfile,
  getReadReplica,
  releaseReplica,
  getOpenSessions,
  queryRaw,
  startSession,
  heartbeatSession,
  closeSession,
  recordSessionOutcome,
  logRoutingDecision,
  TIER_ORDER,
  tierRank,
  clampTier,
  pruneFingerprints,
  resetDb,
} from "./db.js";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("db.ts - Database foundation", () => {
  let tempDir: string;
  let tempDbPath: string;

  beforeEach(() => {
    resetDb();
    tempDir = mkdtempSync(join(tmpdir(), "gruff-test-"));
    tempDbPath = join(tempDir, "test.sqlite");
    process.env.GRUFF_TRUST_SQLITE = tempDbPath;
  });

  afterEach(() => {
    resetDb();
    delete process.env.GRUFF_TRUST_SQLITE;
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should return correct DB path", () => {
    assert.strictEqual(trustDbPath(), tempDbPath);
  });

  it("should getDb and apply schema", () => {
    const db = getDb();
    assert.ok(db instanceof Database);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map((table) => table.name);
    assert.ok(tableNames.includes("actor_profile"));
    assert.ok(tableNames.includes("events"));
    assert.ok(tableNames.includes("actor_sessions"));
    assert.ok(tableNames.includes("routing_decisions"));
    assert.ok(tableNames.includes("event_fingerprints"));
  });

  it("should list actors (empty)", () => {
    const actors = listActors();
    assert.ok(Array.isArray(actors));
    assert.strictEqual(actors.length, 0);
  });

  it("should insert and retrieve actor profile", () => {
    const db = getDb();
    db.prepare(`
      INSERT INTO actor_profile (actor, first_seen, last_seen, event_count, ok_count, err_count, recent_err_count, score, tier, tier_changed_at, notes_json)
      VALUES (?, datetime('now'), datetime('now'), 10, 8, 2, 1, 70, 'practice', datetime('now'), '{}')
    `).run("test-actor");

    const profile = getActorProfile("test-actor");
    assert.ok(profile !== null);
    assert.strictEqual(profile?.actor, "test-actor");
    assert.strictEqual(profile?.tier, "practice");
    assert.strictEqual(profile?.event_count, 10);
  });

  it("should session lifecycle: start, heartbeat, close", () => {
    const actor = "session-test-actor";
    const sessionId = "sess-001";

    startSession(actor, sessionId, { meta: "test" });
    let sessions = getOpenSessions(actor);
    assert.strictEqual(sessions.length, 1);
    assert.strictEqual(sessions[0].active, 1);

    heartbeatSession(actor, sessionId);
    sessions = getOpenSessions(actor);
    assert.ok(sessions[0].turn_count >= 1);

    closeSession(actor, sessionId, "completed");
    sessions = getOpenSessions(actor);
    assert.strictEqual(sessions.length, 0);
  });

  it("should record session outcome counters", () => {
    startSession("actor-a", "sess-a");
    recordSessionOutcome("actor-a", "sess-a", true);
    recordSessionOutcome("actor-a", "sess-a", false);
    const session = getDb().prepare(
      "SELECT ok_count, err_count FROM actor_sessions WHERE actor = ? AND session_id = ?"
    ).get("actor-a", "sess-a") as { ok_count: number; err_count: number };
    assert.strictEqual(session.ok_count, 1);
    assert.strictEqual(session.err_count, 1);
  });

  it("should log routing decisions", () => {
    const logged = logRoutingDecision("actor-route", "tool-x", "practice", "policy.tool", { via: "test" });
    assert.strictEqual(logged, true);
    const row = getDb().prepare(
      "SELECT actor, tool, tier, reason_code FROM routing_decisions WHERE actor = ?"
    ).get("actor-route") as { actor: string; tool: string; tier: string; reason_code: string };
    assert.deepStrictEqual(row, {
      actor: "actor-route",
      tool: "tool-x",
      tier: "practice",
      reason_code: "policy.tool",
    });
  });

  it("should query raw SELECT", () => {
    const result = queryRaw("SELECT 1 as one");
    assert.ok(Array.isArray(result));
    assert.strictEqual((result[0] as { one: number }).one, 1);
  });

  it("should throw on non-SELECT in queryRaw", () => {
    assert.throws(() => {
      queryRaw("DELETE FROM actor_profile");
    });
  });

  it("should have valid TIER_ORDER", () => {
    assert.deepStrictEqual(TIER_ORDER, ["hold", "practice", "school"]);
  });

  it("should expose tier helpers", () => {
    assert.strictEqual(tierRank("hold"), 0);
    assert.strictEqual(tierRank("practice"), 1);
    assert.strictEqual(tierRank("school"), 2);
    assert.strictEqual(tierRank("unknown"), 0);
    assert.strictEqual(clampTier("school", "practice"), "practice");
    assert.strictEqual(clampTier("hold", "school"), "hold");
  });

  it("should prune old fingerprints", () => {
    const db = getDb();
    db.prepare("INSERT INTO event_fingerprints (fingerprint, seen_at) VALUES (?, ?)").run(
      "old-fp",
      "2000-01-01T00:00:00.000Z"
    );
    db.prepare("INSERT INTO event_fingerprints (fingerprint, seen_at) VALUES (?, ?)").run(
      "new-fp",
      new Date().toISOString()
    );
    const pruned = pruneFingerprints(7);
    assert.strictEqual(pruned, 1);
    const fingerprints = db.prepare("SELECT fingerprint FROM event_fingerprints ORDER BY fingerprint").all() as Array<{ fingerprint: string }>;
    assert.deepStrictEqual(fingerprints, [{ fingerprint: "new-fp" }]);
  });

  it("should open and release a read replica", () => {
    getDb().prepare("SELECT 1").get();
    const replica = getReadReplica();
    const row = replica.prepare("SELECT 1 as one").get() as { one: number };
    assert.strictEqual(row.one, 1);
    assert.doesNotThrow(() => releaseReplica(replica));
  });
});
