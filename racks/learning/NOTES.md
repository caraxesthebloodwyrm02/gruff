# racks/learning — what belongs here

This directory stores **curated, exportable** learning signals for trust and
routing research. It is **not read by the `gruff` CLI at runtime**; the live
scoring engine reads only from `~/.gruff/trust.sqlite`. Content here is
opt-in, human-reviewed, and intended for offline analysis or future model
improvement.

---

## What belongs here

| Kind | Example files | Format |
|------|---------------|--------|
| Labeled event slices | `events-2026-04-batch.ndjson` | Redacted NDJSON, one event per line |
| Aggregate statistics | `actor-score-distribution-q1.json` | JSON summary (no raw actor IDs unless redacted) |
| A/B or flag notes | `flag-notes-banned-override.md` | Markdown prose |
| Post-mortems / retros | `postmortem-2026-04-ingester-lag.md` | Markdown, sanitised |
| MIST session captures | `mist-session-YYYYMMDD.md` | Markdown, opt-in only |
| Scoring model notes | `scorer-v2-design.md` | Markdown or JSON schema drafts |

---

## Hard rules

1. **No PII.** Actor IDs that map to real people must be redacted or replaced
   with opaque tokens (e.g. `actor-a3f9`) before committing.
2. **Opt-in only.** Nothing is captured automatically. A human must
   deliberately export, redact, and place a file here.
3. **No raw audit logs.** Do not commit unredacted slices of
   `~/.echoes/audit.ndjson`. Aggregate or strip identifying fields first.
4. **No secrets.** Treat this directory as if it will be reviewed in a public
   PR. Env vars, tokens, and hostnames must be removed.

---

## Relationship to trust.sqlite

```
~/.echoes/audit.ndjson  ──►  gruff-ingester  ──►  ~/.gruff/trust.sqlite
                                                          │
                                             listActors() │ recomputeActor()
                                                          ▼
                                               gruff TUI  (runtime)

                         racks/learning/       ◄──  manual export + redact
                         (this directory)            (offline, opt-in)
```

Runtime scoring is always authoritative. Files here are snapshots for research
and do not feed back into the CLI automatically.

---

## Naming convention

```
<kind>-<topic>-<YYYY-MM[-detail]>.<ext>

examples:
  events-mcp-failures-2026-04.ndjson
  stats-tier-distribution-q1-2026.json
  postmortem-ingester-lag-2026-04-21.md
  mist-session-2026-04-23.md
```

---

## Adding content

1. Export and redact locally.
2. Drop the file in the matching subdirectory (or directly here if no
   subdirectory fits).
3. Open a PR with a one-line description of what was captured and why.
4. A second pair of eyes reviews for PII before merge.
