# Racks

**Racks** store **durable, human-curated knowledge** for trust routing and actor behavior: learning signals, named patterns, actor snapshots, and routine definitions. The `gruff` package reads trust data from `~/.gruff/trust.sqlite` at runtime; this tree is for **opt-in exports, research, and ops playbooks** aligned with the same concepts.

| Directory | Purpose |
|-----------|---------|
| `learning/` | Datasets, labeled examples, or notes used to improve scoring models (kept out of the repo until explicitly shared). |
| `patterns/` | Detected or hand-authored actor behavior patterns (e.g. “always fails on tool X”). |
| `profiles/` | Exported actor profile snapshots, audits, or redacted dumps for support. |
| `routines/` | Scheduled or manual task definitions (cron, timers, `gruff init-automation` notes). |

Merge with `planes/services/` or `planes/artifacts/` when a piece of content is both a “service contract” and a “rack” asset; avoid duplicating the same file in two places.
