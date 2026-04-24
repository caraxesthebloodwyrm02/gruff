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
- **CascadeProjects/** — Not initialized (doc only)

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
