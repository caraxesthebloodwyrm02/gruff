#!/usr/bin/env node
/**
 * Tails ~/.echoes/audit.ndjson → ~/.gruff/trust.sqlite.
 * Run via: gruff-ingester [--watch]
 * Automated via systemd user timer (gruff init-automation).
 */
import { createReadStream, statSync, watchFile, mkdirSync } from "node:fs";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { getDb, ingestAuditEvent } from "./db.js";
import { recomputeActor } from "./scorer.js";

const AUDIT_PATH = join(homedir(), ".echoes", "audit.ndjson");
const GRUFF_DIR = join(homedir(), ".gruff");
const STATE_PATH = join(GRUFF_DIR, "ingester.state");

interface State {
  offset: number;
  last_ts: string;
}

function loadState(): State {
  if (existsSync(STATE_PATH)) {
    try {
      return JSON.parse(readFileSync(STATE_PATH, "utf8"));
    } catch {
      /* corrupt — restart from 0 */
    }
  }
  return { offset: 0, last_ts: "" };
}

function saveState(state: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(state), "utf8");
}

function deriveActor(event: Record<string, unknown>): string {
  const m = event.metadata as Record<string, unknown> | undefined;

  // Special case: infrastructure failures attributed to system
  if (m?.reason_code === "GRID_BACKEND_UNAVAILABLE" || m?.error?.toString().includes("ECONNREFUSED")) {
    return "mcp:system";
  }

  return (
    (m?.entity_id as string) ??
    (m?.actor as string) ??
    (m?.subject as string) ??
    (m?.entity as string) ??
    (event.source as string) ??
    "unknown"
  );
}

async function ingestFromOffset(offset: number): Promise<number> {
  if (!existsSync(AUDIT_PATH)) return offset;
  const fileSize = statSync(AUDIT_PATH).size;
  if (fileSize <= offset) return offset;

  const db = getDb();
  const affected = new Set<string>();

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(AUDIT_PATH, {
      start: offset,
      encoding: "utf8",
    });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed);
      } catch {
        return;
      }
      const actor = deriveActor(event);
      ingestAuditEvent({
        ts: (event.timestamp as string) ?? new Date().toISOString(),
        source: (event.source as string) ?? "unknown",
        tool: (event.tool as string) ?? "unknown",
        actor,
        status: (event.status as string) ?? "unknown",
        duration_ms: event.durationMs as number | undefined,
        payload_json: JSON.stringify(event.metadata ?? null),
      });
      affected.add(actor);
    });

    rl.on("close", resolve);
    rl.on("error", reject);
    stream.on("error", reject);
  });

  for (const actor of affected) {
    recomputeActor(db, actor);
  }

  return fileSize;
}

async function runOnce(): Promise<void> {
  mkdirSync(GRUFF_DIR, { recursive: true });
  const state = loadState();
  const newOffset = await ingestFromOffset(state.offset);
  saveState({ offset: newOffset, last_ts: new Date().toISOString() });
  const gained = newOffset - state.offset;
  process.stderr.write(`[gruff-ingester] processed ${gained} bytes, offset now ${newOffset}\n`);
}

async function runWatch(): Promise<void> {
  await runOnce();
  process.stderr.write(`[gruff-ingester] watching ${AUDIT_PATH}\n`);
  watchFile(AUDIT_PATH, { interval: 5000 }, async () => {
    try {
      await runOnce();
    } catch (err) {
      process.stderr.write(`[gruff-ingester] error: ${err}\n`);
    }
  });
}

const watchMode = process.argv.includes("--watch");
if (watchMode) {
  runWatch().catch((e) => {
    process.stderr.write(`[gruff-ingester] fatal: ${e}\n`);
    process.exit(1);
  });
} else {
  runOnce()
    .then(() => process.exit(0))
    .catch((e) => {
      process.stderr.write(`[gruff-ingester] fatal: ${e}\n`);
      process.exit(1);
    });
}
