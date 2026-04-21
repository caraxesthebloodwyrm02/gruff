import { listActors, queryRaw } from "../trust/db.js";
import type { ActorProfile } from "../trust/db.js";

const TIER_LABEL: Record<string, string> = {
  school: "  school  ",
  practice: " practice ",
  hold: "   hold   ",
};

export function runActors(sql?: string): void {
  if (sql) {
    try {
      const rows = queryRaw(sql);
      process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    } catch (e: any) {
      process.stderr.write(`sql error: ${e.message}\n`);
      process.exit(1);
    }
    return;
  }

  const actors = listActors(50);
  if (actors.length === 0) {
    process.stdout.write(
      "no actors yet — run `gruff init-automation` to start the ingester\n",
    );
    return;
  }

  const header = `${"actor".padEnd(32)} ${"tier".padEnd(10)} ${"score".padEnd(7)} ${"events".padEnd(8)} ${"ok/err".padEnd(10)} last_seen`;
  const sep = "-".repeat(header.length);
  process.stdout.write(header + "\n" + sep + "\n");

  for (const a of actors) {
    const score = a.score.toFixed(1).padEnd(7);
    const events = String(a.event_count).padEnd(8);
    const ok_err = `${a.ok_count}/${a.err_count}`.padEnd(10);
    const tier = (TIER_LABEL[a.tier] ?? a.tier).padEnd(10);
    const last = a.last_seen.slice(0, 19);
    process.stdout.write(
      `${a.actor.slice(0, 32).padEnd(32)} ${tier} ${score} ${events} ${ok_err} ${last}\n`,
    );
  }
}
