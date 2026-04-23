# Ingestion Pattern — Edge Case Decision Rules

Companion to the operational plan at `~/.claude/plans/understood-the-copy-quiet-ripple.md`. The spine plan defines a 5-step ingestion loop:

1. **discover** — walk `~/workspace/` to surface candidate assets
2. **classify** — assign `kind` and `plane` per `design/inventory-schema.md`
3. **link** — create symlinks/aliases from plane directories
4. **register** — write a row into `INVENTORY.md`
5. **verify** — `scripts/verify-planes.sh` reconciles filesystem vs inventory

This document stress-tests the loop against seven known-awkward cases. For each, the rule is one-sentence imperative. Rationale cites `CLAUDE.md` or `docs/SPEC.md` where applicable.

---

### 1. `~/skills/*.skill` files, not directories

**Situation.** `~/skills/` holds `.skill` files (flat config leaves), not project directories. Loop operates at asset granularity, but each `.skill` is a config fragment.

**Decision rule.** Register `~/skills/` as a single `kind:skill-bundle` row; do not link per-file. Emit a generated `skills/INDEX.md` with per-skill detail and reference member count via a `contains: N` note on the inventory row.

**Rationale.** CLAUDE.md treats `skills/` as one cohesive "Skill definitions and context" directory. Links point to containers; inventory rows count members. Per-file registration would explode row count without adding navigational value.

---

### 2. `~/scripts/` loose shell scripts

**Situation.** `~/scripts/` has ~15 loose shell scripts (`weekly-security-check.sh`, `workspace-maintenance.sh`, `memory-watchdog.sh`, etc.) with no subdir structure.

**Decision rule.** Batch-link `~/scripts/` as one `kind:script-bundle`, `plane:infrastructure` row; list individual scripts in a collapsed child table rendered beneath the row.

**Rationale.** CLAUDE.md's "Scripts Directory" section treats them as one workspace-level automation unit. Per-script linking would 20× the `infrastructure/` plane surface for no navigation benefit. A collapsed child table preserves discoverability.

---

### 3. `~/plugins/caraxes` and `~/plugins/atlas-echoes`

**Situation.** Two plugin directories with manifest files (e.g., `plugin.yaml`). They extend agent surface rather than being passive cognitive overlays.

**Decision rule.** Each plugin is `kind:plugin`, `plane:services` — not `rack`, not `contracts`.

**Rationale.** `docs/SPEC.md` §2 assigns `services` to "what you CAN do." Plugins *are* code that extends that axis. `contracts` is reserved for shared type/resilience/pipeline packages. Racks are cognitive overlays *about* code; plugins are code.

---

### 4. `~/seed/templates/` (active) vs `~/seed/archive/` (excluded)

**Situation.** `~/seed/` contains both active template material and historical archive (`Atmosphere`, `Coinbase_from_zip`, `storage`). Scanner must distinguish.

**Decision rule.** Scanner walks `~/seed/` but marks any asset whose path contains a segment equal to `archive` (case-sensitive) as `status:archived`; freshness checks skip archived rows, and active sort excludes them.

**Rationale.** Consistent with CLAUDE.md's treatment of `grove/archive/` and `seed/archive/` as inert. Single predicate, no per-directory allowlist needed. The same rule catches future `*/archive/` siblings without code change.

---

### 5. `~/grove/Vision` symlink — double-link risk

**Situation.** `~/grove/Vision` is already a symlink into `CascadeProjects/Projects/Vision`. Naïve discover would register both, creating a duplicate row.

**Decision rule.** Discover resolves every candidate with `realpath`; collapse duplicates by realpath before register. Canonical row is the one *inside* `CascadeProjects/Projects/` (or, generally, the non-symlink). Symlink sources are recorded in the row's `aliases` column.

**Rationale.** Prevents duplicate rows and prevents `verify-planes.sh` from emitting false-positive drift when the same realpath surfaces under two entry points. Aliases stay visible so the grove-side entry point is still discoverable by humans.

---

### 6. GRID-main submodule vs `CascadeProjects/Projects/GRID-main`

**Situation.** Two paths point at GRID: `CascadeProjects/GRID-main/` (HTTPS submodule, read-only) and `CascadeProjects/Projects/GRID-main/` (SSH remote, canonical development path).

**Decision rule.** Canonical row is `CascadeProjects/Projects/GRID-main` (`kind:app`). The submodule pointer `CascadeProjects/GRID-main` gets a separate row with `kind:submodule-alias`, `status:submodule-alias`, and `notes: → canonical` pointing at the Projects path. Only the canonical row participates in freshness/owner/size accounting.

**Rationale.** CLAUDE.md explicit rule — "all direct GRID development happens in `CascadeProjects/Projects/GRID-main/` — `GRID-main/` is a read-only submodule reference. Never commit from within `GRID-main/`." Inventory must encode this asymmetry, not hide it behind realpath collapse (the two paths are not identical filesystem targets — they are different clones).

---

### 7. Hidden assets not declared in CLAUDE.md (e.g., `python-craft`)

**Situation.** New or undeclared projects appear in the tree without being listed in CLAUDE.md's directory map. Classification requires human judgment.

**Decision rule.** Discover walks depth ≤ 3 from `~/workspace/`; flag any directory containing `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, or a top-level `Makefile` as a candidate. Candidates not matched against CLAUDE.md's inventory get `status:undeclared`, `plane:—`, and appear in a dedicated "Undeclared" section of INVENTORY.md for human triage. Never auto-assign a plane to an undeclared asset.

**Rationale.** The loop must *surface* orphans, not silently bucket them. Auto-assignment would let CLAUDE.md drift invisibly. A terminal "Undeclared" section makes the triage queue a first-class artifact.

---

## Interaction table

Which loop step each rule fires at:

| # | Edge case              | discover | classify | link | register | verify |
|---|------------------------|:-:|:-:|:-:|:-:|:-:|
| 1 | `.skill` files         |   | ● | ● | ● |   |
| 2 | `~/scripts/` bundle    |   | ● | ● | ● |   |
| 3 | plugins → services     |   | ● |   | ● |   |
| 4 | `archive/` exclusion   | ● | ● |   | ● | ● |
| 5 | symlink collapse       | ● |   | ● | ● | ● |
| 6 | submodule asymmetry    | ● | ● | ● | ● | ● |
| 7 | undeclared discovery   | ● | ● |   | ● |   |

Reading key: ● = rule has effect at this step. Rules spanning multiple steps need consistent implementation across them.
