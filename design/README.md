# Design

Design-time decision docs that shape the workspace ingest and inventory loop. Operational policy lives here; executable code lives elsewhere (`src/`, `scripts/`, `planes/`).

| File | Scope |
|------|-------|
| `ingestion-pattern.md` | Edge-case decision rules for the 5-step ingest loop (discover → classify → link → register → verify). Companion to `~/.claude/plans/understood-the-copy-quiet-ripple.md`. |
| `inventory-schema.md` | Canonical `INVENTORY.md` row shape: `kind`, `plane`, required fields, link conventions. Referenced by `scripts/verify-planes.sh`. |

These are **specification documents**, not templates. Edit them when the ingest contract itself changes, not when you classify a new asset. For per-asset entries, update the relevant `INVENTORY.md` under `planes/` instead.

See also: `planes/README.md` (the classification targets) and `docs/SPEC.md` (overall workspace spec).
