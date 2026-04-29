// src/routine-runner.ts
// Reads routine.yaml, resolves dispatches, executes them, emits a result summary.

import { exec as execCb } from "child_process";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";
import { promisify } from "util";
import { load as loadYaml } from "js-yaml";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const execAsync = promisify(execCb);

// ── Paths ────────────────────────────────────────────────────────────────────

const WORKSPACE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const RACKS_DIR = join(WORKSPACE_ROOT, "racks");
const ROUTINES_DIR = join(RACKS_DIR, "routines");
const SERVERS_PATH = join(RACKS_DIR, "servers.json");

// ── Types ────────────────────────────────────────────────────────────────────

export interface McpToolDispatch {
  tool: string;
  server: string;
  description?: string;
  args?: Record<string, unknown>;
}

export interface ShellDispatch {
  shell: string;
  name?: string;
  verb?: string;
  pass?: string;
  fail?: string;
}

export interface VerifyDispatch {
  verify: string;
}

export type Dispatch = McpToolDispatch | ShellDispatch | VerifyDispatch;

export interface RetryPolicy {
  max_attempts: number;
  backoff: "fixed" | "exponential";
  initial_delay_ms: number;
}

export interface RoutineConfig {
  name: string;
  intent: string;
  trigger: string;
  timeout: string;
  retry_policy?: RetryPolicy;
  owner: string;
  lock_key?: string;
  dispatches: Dispatch[];
  action?: string;
  produces: string[];
  status: string;
  references: string[];
}

export interface ServerEntry {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface DispatchResult {
  type: "mcp-tool" | "shell" | "verify" | "probe";
  name: string;
  status: "pass" | "fail" | "error" | "skipped";
  output?: string;
  error?: string;
  durationMs: number;
}

export interface RunReport {
  routine: string;
  status: "pass" | "fail" | "error" | "dry-run";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  dispatches: DispatchResult[];
}

export interface RunOptions {
  dryRun?: boolean;
  json?: boolean;
  args?: Record<string, unknown>;
  timeoutMs?: number;
}

// ── Loaders ──────────────────────────────────────────────────────────────────

export function listRoutines(): string[] {
  if (!existsSync(ROUTINES_DIR)) return [];
  return readdirSync(ROUTINES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function loadRoutine(name: string): RoutineConfig {
  const yamlPath = join(ROUTINES_DIR, name, "routine.yaml");
  if (!existsSync(yamlPath)) {
    throw new Error(`Routine not found: ${name} (expected ${yamlPath})`);
  }
  const raw = readFileSync(yamlPath, "utf-8");
  const parsed = loadYaml(raw) as Record<string, unknown>;
  return {
    name: (parsed.name as string) ?? name,
    intent: (parsed.intent as string) ?? "",
    trigger: (parsed.trigger as string) ?? "manual",
    timeout: (parsed.timeout as string) ?? "10m",
    retry_policy: parsed.retry_policy as RetryPolicy | undefined,
    owner: (parsed.owner as string) ?? "unknown",
    lock_key: parsed.lock_key as string | undefined,
    dispatches: normalizeDispatches(parsed.dispatches),
    action: parsed.action as string | undefined,
    produces: (parsed.produces as string[]) ?? [],
    status: (parsed.status as string) ?? "unknown",
    references: (parsed.references as string[]) ?? [],
  };
}

function normalizeDispatches(raw: unknown): Dispatch[] {
  if (!Array.isArray(raw)) return [];
  return raw as Dispatch[];
}

export function loadServerRegistry(): Record<string, ServerEntry> {
  const configPath = process.env.GRUFF_SERVERS_CONFIG ?? SERVERS_PATH;
  if (!existsSync(configPath)) return {};
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

// ── Timeout helper ───────────────────────────────────────────────────────────

function parseTimeout(t: string): number {
  const match = t.match(/^(\d+)(s|m|h)?$/);
  if (!match) return 600_000; // 10m default
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case "s": return val * 1000;
    case "h": return val * 3_600_000;
    default:  return val * 60_000; // minutes
  }
}

// ── Dispatch executors ───────────────────────────────────────────────────────

function isMcpTool(d: Dispatch): d is McpToolDispatch {
  return "tool" in d && "server" in d;
}
function isVerify(d: Dispatch): d is VerifyDispatch {
  return "verify" in d;
}
function isShell(d: Dispatch): d is ShellDispatch {
  return "shell" in d;
}

async function executeMcpTool(
  dispatch: McpToolDispatch,
  registry: Record<string, ServerEntry>,
  toolArgs: Record<string, unknown>,
): Promise<DispatchResult> {
  const start = Date.now();
  const entry = registry[dispatch.server];
  if (!entry) {
    return {
      type: "mcp-tool",
      name: `${dispatch.server}/${dispatch.tool}`,
      status: "error",
      error: `Server "${dispatch.server}" not found in registry. Add it to racks/servers.json.`,
      durationMs: Date.now() - start,
    };
  }

  let transport: StdioClientTransport | null = null;
  let client: Client | null = null;
  try {
    transport = new StdioClientTransport({
      command: entry.command,
      args: entry.args,
      cwd: entry.cwd,
      env: { ...process.env, ...(entry.env ?? {}) } as Record<string, string>,
    });
    client = new Client({ name: "gruff-runner", version: "1.0.0" });
    await client.connect(transport);

    const mergedArgs = { ...toolArgs, ...(dispatch.args ?? {}) };
    const result = await client.callTool({ name: dispatch.tool, arguments: mergedArgs });

    const text = (result.content as Array<{ type: string; text?: string }>)
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    const isError = result.isError === true;

    return {
      type: "mcp-tool",
      name: `${dispatch.server}/${dispatch.tool}`,
      status: isError ? "fail" : "pass",
      output: text,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      type: "mcp-tool",
      name: `${dispatch.server}/${dispatch.tool}`,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  } finally {
    try { await client?.close(); } catch { /* best-effort */ }
  }
}

async function executeShell(cmd: string, label: string): Promise<DispatchResult> {
  const start = Date.now();
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 120_000,
      shell: "/bin/bash",
    });
    return {
      type: "shell",
      name: label,
      status: "pass",
      output: (stdout + (stderr ? `\n[stderr] ${stderr}` : "")).trim(),
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      type: "shell",
      name: label,
      status: "fail",
      output: e.stdout?.trim(),
      error: e.stderr?.trim() || e.message,
      durationMs: Date.now() - start,
    };
  }
}

async function executeVerify(cmd: string, label: string): Promise<DispatchResult> {
  const result = await executeShell(cmd, label);
  result.type = "verify";
  return result;
}

async function executeProbe(dispatch: ShellDispatch): Promise<DispatchResult> {
  const result = await executeShell(dispatch.shell, dispatch.name ?? "probe");
  result.type = "probe";
  return result;
}

// ── Dispatch router ──────────────────────────────────────────────────────────

async function executeDispatch(
  dispatch: Dispatch,
  registry: Record<string, ServerEntry>,
  toolArgs: Record<string, unknown>,
): Promise<DispatchResult> {
  if (isMcpTool(dispatch)) {
    return executeMcpTool(dispatch, registry, toolArgs);
  }
  if (isVerify(dispatch)) {
    return executeVerify(dispatch.verify, "verify");
  }
  if (isShell(dispatch)) {
    if (dispatch.name) {
      return executeProbe(dispatch);
    }
    return executeShell(dispatch.shell, "shell");
  }
  return {
    type: "shell",
    name: "unknown",
    status: "error",
    error: `Unrecognized dispatch shape: ${JSON.stringify(dispatch)}`,
    durationMs: 0,
  };
}

// ── Retry logic ──────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function retryDelay(policy: RetryPolicy, attempt: number): number {
  if (policy.backoff === "exponential") {
    return policy.initial_delay_ms * Math.pow(2, attempt);
  }
  return policy.initial_delay_ms;
}

// ── Main runner ──────────────────────────────────────────────────────────────

export async function runRoutine(name: string, opts: RunOptions = {}): Promise<RunReport> {
  const routine = loadRoutine(name);
  const registry = loadServerRegistry();
  const startedAt = new Date().toISOString();
  const timeoutMs = opts.timeoutMs ?? parseTimeout(routine.timeout);
  const toolArgs = opts.args ?? {};
  const maxAttempts = routine.retry_policy?.max_attempts ?? 1;

  // Collect executable dispatches
  let dispatches = routine.dispatches;

  // Fallback: if no dispatches but routine has an action string, treat as single shell dispatch
  if (dispatches.length === 0 && routine.action) {
    dispatches = [{ shell: routine.action } as ShellDispatch];
  }

  if (dispatches.length === 0) {
    return {
      routine: name,
      status: "error",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
      dispatches: [{
        type: "shell",
        name: "no-dispatches",
        status: "skipped",
        error: `Routine "${name}" has no dispatches or action defined.`,
        durationMs: 0,
      }],
    };
  }

  // Dry-run: return plan without executing
  if (opts.dryRun) {
    const planned: DispatchResult[] = dispatches.map((d, i) => {
      let label = `dispatch-${i}`;
      let type: DispatchResult["type"] = "shell";
      if (isMcpTool(d)) { label = `${d.server}/${d.tool}`; type = "mcp-tool"; }
      else if (isVerify(d)) { label = "verify"; type = "verify"; }
      else if (isShell(d) && d.name) { label = d.name; type = "probe"; }
      return { type, name: label, status: "skipped" as const, durationMs: 0 };
    });
    return {
      routine: name,
      status: "dry-run",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
      dispatches: planned,
    };
  }

  // Execute with timeout
  const results: DispatchResult[] = [];
  let overallStatus: RunReport["status"] = "pass";

  const runAll = async () => {
    for (const dispatch of dispatches) {
      let result: DispatchResult | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        result = await executeDispatch(dispatch, registry, toolArgs);
        if (result.status === "pass") break;
        if (attempt < maxAttempts - 1 && routine.retry_policy) {
          await delay(retryDelay(routine.retry_policy, attempt));
        }
      }

      results.push(result!);
      if (result!.status !== "pass") {
        overallStatus = result!.status === "error" ? "error" : "fail";
      }
    }
  };

  try {
    await Promise.race([
      runAll(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Routine "${name}" timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  } catch (err) {
    overallStatus = "error";
    results.push({
      type: "shell",
      name: "timeout",
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      durationMs: timeoutMs,
    });
  }

  const completedAt = new Date().toISOString();
  return {
    routine: name,
    status: overallStatus,
    startedAt,
    completedAt,
    durationMs: Date.now() - new Date(startedAt).getTime(),
    dispatches: results,
  };
}

// ── Formatting ───────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  pass: "PASS",
  fail: "FAIL",
  error: "ERR ",
  skipped: "SKIP",
};

export function formatReport(report: RunReport): string {
  const lines: string[] = [];
  const icon = STATUS_ICON[report.status] ?? report.status;

  lines.push(`[${icon}] ${report.routine}  (${report.durationMs}ms)`);
  lines.push("");

  for (const d of report.dispatches) {
    const di = STATUS_ICON[d.status] ?? d.status;
    lines.push(`  ${di}  ${d.type}  ${d.name}  (${d.durationMs}ms)`);
    if (d.output) {
      const preview = d.output.length > 200 ? d.output.slice(0, 200) + "..." : d.output;
      for (const line of preview.split("\n")) {
        lines.push(`       ${line}`);
      }
    }
    if (d.error) {
      for (const line of d.error.split("\n").slice(0, 5)) {
        lines.push(`       ! ${line}`);
      }
    }
  }

  return lines.join("\n");
}
