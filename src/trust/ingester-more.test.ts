import { describe, it, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import Database from "better-sqlite3";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync, existsSync, unwatchFile } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface RuntimePaths {
  tempHome: string;
  auditPath: string;
  statePath: string;
  dbPath: string;
}

function makeRuntime(): RuntimePaths {
  const tempHome = mkdtempSync(join(tmpdir(), "gruff-ingester-cli-"));
  const auditDir = join(tempHome, ".echoes");
  const gruffDir = join(tempHome, ".gruff");
  mkdirSync(auditDir, { recursive: true });
  mkdirSync(gruffDir, { recursive: true });
  return {
    tempHome,
    auditPath: join(auditDir, "audit.ndjson"),
    statePath: join(gruffDir, "ingester.state"),
    dbPath: join(gruffDir, "trust.sqlite"),
  };
}

async function loadModules(runtime: RuntimePaths) {
  process.env.HOME = runtime.tempHome;
  process.env.GRUFF_TRUST_SQLITE = runtime.dbPath;
  const dbModule = await import("./db.js");
  dbModule.resetDb();
  const ingesterModule = await import(`./ingester.ts?case=${Date.now()}-${Math.random()}`);
  return { dbModule, ingesterModule };
}

async function waitFor(predicate: () => boolean, timeoutMs = 7000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("ingester.ts - in-process coverage", () => {
  const tempHomes: string[] = [];

  afterEach(async () => {
    const dbModule = await import("./db.js");
    dbModule.resetDb();
    delete process.env.GRUFF_TRUST_SQLITE;
    while (tempHomes.length > 0) {
      const tempHome = tempHomes.pop();
      if (tempHome && existsSync(tempHome)) {
        rmSync(tempHome, { recursive: true, force: true });
      }
    }
  });

  it("should ingest events, handle malformed lines, and reset after truncation", async () => {
    const runtime = makeRuntime();
    tempHomes.push(runtime.tempHome);
    const { dbModule, ingesterModule } = await loadModules(runtime);

    writeFileSync(
      runtime.auditPath,
      [
        JSON.stringify({
          ts: "2026-04-24T00:00:00.000Z",
          source: "cli-test",
          tool: "alpha",
          actor: "actor-one",
          session_id: "sess-one",
          status: "success",
          metadata: { actor: "actor-one", session_id: "sess-one", padding: "x".repeat(400) },
        }),
        "",
      ].join("\n"),
      "utf8"
    );

    await ingesterModule.__testing.runOnce();

    writeFileSync(
      runtime.auditPath,
      [
        "{bad json",
        JSON.stringify({
          ts: "2026-04-24T00:00:10.000Z",
          source: "cli-test",
          tool: "beta",
          actor: "actor-one",
          session_id: "sess-one",
          status: "completed",
          metadata: { actor: "actor-one", session_id: "sess-one" },
        }),
        "",
      ].join("\n"),
      "utf8"
    );

    await ingesterModule.__testing.runOnce();

    dbModule.resetDb();
    const db = new Database(runtime.dbPath, { readonly: true });
    const eventCount = db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number };
    const session = db.prepare(
      "SELECT active, exit_reason, ok_count FROM actor_sessions WHERE actor = ? AND session_id = ?"
    ).get("actor-one", "sess-one") as { active: number; exit_reason: string; ok_count: number };
    db.close();

    const state = JSON.parse(readFileSync(runtime.statePath, "utf8")) as {
      offset: number;
      malformed_count: number;
    };

    assert.strictEqual(ingesterModule.__testing.isCliEntrypoint(), false);
    assert.strictEqual(eventCount.count, 2);
    assert.strictEqual(session.active, 0);
    assert.strictEqual(session.exit_reason, "completed");
    assert.ok(session.ok_count >= 1);
    assert.ok(state.offset > 0);
    assert.strictEqual(state.malformed_count, 1);
  });

  it("should process appended events while watching", async () => {
    const runtime = makeRuntime();
    tempHomes.push(runtime.tempHome);
    const { dbModule, ingesterModule } = await loadModules(runtime);

    writeFileSync(
      runtime.auditPath,
      JSON.stringify({
        ts: "2026-04-24T00:01:00.000Z",
        source: "cli-watch",
        tool: "start",
        actor: "watch-actor",
        session_id: "watch-sess",
        status: "success",
        metadata: { actor: "watch-actor", session_id: "watch-sess" },
      }) + "\n",
      "utf8"
    );

    await ingesterModule.__testing.runWatch();

    appendFileSync(
      runtime.auditPath,
      JSON.stringify({
        ts: "2026-04-24T00:01:05.000Z",
        source: "cli-watch",
        tool: "finish",
        actor: "watch-actor",
        session_id: "watch-sess",
        status: "completed",
        metadata: { actor: "watch-actor", session_id: "watch-sess" },
      }) + "\n",
      "utf8"
    );

    try {
      await waitFor(() => {
        dbModule.resetDb();
        const db = new Database(runtime.dbPath, { readonly: true });
        const row = db.prepare("SELECT COUNT(*) AS count FROM events WHERE actor = ?").get("watch-actor") as { count: number };
        db.close();
        return row.count === 2;
      });
    } finally {
      unwatchFile(ingesterModule.__testing.paths.AUDIT_PATH);
      dbModule.resetDb();
    }

    const db = new Database(runtime.dbPath, { readonly: true });
    const session = db.prepare(
      "SELECT active, exit_reason FROM actor_sessions WHERE actor = ? AND session_id = ?"
    ).get("watch-actor", "watch-sess") as { active: number; exit_reason: string };
    db.close();

    assert.strictEqual(session.active, 0);
    assert.strictEqual(session.exit_reason, "completed");
  });
});
