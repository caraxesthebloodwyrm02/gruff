// signal-chain.test.ts - Demonstrates pre-post hooks with signal chains
// Shows: print actor profile, query process id, signals against profile id

import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import {
  setupScenario,
  teardownScenario,
  sendSignalChain,
  printActorProfile,
  queryProcessId,
  querySignalsAgainstProfileId,
  generateActorId,
  ENDPOINT_DETAILS,
} from "./test-hooks.js";
import { getActorProfile, getOpenSessions } from "./db.js";
import { computeScore } from "./scorer.js";

describe("Signal Chain Demonstration - Pre-Post Hooks", () => {
  let ctx: ReturnType<typeof setupScenario>;

  beforeEach(() => {
    // PRE-HOOK: Set up scenario with tailored variables
    ctx = setupScenario({
      actorId: generateActorId("signal-test"),
      tier: "practice",
      score: 60,
      eventCount: 20,
    });

    console.log("=== PRE-HOOK: Scenario Setup ===");
    console.log("Actor ID (Profile ID):", ctx.actorId);
    console.log("Session ID (Process ID):", ctx.sessionId);
    console.log("Process ID:", ctx.processId);
    console.log("Temp DB:", ctx.tempDbPath);
    console.log("=== End PRE-HOOK ===");
  });

  afterEach(() => {
    // POST-HOOK: Clean up with high precision
    console.log("=== POST-HOOK: Teardown ===");
    teardownScenario(ctx, { exitReason: "completed" });
    console.log("=== End POST-HOOK ===");
  });

  it("should print actor profile (query against profile ID)", () => {
    // Print actor profile
    const profile = printActorProfile(ctx.profileId);

    assert.ok(profile !== null);
    assert.strictEqual(profile?.actor, ctx.actorId);
    assert.strictEqual(profile?.tier, "practice");

    // Verify endpoint details are clear
    console.log("Endpoint:", ENDPOINT_DETAILS.actorProfile);
  });

  it("should query process ID and verify session", () => {
    // Query process ID (session ID)
    const processInfo = queryProcessId(ctx.processId);

    assert.ok(processInfo !== null);
    assert.strictEqual((processInfo as any).session_id, ctx.sessionId);
    assert.strictEqual((processInfo as any).actor, ctx.actorId);

    // Verify session is active
    const openSessions = getOpenSessions(ctx.actorId);
    assert.ok(openSessions.length >= 1);

    console.log("Endpoint:", ENDPOINT_DETAILS.processId);
  });

  it("should send signal chain and query signals against profile ID", () => {
    // Send signal chain (tailored to scenario)
    const signals = [
      { status: "success" as const, tool: "tool-a", duration_ms: 120 },
      { status: "success" as const, tool: "tool-b", duration_ms: 80 },
      { status: "failure" as const, tool: "tool-a", duration_ms: 200 },
      { status: "success" as const, tool: "tool-c", duration_ms: 50 },
    ];

    const results = sendSignalChain(ctx.actorId, ctx.sessionId, signals);

    assert.strictEqual(results.length, 4);
    assert.ok(results.every(r => r.ingested));

    // Query signals against profile ID (actor)
    const events = querySignalsAgainstProfileId(ctx.profileId, 10);

    assert.ok(events.length >= 4);
    console.log(`Found ${events.length} signals for profile ${ctx.profileId}`);

    console.log("Endpoint:", ENDPOINT_DETAILS.signals);
  });

  it("should demonstrate balanced results (mixed success/failure)", () => {
    // Send balanced signal chain
    const signals = [
      { status: "success" as const, tool: "balanced-a" },
      { status: "failure" as const, tool: "balanced-b" },
      { status: "success" as const, tool: "balanced-c" },
      { status: "failure" as const, tool: "balanced-d" },
      { status: "success" as const, tool: "balanced-e" },
    ];

    sendSignalChain(ctx.actorId, ctx.sessionId, signals);

    // Verify profile updated
    const profile = getActorProfile(ctx.actorId);
    assert.ok(profile !== null);

    // Score should reflect mixed results
    const counts = {
      event_count: 5,
      ok_count: 3,
      failure_count: 2,
      recent_failure_count: 2,
    };
    const score = computeScore(counts);
    console.log("Balanced score:", score);
    assert.ok(score > 0 && score < 100);
  });

  it("should show all endpoint details are actionable", () => {
    console.log("=== All Endpoint Details ===");
    Object.entries(ENDPOINT_DETAILS).forEach(([key, details]) => {
      console.log(`\nEndpoint: ${key}`);
      console.log(`  Function: ${details.endpoint}`);
      console.log(`  Description: ${details.description}`);
      console.log(`  Returns: ${details.returns}`);
      console.log(`  Actionable: ${details.actionable}`);
    });
    console.log("=== End Endpoint Details ===");

    // Verify all endpoints are actionable
    assert.ok(ENDPOINT_DETAILS.actorProfile.actionable);
    assert.ok(ENDPOINT_DETAILS.processId.actionable);
    assert.ok(ENDPOINT_DETAILS.signals.actionable);
    assert.ok(ENDPOINT_DETAILS.signalChain.actionable);
  });
});
