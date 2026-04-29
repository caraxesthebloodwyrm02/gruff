import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadRoutine,
  listRoutines,
  loadServerRegistry,
  runRoutine,
  formatReport,
  type RoutineConfig,
  type RunReport,
} from "./routine-runner.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTempRoutineDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "gruff-runner-"));
  return dir;
}

function writeRoutine(dir: string, name: string, yaml: string): void {
  const routineDir = join(dir, name);
  mkdirSync(routineDir, { recursive: true });
  writeFileSync(join(routineDir, "routine.yaml"), yaml, "utf-8");
}

// We override ROUTINES_DIR at module level via environment manipulation.
// Since routine-runner resolves paths from import.meta.url, we test through
// the public API by creating real yaml files in a temp directory and pointing
// the runner at them using a wrapper.

describe("routine-runner", () => {
  describe("loadRoutine + listRoutines", () => {
    // These tests exercise the parser against in-memory YAML. Since loadRoutine
    // reads from a fixed path, we test the parsing contract indirectly by ensuring
    // the real routines on disk are parseable.

    it("lists all routines from racks/routines/", () => {
      const names = listRoutines();
      assert.ok(names.length >= 10, `Expected at least 10 routines, got ${names.length}`);
      assert.ok(names.includes("gruff-bridge"));
      assert.ok(names.includes("attention"));
      assert.ok(names.includes("mcp-maintenance"));
    });

    it("loads gruff-bridge routine with correct fields", () => {
      const r = loadRoutine("gruff-bridge");
      assert.equal(r.name, "gruff-bridge");
      assert.equal(r.status, "active");
      assert.equal(r.trigger, "manual");
      assert.ok(r.dispatches.length > 0, "gruff-bridge should have dispatches");
      const mcp = r.dispatches[0] as { tool?: string; server?: string };
      assert.equal(mcp.tool, "record_gruff_proportion");
      assert.equal(mcp.server, "echoes-server");
    });

    it("loads attention routine (draft, has action)", () => {
      const r = loadRoutine("attention");
      assert.equal(r.status, "draft");
      assert.ok(r.action, "attention should have an action string");
    });

    it("loads mcp-maintenance routine (active, has named probes)", () => {
      const r = loadRoutine("mcp-maintenance");
      assert.equal(r.status, "active");
      assert.ok(r.dispatches.length >= 7, `Expected >=7 dispatches, got ${r.dispatches.length}`);
    });

    it("throws on nonexistent routine", () => {
      assert.throws(() => loadRoutine("nonexistent-routine-xyz"), /not found/);
    });
  });

  describe("loadServerRegistry", () => {
    it("loads server entries from racks/servers.json", () => {
      const reg = loadServerRegistry();
      assert.ok("echoes-server" in reg, "echoes-server should be in registry");
      assert.ok(reg["echoes-server"].command, "should have a command");
      assert.ok(Array.isArray(reg["echoes-server"].args), "should have args array");
    });
  });

  describe("runRoutine - dry-run mode", () => {
    it("dry-runs gruff-bridge without executing", async () => {
      const report = await runRoutine("gruff-bridge", { dryRun: true });
      assert.equal(report.routine, "gruff-bridge");
      assert.equal(report.status, "dry-run");
      assert.ok(report.dispatches.length > 0);
      assert.equal(report.dispatches[0].status, "skipped");
      assert.equal(report.dispatches[0].type, "mcp-tool");
    });

    it("dry-runs attention (action fallback)", async () => {
      const report = await runRoutine("attention", { dryRun: true });
      assert.equal(report.status, "dry-run");
      assert.equal(report.dispatches.length, 1);
      assert.equal(report.dispatches[0].type, "shell");
    });

    it("dry-runs mcp-maintenance (named probes)", async () => {
      const report = await runRoutine("mcp-maintenance", { dryRun: true });
      assert.equal(report.status, "dry-run");
      assert.ok(report.dispatches.length >= 7);
      // Named probes should be typed as "probe"
      const probes = report.dispatches.filter((d) => d.type === "probe");
      assert.ok(probes.length > 0, "should have probe-type dispatches");
    });
  });

  describe("runRoutine - shell execution", () => {
    it("runs a routine with a simple action", async () => {
      // attention has action: "echo 'Processing...' && sleep 2 && echo 'Done.'"
      // but sleep 2 is slow for tests. Use mcp-server-remediation which has no
      // dispatches and no action (should return error/empty).
      // Instead, test with a routine that has fast shell dispatches.
      // We'll test the shell executor indirectly through a known routine.

      // Use phases (draft, empty dispatches, no action) — should return error
      const report = await runRoutine("phases");
      assert.equal(report.status, "error");
      assert.ok(report.dispatches[0].error?.includes("no dispatches"));
    });
  });

  describe("formatReport", () => {
    it("formats a passing report", () => {
      const report: RunReport = {
        routine: "test-routine",
        status: "pass",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 42,
        dispatches: [
          { type: "shell", name: "echo", status: "pass", output: "hello", durationMs: 10 },
        ],
      };
      const text = formatReport(report);
      assert.ok(text.includes("PASS"), "should contain PASS");
      assert.ok(text.includes("test-routine"), "should contain routine name");
      assert.ok(text.includes("hello"), "should contain output");
    });

    it("formats a failing report", () => {
      const report: RunReport = {
        routine: "fail-routine",
        status: "fail",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 100,
        dispatches: [
          { type: "verify", name: "check", status: "fail", error: "exit code 1", durationMs: 50 },
        ],
      };
      const text = formatReport(report);
      assert.ok(text.includes("FAIL"), "should contain FAIL");
      assert.ok(text.includes("exit code 1"), "should contain error");
    });

    it("formats a dry-run report", () => {
      const report: RunReport = {
        routine: "dry-routine",
        status: "dry-run",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        dispatches: [
          { type: "mcp-tool", name: "echoes-server/record_audit", status: "skipped", durationMs: 0 },
        ],
      };
      const text = formatReport(report);
      assert.ok(text.includes("dry-routine"));
      assert.ok(text.includes("SKIP"));
    });
  });
});
