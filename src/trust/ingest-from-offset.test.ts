import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { ingestAuditEvent, deriveActor } from "./ingester.js";
import { getDb, resetDb } from "./db.js";
import { mkdtempSync, rmSync, existsSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("ingester.ts - ingestFromOffset simulation", () => {
  let tempDir: string;
  let auditPath: string;
  let tempDbPath: string;

  beforeEach(() => {
    resetDb();
    tempDir = mkdtempSync(join(tmpdir(), "ingest-offset-"));
    auditPath = join(tempDir, "audit.ndjson");
    tempDbPath = join(tempDir, "test.sqlite");
    process.env.GRUFF_TRUST_SQLITE = tempDbPath;
  });

  afterEach(() => {
    resetDb();
    if (existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true });
    delete process.env.GRUFF_TRUST_SQLITE;
  });

  it("should ingest multiple events via ingestAuditEvent (simulates ingestFromOffset)", () => {
    const events = [
      { ts: new Date().toISOString(), source: "test", tool: "t1", actor: "a1", status: "success", duration_ms: 100 },
      { ts: new Date().toISOString(), source: "test", tool: "t2", actor: "a1", status: "failure", duration_ms: 200 },
      { ts: new Date().toISOString(), source: "test", tool: "t3", actor: "a2", status: "success", duration_ms: 150 },
    ];

    const results = events.map(e => ingestAuditEvent(e));
    assert.strictEqual(results.every(r => r === true), true);

    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM events").get() as { c: number };
    assert.strictEqual(count.c, 3);
  });

  it("should handle large batch of events", () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      ts: new Date().toISOString(),
      source: "test",
      tool: `tool-${i}`,
      actor: "batch-actor",
      status: i % 2 === 0 ? "success" as const : "failure" as const,
      duration_ms: 100 + i,
    }));

    const results = events.map(e => ingestAuditEvent(e));
    assert.strictEqual(results.filter(r => r === true).length, 10);

    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as c FROM events WHERE actor = ?").get("batch-actor") as { c: number };
    assert.strictEqual(count.c, 10);
  });
});
