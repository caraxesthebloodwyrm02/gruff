// test-hooks.ts - Pre-post hooks with tailored function calls for signal chains
import { randomBytes, randomUUID } from "crypto";
import {
  getDb,
  trustDbPath,
  getActorProfile,
  startSession,
  heartbeatSession,
  closeSession,
  resetDb,
} from "./db.js";
import { recomputeActor } from "./scorer.js";
import { ingestAuditEvent } from "./ingester.js";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// ─── Tailored Variable Generator ───────────────────────────────────

export function generateActorId(prefix = "actor"): string {
  return `${prefix}-${randomBytes(4).toString("hex")}`;
}

export function generateSessionId(actorId: string): string {
  return `sess-${actorId}-${Date.now()}-${randomBytes(2).toString("hex")}`;
}

export function generateProcessId(sessionId: string): string {
  return sessionId;
}

// ─── Pre-Hook: Scenario Setup ─────────────────────────────────────

export interface ScenarioContext {
  actorId: string;
  sessionId: string;
  processId: string;
  profileId: string;
  tempDir: string;
  tempDbPath: string;
}

export function setupScenario(options?: {
  actorId?: string;
  tier?: "school" | "practice" | "hold";
  score?: number;
  eventCount?: number;
}): ScenarioContext {
  const actorId = options?.actorId ?? generateActorId();
  const sessionId = generateSessionId(actorId);
  const processId = generateProcessId(sessionId);
  const profileId = actorId;

  const tempDir = mkdtempSync(join(tmpdir(), "gruff-scenario-"));
  const tempDbPath = join(tempDir, "test.sqlite");
  process.env.GRUFF_TRUST_SQLITE = tempDbPath;

  resetDb();

  startSession(actorId, sessionId, {
    scenario: true,
    tier: options?.tier,
    score: options?.score,
  });

  if (options?.tier || options?.score !== undefined) {
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO actor_profile
      (actor, first_seen, last_seen, event_count, ok_count, err_count, recent_err_count, score, tier, tier_changed_at, notes_json)
      VALUES (?, datetime('now'), datetime('now'), ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      actorId,
      options?.eventCount ?? 10,
      Math.round((options?.score ?? 50) * 0.8),
      Math.round((100 - (options?.score ?? 50)) * 0.2),
      Math.round((100 - (options?.score ?? 50)) * 0.1),
      options?.score ?? 50,
      options?.tier ?? "practice",
      JSON.stringify({ scenario: true })
    );
    recomputeActor(actorId);
  }

  return { actorId, sessionId, processId, profileId, tempDir, tempDbPath };
}

// ─── Signal Chain Functions ──────────────────────────────────────

export interface Signal {
  status: "success" | "failure" | "error" | "timeout";
  tool?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export function sendSignalChain(
  actorId: string,
  sessionId: string,
  signals: Signal[]
): Array<{ signal: Signal; ingested: boolean }> {
  const results: Array<{ signal: Signal; ingested: boolean }> = [];

  for (const sig of signals) {
    const event = {
      ts: new Date().toISOString(),
      source: "test-scenario",
      tool: sig.tool ?? "test-tool",
      actor: actorId,
      status: sig.status,
      duration_ms: sig.duration_ms ?? 100,
      metadata: sig.metadata ?? { session_id: sessionId },
      session_id: sessionId,
    };

    const ingested = ingestAuditEvent(event);
    results.push({ signal: sig, ingested });

    heartbeatSession(actorId, sessionId);
  }

  recomputeActor(actorId);
  return results;
}

// ─── Query Functions ───────────────────────────────────────────

export function printActorProfile(profileId: string): Record<string, unknown> | null {
  const profile = getActorProfile(profileId);
  console.log("=== Actor Profile ===");
  console.log(JSON.stringify(profile, null, 2));
  console.log("=== End Profile ===");
  return profile as Record<string, unknown> | null;
}

export function queryProcessId(processId: string): Record<string, unknown> | null {
  const db = getDb();
  const session = db.prepare(
    "SELECT * FROM actor_sessions WHERE session_id = ? ORDER BY started_at DESC LIMIT 1"
  ).get(processId) as Record<string, unknown> | undefined;

  console.log("=== Process (Session) ===");
  console.log(JSON.stringify(session, null, 2));
  console.log("=== End Process ===");
  return session ?? null;
}

export function querySignalsAgainstProfileId(
  profileId: string,
  limit = 50
): Array<Record<string, unknown>> {
  const db = getDb();
  const events = db.prepare(
    "SELECT * FROM events WHERE actor = ? ORDER BY ts DESC LIMIT ?"
  ).all(profileId, limit) as Array<Record<string, unknown>>;

  console.log(`=== Signals for Profile ${profileId} ===`);
  console.log(JSON.stringify(events, null, 2));
  console.log("=== End Signals ===");
  return events;
}

// ─── Post-Hook: Scenario Teardown ─────────────────────────────────

export function teardownScenario(
  context: ScenarioContext,
  options?: {
    exitReason?: "completed" | "timeout" | "evicted" | "error";
  }
): void {
  try {
    closeSession(context.actorId, context.sessionId, options?.exitReason ?? "completed");
  } catch {}

  resetDb();
  if (existsSync(context.tempDir)) {
    rmSync(context.tempDir, { recursive: true, force: true });
  }
  delete process.env.GRUFF_TRUST_SQLITE;
}

export const ENDPOINT_DETAILS = {
  actorProfile: {
    endpoint: "getActorProfile(actorId)",
    description: "Queries actor_profile table for given actor ID",
    returns: "ActorProfile | null",
    actionable: "Use printActorProfile(profileId) to display and return profile",
  },
  processId: {
    endpoint: "queryProcessId(processId)",
    description: "Queries actor_sessions table for given session ID",
    returns: "ActorSession | null",
    actionable: "Use queryProcessId() to get session details",
  },
  signals: {
    endpoint: "querySignalsAgainstProfileId(profileId)",
    description: "Queries events table for given actor ID",
    returns: "Array<Event>",
    actionable: "Use querySignalsAgainstProfileId() to get all events for actor",
  },
  signalChain: {
    endpoint: "sendSignalChain(actorId, sessionId, signals)",
    description: "Sends multiple events (signals) for actor in session",
    returns: "Array<{ signal, ingested }>",
    actionable: "Use sendSignalChain() to send test events and track results",
  },
} as const;
