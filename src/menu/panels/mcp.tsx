import React from "react";
import { Text, Box } from "ink";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MCP_CONFIG =
  process.env.CASCADE_WORKSPACE_ROOT
    ? join(process.env.CASCADE_WORKSPACE_ROOT, "mcp_config.json")
    : join(homedir(), "workspace", "CascadeProjects", "mcp_config.json");

const AUDIT_PATH = join(homedir(), ".echoes", "audit.ndjson");

function getServerNames(): string[] {
  if (!existsSync(MCP_CONFIG)) return [];
  try {
    const cfg = JSON.parse(readFileSync(MCP_CONFIG, "utf8"));
    const mcpServers = cfg?.mcpServers ?? cfg?.servers ?? {};
    return Object.keys(mcpServers).slice(0, 8);
  } catch {
    return [];
  }
}

function getLastSourceStatus(): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(AUDIT_PATH)) return out;
  try {
    const lines = readFileSync(AUDIT_PATH, "utf8").trim().split("\n").slice(-200);
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (ev.source) out.set(ev.source, ev.status ?? "unknown");
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  return out;
}

function getIngesterLag(): string {
  const stateFile = join(homedir(), ".gruff", "ingester.state");
  if (!existsSync(stateFile)) return "not started";
  try {
    const s = JSON.parse(readFileSync(stateFile, "utf8"));
    const lagMs = Date.now() - new Date(s.last_ts).getTime();
    return `${Math.round(lagMs / 1000)}s ago`;
  } catch {
    return "unknown";
  }
}

export function McpPanel({ tick: _tick }: { tick: number }) {
  const servers = getServerNames();
  const statuses = getLastSourceStatus();
  const lag = getIngesterLag();

  if (servers.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>mcp_config.json not found</Text>
        <Text dimColor>ingester: {lag}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {servers.map((name) => {
        const st = statuses.get(name) ?? statuses.get(name.replace("-server", "")) ?? "—";
        const color = st === "success" ? "green" : st === "failure" ? "red" : "gray";
        return (
          <Box key={name}>
            <Text color={color}>{"● "}</Text>
            <Text>{name.replace("-server", "").padEnd(16)}</Text>
            <Text dimColor>{st}</Text>
          </Box>
        );
      })}
      <Text dimColor>ingester lag: {lag}</Text>
    </Box>
  );
}
