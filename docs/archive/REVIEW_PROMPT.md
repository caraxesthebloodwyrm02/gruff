# Claude Code — Workspace Design Review Prompt

> Paste everything below into Claude Code (or equivalent review agent). The workspace is at `~/workspace/`. Read `SPEC.md` first, then cross-reference against this session record.

---

## Your role

You are reviewing a freshly-constructed workspace overlay at `~/workspace/` on Ubuntu, built during a single migration session (Apr 19, 2026, 22:40–23:50 UTC+6). The overlay reorganizes an existing monorepo (`CascadeProjects/`) into a plane-grouped view reflecting the architecture the operator designed in `hogsmade-design/Hogsmade Cockpit.html`. Nothing was moved inside the monorepo — the overlay is pure symlinks + manifest scaffolding + governance docs.

**Your job:** audit the construction for (a) fidelity to the stated vision, (b) hidden bugs or stale refs, (c) gaps that would break scheduler/dispatch/routine use-cases, (d) anything a future session would regret.

You are not a rubber-stamper. If you find defects, name them and propose minimal fixes.

---

## Session context

### Operator

- **Identity:** Prince (Irfan Kabir), default agent `prince-runtime-intel` per `AGENTS.md`.
- **Home:** `/home/irfankabir/` on Ubuntu (fresh install).
- **Prior home:** `/home/caraxes/` on Arch Linux, now preserved read-only at `/mnt/arch_data/home/caraxes/`. "caraxes" is an archived persona + context-switched agent + GitHub handle (`caraxesthebloodwyrm02`) — **not the live operator**.
- **Location:** Uttara, Dhaka, Bangladesh, UTC+6.

### Trigger

User request (verbatim): *"this is a fresh workspace initiation, review the .zip files at downloads to interpret the design and review mounted arch_data to find the 'rack system' identify custom assets for routine interpretation and identify the custom code symbols for pattern e.g. GRUFF tooling. then give me a workspace construction architectural sketch to write the spec and initiate the workspace"*

### Source material consulted

| Source | Role |
|---|---|
| `~/Downloads/grid.zip` | GRID Design System — warm-tone reread (amber primary). Voice rules, tokens, UI kits, research-render imagery. Canonical SKILL.md for brand. |
| `~/Downloads/hogsmade.zip` | Hogsmade Audit + Hogsmade Cockpit HTML — the designer's explicit "BEFORE (30 surfaces) → AFTER (4 planes + bus + contracts)" sketch. Layout A ("command center with ⌘K") is the hi-fi pick. |
| `~/Downloads/hogsmade (1).zip` | Duplicate payload (md5-confirmed identical HTML). Skipped. |
| `/mnt/arch_data/home/caraxes/` | Raw arch_data mount — CascadeProjects monorepo, `~/.echoes/` runtime state, governance docs, agent configs. |
| `~/concept-command-bus.md` | User-authored spec for command bus over NDJSON (from session `ses_25968ad3bffe…`, Build · glm-5.1). Blocks on `cursor/signal-io-hardening-d896` landing. |
| `~/session-ses_2596.md` | Prior session transcript — 3 parallel-exploration subagent calls surveying shared-types + 14 MCP servers + id.ts. |

### Design vision extracted from source

From `Hogsmade Cockpit.html` AFTER sketch:

```
                  COMMAND BUS  (one event stream, one API, one palette)
                  ──────────────────────────────────────────────────────
  1 · SERVICES         2 · RUNS           3 · ARTIFACTS         4 · SURFACES
  what you CAN do      what IS happening  what it PRODUCED      how you SEE it
                  + infrastructure  (ops, hardening, deployment)
                  ──────────────────────────────────────────────────────
                  shared-types · shared-resilience · audit schema
```

Applied to disk: `planes/{bus,services,runs,artifacts,surfaces,contracts,infrastructure}/`.

---

## Decisions made (in order, with reasoning)

### Phase 1 — Plane mapping (Q1)

| Entry | Assignment | Reason |
|---|---|---|
| `apiguard` | services (not runs) | API security/rate-limiting is a capability, not a motion |
| `Vision` | surfaces (not runs) | Computer-vision pipelines are views-on-data, not jobs |
| `integration-review` | **omitted** | Docs-only; no `src/`. Reachable via monorepo path |
| `Hogwarts` | split into 4 surfaces | `board`, `governors`, `hyperspace`, `nuke` are functionally distinct per STRUCTURE.md |

### Phase 2 — Governance docs (Q2)

**Decision:** copy-once-diverge. The four docs (`CENTRAL_PLAZA.md`, `WORKSPACE_GATES.md`, `CLAUDE.md`, `AGENTS.md`) were copied from `/mnt/arch_data/home/caraxes/...` to `~/workspace/...`. Workspace versions become canonical; arch_data versions freeze as history.

**Consequence (caught later):** the copied docs carried stale `/home/caraxes/...` paths and "CARAXES CENTRAL PLAZA" title. Identity reconciliation applied post-construction (see Phase 6).

### Phase 3 — Racks seeding (Q3)

**Decision:** empty scaffolds only. Every pattern/profile/learning dir gets a one-line `README.md` stub ("populate on first use."). No pre-population from GRID docs or skills.

**Refined later (Phase 4 patches):** routines upgraded to machine-readable `routine.yaml` manifests.

### Phase 4 — Concept + infrastructure (Q4)

- `planes/concept/` **omitted** — projects don't exist in tree yet (Atmosphere, veridisquo, light_of_the_seven, etc. are GitHub-only or unsurfaced). Add when they land.
- `planes/infrastructure/` **included** as empty scaffold with README — reserves the plane for mangrove-hardening, Vision ops, etc.

### Phase 5 — Audit patches (P1–P4)

After the first plan iteration, an audit surfaced operational gaps:

| Patch | Applied? | Reason |
|---|---|---|
| **P1 — routine.yaml manifests** | Yes (routines only) | Without machine-readable manifests, scheduler has nothing to dispatch against. Patterns/profiles stayed stub because no scheduler semantics yet. |
| **P2 — echoes integrity carry-over** | **Deferred** | User chose to defer `check-integrity.sh` + `audit.ndjson.sha256` migration until first server start on Ubuntu. |
| **P3 — scripts bridge** | Partial (`verify-planes.sh` only) | `dispatch.sh` / `schedule.sh` deferred — both require the command bus to be real. `verify-planes.sh` is on-demand drift detection. |
| **P4 — hygiene** | Yes (both) | `.gitignore` (workspace is not a repo) + SPEC.md CLAUDE.md precedence rule (narrower scope wins on conflict). |

### Phase 6 — Refraction (R1–R3, then identity reconciliation)

User asked if the design reflected their vision "with accuracy or needs refraction". Three perceptual mismatches surfaced:

| Refraction | Applied? | Reason |
|---|---|---|
| **R1 — plaza/plane vocabulary reconciliation** | Yes | User invested in district vocabulary (`roots/`, `canopy/`). Adding a two-layer preface paragraph to `CENTRAL_PLAZA.md` explicitly names plaza=location, planes=role. |
| **R2 — BEFORE/AFTER Cockpit diagram in SPEC.md** | **Declined** | User chose terse SPEC; Cockpit HTML remains reachable. |
| **R3 — `.echoes` symlink to arch_data live history** | **Declined** | User preferred fresh-start semantic: Ubuntu starts clean, arch_data history is read-reference. |

### Phase 7 — Identity reconciliation (post-V7 correction)

**User correction (verbatim):** *"current design reflects a stale state. current state is irfankabirprince not caraxes. caraxes has been compartmentalized into the background as data ... please reconsider and review the logic gates to identify the combination discrepency and finalize with current, up to date referencing"*

**Root cause identified:** copied governance docs (`CENTRAL_PLAZA.md`, `CLAUDE.md`, `WORKSPACE_GATES.md`) inherited `/home/caraxes/...` paths and persona framing from the Arch Linux home. The "copy-once-diverge" decision in Q2 licensed divergence but I hadn't applied it to the stale parts.

**Actions taken:**

1. **Plaza title:** `CARAXES CENTRAL PLAZA` → `PRINCE · WORKSPACE PLAZA` (ASCII box re-centered).
2. **Path rewrites** across 3 files:
   - `/home/caraxes/CascadeProjects/...` → `~/workspace/CascadeProjects/...`
   - `/home/caraxes/.echoes/...` → `~/.echoes/...`
   - `/home/caraxes/` (bare home) → `~/workspace/` or noted as archived
3. **Archived paths explicitly labeled** — e.g., `/home/caraxes/skills/os-guardrails/` relabeled as `/mnt/arch_data/home/caraxes/skills/os-guardrails/` with `(archived)` suffix.
4. **Legitimate `caraxes` tokens preserved:** GitHub identity `caraxesthebloodwyrm02`, SSH alias `github-caraxes`, plugin name `caraxes`, agent persona `caraxes.md`.
5. **SPEC.md §1 rewritten** with explicit identity stack (live vs archived vs persona vs handle).
6. **SPEC.md §10 appended** with "Identity reconciliation" + "Hidden-bug defenses" sections.

**Hidden bug discovered during reconciliation:**

- `racks/routines/governance/routine.yaml` had `../../WORKSPACE_GATES.md` → resolved to `~/workspace/racks/WORKSPACE_GATES.md` (nonexistent). Two levels wrong. Would have silently broken any scheduler reading the reference. Fixed to `../../../WORKSPACE_GATES.md`.
- `verify-planes.sh` initially flagged `Projects/projects` as drift. Added to whitelist since it's a container dir whose children are placed individually.

---

## Verbose console logs — what actually ran

### V0 — Compile check (read-only path verification)

```
$ paths=(Components/shared-types Components/shared-resilience ... Hogwarts/nuke)
$ for p in "${paths[@]}"; do [ -e ~/workspace/CascadeProjects/"$p" ] || echo "MISS $p"; done
$ # (reference file check for zips + governance sources)
V0 PASS
```

Result: all 30 monorepo paths exist, all 8 reference files exist. No misses.

### V1 — Scaffold directories

```
$ mkdir -p ~/workspace/planes/{bus,services,runs,artifacts,surfaces,contracts,infrastructure}
$ mkdir -p ~/workspace/racks/{patterns,routines,profiles,learning}
$ mkdir -p ~/workspace/racks/patterns/{flow,spatial,rhythm,color,repetition,deviation,cause,time,combination}
$ mkdir -p ~/workspace/racks/routines/{attention,gate-contrast,governance,phases,unified-360}
$ mkdir -p ~/workspace/racks/profiles/{prince,claude,cascade,gemini}
$ mkdir -p ~/workspace/design-system ~/workspace/hogsmade-design ~/workspace/scripts
```

Result: 7 plane dirs + 9 pattern + 5 routine + 4 profile + 3 reference dirs.

### V2 — Symlinks, 6 per-plane batches

```
bus: 1 links        (shared-types)
services: 16 links  (14 MCP servers + apiguard + pi-mangrove)
runs: 2 links       (GRID, DIO)
artifacts: 2 links  (GATE, echoes-runtime → ~/.echoes absolute)
surfaces: 9 links   (Vision, glimpse-engine, glimpse-artifact,
                     bandwidth-equalizer, viz, board, governors,
                     hyperspace, nuke)
contracts: 3 links  (shared-types, shared-resilience, shared-pipeline)
infrastructure: 0   (empty scaffold)
TOTAL: 33 links, all resolve
```

### V3 — Unpack reference zips

```
$ unzip -oq ~/Downloads/grid.zip     -d ~/workspace/design-system/
$ unzip -oq ~/Downloads/hogsmade.zip -d ~/workspace/hogsmade-design/
design-system/: 49 MB (README, SKILL, colors_and_type.css, assets/, preview/, ui_kits/, uploads/)
hogsmade-design/: 128 KB (Hogsmade Audit.html + Hogsmade Cockpit.html + scraps/)
```

### V4 — Racks seed

- 9 `patterns/*/README.md` + 4 `profiles/*/README.md` + 1 `learning/README.md` = **14 stubs**.
- 5 `routines/*/routine.yaml` manifests (attention, gate-contrast, governance, phases, unified-360).

YAML parse + status check:

```
ok attention    | stub | manual
ok gate-contrast | stub | manual
ok governance   | stub | manual
ok phases       | stub | manual
ok unified-360  | stub | manual
```

### V5 — Governance + SPEC + hygiene + R1

Copied: `CENTRAL_PLAZA.md`, `WORKSPACE_GATES.md`, `CLAUDE.md` (from arch home), `AGENTS.md` (from monorepo root).
Wrote: `SPEC.md` (210 lines), `README.md` (38 lines), `planes/infrastructure/README.md`, `.gitignore`.
Applied: R1 preface to `CENTRAL_PLAZA.md` (two-layer reconciliation paragraph).

### V5b — `scripts/verify-planes.sh`

Shell script (bash, 55 lines) asserting every top-level dir under `CascadeProjects/{Tools/MCPServers, Applications, Projects, Components, Hogwarts}` maps to either a plane symlink or the whitelist (`integration-review|tests|config|experiments|scripts|research|projects`). `chmod +x`. First run:

```
summary: ok=30, skip=6, drift=0
```

### V6 — `workspace.code-workspace`

18 plane-grouped folder entries, sentence-case labels, `·` separator, no emoji. Design-system + hogsmade-design marked `files.readonlyInclude`. Node_modules / .venv / __pycache__ / .pytest_cache excluded.

JSON validates.

### V7 — Final verification

```
check 1: LINKS OK (33 total, 0 broken)
check 2: JSON OK (18 folders)
check 3: 5 routine.yaml parse
check 4: script syntax OK + executable
check 5: verify-planes drift=0
check 6: MONOREPO UNCHANGED (17 dirty entries byte-identical)
check 7: HEAD PRESERVED (4c8cf57cbf043f32045b789a61307e504b0a4a03)
check 8: STASH PRESERVED (1 entry on hogsmade)
check 9: NO STALE /home/caraxes paths in live docs
```

### Phase 7 — Identity reconciliation (post-V7)

```
$ grep -cE "caraxes|/mnt/arch_data|home/caraxes" ~/workspace/*.md
  CENTRAL_PLAZA.md: 8 matches  → 1 legitimate (archived ref) after fix
  CLAUDE.md: 11 matches        → 5 legitimate (GH identity, SSH, plugin, archive notes)
  WORKSPACE_GATES.md: 3 matches → 0 after fix
  AGENTS.md: 1 match            → legitimate (caraxes agent persona)
  SPEC.md: 2 → 3 after reconciliation section added
```

Routine.yaml ref audit:

```
OK  attention    -> ../../../design-system/assets/routine_attention.png
OK  attention    -> ../../../CascadeProjects/Tools/MCPServers/ori-server/src/router-config.ts
OK  gate-contrast -> ../../../design-system/assets/routine_gate_contrast.png
OK  gate-contrast -> ../../../CascadeProjects/Projects/GATE/README.md
OK  governance   -> ../../../design-system/assets/routine_governance.png
OK  governance   -> ../../../WORKSPACE_GATES.md   ← WAS MISS before fix
OK  phases       -> ../../../design-system/assets/routine_phases.png
OK  phases       -> ../../../CascadeProjects/Documentation/docs/PHASE4_QUALITY_CONTRACT.md
OK  unified-360  -> ../../../design-system/assets/routine_unified_360.png
OK  unified-360  -> ../../../hogsmade-design/Hogsmade Cockpit.html
```

10/10 resolve.

---

## Current workspace state

```
~/workspace/                         total footprint (excl. CascadeProjects):
├── CascadeProjects/  317M           monorepo, untouched
├── planes/           36K            33 symlinks (0 real bytes)
├── racks/            168K           14 README stubs + 5 routine.yaml
├── design-system/    49M            read-only reference
├── hogsmade-design/  128K           read-only reference
├── scripts/                         verify-planes.sh (executable)
├── SPEC.md           210 lines
├── CENTRAL_PLAZA.md  178 lines
├── README.md         38 lines
├── CLAUDE.md         ~400 lines     copied + path-reconciled
├── WORKSPACE_GATES.md              copied + path-reconciled
├── AGENTS.md                        copied (monorepo-scoped)
├── .gitignore        6 lines
└── workspace.code-workspace         18 plane-grouped folders
```

Monorepo state (`~/workspace/CascadeProjects/`):

- Branch: `cursor/signal-io-hardening-d896`
- HEAD: `4c8cf57` (1 ahead of origin)
- Dirty: 4 modified + 13 untracked (including new `Projects/DIO/` scaffolding, `Tools/MCPServers/echoes-server/src/automation/`, two disabled config backups)
- Stash: 1 (`WIP on hogsmade: 6e758c6 fix(knip): declare shared-types entry files…`)
- Submodule: `Projects/GRID-main` at `635079c3` (v2.8.0-83-g635079c)

---

## What to review — brief

Please evaluate the following dimensions and report findings:

### 1. Vision fidelity

- Does `planes/` layout match the Hogsmade Cockpit AFTER sketch? Specifically: is the bus-as-spine metaphor survivable given the filesystem limitation (spine appears as a sibling dir)?
- Does `SPEC.md` §2 accurately describe each plane's role? Are the "what you CAN do / IS happening / PRODUCED / SEE it" axes preserved?
- Is the plaza/plane vocabulary reconciliation in `CENTRAL_PLAZA.md` preface coherent, or does it create double-bookkeeping?

### 2. Hidden-bug surface

- Are there other routine.yaml or script paths that resolve wrong but weren't caught? Script: `for f in racks/routines/*/routine.yaml; do ...` from SPEC.md §10.
- Do any symlinks have fragile assumptions? Specifically `planes/artifacts/echoes-runtime → /home/irfankabir/.echoes` is absolute.
- Does `scripts/verify-planes.sh` have false negatives? (e.g., an MCP server created later that nobody links into `planes/services/` — would the drift detection catch it, or does the whitelist absorb it?)

### 3. Scheduler / dispatch / routine readiness

- Each `routine.yaml` has `status: stub`, `trigger: manual`, `dispatches: []`, `produces: []`. Is this schema rich enough for an eventual scheduler, or would a real scheduler need more fields (e.g., `timeout`, `retry_policy`, `owner`, `lock_key`)?
- `planes/bus/shared-types/` is the substrate for the command bus per `~/concept-command-bus.md`. Is there anything missing that would prevent that spec from being implemented when `cursor/signal-io-hardening-d896` lands?
- `~/.echoes/` is stub-only on Ubuntu; no `check-integrity.sh`, no `.sha256`. If a server starts writing audit events from Ubuntu, what's the risk posture?

### 4. Identity / governance coherence

- `SPEC.md` §1 introduces the identity stack (prince live, caraxes archived, caraxesthebloodwyrm02 legitimate GitHub). Is this clear enough that a new contributor wouldn't get confused when they see `caraxes` in commit metadata or plugin names?
- CLAUDE.md precedence rule (narrower scope wins): workspace CLAUDE.md vs monorepo CLAUDE.md. Is this written in a way that tools enforcing rules (editor `.rules`, pre-commit hooks) would honor?
- `.gitignore` at workspace root excludes `CascadeProjects/`, `planes/`, `racks/`, etc. Is this protective enough? Would `git init` here still cause trouble?

### 5. Scope boundary enforcement

SPEC.md §6 says nothing inside `CascadeProjects/` was moved, no git ops, no installs, no command-bus implementation. V7 check 6 confirms dirty state is byte-identical to snapshot (`~/workspace-migration/dirty-state.txt`). Does the rollback instruction actually restore to pre-construction state?

### 6. Things not asked but worth flagging

If you notice anything else — style, ceremony risk, documentation drift, tool-resolution problems with symlinks, deferred items that shouldn't have been deferred — surface it.

---

## Artifacts to inspect (in recommended order)

1. `~/workspace/SPEC.md` — complete spec, start here
2. `~/workspace/README.md` — one-screen nav
3. `~/workspace/CENTRAL_PLAZA.md` — plaza/district UX (with R1 preface)
4. `~/workspace/WORKSPACE_GATES.md` — 6-stage gated protocol
5. `~/workspace/CLAUDE.md` — monorepo-adjacent agent charter
6. `~/workspace/AGENTS.md` — agent registry
7. `~/workspace/planes/` — 33 symlinks, 7 planes
8. `~/workspace/racks/routines/*/routine.yaml` — 5 manifests
9. `~/workspace/scripts/verify-planes.sh` — drift detector
10. `~/workspace/workspace.code-workspace` — 18 plane-grouped folders
11. `~/workspace/hogsmade-design/Hogsmade Cockpit.html` — the original vision sketch (read-only reference)
12. `~/workspace/design-system/README.md` + `SKILL.md` — brand + voice rules (read-only reference)
13. `~/concept-command-bus.md` — user-authored spec for the bus (outside workspace)
14. `~/.windsurf/plans/workspace-vision-overlay-5964d7.md` — the construction plan (iterative)
15. `~/workspace-migration/` — dirty-state snapshot + diff + branches + submodules + stash list (evidence of monorepo preservation)

---

## Output format requested

Please structure your review as:

```
## 1. Vision fidelity
[findings — ok / partial / gap; cite specific files + lines]

## 2. Hidden-bug surface
[list of bugs found, with reproduction + proposed fix]

## 3. Scheduler readiness
[gaps that block real scheduling; propose schema extensions if needed]

## 4. Identity coherence
[confusion risks; propose clarifications]

## 5. Scope boundary
[drift detection; does rollback work?]

## 6. Other findings
[anything the prompt didn't ask about]

## 7. Verdict
[accept as-is / accept with N fixes / requires rework — with justification]
```

Be direct. Cite file paths and line numbers. Propose fixes as patches or explicit edits.
