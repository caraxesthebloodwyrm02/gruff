import React from "react";
import { Text, Box } from "ink";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { listActors } from "../../trust/db.js";

const SEEDS_DIR = join(homedir(), ".seeds-server", "snapshots");

function getLatestSeedsScore(): number | null {
  if (!existsSync(SEEDS_DIR)) return null;
  try {
    const files = readdirSync(SEEDS_DIR)
      .filter((f) => f.startsWith("snapshot-") && f.endsWith(".json"))
      .sort()
      .reverse();
    if (!files[0]) return null;
    const snap = JSON.parse(readFileSync(join(SEEDS_DIR, files[0]), "utf8"));
    return typeof snap.overallScore === "number" ? snap.overallScore : null;
  } catch {
    return null;
  }
}

function tierColor(tier: string): string {
  if (tier === "school") return "green";
  if (tier === "practice") return "yellow";
  return "red";
}

export function AgencyPanel({ tick: _tick }: { tick: number }) {
  const actors = listActors(5);
  const seedsScore = getLatestSeedsScore();

  return (
    <Box flexDirection="column">
      {seedsScore !== null && (
        <Box marginBottom={0}>
          <Text>ecosystem health: </Text>
          <Text bold color={seedsScore >= 75 ? "green" : seedsScore >= 50 ? "yellow" : "red"}>
            {seedsScore}
          </Text>
        </Box>
      )}
      {actors.length === 0 ? (
        <Text dimColor>no actor data — run: gruff init-automation</Text>
      ) : (
        actors.map((a) => (
          <Box key={a.actor}>
            <Text color={tierColor(a.tier)}>{"● "}</Text>
            <Text>{a.actor.slice(0, 18).padEnd(18)}</Text>
            <Text dimColor> {a.tier.padEnd(8)}</Text>
            <Text dimColor>{a.score.toFixed(0)}pts</Text>
          </Box>
        ))
      )}
      <Text dimColor>
        total events:{" "}
        {actors.reduce((s, a) => s + a.event_count, 0)}
      </Text>
    </Box>
  );
}
