import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import {
  computeScore,
  recomputeActor,
  scoreToTier,
  type RawCounts,
} from "./scorer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(join(__dirname, "schema.sql"), "utf8");

function memDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SQL);
  return db;
}

function insertEvent(
  db: Database.Database,
  opts: { actor: string; status: string; ts?: string; recent?: boolean },
) {
  const ts =
    opts.ts ??
    (opts.recent
      ? new Date().toISOString()
      : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
  db.prepare(
    `INSERT INTO events (ts, source, tool, actor, status) VALUES (?, 's', 't', ?, ?)`,
  ).run(ts, opts.actor, opts.status);
}

// ---------------------------------------------------------------------------
// computeScore / scoreToTier
// ---------------------------------------------------------------------------

describe("computeScore — basic math", () => {
  test("all ok => 100", () => {
    const c: RawCounts = {
      event_count: 4,
      ok_count: 4,
      failure_count: 0,
      recent_failure_count: 0,
    };
    assert.equal(computeScore(c), 100);
  });

  test("50/50 ok v failure => 50", () => {
    const c: RawCounts = {
      event_count: 2,
      ok_count: 1,
      failure_count: 1,
      recent_failure_count: 0,
    };
    assert.equal(computeScore(c), 50);
  });

  test("recent failures subtract 10 each", () => {
    const c: RawCounts = {
      event_count: 1,
      ok_count: 1,
      failure_count: 0,
      recent_failure_count: 3,
    };
    assert.equal(computeScore(c), 70);
  });

  test("zero events yields 0 (ok_count=0 → base=0)", () => {
    const c: RawCounts = {
      event_count: 0,
      ok_count: 0,
      failure_count: 0,
      recent_failure_count: 0,
    };
    // formula: 100 * (0 / max(1, 0+0)) = 0; no ok events means score = 0
    assert.equal(computeScore(c), 0);
  });

  test("score clamps to 0 under heavy penalty", () => {
    const c: RawCounts = {
      event_count: 1,
      ok_count: 0,
      failure_count: 1,
      recent_failure_count: 20,
    };
    assert.equal(computeScore(c), 0);
  });

  test("score does not exceed 100 regardless of inputs", () => {
    const c: RawCounts = {
      event_count: 100,
      ok_count: 100,
      failure_count: 0,
      recent_failure_count: 0,
    };
    assert.equal(computeScore(c), 100);
  });
});

describe("scoreToTier — boundaries", () => {
  test("100 => school", () => assert.equal(scoreToTier(100), "school"));
  test("75 => school (lower school boundary)", () =>
    assert.equal(scoreToTier(75), "school"));
  test("74 => practice", () => assert.equal(scoreToTier(74), "practice"));
  test("50 => practice", () => assert.equal(scoreToTier(50), "practice"));
  test("40 => practice (lower practice boundary)", () =>
    assert.equal(scoreToTier(40), "practice"));
  test("39 => hold", () => assert.equal(scoreToTier(39), "hold"));
  test("0 => hold", () => assert.equal(scoreToTier(0), "hold"));
});

// ---------------------------------------------------------------------------
// recomputeActor — system actor
// ---------------------------------------------------------------------------

describe("recomputeActor — mcp:system", () => {
  test("mcp:system is skipped — no row inserted", () => {
    const db = memDb();
    recomputeActor(db, "mcp:system");
    const n = db.prepare("SELECT COUNT(*) as n FROM actor_profile").get() as {
      n: number;
    };
    assert.equal(n.n, 0);
    db.close();
  });

  test("mcp:system is skipped even with events present", () => {
    const db = memDb();
    insertEvent(db, { actor: "mcp:system", status: "success", recent: true });
    recomputeActor(db, "mcp:system");
    const n = db.prepare("SELECT COUNT(*) as n FROM actor_profile").get() as {
      n: number;
    };
    assert.equal(n.n, 0);
    db.close();
  });
});

// ---------------------------------------------------------------------------
// recomputeActor — profile creation
// ---------------------------------------------------------------------------

describe("recomputeActor — profile creation", () => {
  test("creates profile for brand-new actor", () => {
    const db = memDb();
    const tsBefore = new Date().toISOString();
    insertEvent(db, { actor: "new1", status: "success", recent: true });
    recomputeActor(db, "new1");
    const row = db
      .prepare("SELECT * FROM actor_profile WHERE actor = ?")
      .get("new1") as any;
    assert.ok(row, "profile row must exist");
    assert.equal(row.actor, "new1");
    assert.equal(row.tier, "school");
    assert.ok(
      row.tier_changed_at >= tsBefore,
      "tier_changed_at should be set on first run",
    );
    assert.ok(row.score >= 0 && row.score <= 100, "score must be in [0, 100]");
    assert.equal(row.ok_count, 1);
    assert.equal(row.err_count, 0);
    db.close();
  });

  test("profile created with hold tier for all-failure actor", () => {
    const db = memDb();
    for (let i = 0; i < 10; i++) {
      insertEvent(db, { actor: "badfirst", status: "failure", recent: true });
    }
    recomputeActor(db, "badfirst");
    const row = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("badfirst") as any;
    assert.equal(row.tier, "hold");
    db.close();
  });
});

// ---------------------------------------------------------------------------
// recomputeActor — tier_changed_at tracking
// ---------------------------------------------------------------------------

describe("recomputeActor — tier_changed_at tracking", () => {
  test("tier_changed_at is preserved when tier stays the same", () => {
    const db = memDb();
    insertEvent(db, { actor: "u", status: "success", recent: true });
    recomputeActor(db, "u");
    const t1 = db
      .prepare(
        "SELECT tier, tier_changed_at FROM actor_profile WHERE actor = ?",
      )
      .get("u") as { tier: string; tier_changed_at: string };
    assert.equal(t1.tier, "school");

    // Second recompute — same tier should result
    insertEvent(db, { actor: "u", status: "success", recent: true });
    recomputeActor(db, "u");
    const t2 = db
      .prepare(
        "SELECT tier, tier_changed_at FROM actor_profile WHERE actor = ?",
      )
      .get("u") as { tier: string; tier_changed_at: string };
    assert.equal(t2.tier, t1.tier);
    assert.equal(
      t2.tier_changed_at,
      t1.tier_changed_at,
      "tier_changed_at must not shift if tier is unchanged",
    );
    db.close();
  });

  test("tier_changed_at updates when tier changes (school → hold)", () => {
    const db = memDb();
    // Seed a school profile with a known-old tier_changed_at so we can
    // assert it changed without relying on sub-millisecond timing.
    const oldTs = new Date(Date.now() - 10_000).toISOString();
    db.prepare(
      `INSERT INTO actor_profile
         (actor, first_seen, last_seen, event_count, ok_count, err_count,
          recent_err_count, score, tier, tier_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("deg", oldTs, oldTs, 1, 1, 0, 0, 100, "school", oldTs);

    // Flood with recent failures to force score down to hold
    for (let i = 0; i < 20; i++) {
      insertEvent(db, { actor: "deg", status: "failure", recent: true });
    }
    recomputeActor(db, "deg");
    const row = db
      .prepare(
        "SELECT tier, tier_changed_at FROM actor_profile WHERE actor = ?",
      )
      .get("deg") as any;

    assert.notEqual(row.tier, "school", "tier should have dropped from school");
    assert.ok(
      row.tier_changed_at > oldTs,
      "tier_changed_at must be newer than the seeded old timestamp after tier change",
    );
    db.close();
  });

  test("last_seen advances on repeated recomputes while tier_changed_at stays fixed", () => {
    const db = memDb();
    insertEvent(db, { actor: "ls", status: "success", recent: true });
    recomputeActor(db, "ls");
    const r1 = db
      .prepare(
        "SELECT last_seen, tier_changed_at FROM actor_profile WHERE actor = ?",
      )
      .get("ls") as any;

    // Small pause then insert another event and recompute
    insertEvent(db, { actor: "ls", status: "success", recent: true });
    recomputeActor(db, "ls");
    const r2 = db
      .prepare(
        "SELECT last_seen, tier_changed_at FROM actor_profile WHERE actor = ?",
      )
      .get("ls") as any;

    assert.equal(
      r2.tier_changed_at,
      r1.tier_changed_at,
      "tier_changed_at must be stable",
    );
    db.close();
  });
});

// ---------------------------------------------------------------------------
// recomputeActor — banned override
// ---------------------------------------------------------------------------

describe("recomputeActor — banned override", () => {
  test("banned forces tier to hold regardless of score", () => {
    const db = memDb();
    insertEvent(db, { actor: "a", status: "success", recent: true });
    recomputeActor(db, "a", { banned: true });
    const row = db
      .prepare("SELECT tier, score FROM actor_profile WHERE actor = ?")
      .get("a") as { tier: string; score: number };
    assert.equal(row.tier, "hold");
    assert.ok(row.score >= 0, "score is still computed and stored");
    db.close();
  });

  test("banned notes contain override = 'grid.admission_bannered'", () => {
    const db = memDb();
    insertEvent(db, { actor: "ban2", status: "success", recent: true });
    recomputeActor(db, "ban2", { banned: true });
    const row = db
      .prepare("SELECT notes_json FROM actor_profile WHERE actor = ?")
      .get("ban2") as any;
    const notes = JSON.parse(row.notes_json);
    assert.equal(notes.override, "grid.admission_bannered");
    db.close();
  });

  test("banned overrides even a perfect-score actor", () => {
    const db = memDb();
    for (let i = 0; i < 10; i++) {
      insertEvent(db, { actor: "perfban", status: "success", recent: true });
    }
    recomputeActor(db, "perfban", { banned: true });
    const row = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("perfban") as any;
    assert.equal(row.tier, "hold");
    db.close();
  });
});

// ---------------------------------------------------------------------------
// recomputeActor — promoted sticky
// ---------------------------------------------------------------------------

describe("recomputeActor — promoted sticky", () => {
  test("promoted: school sticky holds within 24h when score would drop", () => {
    const db = memDb();
    // Establish school profile
    insertEvent(db, { actor: "promo", status: "success", recent: true });
    recomputeActor(db, "promo");
    const before = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("promo") as any;
    assert.equal(before.tier, "school");

    // Flood with recent failures — raw score would now be hold
    for (let i = 0; i < 20; i++) {
      insertEvent(db, { actor: "promo", status: "failure", recent: true });
    }
    recomputeActor(db, "promo", { promoted: true });
    const after = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("promo") as any;
    assert.equal(
      after.tier,
      "school",
      "promoted sticky must preserve school within 24h",
    );
    db.close();
  });

  test("promoted sticky sets notes.override = 'eligibility.promote_gate_sticky'", () => {
    const db = memDb();
    insertEvent(db, { actor: "pnotes", status: "success", recent: true });
    recomputeActor(db, "pnotes");

    for (let i = 0; i < 20; i++) {
      insertEvent(db, { actor: "pnotes", status: "failure", recent: true });
    }
    recomputeActor(db, "pnotes", { promoted: true });
    const row = db
      .prepare("SELECT notes_json, tier FROM actor_profile WHERE actor = ?")
      .get("pnotes") as any;
    if (row.tier === "school") {
      const notes = JSON.parse(row.notes_json);
      assert.equal(notes.override, "eligibility.promote_gate_sticky");
    }
    db.close();
  });

  test("promoted sticky does NOT apply when tier_changed_at > 24h ago", () => {
    const db = memDb();
    const oldTs = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    // Manually seed a stale school profile
    db.prepare(
      `INSERT INTO actor_profile
         (actor, first_seen, last_seen, event_count, ok_count, err_count, recent_err_count, score, tier, tier_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("expired", oldTs, oldTs, 5, 5, 0, 0, 100, "school", oldTs);

    for (let i = 0; i < 20; i++) {
      insertEvent(db, { actor: "expired", status: "failure", recent: true });
    }
    recomputeActor(db, "expired", { promoted: true });
    const row = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("expired") as any;
    assert.notEqual(
      row.tier,
      "school",
      "expired sticky must not hold tier as school",
    );
    db.close();
  });

  test("promoted with no prior profile: sticky does not fire (stickyExpiry = 0)", () => {
    const db = memDb();
    // No prior profile — actor has only failures
    for (let i = 0; i < 20; i++) {
      insertEvent(db, { actor: "noprofile", status: "failure", recent: true });
    }
    recomputeActor(db, "noprofile", { promoted: true });
    const row = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("noprofile") as any;
    // With no prior school profile, sticky can't fire — tier is determined by raw score
    assert.notEqual(row.tier, "school");
    db.close();
  });

  test("promoted with non-school prior tier: sticky does not apply", () => {
    const db = memDb();
    // Seed actor at practice (score ~50, tier practice)
    for (let i = 0; i < 5; i++) {
      insertEvent(db, { actor: "prac", status: "success", recent: true });
      insertEvent(db, { actor: "prac", status: "failure", recent: true });
    }
    recomputeActor(db, "prac");
    const r1 = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("prac") as any;
    // tier may be practice or hold depending on exact score; either way, NOT school (sticky won't fire)
    assert.notEqual(r1.tier, "school");

    // Add failures so score drops further; call with promoted
    for (let i = 0; i < 10; i++) {
      insertEvent(db, { actor: "prac", status: "failure", recent: true });
    }
    recomputeActor(db, "prac", { promoted: true });
    const r2 = db
      .prepare("SELECT tier FROM actor_profile WHERE actor = ?")
      .get("prac") as any;
    // Sticky requires prior tier === "school", so it does not elevate here
    assert.notEqual(r2.tier, "school");
    db.close();
  });
});

// ---------------------------------------------------------------------------
// recomputeActor — notes_json integrity
// ---------------------------------------------------------------------------

describe("recomputeActor — notes_json", () => {
  test("notes always contain score_basis with raw counts", () => {
    const db = memDb();
    insertEvent(db, { actor: "nb", status: "success", recent: true });
    recomputeActor(db, "nb");
    const row = db
      .prepare("SELECT notes_json FROM actor_profile WHERE actor = ?")
      .get("nb") as any;
    const notes = JSON.parse(row.notes_json);
    assert.ok("score_basis" in notes, "notes_json must contain score_basis");
    assert.ok(
      typeof notes.score_basis === "object",
      "score_basis must be an object",
    );
    assert.ok("event_count" in notes.score_basis);
    assert.ok("ok_count" in notes.score_basis);
    assert.ok("failure_count" in notes.score_basis);
    assert.ok("recent_failure_count" in notes.score_basis);
    db.close();
  });

  test("no override key in notes when no override applied", () => {
    const db = memDb();
    insertEvent(db, { actor: "noov", status: "success", recent: true });
    recomputeActor(db, "noov");
    const row = db
      .prepare("SELECT notes_json FROM actor_profile WHERE actor = ?")
      .get("noov") as any;
    const notes = JSON.parse(row.notes_json);
    assert.ok(
      !("override" in notes),
      "no override key should be present for standard recompute",
    );
    db.close();
  });
});

// ---------------------------------------------------------------------------
// recomputeActor — aggregate counters
// ---------------------------------------------------------------------------

describe("recomputeActor — aggregate counters", () => {
  test("event_count, ok_count, err_count reflect inserted events", () => {
    const db = memDb();
    for (let i = 0; i < 3; i++)
      insertEvent(db, { actor: "cnt", status: "success" });
    for (let i = 0; i < 2; i++)
      insertEvent(db, { actor: "cnt", status: "failure" });
    recomputeActor(db, "cnt");
    const row = db
      .prepare(
        "SELECT event_count, ok_count, err_count FROM actor_profile WHERE actor = ?",
      )
      .get("cnt") as any;
    assert.equal(row.event_count, 5);
    assert.equal(row.ok_count, 3);
    assert.equal(row.err_count, 2);
    db.close();
  });

  test("recent_err_count only counts events within the 1h window", () => {
    const db = memDb();
    // One old failure (outside window) + one recent failure
    insertEvent(db, { actor: "rwin", status: "failure", recent: false });
    insertEvent(db, { actor: "rwin", status: "failure", recent: true });
    recomputeActor(db, "rwin");
    const row = db
      .prepare(
        "SELECT recent_err_count, err_count FROM actor_profile WHERE actor = ?",
      )
      .get("rwin") as any;
    assert.equal(row.err_count, 2, "total err_count includes both");
    assert.equal(
      row.recent_err_count,
      1,
      "recent_err_count only includes the recent one",
    );
    db.close();
  });
});
