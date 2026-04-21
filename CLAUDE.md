# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# gruff — Local Filesystem Umbrella

`~/gruff/` is **not** a git repository. It is a local filesystem umbrella with two layers:

| Directory | Mode | Git? | Purpose |
|-----------|------|------|---------|
| `workspace/` | Practice / Write | ✅ Yes | The actual `gruff` git repo — all dev work happens here |
| `school/` | Learning / Read | ❌ No | Sandbox; a symlink to `workspace/CascadeProjects/Tools/MCPServers/school-server` |

**Always `cd workspace/` before doing any development.** The `workspace/` directory has its own `CLAUDE.md` with all build commands, architecture, and constraints — that file is authoritative.

## workspace/ Quick Reference

```bash
cd ~/gruff/workspace

npm install && npm run build   # install deps + compile (tsup + extract-tokens.mjs)
npm run lint                   # tsc --noEmit
npm run dev                    # tsx --watch src/cli.tsx (live reload CLI)

make verify-planes             # check planes/ symlink drift
make fourfold-snap             # verify four-on-the-floor files + session-seal.json
make submodule-init            # git submodule update --init --recursive
```

Diagnostic scripts:
```bash
node scripts/diagnostic-paths.mjs              # path checks
node scripts/diagnostic-paths.mjs --bugs       # + bug scan
node scripts/diagnostic-paths.mjs --bugs --format  # all stages
```

## workspace/ Architecture

`gruff` is a TypeScript CLI + trust-routing overlay published as `@irfankabir002/gruff` on npm (`next` tag). Node ≥ 22 required; `better-sqlite3` builds a native binding on install.

```
src/
├── cli.tsx            — entrypoint; dispatches subcommands (actors, route, init, proportion, init-automation)
├── trust/
│   ├── db.ts          — SQLite wrapper (~/.gruff/trust.sqlite); actor_profile, events, routing_decisions tables
│   ├── ingester.ts    — gruff-ingester binary; tails ~/.echoes/audit.ndjson → trust.sqlite
│   ├── scorer.ts      — recomputeActor(): score = success_rate×100 − (10×recent_failures); tiers: school/practice/hold
│   └── schema.sql     — DDL; WAL mode, FK enforcement
├── commands/          — one module per CLI subcommand
└── menu/
    ├── Menu.tsx        — top-level Ink component (4-quadrant TUI)
    └── panels/         — agency.tsx, horizon.tsx, inference.tsx, mcp.tsx
```

**Data flow**: `gruff-ingester` reads `~/.echoes/audit.ndjson` (append-only NDJSON from the MCP fleet via `emitAudit`), writes rows to `~/.gruff/trust.sqlite`, and recomputes actor scores/tiers. The `gruff` TUI reads only from SQLite. `gruff proportion` validates and POSTs a `gruff-proportion-v1` JSON body to the gruff-echoes bridge (stub at `bridges/gruff-echoes/receiver.py`; real target: Echoes FastAPI).

**Published exports** (non-JS, accessible to other packages):
- `@irfankabir002/gruff/tokens.json` — GRID design-system tokens
- `@irfankabir002/gruff/schemas/gruff-proportion-v1` — JSON Schema for wall-board control snapshots
- `@irfankabir002/gruff/schemas/trust-event-v1` — JSON Schema for trust events

**CascadeProjects submodule**: `workspace/CascadeProjects/` → hogsmade monorepo (14+ MCP servers, shared-types, GRID-main nested submodule). TypeScript compilation explicitly excludes it (`tsconfig.json`). Follow workspace CLAUDE.md GRID rules when touching submodule content.

## Root-Level Files

| File | Purpose |
|------|---------|
| `router_agents.json` | Agent routing config (prince-runtime-intel / hermes / caraxes chain) |
| `agent_router.json.save` | Backup of previous routing state |
| `ESSAY.md` | Narrative document — not configuration |
| `mental_load_balancer.log` | Runtime log — do not commit |
| `canvas-design-mlbal/` | Canvas design artifacts (Python scripts + PNG output) |
