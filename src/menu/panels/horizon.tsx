import React from "react";
import { Text, Box } from "ink";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const GATE_DIR =
  process.env.GATE_DIR ??
  join(homedir(), "workspace", "CascadeProjects", "Projects", "GATE");

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

function getAnticipationSignals(): Array<{ category: string; confidence: number }> {
  const ori = join(homedir(), ".ori-server", "anticipation.json");
  if (!existsSync(ori)) return [];
  try {
    const raw = JSON.parse(readFileSync(ori, "utf8"));
    return Array.isArray(raw) ? raw.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function getPromotionCandidates(): string[] {
  const eligibilityLog = join(homedir(), ".eligibility-server", "cycles.json");
  if (!existsSync(eligibilityLog)) return [];
  try {
    const raw = JSON.parse(readFileSync(eligibilityLog, "utf8"));
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
