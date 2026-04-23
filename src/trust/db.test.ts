import assert from "node:assert/strict";
import { existsSync, unlinkSync } from "node:fs";
import { afterEach, beforeEach, describe, test } from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getDb,
  getReadonlyDb,
  ingestAuditEvent,
  lookupTier,
  getActorProfile,
  listActors,
  recordRoutingDecision,
  queryRaw,
  __resetTrustDbForTests,
} from "./db.js";

let dbFile: string;

beforeEach(() => {
  __resetTrustDbForTests();
  try {
    if (dbFile) unlinkSync(dbFile);
  } catch {
    /* ignore */
  }
  dbFile = join(
    tmpdir(),
    `gruff-trust-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
  );
  process.env.GRUFF_TRUST_SQLITE = dbFile;
});

afterEach(() => {
  __resetTrustDbForTests();
  try {
    unlinkSync(dbFile);
  } catch {
    /* ignore */
  }
  delete process.env.GRUFF_TRUST_SQLITE;
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function seedProfile(
  actor: string,
  opts: {
    tier?: "school" | "practice" | "hold";
    score?: number;
    tierChangedAt?: string;
  } = {},
) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO actor_profile
       (actor, first_seen, last_seen, event_count, ok_count, err_count,
        recent_err_count, score, tier, tier_changed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    actor,
    now,
    now,
    1,
    1,
    0,
    0,
    opts.score ?? 100,
    opts.tier ?? "school",
    opts.tierChangedAt ?? now,
  );
}

// ---------------------------------------------------------------------------
// ingestAuditEvent
// ---------------------------------------------------------------------------

describe("ingestAuditEvent", () => {
  test("roundtrip: event is readable via SQL", () => {
    const db = getDb();
    ingestAuditEvent({
      ts: new Date().toISOString(),
      source: "s",
      tool: "t",
      actor: "actor-1",
      status: "success",
      payload_json: "{}",
    });
    const c = db
      .prepare("SELECT COUNT(*) as n FROM events WHERE actor = ?")
      .get("actor-1") as { n: number };
    assert.equal(c.n, 1);
  });

  test("null duration_ms is stored as null", () => {
    const db = getDb();
    ingestAuditEvent({
      ts: new Date().toISOString(),
      source: "s",
      tool: "t",
      actor: "actor-null",
      status: "success",
      duration_ms: null,
    });
    const row = db
      .prepare("SELECT duration_ms FROM events WHERE actor = ?")
      .get("actor-null") as { duration_ms: number | null };
    assert.equal(row.duration_ms, null);
  });

  test("duration_ms is stored when provided", () => {
    const db = getDb();
    ingestAuditEvent({
      ts: new Date().toISOString(),
      source: "s",
      tool: "t",
      actor: "actor-ms",
      status: "success",
      duration_ms: 42,
    });
    const row = db
      .prepare("SELECT duration_ms FROM events WHERE actor = ?")
      .get("actor-ms") as { duration_ms: number };
    assert.equal(row.duration_ms, 42);
  });

  test("multiple events for same actor accumulate", () => {
    const db = getDb();
    for (let i = 0; i < 5; i++) {
      ingestAuditEvent({
        ts: new Date().toISOString(),
        source: "s",
        tool: "t",
        actor: "multi",
        status: i % 2 === 0 ? "success" : "failure",
      });
    }
    const c = db
      .prepare("SELECT COUNT(*) as n FROM events WHERE actor = ?")
      .get("multi") as { n: number };
    assert.equal(c.n, 5);
  });
});

// ---------------------------------------------------------------------------
// lookupTier
// ---------------------------------------------------------------------------

describe("lookupTier", () => {
  test("returns 'school' for unknown actor (safe default)", () => {
    const tier = lookupTier("nobody");
    assert.equal(tier, "school");
  });

  test("returns stored 'school' tier", () => {
    seedProfile("alpha", { tier: "school" });
    assert.equal(lookupTier("alpha"), "school");
  });

  test("returns stored 'practice' tier", () => {
    seedProfile("beta", { tier: "practice", score: 60 });
    assert.equal(lookupTier("beta"), "practice");
  });

  test("returns stored 'hold' tier", () => {
    seedProfile("gamma", { tier: "hold", score: 10 });
    assert.equal(lookupTier("gamma"), "hold");
  });
});

// ---------------------------------------------------------------------------
// getActorProfile
// ---------------------------------------------------------------------------

describe("getActorProfile", () => {
  test("returns undefined for unknown actor", () => {
    const profile = getActorProfile("nobody");
    assert.equal(profile, undefined);
  });

  test("returns full profile after seed", () => {
    seedProfile("delta", { tier: "school", score: 95 });
    const profile = getActorProfile("delta");
    assert.ok(profile, "profile should be defined");
    assert.equal(profile.actor, "delta");
    assert.equal(profile.tier, "school");
    assert.equal(profile.score, 95);
    assert.ok(profile.first_seen);
    assert.ok(profile.last_seen);
    assert.ok(profile.tier_changed_at);
  });

  test("returns correct tier and score for practice actor", () => {
    seedProfile("epsilon", { tier: "practice", score: 55 });
    const profile = getActorProfile("epsilon");
    assert.ok(profile);
    assert.equal(profile.tier, "practice");
    assert.equal(profile.score, 55);
  });
});

// ---------------------------------------------------------------------------
// listActors
// ---------------------------------------------------------------------------

describe("listActors", () => {
  test("returns empty array when no profiles exist", () => {
    const actors = listActors();
    assert.deepEqual(actors, []);
  });

  test("returns actors sorted by score descending", () => {
    seedProfile("low", { tier: "hold", score: 10 });
    seedProfile("mid", { tier: "practice", score: 55 });
    seedProfile("high", { tier: "school", score: 99 });

    const actors = listActors();
    assert.equal(actors.length, 3);
    assert.equal(actors[0].actor, "high");
    assert.equal(actors[1].actor, "mid");
    assert.equal(actors[2].actor, "low");
  });

  test("respects limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      seedProfile(`actor-${i}`, { score: i * 10 });
    }
    const actors = listActors(3);
    assert.equal(actors.length, 3);
  });

  test("default limit is 50", () => {
    for (let i = 0; i < 60; i++) {
      seedProfile(`bulk-${i}`, { score: i });
    }
    const actors = listActors();
    assert.equal(actors.length, 50);
  });
});

// ---------------------------------------------------------------------------
// recordRoutingDecision
// ---------------------------------------------------------------------------

describe("recordRoutingDecision", () => {
  test("inserts a routing decision row", () => {
    const db = getDb();
    recordRoutingDecision("actor-rd", "some-tool", "school", "test reason");
    const row = db
      .prepare("SELECT * FROM routing_decisions WHERE actor = ?")
      .get("actor-rd") as any;
    assert.ok(row, "row should exist");
    assert.equal(row.actor, "actor-rd");
    assert.equal(row.tool, "some-tool");
    assert.equal(row.decision, "school");
    assert.equal(row.reason, "test reason");
    assert.equal(row.decided_by, "proxy-server");
    assert.ok(row.ts);
  });

  test("custom decidedBy is stored", () => {
    const db = getDb();
    recordRoutingDecision(
      "actor-custom",
      "tool-x",
      "hold",
      "blocked",
      "custom-decider",
    );
    const row = db
      .prepare("SELECT decided_by FROM routing_decisions WHERE actor = ?")
      .get("actor-custom") as any;
    assert.equal(row.decided_by, "custom-decider");
  });

  test("multiple decisions for same actor accumulate", () => {
    const db = getDb();
    for (const tier of ["school", "practice", "hold"] as const) {
      recordRoutingDecision("actor-multi-rd", "t", tier, "r");
    }
    const c = db
      .prepare("SELECT COUNT(*) as n FROM routing_decisions WHERE actor = ?")
      .get("actor-multi-rd") as { n: number };
    assert.equal(c.n, 3);
  });

  test("all three tier values are accepted", () => {
    for (const tier of ["school", "practice", "hold"] as const) {
      assert.doesNotThrow(() =>
        recordRoutingDecision(`tier-test-${tier}`, "t", tier, "r"),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// queryRaw
// ---------------------------------------------------------------------------

describe("queryRaw", () => {
  test("SELECT returns rows", () => {
    ingestAuditEvent({
      ts: new Date().toISOString(),
      source: "s",
      tool: "t",
      actor: "qr-actor",
      status: "success",
    });
    const rows = queryRaw(
      "SELECT actor, status FROM events WHERE actor = 'qr-actor'",
    );
    assert.equal((rows as any[]).length, 1);
    assert.equal((rows[0] as any).actor, "qr-actor");
  });

  test("SELECT COUNT returns numeric result", () => {
    for (let i = 0; i < 3; i++) {
      ingestAuditEvent({
        ts: new Date().toISOString(),
        source: "s",
        tool: "t",
        actor: "count-actor",
        status: "success",
      });
    }
    const rows = queryRaw(
      "SELECT COUNT(*) as n FROM events WHERE actor = 'count-actor'",
    ) as any[];
    assert.equal(rows[0].n, 3);
  });

  test("SELECT with no matches returns empty array", () => {
    const rows = queryRaw("SELECT * FROM events WHERE actor = 'ghost'");
    assert.deepEqual(rows, []);
  });

  test("non-SELECT throws an error", () => {
    assert.throws(
      () =>
        queryRaw(
          "INSERT INTO events (ts, source, tool, actor, status) VALUES ('t','s','t','a','ok')",
        ),
      /Only SELECT/i,
    );
  });

  test("DROP statement is rejected", () => {
    assert.throws(() => queryRaw("DROP TABLE events"), /Only SELECT/i);
  });

  test("UPDATE statement is rejected", () => {
    assert.throws(
      () => queryRaw("UPDATE events SET status='x' WHERE 1=1"),
      /Only SELECT/i,
    );
  });
});

// ---------------------------------------------------------------------------
// getReadonlyDb
// ---------------------------------------------------------------------------

describe("getReadonlyDb", () => {
  test("returns a db instance even when file does not yet exist", () => {
    const db = getReadonlyDb();
    assert.ok(db, "should return a Database instance");
  });

  test("readonly db can read events written by write db", () => {
    const writeDb = getDb();
    writeDb
      .prepare(
        `INSERT INTO events (ts, source, tool, actor, status) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(new Date().toISOString(), "s", "t", "rodb-actor", "success");

    const roDB = getReadonlyDb();
    const row = roDB
      .prepare("SELECT actor FROM events WHERE actor = ?")
      .get("rodb-actor") as any;
    assert.equal(row?.actor, "rodb-actor");
  });
});

// ---------------------------------------------------------------------------
// __resetTrustDbForTests
// ---------------------------------------------------------------------------

describe("__resetTrustDbForTests", () => {
  test("allows a new db to be opened at a fresh path", () => {
    const db1 = getDb();
    ingestAuditEvent({
      ts: new Date().toISOString(),
      source: "s",
      tool: "t",
      actor: "reset-actor",
      status: "success",
    });
    const c1 = db1.prepare("SELECT COUNT(*) as n FROM events").get() as {
      n: number;
    };
    assert.equal(c1.n, 1);

    // Reset and point to a fresh file
    __resetTrustDbForTests();
    const newFile = join(tmpdir(), `gruff-trust-reset-${Date.now()}.sqlite`);
    process.env.GRUFF_TRUST_SQLITE = newFile;

    try {
      const db2 = getDb();
      const c2 = db2.prepare("SELECT COUNT(*) as n FROM events").get() as {
        n: number;
      };
      assert.equal(c2.n, 0, "fresh db should start with 0 events");
    } finally {
      __resetTrustDbForTests();
      try {
        unlinkSync(newFile);
      } catch {
        /* ignore */
      }
    }
  });

  test("GRUFF_TRUST_SQLITE env var controls db path", () => {
    // Confirmed by the beforeEach/afterEach lifecycle — each test gets a unique path
    assert.ok(
      process.env.GRUFF_TRUST_SQLITE?.includes("gruff-trust-"),
      "env var should be set to a temp path",
    );
    const db = getDb();
    assert.ok(
      existsSync(process.env.GRUFF_TRUST_SQLITE!),
      "db file should exist after getDb()",
    );
    // Suppress unused-var warning on db
    void db;
  });
});
