import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { ingestAuditEvent, deriveActor } from "./ingester.js";
import { getDb, resetDb } from "./db.js";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("ingester.ts - Coverage boost", () => {
  let tempDir: string;
  let tempDbPath: string;

  beforeEach(() => {
    resetDb();
    tempDir = mkdtempSync(join(tmpdir(), "ingester-cov-"));
    tempDbPath = join(tempDir, "test.sqlite");
    process.env.GRUFF_TRUST_SQLITE = tempDbPath;
  });

  afterEach(() => {
    resetDb();
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    delete process.env.GRUFF_TRUST_SQLITE;
  });

  it("should ingest batch of events (simulate ingestFromOffset)", () => {
    const events = [
      { ts: new Date().toISOString(), source: "test", tool: "t1", actor: "batch-actor", status: "success", duration_ms: 100 },
      { ts: new Date().toISOString(), source: "test", tool: "t2", actor: "batch-actor", status: "failure", duration_ms: 200 },
      { ts: new Date().toISOString(), source: "test", tool: "t3", actor: "batch-actor", status: "success", duration_ms: 150 },
    ];

    const results = events.map(e => ingestAuditEvent(e));
    assert.strictEqual(results.every(r => r === true), true);

    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM events WHERE actor = ?").get("batch-actor") as { c: number };
    assert.strictEqual(count.c, 3);
  });

  it("should handle various actor derivation scenarios", () => {
    assert.strictEqual(deriveActor({ metadata: { actor: "a1" } }), "a1");
    assert.strictEqual(deriveActor({ metadata: { client_id: "c1" } }), "c1");
    assert.strictEqual(deriveActor({ source: "echoes" }), "echoes");
    assert.strictEqual(deriveActor({ metadata: { reason_code: "GRID_BACKEND_UNAVAILABLE" } }), "mcp:system");
    assert.strictEqual(deriveActor({ metadata: { error: "ECONNREFUSED" } }), "mcp:system");
    assert.strictEqual(deriveActor({ }), "unknown");
  });

  it("should handle duplicate detection", () => {
    const event = { ts: new Date().toISOString(), source: "test", tool: "dup", actor: "dup-actor", status: "success" };

    assert.strictEqual(ingestAuditEvent(event), true);
    assert.strictEqual(ingestAuditEvent(event), false); // duplicate

    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM events WHERE actor = ?").get("dup-actor") as { c: number };
    assert.strictEqual(count.c, 1);
  });
});
