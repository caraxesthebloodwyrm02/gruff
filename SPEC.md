# Workspace specification

This workspace is a plane-grouped view over the `CascadeProjects/` monorepo, reflecting the 4-plane + bus + contracts architecture from `hogsmade-design/Hogsmade Cockpit.html` and `CascadeProjects/Documentation/docs/STRUCTURE.md`. The substrate is the monorepo; the view is `planes/`; edits flow through symlinks back to source.

---

## 1. Identity

| Field | Value |
|---|---|
| Operator | **Prince** (Irfan Kabir) — agent: `prince-runtime-intel` (see `AGENTS.md`) |
| Home | `/home/irfankabir/` — Ubuntu |
| Workspace root | `~/workspace/` — this file lives here |
| Monorepo substrate | `~/workspace/CascadeProjects/` (branch `cursor/signal-io-hardening-d896`) |
| Runtime data root | `~/.echoes/` — live audit stream (env: `ECHOES_AUDIT_PATH`) |
| OS | Ubuntu (migrated from Arch Linux) |
| Location | Uttara, Dhaka, Bangladesh — UTC+6 |

### Identity stack — what's live, what's archived

- **Live operator:** `prince` @ `/home/irfankabir/` on Ubuntu. All paths in this workspace resolve under `~/` unless explicitly noted.
- **Archived substrate:** `caraxes` @ `/mnt/arch_data/home/caraxes/` — the prior Arch Linux home, now a read-only raw-inventory mount. Referenced for migration-historical reasons only.
- **`caraxes` as persona:** a context-switched agent (`~/.claude/agents/caraxes.md`) for marketplace/plugin ecosystem scouting, per `AGENTS.md`. Not the operator.
- **`caraxesthebloodwyrm02`:** GitHub identity, legitimately retained in commit metadata, SSH aliases (`git@github-caraxes:`), and plugin manifests.

When you see `caraxes` in docs: a persona/agent/GitHub-handle/plugin-name is live; a home-path is archived. The combination discrepancy — stale `/home/caraxes/...` env paths inherited from copied governance docs — has been reconciled (see §10 "Semantic choices made").

---

## 2. The architecture — 4 planes + bus + contracts + infrastructure

Derived from the Hogsmade Cockpit "AFTER" sketch:

```
                    COMMAND BUS  (one event stream, one API, one palette)
                    ──────────────────────────────────────────────────────
    1 · SERVICES         2 · RUNS           3 · ARTIFACTS         4 · SURFACES
    what you CAN do      what IS happening  what it PRODUCED      how you SEE it
                         + infrastructure  (ops, hardening, deployment)
                    ──────────────────────────────────────────────────────
                    shared-types · shared-resilience · audit schema
```

**Services** (`planes/services/`) — capabilities you invoke. 14 MCP servers + `apiguard` (API security middleware) + `pi-mangrove` (skills/tools workspace). Build order: `shared-types` → `shared-resilience` → any server.

**Runs** (`planes/runs/`) — active executions. `GRID` (submodule, Python/FastAPI — the AI framework) and `DIO` (Python control room — episode tooling).

**Artifacts** (`planes/artifacts/`) — memory. `GATE` (envelopes, contracts, audit store) and `echoes-runtime` (live NDJSON stream at `~/.echoes/`).

**Surfaces** (`planes/surfaces/`) — views on the other three. `Vision` (CV pipelines), `glimpse-engine` + `glimpse-artifact` (decision-support viz), `bandwidth-equalizer`, `viz` (experiments), and the four Hogwarts halls (`board`, `governors`, `hyperspace`, `nuke`).

**Bus** (`planes/bus/shared-types`) — the spine. `emitAudit` today; `dispatch`/`subscribe` once `~/concept-command-bus.md` is implemented. On disk the spine is a sibling plane; in the model it's cross-cutting.

**Contracts** (`planes/contracts/`) — shared foundation floor. `shared-types`, `shared-resilience`, `shared-pipeline`. Every server depends on this floor.

**Infrastructure** (`planes/infrastructure/`) — empty scaffold. Ops / hardening / deployment scripts belong here as they become first-class (the designer's Audit §6 recommendation). Currently awaiting content.

---

## 3. The command bus

**Status: implemented** — branch `concept/command-bus` (commit `fcc7ba0`), pending PR to main.

One substrate: `~/.echoes/audit.ndjson`. `appendNdjsonLine()` exported from `audit-client.ts` is the shared write primitive. `emitAudit` (observability) and `dispatch` (actuation) both call it. Read path: `subscribe(ns, handler, opts?)` watches the parent directory (inotify + 1s poll fallback) and filters by namespace via `CommandEnvelopeSchema.safeParse`. `runId` ({service}.{kind}.{uuid}) is first-class — issue #2 is now a propagation task.

POC call-sites live: eligibility-server `onEvolutionCaseOpened` dispatches `case_opened`; pulse-server subscribes at startup with `fromTail: true`. 8/8 unit tests green.

---

## 4. Contracts floor

- `Components/shared-types` — zod schemas, `emitAudit`, `generateRunId`, W3C trace context, merit policy, session rate limit. Package: `@cascade/shared-types`. ESM/NodeNext, strict TypeScript, ES2022 target.
- `Components/shared-resilience` — circuit breakers, retries, rate limiting.
- `Components/shared-pipeline` — shared pipeline helpers.

**Build order (honored by every server):** `shared-types` → `shared-resilience` → server.

---

## 5. Substrate vs view; two navigational layers

- **`CascadeProjects/`** — canonical source. All code, config, tests, docs, agent charters live here. Git-tracked, dirty tree preserved (branch `cursor/signal-io-hardening-d896`, HEAD `4c8cf57`).
- **`planes/`** — architectural view. 33 symlinks into the monorepo. Zero bytes of their own. `rm -rf planes/` rolls back the view without touching source.
- **`CENTRAL_PLAZA.md`** — navigational UX. Districts (`roots/`, `canopy/`, `grove/`, `seeds/`) for human way-finding and health dashboards.

Use **plaza vocabulary** for location ("I'm in `roots/GRID`"). Use **plane vocabulary** for role ("GRID is a `runs` executor"). Same territory, complementary maps.

---

## 6. Racks — cognitive overlay

Separate from code. Writes about the code, not within it.

- **`racks/patterns/`** — 9 Cognition Pattern dirs (flow, spatial, rhythm, color, repetition, deviation, cause, time, combination). One-line stubs; populate as you articulate each pattern's role in your work.
- **`racks/routines/`** — 5 routine dirs, each with a `routine.yaml` manifest (name, intent, trigger, dispatches, produces, status, references). Machine-readable. All currently `status: stub`, `trigger: manual`. Advance through `stub → draft → active` as you wire real dispatch targets and producers.
- **`racks/profiles/`** — operator + agent identity stubs (prince, claude, cascade, gemini).
- **`racks/learning/`** — session captures, MIST notes, post-mortems. Populate on first use.

---

## 7. Design system

Amber-primary warm-tone reread of GRID's canonical tokens. Source: `design-system/` (read-only reference, unpacked from `~/Downloads/grid.zip`).

**Hard rules** (cite `design-system/SKILL.md`):

- Primary is amber (`var(--primary)` = `#F59E0B`). Cyan is a secondary accent for data-viz glints only.
- Dark-first. Default page `--bg-1` (`#14141A`); hero `--bg-0` (`#0A0A0F`).
- Fonts: Space Grotesk (display), Manrope (body), JetBrains Mono (code).
- Wordmark GRID is uppercase, `0.15em` tracked, 700 weight. Never "Grid".
- No emoji in UI chrome (except `🛞` as text-fallback for the wheel).
- Icons: Lucide, 1.5–1.75 stroke, rounded joins.
- Voice: measured, specific, no hype. Em dash for inline breaks. Specific numbers, no filler adjectives.
- "Understand" is the product verb. "MIST" = named epistemic-humility state. "Signal vs. noise" is the recurring frame.

---

## 8. Governance + precedence

### 6-stage gated execution protocol

1. **Orient** — read configs, identify conventions. No edits.
2. **Route** — identify all files changing. Cross-project? Confirm scope first.
3. **Gate** — pattern gate, safety gate, test gate, dependency gate. Any BLOCKED = stop.
4. **Implement** — smallest correct change. No unrelated refactors.
5. **Reconcile** — update changelog / session state. Leave breadcrumbs.
6. **Report** — what changed / context used / constraints applied / verification / remaining.

Canonical doc: `~/workspace/WORKSPACE_GATES.md`.

### Drift check

`scripts/verify-planes.sh` — on-demand. Asserts every top-level dir under `CascadeProjects/{Tools/MCPServers, Applications, Projects, Components, Hogwarts}` maps to either a plane symlink or the explicit whitelist. Not yet CI/cron-wired.

### CLAUDE.md precedence

Two CLAUDE.md files exist:

- `~/workspace/CLAUDE.md` — **workspace-scoped**; authoritative for workspace-level concerns (navigation, plane model, overlay discipline).
- `~/workspace/CascadeProjects/CLAUDE.md` — **monorepo-scoped**; authoritative for monorepo-internal work (build orders, MCP server patterns, component refactors).

On conflict: **the narrower scope wins**. Monorepo CLAUDE.md governs inside `CascadeProjects/`. Workspace CLAUDE.md governs outside.

---

## 9. Migration ledger

### Carried over from arch_data

- `CascadeProjects/` — full monorepo (317 MB, 6673 files, 3 symlinks) via `rsync -aHAX` excluding `node_modules`, `.venv`, `__pycache__`, `.pytest_cache`, `dist`, `.next`, `build`.
- Governance docs — `CENTRAL_PLAZA.md`, `WORKSPACE_GATES.md`, `CLAUDE.md`, `AGENTS.md` (copy-once, diverge).
- Reference zips — `grid.zip` → `design-system/`, `hogsmade.zip` → `hogsmade-design/`.
- Dirty-state snapshot — `~/workspace-migration/dirty-state.{txt,diff}`, `head-sha.txt`, `branches.txt`, `submodules.txt`, `stash-list.txt`.

### Deferred (future sessions)

- **P2 — Echoes integrity tooling carry-over.** Copy `~/.echoes/check-integrity.sh`, `audit-integrity.md`; seed `audit.ndjson.sha256`. Needed before first Ubuntu server start that writes audit events.
- ~~**Command bus implementation.**~~ **DONE** — `concept/command-bus` branch, commit `fcc7ba0`. PR to main pending.
- **Scheduler wiring.** `scripts/dispatch.sh` + `scripts/schedule.sh` — now unblocked.
- **Verify-planes CI/cron integration.** Promote to pre-commit hook or daily check.

### Ubuntu-verify checklist

- [ ] Python 3.12+ on PATH
- [ ] `uv` installed
- [ ] Node.js present (verify version against Glimpse engine)
- [ ] `npm install` run in `Applications/glimpse-artifact/`
- [ ] SSH keys restored and `ssh-agent` configured
- [ ] `.env` files restored per project
- [ ] Git `user.name`, `user.email`, `core.editor`
- [ ] Ollama installed (if local LLM needed for GRID)
- [ ] ChromaDB available (GRID vector store)

---

## 10. Known issues (acknowledged, not blocking)

### Bugs and fragilities

- **B1** — TypeScript `tsc --noEmit` with strict `rootDir` may emit "file is not under rootDir" errors when editing via `planes/services/X/`. Mitigation: use `CascadeProjects/Tools/MCPServers/X/` path for builds; symlinks for navigation.
- **B5** — `planes/artifacts/echoes-runtime` is an absolute symlink to `/home/irfankabir/.echoes`. Dangles if `~/.echoes/` is ever moved or XDG-restructured.
- **B6** — arch_data is still R/W mounted. External writes to `/mnt/arch_data/.../CascadeProjects/*` after the V1 rsync would silently diverge the Ubuntu monorepo. No known external writer is active.
- **B7** — "populate on first use" stubs risk congealing as permanent placeholders. Acknowledge; replace with real content when sessions produce it.

### Open structural issues (the designer flagged)

- **Name collisions** — `afloat` (Next.js app) vs `afloat-server` (MCP). Private `interface` dir collides with "surfaces" plane.
- **Glimpse 3-way split** — `glimpse-server` / `glimpse-artifact` / `glimpse-engine` should consolidate or formalize the split.
- **Orphans** — `ai-web-demo`, `Coinbase_from_zip`, `upwork-cli` — no declared plane.
- **Deferred `/concept/` plane** — for Atmosphere, veridisquo, light_of_the_seven, magical_forest, walt-disney-st, concept. Omitted from this overlay; add when projects land.

### Semantic choices made

- `.echoes` symlink points at Ubuntu stub (not arch_data live history). Fresh-start on Ubuntu; history remains readable on arch_data.
- `integration-review` omitted from `planes/services/` (docs-only, no `src/`). Reachable via monorepo path.
- `Hogwarts` split into 4 surfaces (board, governors, hyperspace, nuke) instead of one aggregate.

### Identity reconciliation (post-migration cleanup)

Copied governance docs (`CLAUDE.md`, `CENTRAL_PLAZA.md`, `WORKSPACE_GATES.md`) originally referenced `/home/caraxes/...` paths and "CARAXES" plaza title — carryover from the Arch Linux `caraxes` home. These have been diverged to the live operator context:

- Plaza title: `CARAXES CENTRAL PLAZA` → `PRINCE · WORKSPACE PLAZA`
- Env paths: `/home/caraxes/CascadeProjects/...` → `~/workspace/CascadeProjects/...`
- Runtime: `/home/caraxes/.echoes/...` → `~/.echoes/...`
- Archived sources (e.g., `/home/caraxes/skills/os-guardrails/`, `/home/caraxes/seed/`) are explicitly labeled as such with the `/mnt/arch_data/home/caraxes/` path — they remain read-only references, not live.
- Legitimate `caraxes` tokens preserved: GitHub identity `caraxesthebloodwyrm02`, SSH alias `github-caraxes`, plugin name `caraxes`, agent persona `caraxes.md`.

### Hidden-bug defenses

- `racks/routines/governance/routine.yaml` path `../../WORKSPACE_GATES.md` (resolves to `~/workspace/racks/WORKSPACE_GATES.md`, doesn't exist) corrected to `../../../WORKSPACE_GATES.md` (resolves to `~/workspace/WORKSPACE_GATES.md`).
- All 10 `routine.yaml` reference paths verified to resolve. Audit: `for f in racks/routines/*/routine.yaml; do python3 -c "import yaml,os; [print('OK' if os.path.exists(os.path.normpath(os.path.join(os.path.dirname('$f'),r))) else 'MISS',r) for r in yaml.safe_load(open('$f'))['references']]"; done`
- `scripts/verify-planes.sh` whitelist includes `projects` (container for nested `viz/` and `research/` that are individually placed or whitelisted).
