import { getActorProfile } from "../trust/db.js";

export function runRoute(tool: string, actor: string): void {
  const profile = getActorProfile(actor);

  if (!profile) {
    process.stdout.write(
      JSON.stringify(
        {
          actor,
          tool,
          tier: "school",
          reason: "no profile — new actor defaults to school",
          score: null,
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const notes = profile.notes_json ? JSON.parse(profile.notes_json) : {};
  process.stdout.write(
    JSON.stringify(
      {
        actor,
        tool,
        tier: profile.tier,
        score: profile.score,
        event_count: profile.event_count,
        last_seen: profile.last_seen,
        reason: notes.override ?? `score=${profile.score.toFixed(1)}`,
      },
      null,
      2,
    ) + "\n",
  );
}
