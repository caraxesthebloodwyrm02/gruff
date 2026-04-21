import React from "react";
import { Text, Box } from "ink";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const AUDIT_PATH = join(homedir(), ".echoes", "audit.ndjson");

interface ProportionEvent {
  audioDrive?: number;
  sequence?: { stepName?: string; stepIndex?: number; id?: string };
  theta?: number;
  weights?: { sound: number; gesture: number; calculation: number };
}

function getLatestProportion(): ProportionEvent | null {
  if (!existsSync(AUDIT_PATH)) return null;
  try {
    const lines = readFileSync(AUDIT_PATH, "utf8").trim().split("\n").reverse();
    for (const line of lines) {
      try {
        const ev = JSON.parse(line);
        if (ev.tool === "proportion" || ev.metadata?.audioDrive !== undefined) {
          return ev.metadata ?? ev;
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* skip */
  }
  return null;
}

function audioDriveBar(v: number, width = 20): string {
  const filled = Math.round(v * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

export function InferencePanel({ tick: _tick }: { tick: number }) {
  const p = getLatestProportion();

  if (!p) {
    return (
      <Box flexDirection="column">
        <Text dimColor>no proportion data</Text>
        <Text dimColor>POST to /gruff/proportion or</Text>
        <Text dimColor>run: gruff proportion --file p.json</Text>
      </Box>
    );
  }

  const ad = typeof p.audioDrive === "number" ? p.audioDrive : 0;
  const color = ad > 0.7 ? "red" : ad > 0.4 ? "yellow" : "green";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={color}>{audioDriveBar(ad)}</Text>
        <Text>{" "}</Text>
        <Text bold color={color}>
          {(ad * 100).toFixed(1)}%
        </Text>
      </Box>
      <Text dimColor>audioDrive (narrow-band)</Text>
      {p.sequence?.stepName && (
        <Text>
          step: <Text bold>{p.sequence.stepName}</Text>
          {p.sequence.stepIndex !== undefined && ` [${p.sequence.stepIndex}]`}
        </Text>
      )}
      {p.theta !== undefined && (
        <Text dimColor>θ = {typeof p.theta === "number" ? p.theta.toFixed(4) : "—"}</Text>
      )}
      {p.weights && (
        <Text dimColor>
          sound={p.weights.sound.toFixed(2)} gesture={p.weights.gesture.toFixed(2)} calc=
          {p.weights.calculation.toFixed(2)}
        </Text>
      )}
    </Box>
  );
}
