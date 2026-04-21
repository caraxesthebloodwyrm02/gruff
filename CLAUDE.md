# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Mangrove Ecosystem Root

## Directory Map

```
~/gruff/workspace/  (prince@Ubuntu; legacy caraxes root archived at /mnt/arch_data/home/caraxes/)
├── CascadeProjects/         # Nerve center — hogsmade monorepo
│   ├── Tools/MCPServers/    # 21 MCP servers (14 TS servers including afloat, craft, echoes, grid, harness, ori, etc., + 7 Python servers)
│   ├── Components/          # shared-types, shared-resilience, shared-pipeline, scripts, tests
│   ├── Applications/        # glimpse-artifact, glimpse-engine, pi-mangrove, bandwidth-equalizer
│   ├── Projects/            # GRID-main (submodule), DIO, GATE, apiguard, Vision, projects/
│   ├── Documentation/       # Architecture notes, audits, workflow references
│   └── Hogwarts/            # board/ (React+Vite tool UI), governors/ (contract YAML)
├── canopy/                  # Standalone applications
│   ├── afloat/              # Workflow app (Next.js)
│   ├── echoes/              # Audit & observability platform (Python/FastAPI/Docker)
│   ├── assistive-agreement-contracts/  # Afloat deployment variant (Next.js)
│   ├── ai-web-demo/         # AI web demo (TS backend + frontend)
│   └── upwork-cli/          # Upwork CLI tooling
├── roots/                   # Infrastructure libraries & frameworks
│   ├── GRID/                # Full-stack AI framework (Python 3.13+, FastAPI, ChromaDB, Ollama)
│   ├── apiguard/            # API security gateway (Python)
│   ├── glimpse-engine/      # Rendering engine
│   ├── dep-mapper/          # Dependency mapper
│   ├── mcp-orchestration-language/  # MCP orchestration DSL
│   ├── portfolio-control/   # Portfolio control
│   └── security/            # Security tooling
├── seed/                    # The propagule — templates & archive
│   ├── templates/
│   └── archive/             # Inactive repos (Atmosphere, Coinbase_from_zip, storage)
├── grove/                   # irfankabir02 account repos
│   ├── Vision/              # Active — AI vision project (Python, symlink → CascadeProjects/Projects/Vision)
│   └── archive/             # Historical repos (GRID-historical, light_of_the_seven, Python, etc.)
├── plugins/                 # Custom plugins (caraxes, atlas-echoes)
├── scripts/                 # Workspace-level automation scripts
├── skills/                  # Skill definitions and context
├── .echoes/                 # Echoes audit trail
└── school/                  # Practice & sandbox mode
    └── server/              # Symlink to school-server
```

## GitHub Accounts & Git Identity

| Account                             | Email                           | SSH Host Alias   | Directories                |
| ----------------------------------- | ------------------------------- | ---------------- | -------------------------- |
| **caraxesthebloodwyrm02** (primary) | caraxesthebloodwyrm02@gmail.com | `github-caraxes` | Everything except `grove/` |
| **irfankabir02** (secondary)        | irfankabir02@gmail.com          | `github-irfan`   | `grove/` only              |

Git identity auto-switches via `~/.gitconfig` `includeIf` for `~/grove/`.

## Per-Project Instruction Files

Each active project has its own CLAUDE.md and/or AGENTS.md with project-specific commands, architecture, and constraints. **Always prefer the closest local instruction file when working in a subproject.**

| Project | Files |
| --- | --- |
| `CascadeProjects/Projects/GRID-main` | `CLAUDE.md` (full commands, architecture, middleware chain) + `AGENTS.md` (security guardrails) |
| `CascadeProjects` | `CLAUDE.md` (per-server commands, response discipline) + `AGENTS.md` (coding style, MUST/MUST NOT) |
| `canopy/afloat` | `CLAUDE.md` + `AGENTS.md` (14 required env vars, safety pipeline) |
| `canopy/echoes` | `CLAUDE.md` (8 core modules, quick-validation, session protocol) |
| Root workspace | `.github/copilot-instructions.md` (project boundary summary) |

## Key Project Relationships

- **CascadeProjects/shared-types** must be built before any MCP server that depends on it (especially afloat-server)
- **CascadeProjects/GRID-main** is a git submodule pointing to GRID-INTELLIGENCE/GRID.git (same as CascadeProjects/Projects/GRID-main). **Rule: all direct GRID development happens in `CascadeProjects/Projects/GRID-main/` — `GRID-main/` is a read-only submodule reference. Never commit from within `GRID-main/`.** The submodule uses HTTPS remote; `CascadeProjects/Projects/GRID-main/` uses SSH (`git@github-caraxes:`). Commits pushed from `CascadeProjects/Projects/GRID-main/` propagate to the remote; update the submodule pointer in CascadeProjects separately when pinning a new GRID version.
- **grove/archive/GRID-historical** is the original GRID repo from irfankabir02 before migration to GRID-INTELLIGENCE org. It is archived — no active development. Remote removed to prevent accidental pushes to the legacy irfankabir02/GRID.git. See `grove/archive/GRID-historical/ARCHIVED.md`.
- MCP servers in CascadeProjects connect to GRID via `GRID_API_URL=http://localhost:8080`
- **GRID has two API servers**: Mothership (port 8080, primary) and API Gateway (port 8000, routes to Mothership)
- **CascadeProjects/overview-server** is an MCP server not listed in build order — has `checkpoint` and `health_check` tools
- **CascadeProjects/craft-server** — LSP template rendering / context artifact generation (python-craft geometric/transformer outputs)
- **CascadeProjects/harness-server** — Great League GATE harness pipeline (bastiodon/talonflame/exeggutor-a scenarios, arm/cycle/disarm loop)

## Build Order & Package Managers

1. `CascadeProjects/shared-types` — `npm install && npm run build`
2. MCP servers (afloat-server, craft-server, echoes-server, eligibility-server, glimpse-server, grid-server, harness-server, lots-server, maintain-server, mangrove-server, ori-server, overview-server, pulse-server, seeds-server) — `npm install`
3. `CascadeProjects/glimpse-artifact` — `npm install && npm run build`
4. `CascadeProjects/Projects/GRID-main` — `uv sync --group dev --group test`
5. `canopy/afloat` — `npm install`
6. `canopy/echoes` — `uv sync` (Python/FastAPI)
7. `CascadeProjects/Projects/apiguard` — `uv sync`
8. `CascadeProjects/Projects/Vision` — `uv sync`

**Package manager rules:**

- Python projects → `uv` (never raw pip)
- CascadeProjects root + MCP servers → `npm`
- mcp-tool-experiment → `pnpm`

## Quick Commands (Per-Project)

Projects with Makefiles — use `make` targets as the canonical shortcut:

**CascadeProjects/Projects/GRID-main** (`Makefile`):
- `make run` — start Mothership (port 8080)
- `make test` — unit + integration + security + api tests
- `make lint` — ruff check + mypy
- `make format` — ruff format + autofix
- `make guard-no-debug` — assert no debug flags in production mode
- Single test: `cd CascadeProjects/Projects/GRID-main && uv run pytest tests/unit/test_foo.py::test_bar -v`

**canopy/echoes** (`Makefile`):
- `make dev` — uvicorn with reload
- `make test` / `make coverage` — pytest with optional coverage
- `make lint` / `make format` — ruff check + format
- Single test: `cd canopy/echoes && uv run pytest tests/test_foo.py::test_bar -v`

**canopy/afloat**:
- `npm run check` — lint + typecheck + test:coverage + build (quality gate)
- `npx vitest run tests/session.test.ts` — single test file
- `npx vitest run -t "test name"` — single test by name

**CascadeProjects/Projects/GRID-main frontend** (`CascadeProjects/Projects/GRID-main/frontend/`):
- `npm run dev` — Vite + Electron
- `npm run storybook` — Storybook on port 6006
- `npm run api:generate` — OpenAPI TypeScript types from running Mothership

**CascadeProjects/glimpse-artifact** (`Makefile`):
- `make check` → `npm run check`
- `make debug-gate` → test + build

**MCP servers** (dev mode): `npm run dev` → `tsx --watch src/server.ts` (same pattern for all servers)

## Docker Stacks

- **GRID monitoring**: `CascadeProjects/Projects/GRID-main/infrastructure/monitoring/docker-compose.yml` — Prometheus (9090), Grafana (3000), Alertmanager (9093), Node Exporter (9100), Jaeger (16686)
- **Echoes**: `canopy/echoes/docker-compose.yml` — API + Redis 7 + Prometheus + Grafana + Redis Commander; prod variant at `docker/docker-compose.prod.yml`

## MCP Server Config

Canonical config: `CascadeProjects/mcp_config.json` (for editors) and `CascadeProjects/claude_code_config.json` (for Claude Code).

Key environment variables:

- `CASCADE_WORKSPACE_ROOT` → `~/workspace/CascadeProjects`
- `GATE_DIR` → `~/workspace/CascadeProjects/Projects/GATE`
- `SEEDS_ROOT` → `~/workspace/CascadeProjects/seed`  (seed dir not migrated; raw at `/mnt/arch_data/home/caraxes/seed/`)
- `ECHOES_AUDIT_PATH` → `~/.echoes/audit.ndjson`
- `LOTS_EXPERIMENTS_DIR` → `~/workspace/CascadeProjects/experiments`
- `PYTHONPATH` for GRID servers → `~/workspace/CascadeProjects/Projects/GRID-main/src:~/workspace/CascadeProjects/Projects/GRID-main`

## Data Contracts

Cross-server contracts that must not be broken:

- **Echoes audit log** (`~/.echoes/audit.ndjson`): All MCP servers use `@cascade/shared-types` `emitAudit` to append `AuditEvent` objects. Fields: `timestamp`, `source`, `tool`, `status`, optional `durationMs`/`metadata`. Do not rename fields.
- **GRUFF proportion v1** (workspace `schemas/gruff-proportion-v1.schema.json`, stub `bridges/gruff-echoes/receiver.py`): A **separate** contract for wall-board control snapshots (phase, CoG, weights, metrics, `audioDrive`). It is **not** an `AuditEvent` — do not append proportion JSON bodies to `audit.ndjson` unless you define an explicit `metadata` mapping and tooling to consume it.
- **Seeds snapshots** (`~/.seeds-server/snapshots/snapshot-{timestamp}.json`): seeds-server writes; pulse-server reads latest by filename sort. Required fields: `overallScore` (number) and `repos[].healthScore` (number).
- **GATE directory** (`CascadeProjects/GATE/`): Runtime envelopes, contracts, and results. Check `GATE/README.md` before restructuring.
- **shared-types exports**: 9 paths — `.` (types), `./audit-client` (emitAudit), `./security-policy`, `./session-rate-limit`, `./id`, `./mcp-logger`, `./precedent`, `./trace-context`, `./command-bus`.

## Shell Aliases

`cascade`, `canopy`, `roots`, `seed`, `grove`, `grid`, `afloat`, `echoes`, `vision` — cd shortcuts defined in `~/.bashrc`.

## Shared Development Rules

**Canonical sources**: `~/.dev-rules.md` (TUV-001 + workspace baselines) and `seed/templates/development-contract.md` (full trust contract). For **bounded broad-pass sweeps**, use `seed/templates/gruff-sweep-execution-radius.md`. Editor rule files (`.cursorrules`, `.windsurfrules`, etc.) are compatibility layers aligned to `~/.dev-rules.md`.

**shared-types/command-bus**: `dispatch` / `subscribe` primitive. `CommandEnvelope` and `Namespace` schemas validated with Zod; `runId` must be a valid `RunId` (format: `{service}.{kind}.{uuid}`).

**shared-types/id**: `generateRunId(service, kind)` produces structured run IDs. `parseRunId` / `isRunId` for validation. Both `service` and `kind` must be lowercase-kebab (no dots).

**shared-types test runner**: `.test.mjs` files run via `node --test` (not vitest). `.test.ts` files run via vitest. Run both with `npm test` from the package root.

**Canonical MCP source**: `CascadeProjects/mcp_config.json` — all tool configs are derived from this. Inventory: `CascadeProjects/mcp_inventory.manifest.json`; drift check: `python3 CascadeProjects/scripts/verify_mcp_inventory.py`.

**Ollama models required**: `ministral:latest`, `nomic-embed-text-v2-moe:latest`

## Environment Constraints

- **OS**: Arch Linux — use `pacman -S` for packages (not apt, brew, dnf)
- **No sudo**: Never run `sudo` commands directly. Collect all privileged commands and present as a single copyable block at the end of the session.
- **Tool availability**: Check with `command -v` before assuming a binary exists — fresh Arch installs may be missing common tools (e.g., `hostname`)
- **Exit codes**: Verify actual output content, not just return codes. Some tools (e.g., `ssh-keygen -l`) return non-zero for non-error conditions.
- **Python runtime**: Always `uv run` — never bare `python` or `pip`
- **`prompt.md` files**: These are often notes or scratch files, not authoritative configuration. Do not treat them as instruction files.

## Git Workflow Constraints

- Do NOT autonomously create branches, rebase, or run extra git operations when the user only asks to commit.
- Only perform the specific git action requested; ask before expanding scope.
- Before any git work, run `git status` and `git diff --stat`, summarize what you see, and confirm it matches the task brief. If the working tree state doesn't match what was described, STOP and report — do not proceed.

## Response Style

- When asked for concrete output (commit messages, command sequences, file contents), produce the output directly. Make reasonable assumptions, note them at the end under "Assumptions". Do not ask clarifying questions unless genuinely blocked from starting.
- Draft first, iterate after — never stall on ambiguity when a reasonable attempt is possible.

## Git Operations

- **Push strategy**: Prefer `gh` CLI or HTTPS as fallback if SSH fails. Do not retry SSH more than once.
- **Multi-repo cwd**: Always `cd` into the project root before running git commands. Do not relocate or move projects unless explicitly asked.
- **Identity**: Git identity auto-switches via `~/.gitconfig` `includeIf` — never override with `git config user.*` commands.

## Session Resilience

### Session Start Checklist (run before any work)

1. **Lumos fast-lane** — run these 3 calls in parallel:
   - `mcp__eligibility-server__check_the_line`
   - `mcp__seeds-server__ecosystem_scan` (saveSnapshot: false)
   - `mcp__echoes-server__enforcement_status`
   Apply FAST CLEAR / WATCH / ACT / URGENT verdict. If URGENT, run `mcp__eligibility-server__hold_the_line` first.

2. **Memory verification** — before acting on any memory reference (file path, function name, flag, or config value), verify it exists in current state. Memory entries are point-in-time. If a memory entry conflicts with observed code, trust the code and update the memory.

- **Checkpoint on limit**: If approaching rate limits or context limits, immediately write progress to `.claude-progress.md` in the workspace root with: (1) what was done, (2) what's next, (3) blockers encountered.
- **Resume protocol**: On session start, check for `.claude-progress.md` and resume from where the last session left off.
- **Scope discipline**: One session = one project, one primary goal. Flag scope expansion before acting.
- **Partial work**: Never discard partial results silently. If a multi-step task can't complete, save intermediate artifacts and report what remains.
- **Response verbosity**: Brief by default — answer first, no preamble, no trailing summaries.

---

## Operational Standards

### Known Test Environment Constraints

- **ori-server Fold 1** (executor/registry): 4 tests fail in recursive test environments — `run_tests`, `get_run_result`, `registry health updated after test run` (subprocess cascade), and `discover_tests validates project on disk` (path env coupling). These are expected failures in CI; do not treat as regressions.
- **ori-server Fold 3** (threat-model): 6 tests fail with `ENOENT` for `/home/caraxes/CascadeProjects/Documentation/docs/CascadeProjects-threat-model.md`. The file doesn't exist at that hardcoded path — fixture-missing, not a code bug.
- **ori-server Fold 2** (reporter/heatmap/anti-pattern): All green — zero failures expected.

### ori-server Additions

**anticipation engine** — Pipeline failure prediction. Generates `AnticipationSignal` objects from log history and environment state. Three MCP tools: `generate_anticipation_signals`, `get_anticipation_status`, `resolve_anticipation_signal`. Signal shape uses `category`, `confidence`, `horizon`, `evidence[]`, and `resolved` fields — do not rename these.

**envelope.ts** — Phased test pipeline with modulation gates. Exports `envelope()` callable and fold constants `FOLD_1_CORE`, `FOLD_2_ANALYSIS`, `FOLD_3_INTEGRATION`. Phase advancement: fold N passes → fold N+1 unlocks. Hard-halt on critical smoke failures.

## Custom Skills (Claude Code Commands)

Available via `/command-name` in Claude Code sessions:

| Command                  | Purpose                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `/screen-budget`         | One-screen output discipline (~3000 chars, 3-tier response)                                                   |
| `/iterate`               | Freelance project delivery framework (understand → plan → implement → verify)                                 |
| `/lifeguard-review`      | Production API code review (11 validation rules)                                                              |
| `/gated-execution`       | 6-stage execution protocol for non-trivial code changes                                                       |
| `/trust-layer-review`    | Safety-first senior code review + trust layer audit                                                           |
| `/trust-contract-review` | Review code, architecture, incidents, or AI output against TUV-001 clauses and never-rules                    |
| `/shield-break`          | Structured integrity recovery protocol when context, scope, or quality has drifted                            |
| `/breach-state`          | Formal contract breach recovery protocol for never-rule or accountability failures                            |
| `/echoes-dev`            | Echoes project workflows (venv, tests, lint, API startup)                                                     |
| `/glimpse`               | Glimpse cognitive engine reference and maintenance guide                                                      |
| `/harden`                | Full-spectrum Mangrove security workflow — config/MCP audit, system/process audit, file integrity, monitoring |
| `/os-guardrails`         | OS-level security hardening — sysctl, nftables, service posture, audit logging, 22-point verification         |
| `/dep-wave`              | Multi-repo dependency PR triage, merge, and coordination (batch Dependabot processing)                        |
| `/repo-hygiene`          | Post-work cleanup — branch pruning, stash management, submodule sync, git gc across ecosystem                 |
| `/remediate`             | Ecosystem-wide remediation for config drift, broken refs, stale state                                         |
| `/strategyboard`         | Strategic decision-making advisor for architecture, planning, and cross-project impact                        |
| `/wardrobe`              | Dress any output for scanability, gate visibility, and sort+filter efficiency (offline-capable)               |

Commands live in `~/.claude/commands/`. Some are sourced from `~/skills/*.skill`.

## Scripts Directory

`~/scripts/` contains workspace-level automation:
- `agent-review-loop.sh` — lists open Dependabot PRs and failing checks across all repos
- `weekly-security-check.sh`, `integrity-monitor.sh`, `network-watchdog.sh`, `process-sentinel.sh` — recurring security scripts (last three are scanners, not killers; timers disabled 2026-04-18)
- `os-harden.sh`, `apply-hardening.sh`, `ext-guardrails.sh` — OS hardening scripts
- `memory-watchdog.sh` — canonical backup of the RSS-only memory watchdog (deployed copy at `~/.local/bin/memory-watchdog.sh`)
- `apply-memory-guardrails.sh` — staged sudo installer for Layer 1 user-slice memory cap + Layer 2 systemd-oomd (see `reference_memory_safety.md`)
- `workspace-maintenance.sh`, `stay-current.sh`, `morning-session-launch.sh`, `windsurf-launch.sh`, `vscode-scope-verify.sh` — session and workspace automation
- `retry-review.sh`, `setup-branch-protection.sh` — development workflow scripts

Custom user binaries (`~/.local/bin/`): `memory-watchdog.sh`, `psi-watchdog.sh` (both run as supervised user services).

## Context Files

- **`~/.claude/SESSION_CONTEXT.md`** — narrow goal snapshot for agent session-start: current stability posture, pending actions, recent deltas, read-before-write pointers. Read first.
- `~/skills/claude_code_context.md` — Active project status, open threads, architectural decisions, security notes
- `~/skills/Session Highlights 2026.md` — Phase 4 initiative tracker, workspace map, quality gates, session protocols

## Automated Dev Pipeline

Fully automated CI/CD loop across 6 active repos. Dependabot keeps deps current, Copilot reviews PRs, local agent fixes CI failures, auto-merge when gates pass.

### Pipeline Flow

```
Dependabot/human creates PR → pr-contract validates → secrets-gate scans →
CI pipeline (lint → test → build) → PASS: Copilot reviews + auto-merge (patch/minor)
                                   → FAIL: auto-label agent:fix → self-hosted agent fixes →
                                     CI re-runs → loop → branch auto-deleted
```

### Per-Repo Automation

| Repo            | Dependabot              | Secrets Gate        | CI                                              | Copilot Review | Auto-Merge | Agent-Fix      |
| --------------- | ----------------------- | ------------------- | ----------------------------------------------- | -------------- | ---------- | -------------- |
| CascadeProjects | npm + actions (grouped) | TruffleHog + custom | TS build/test + contract checks                 | Yes            | Yes        | Yes (existing) |
| CascadeProjects/Projects/GRID-main      | pip + actions + npm     | In CI pipeline      | secrets → lint → security → test → build        | Yes            | Yes        | Yes            |
| canopy/echoes   | pip + actions           | TruffleHog + custom | uv lint + test                                  | Yes            | Yes        | Yes            |
| canopy/afloat   | npm + actions           | TruffleHog + CodeQL | lint → typecheck → test → build → Vercel deploy | Yes            | Yes        | Yes            |
| CascadeProjects/Projects/apiguard | pip + actions | TruffleHog + custom | uv lint + test | Yes | No | No |
| CascadeProjects/Projects/Vision | pip + actions | TruffleHog + custom | uv lint + test | Yes | No | No |

### Key Workflows

- `dependabot-auto-merge.yml` — auto-squash-merge patch/minor Dependabot PRs after CI passes
- `auto-label-agent-fix.yml` — labels failed Dependabot PRs with `agent:fix` for self-hosted runner
- `agent-fix.yml` — self-hosted runner runs Codex to fix failing PRs
- `stale-branches.yml` — monthly report of branches >90 days old (CascadeProjects)
- `cross-project-smoke.yml` — weekly shared-types → MCP server build chain verification
- `secrets-gate.yml` — TruffleHog + custom credential scanning on every push/PR

### Copilot Code Review

Per-repo review instructions in `.github/copilot-instructions.md`. Start with manual `@github-copilot review`, graduate to auto-review after validation.

### Self-Hosted Runner

Required labels: `[self-hosted, linux, agent-fix]`. Must have: Node 22, Python 3.13, uv, npm, pnpm, codex CLI. Registered under caraxesthebloodwyrm02.

### Convenience Script

`~/scripts/agent-review-loop.sh` — lists open Dependabot PRs and failing checks across all repos.

### Branch Policy

- Feature branches: merge+delete within 30 days
- Fix branches: within 7 days
- Long-lived: only `main`/`master`/`hogsmade`
- Auto-delete head branches after merge (set in GitHub repo settings)

## Git hygiene and source protection

- Respect **`.gitignore`** in each repo and **`core.excludesfile`** when set (`~/.config/git/ignore` — see `~/scripts/global-git-excludes-README.md`). Do not stage generated output (`dist/`, `build/`, `.next/`, coverage, `.venv/`, `node_modules/`, `*.tsbuildinfo`), caches, local `.env*`, or IDE-only dirs unless the operator explicitly requests it.
- Prefer **`git status`** and **`git diff`** before **`git add`**. Avoid repository-wide **`git add .`**. Do not **force-push** or rewrite **history** without explicit instruction. **GRID-main** in CascadeProjects is a submodule: direct GRID development and commits follow the path spelled out in this file’s GRID section.
- Change **generators and source**, not hand-edited **`dist/`** or lockfiles, unless the task is explicitly to update those files.
- **Secrets:** Never commit credentials. If found tracked or staged, stop and escalate: **`.gitignore`**, **`git rm --cached`**, and rotation / history scrub are **human-gated** when pushes occurred.
- **New repos:** Copy from `~/seed/templates/gitignore-node-strict.template` or `gitignore-python-uv.template`. **Audit:** `~/scripts/gitignore-audit.sh`.

## Development Contract (The Unbreakable Vow)

**Location**: `seed/templates/development-contract.md` (TUV-001)

A 3-condition trust contract between AI assistant and developer, enforcing fidelity, integrity, and accountability. Each condition has 3 clauses and concrete violation protocols. Enforcement patterns are sourced from `canopy/assistive-agreement-contracts` (DPR chains, fail-closed defaults, hardened versioning) and `CascadeProjects/Projects/GRID-main` (BoundaryEngine, Overwatch, transition gate never-rules, GateKeeper audit).

**Activation**: Reference by name in a session ("Unbreakable Vow is active" or "TUV-001 applies"). The assistant acknowledges by restating the three conditions.

**Recovery**:

- Condition I violation → mark output void, re-anchor to the last known-good objective, confirm scope.
- Condition II violation → invoke `/shield-break` and halt.
- Condition III or never-rule violation → invoke `/breach-state` and halt.
- Contract-focused review command → `/trust-contract-review`
