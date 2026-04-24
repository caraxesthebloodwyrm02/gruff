# AGENTS.md — gruff workspace

## Quick Commands

```bash
cd ~/gruff/workspace  # Always work in workspace/

# Quality gates (must pass before commit)
npm run lint        # tsc --noEmit
npm run test        # 48 tests, all pass
npm run coverage   # Lines ≥80%, Branches ≥80%

# Build
npm run build      # tsup → dist/

# Python tests
cd python-prototype && source .venv/bin/activate && python -m pytest tests/ -q
```

## Architecture

- **src/trust/** — Core trust subsystem (db, scorer, ingester, schema)
- **dist/** — Compiled output (CLI entrypoint, ingester binary)
- **python-prototype/** — Notebook engine (LO7 runtime)
- **bridges/** — Echoes bridge (HTTP stub)
- **CascadeProjects/** — Symlink → `/mnt/arch_data/home/caraxes/CascadeProjects`

## Key Entry Points

| File | Purpose |
|------|---------|
| `src/trust/db.ts` | SQLite wrapper, session API |
| `src/trust/ingester.ts` | Tails audit.ndjson → trust.sqlite |
| `src/trust/scorer.ts` | Score/tier computation |
| `src/trust/schema.sql` | DDL (events, sessions, fingerprints) |

## Important Quirks

- **Test files**: `.test.ts` suffix required (pre-commit hook `name-tests-test`)
- **Coverage tool**: c8 (V8 native, 3-5x faster than nyc)
- **Coverage thresholds**: 80% for lines/branches/functions/statements
- **TypeScript**: ESM (`"type": "module"`), no declaration files in dist
- **DB reset**: Use `resetDb()` in tests before `process.env.GRUFF_TRUST_SQLITE` change

## Pre-Post Hook Pattern

```typescript
// test-hooks.ts provides:
import { setupScenario, teardownScenario, sendSignalChain } from "./test-hooks.js";

// PRE-HOOK
const ctx = setupScenario({ tier: "practice", score: 60 });

// POST-HOOK
teardownScenario(ctx, { exitReason: "completed" });
```

## Repo Conventions

- Commits: Conventional format (`feat:`, `fix:`, `docs:`)
- Pre-commit hooks: trim-whitespace, end-of-file-fixer, python-tests-naming
- Push: Direct to `origin/main` (no PR flow in this repo)

## Important Files

- `CLAUDE.md` — Workspace guidance
- `.c8rc.json` — Coverage config
- `Makefile` — verify-planes, fourfold-snap, submodule-init

## MCP Best Picks (TypeScript)

Inventory from `CascadeProjects/mcp_inventory.manifest.json`:

| Server | Tools | Status | Purpose |
|--------|-------|--------|---------|
| **pulse-server** | 8 | ok | Briefings + focus |
| **grid-server** | 11 | ok | GRID/GATE bridge |
| **afloat-server** | 7 | ok | Workflow orchestration |
| **overview-server** | 6 | ok | Checkpoints + health |
| **lots-server** | 5 | ok | Experiment catalog |
| **seeds-server** | 5 | ok | Ecosystem snapshots |
| **echoes-server** | 4 | ok | Audit + telemetry |
| **eligibility-server** | 4 | ok | Promotion + hierarchy |
| **ori-server** | 5 | idle | Console log + risk probe |

Python GRID servers (mcp-setup):
- `grid-intelligence` — intelligence queries
- `grid-rag-enhanced` — enhanced RAG
- `portfolio-safety-lens` — safety analysis

Run any: `npx -y tsx /path/to/server/src/server.ts`
