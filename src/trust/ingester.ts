// src/trust/ingester.ts
// Tails ~/.echoes/audit.ndjson → ~/.gruff/trust.sqlite
// Modes:
//   node ingester.js            — single pass, exit
//   node ingester.js --watch     — tail-and-watch mode

import { createReadStream, statSync, watchFile, createWriteStream } from "fs";
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { createHash } from "crypto";
import { homedir } from "os";
import { join } from "path";
import { createInterface } from "readline";
import { getDb, stmt, getActorProfile, startSession, heartbeatSession, closeSession, recordSessionOutcome } from "./db.js";
import { recomputeActor } from "./scorer.js";

// ─── Paths ──────────────────────────────────────────────────────────────────

const AUDIT_PATH = join(homedir(), ".echoes", "audit.ndjson");
const GRUFF_DIR = join(homedir(), ".gruff");
const STATE_PATH = join(GRUFF_DIR, "ingester.state");
const SESSION_ALIVE_PATH = join(GRUFF_DIR, "sessions");

// ─── State ─────────────────────────────────────────────────────────────────

interface IngestState {
  offset: number;
  last_ts: string;
  malformed_count: number;
}

function loadState(): IngestState {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf8"));
    } catch { /* ignore */ }
  }
  return { offset: 0, last_ts: "", malformed_count: 0 };
}

function saveState(state: IngestState): void {
  mkdirSync(GRUFF_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state), "utf8");
}

// ─── Fingerprint dedup ───────────────────────────────────────────────────────

function fingerprintForEvent(event: Record<string, unknown>): string {
  const canonical = JSON.stringify({
    ts: event.ts,
    source: event.source,
    tool: event.tool,
    actor: event.actor,
    status: event.status,
    payload_json: event.payload_json ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function isDuplicate(fingerprint: string): boolean {
  const db = getDb();
  const row = stmt(db,
    "SELECT 1 FROM event_fingerprints WHERE fingerprint = ?"
  ).get(fingerprint);
  return row !== undefined;
}

function markFingerprint(fingerprint: string): void {
  const db = getDb();
  stmt(db,
    "INSERT OR IGNORE INTO event_fingerprints (fingerprint, seen_at) VALUES (?, ?)"
  ).run(fingerprint, new Date().toISOString());
}

// ─── Event ingestion ─────────────────────────────────────────────────────────

export function ingestAuditEvent(event: Record<string, unknown>): boolean {
  const db = getDb();
  const fingerprint = fingerprintForEvent(event);

  // Idempotent: skip if already seen
  const marker = stmt(db,
    "INSERT OR IGNORE INTO event_fingerprints (fingerprint, seen_at) VALUES (?, ?)"
  ).run(fingerprint, new Date().toISOString());

  if (marker.changes === 0) return false; // duplicate

  stmt(db, `
    INSERT INTO events (ts, source, tool, actor, status, duration_ms, payload_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.ts ?? new Date().toISOString(),
    event.source ?? "unknown",
    event.tool ?? "unknown",
    event.actor ?? "unknown",
    event.status ?? "unknown",
    event.duration_ms ?? null,
    typeof event.payload_json === "string"
      ? event.payload_json
      : JSON.stringify(event.metadata ?? null),
  );

  return true;
}

// ─── Actor derivation ────────────────────────────────────────────────────────

export function deriveActor(event: Record<string, unknown>): string {
  const m = event.metadata as Record<string, unknown> | undefined;

  // System-level errors → route to mcp:system bucket
  if (
    m?.reason_code === "GRID_BACKEND_UNAVAILABLE" ||
    String(m?.error ?? "").includes("ECONNREFUSED")
  ) {
    return "mcp:system";
  }

  // Priority chain for actor identity
  const candidates = [
    m?.entity_id,
    m?.server_id,
    m?.client,
    m?.actor,
    m?.subject,
    m?.entity,
    event.source,
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") {
      return String(c);
    }
  }

  return "unknown";
}

// ─── Catch/release session management ────────────────────────────────────────

function sessionPath(actor: string, sessionId: string): string {
  const dir = join(SESSION_ALIVE_PATH, actor.replace(/[^a-z0-9_-]/gi, "_"));
  mkdirSync(dir, { recursive: true });
  return join(dir, `${sessionId}.alive`);
}

function openSession(actor: string, sessionId: string, metadata: Record<string, unknown>): void {
  startSession(actor, sessionId, metadata);

  // Touch sentinel file for external watchers
  try {
    writeFileSync(sessionPath(actor, sessionId), JSON.stringify({
      started_at: new Date().toISOString(),
      actor,
      session_id: sessionId,
    }), "utf8");
  } catch { /* non-fatal */ }
}

function catchSession(actor: string, sessionId: string, ok: boolean, reason: string): void {
  recordSessionOutcome(actor, sessionId, ok);
  closeSession(actor, sessionId, reason as "timeout" | "completed" | "evicted" | "error");

  // Remove sentinel
  try {
    const p = sessionPath(actor, sessionId);
    if (existsSync(p)) import("fs").then(({ unlinkSync }) => unlinkSync(p));
  } catch { /* non-fatal */ }
}

function heartbeat(actor: string, sessionId: string): void {
  heartbeatSession(actor, sessionId);
  try {
    const p = sessionPath(actor, sessionId);
    if (existsSync(p)) {
      const data = JSON.parse(readFileSync(p, "utf8"));
      data.last_heartbeat = new Date().toISOString();
      writeFileSync(p, JSON.stringify(data), "utf8");
    }
  } catch { /* non-fatal */ }
}

// ─── Main ingest pass ───────────────────────────────────────────────────────

async function ingestFromOffset(offset: number): Promise<{ newOffset: number; malformed: number }> {
  if (!existsSync(AUDIT_PATH)) {
    return { newOffset: offset, malformed: 0 };
  }

  const fileSize = statSync(AUDIT_PATH).size;
  let startOffset = offset;

  if (fileSize < offset) {
    process.stderr.write(
      `[gruff-ingester] warn: audit log rotated/truncated (size=${fileSize}, offset=${offset}); resetting\n`
    );
    startOffset = 0;
  }

  if (fileSize === startOffset) {
    return { newOffset: startOffset, malformed: 0 };
  }

  const db = getDb();
  const affected = new Set<string>();
  let malformed = 0;
  let byteCursor = startOffset;

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(AUDIT_PATH, { start: startOffset, encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (rawLine: string) => {
      const lineBytes = Buffer.byteLength(rawLine + "\n", "utf8");
      const lineStart = byteCursor;
      byteCursor += lineBytes;
      const trimmed = rawLine.trim();
      if (!trimmed) return;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed);
      } catch {
        malformed++;
        process.stderr.write(
          JSON.stringify({
            level: "warn",
            code: "MALFORMED_AUDIT_LINE",
            path: AUDIT_PATH,
            offset: lineStart,
            preview: trimmed.slice(0, 160),
          }) + "\n"
        );
        return;
      }

      const actor = deriveActor(event);
      const sessionId = String(event.session_id ?? event.sessionId ?? `s-${Date.now()}`);

      // Open session on first event for this actor in this pass
      if (!affected.has(actor)) {
        openSession(actor, sessionId, event.metadata as Record<string, unknown> ?? {});
      } else {
        heartbeat(actor, sessionId);
      }

      // Persist event
      if (ingestAuditEvent({ ...event, actor })) {
        affected.add(actor);
      }

      // Catch on terminal status: 'timeout' | 'evicted' | 'completed'
      const status = String(event.status ?? "").toLowerCase();
      if (status === "timeout" || status === "evicted" || status === "completed") {
        const ok = status !== "timeout" && status !== "evicted";
        catchSession(actor, sessionId, ok, status);
      }
    });

    rl.on("close", resolve);
    rl.on("error", reject);
    stream.on("error", reject);
  });

  // Recompute scores for all affected actors
  for (const actor of affected) {
    try {
      recomputeActor(actor);
    } catch (e) {
      process.stderr.write(`[gruff-ingester] warn: recomputeActor(${actor}) failed: ${e}\n`);
    }
  }

  return { newOffset: fileSize, malformed };
}

// ─── Single pass ─────────────────────────────────────────────────────────────

async function runOnce(): Promise<void> {
  mkdirSync(GRUFF_DIR, { recursive: true });
  const state = loadState();
  const { newOffset, malformed } = await ingestFromOffset(state.offset);

  const gained = newOffset - state.offset;
  saveState({
    offset: newOffset,
    last_ts: new Date().toISOString(),
    malformed_count: state.malformed_count + malformed,
  });

  process.stderr.write(
    `[gruff-ingester] processed ${gained} bytes → offset ${newOffset}, malformed=${malformed}\n`
  );
}

// ─── Watch mode ───────────────────────────────────────────────────────────────

async function runWatch(): Promise<void> {
  await runOnce();
  process.stderr.write(`[gruff-ingester] watching ${AUDIT_PATH} (5s poll)\n`);

  watchFile(AUDIT_PATH, { interval: 5_000 }, async () => {
    try {
      await runOnce();
    } catch (e) {
      process.stderr.write(`[gruff-ingester] error: ${e}\n`);
    }
  });
}

// ─── CLI entry ───────────────────────────────────────────────────────────────

const watch = process.argv.includes("--watch");
if (watch) {
  runWatch().catch(e => {
    process.stderr.write(`[gruff-ingester] fatal: ${e}\n`);
    process.exit(1);
  });
} else {
  runOnce()
    .then(() => process.exit(0))
    .catch(e => {
      process.stderr.write(`[gruff-ingester] fatal: ${e}\n`);
      process.exit(1);
    });
}
