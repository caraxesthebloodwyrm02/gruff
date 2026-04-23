import React from "react";
import { Text, Box } from "ink";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const GRUFF_CASCADE = join(homedir(), "gruff", "workspace", "CascadeProjects");

// GATE incoming envelopes: default to the gruff worktree. Override with GATE_DIR.
const GATE_DIR = process.env.GATE_DIR ?? join(GRUFF_CASCADE, "Projects", "GATE");

// Ori and eligibility: legacy defaults were ~/.ori-server and ~/.eligibility-server; those
// paths are often empty on a fresh host. Set ORI_ANTICIPATION_PATH / ELIGIBILITY_CYCLES_PATH
// to where the services actually write, or add symlinks. Optional fallbacks under CascadeProjects.
const ORI_CANDIDATES = [
  process.env.ORI_ANTICIPATION_PATH,
  join(homedir(), ".ori-server", "anticipation.json"),
  join(GRUFF_CASCADE, ".state", "ori", "anticipation.json"),
].filter(Boolean) as string[];

const ELIGIBILITY_CANDIDATES = [
  process.env.ELIGIBILITY_CYCLES_PATH,
  join(homedir(), ".eligibility-server", "cycles.json"),
  join(GRUFF_CASCADE, ".state", "eligibility", "cycles.json"),
].filter(Boolean) as string[];

function getPendingEnvelopes(): string[] {
  const incoming = join(GATE_DIR, "incoming");
  if (!existsSync(incoming)) return [];
  try {
    return readdirSync(incoming)
      .filter((f) => f.endsWith(".json"))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function readFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

function getAnticipationSignals(): Array<{ category: string; confidence: number }> {
  const path = readFirstExisting(ORI_CANDIDATES);
  if (!path) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(raw) ? raw.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function getPromotionCandidates(): string[] {
  const path = readFirstExisting(ELIGIBILITY_CANDIDATES);
  if (!path) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const candidates = Array.isArray(raw) ? raw : [];
    return candidates
      .filter((c: any) => c.status === "pending_promotion")
      .map((c: any) => c.actor ?? c.id)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export function HorizonPanel({ tick: _tick }: { tick: number }) {
  const envelopes = getPendingEnvelopes();
  const signals = getAnticipationSignals();
  const candidates = getPromotionCandidates();

  const empty = envelopes.length === 0 && signals.length === 0 && candidates.length === 0;

  if (empty) {
    return (
      <Box flexDirection="column">
        <Text dimColor>no pending GATE envelopes</Text>
        <Text dimColor>no anticipation signals</Text>
        <Text dimColor>no promotion candidates</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {envelopes.length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>GATE incoming ({envelopes.length}):</Text>
          {envelopes.map((f) => (
            <Text key={f} color="cyan">
              {"  "}{f.slice(0, 34)}
            </Text>
          ))}
        </Box>
      )}
      {signals.length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>anticipation signals:</Text>
          {signals.map((s, i) => (
            <Text key={i} color={s.confidence > 0.7 ? "red" : "yellow"}>
              {"  "}{s.category} ({(s.confidence * 100).toFixed(0)}%)
            </Text>
          ))}
        </Box>
      )}
      {candidates.length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>promotion candidates:</Text>
          {candidates.map((c) => (
            <Text key={c} color="cyan">
              {"  "}{c}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
