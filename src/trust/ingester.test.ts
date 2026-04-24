import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  ingestAuditEvent,
  deriveActor,
  sendProportion,
} from "./ingester.js";
import { getDb, resetDb } from "./db.js";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("ingester.ts - Event ingestion & actors", () => {
  let tempDir: string;
  let tempDbPath: string;

  beforeEach(() => {
    resetDb();
    tempDir = mkdtempSync(join(tmpdir(), "gruff-ingester-test-"));
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

  it("should derive actor from event metadata", () => {
    const event1 = { metadata: { actor: "claude" } };
    assert.strictEqual(deriveActor(event1), "claude");

    const event2 = { metadata: { client_id: "gemini-proxy" } };
    assert.strictEqual(deriveActor(event2), "gemini-proxy");

    const event3 = { source: "echoes", metadata: {} };
    assert.strictEqual(deriveActor(event3), "echoes");

    const event4 = {};
    assert.strictEqual(deriveActor(event4), "unknown");
  });

  it("should derive mcp:system actor for connection errors", () => {
    const event1 = { metadata: { reason_code: "GRID_BACKEND_UNAVAILABLE" } };
    assert.strictEqual(deriveActor(event1), "mcp:system");

    const event2 = { metadata: { error: "ECONNREFUSED something" } };
    assert.strictEqual(deriveActor(event2), "mcp:system");
  });

  it("should ingest valid audit event", () => {
    const event = {
      ts: new Date().toISOString(),
      source: "test",
      tool: "test-tool",
      actor: "test-actor",
      status: "success",
      duration_ms: 100,
      metadata: { test: true },
    };

    const result = ingestAuditEvent(event);
    assert.strictEqual(result, true);

    // Verify it was inserted
    const db = getDb();
    const row = db.prepare("SELECT * FROM events WHERE actor = ?").get("test-actor");
    assert.ok(row);
    assert.strictEqual((row as any).status, "success");
  });

  it("should skip duplicate events (idempotent)", () => {
    const event = {
      ts: new Date().toISOString(),
      source: "test",
      tool: "dedup-tool",
      actor: "dedup-actor",
      status: "failure",
    };

    const first = ingestAuditEvent(event);
    const second = ingestAuditEvent(event); // same event

    assert.strictEqual(first, true);
    assert.strictEqual(second, false); // duplicate
  });

  it("should handle missing fields gracefully", () => {
    const event = { status: "success" };
    const result = ingestAuditEvent(event);
    assert.strictEqual(result, true);
  });

  it("should sendProportion (mock fetch)", async () => {
    // Mock global fetch
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    let fetchedUrl = "";
    let fetchedBody = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = async (url: any, options: any) => {
      fetchCalled = true;
      fetchedUrl = url;
      fetchedBody = options?.body || "";
      return {
        status: 200,
        statusText: "OK",
      } as unknown as Response;
    };

    const payload = { schemaVersion: "gruff-proportion-v1", data: { test: true } };
    await sendProportion(payload);

    assert.strictEqual(fetchCalled, true);
    assert.ok(fetchedUrl.includes("localhost:8000") || fetchedUrl.includes("echoes"));
    assert.ok(fetchedBody.includes("gruff-proportion-v1"));

    // Restore
    globalThis.fetch = originalFetch;
  });
});
