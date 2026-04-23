# Copilot Instructions — workspace umbrella

This repo is a **workspace umbrella**: the root holds `planes/` (symlink map), docs, bridges, and schemas, while `CascadeProjects/` is a **git submodule** pointing to the hogsmade monorepo (MCP servers, shared packages, apps). The submodule contains a nested submodule: `CascadeProjects/Projects/GRID-main/`.

## Architecture

- **Umbrella repo** (this repo): `planes/`, `bridges/`, `schemas/`, top-level docs, workspace glue. PRs here review the submodule pointer, plane layout, and umbrella-level changes.
- **CascadeProjects/ (submodule)**: Node workspaces monorepo — the canonical source for all buildable code.
  - `Tools/MCPServers/`: 14+ TypeScript MCP servers (afloat, echoes, eligibility, glimpse, grid, lots, maintain, mangrove, ori, overview, pulse, seeds, craft, harness)
  - `Components/`: shared packages (`shared-types`, `shared-resilience`, `shared-pipeline`, `geometry-box`)
  - `Applications/`: `glimpse-artifact`, `glimpse-engine`, `pi-mangrove`
  - `Projects/`: `GRID-main` (nested submodule), `DIO`, `GATE`
  - `Hogwarts/`: governance simulation board UI
- **GRID-main (nested submodule)**: Python/FastAPI AI framework with its own Makefile and `uv` workflow. Direct development happens in `CascadeProjects/Projects/GRID-main/` (SSH remote); the top-level `GRID-main/` is a read-only submodule reference — never commit from there.

**Scope rule**: code that builds and ships belongs in the submodule; orchestration, operator docs, and symlink views stay in the umbrella.

## Build, Test, and Lint

### Umbrella root

```bash
make verify-planes     # Check planes/ symlink drift
make fourfold-snap     # Verify root fourfold files + session seal
make submodule-init    # git submodule update --init --recursive
```

### CascadeProjects monorepo (run from `CascadeProjects/`)

```bash
npm run format              # Prettier write
npm run format:check        # Prettier check
npm run lint:all            # Lint every workspace
npm run build:all           # Build every workspace
npm run test:all            # Test every workspace
npm run --workspace Tools/MCPServers/grid-server test   # Single workspace tests
pre-commit run --all-files  # Format + secret scan + manifest checks
```

### GRID-main (run from `CascadeProjects/Projects/GRID-main/`)

```bash
make run              # Start Mothership (port 8080)
make test             # Unit + integration + security + api
make lint             # ruff check + mypy
make format           # ruff format + autofix
make guard-no-debug   # Assert no debug flags in production mode
```

Single test:
```bash
cd CascadeProjects/Projects/GRID-main && uv run pytest tests/unit/test_foo.py::test_bar -v
```

GRID test env vars: `MOTHERSHIP_ENVIRONMENT=test`, `MOTHERSHIP_DATABASE_URL=sqlite:///:memory:`, `MOTHERSHIP_USE_DATABRICKS=false`

### Glimpse artifact (run from `CascadeProjects/Applications/glimpse-artifact/`)

```bash
npm install && npm run build && npm run lint
make check            # lint + typecheck + test + build
make debug-gate       # test + build
```

### Glimpse engine (run from `CascadeProjects/Applications/glimpse-engine/`)

```bash
node cli.js --help
node --test tests/glimpse-engine.test.mjs
```

Config source: `glimpse.master.yaml` → runtime pipeline `core/engine.js` → layouts `view-specs.js`.

### MCP servers (individual, run from `Tools/MCPServers/<server>/`)

```bash
npm install && npm run build && npm test
npm run dev            # tsx --watch src/server.ts
npm run start          # production start
```

### DIO (run from `CascadeProjects/Projects/DIO/`)

```bash
uv sync --group dev
uv run pytest
```

## Build Order (critical)

Dependency chain that must be respected:

1. `Components/shared-types` — `npm install && npm run build` (exports 9 paths: types, audit-client, security-policy, session-rate-limit, id, mcp-logger, precedent, trace-context, command-bus)
2. `Components/shared-resilience` — builds after shared-types
3. Dependent MCP servers (e.g. `grid-server` depends on both shared packages)

## Coding Conventions

- **Formatting**: Prettier — 2-space indent, semicolons, double quotes, trailing commas, LF endings, 100 char print width
- **Modules**: ESM (`"type": "module"`) everywhere; Node 22+
- **Naming**: `kebab-case` folders/files, `camelCase` functions/variables, `PascalCase` React components/types
- **Python**: 3.13+, ruff (120 char lines), type hints, structlog, Pydantic v2, `uv run` only (never bare `pip` or `python`)
- **TypeScript**: strict mode, ESLint + Prettier
- **Commits**: Conventional with scope — `feat(scope):`, `fix(scope):`, `docs(workspace):`, `chore(submodule):`
- **Server isolation**: keep server-specific logic inside `Tools/MCPServers/<server>/`; share via `Components/*`
- **Test files**: `*.test.ts`, `*.test.js`, `*.test.mjs`; shared-types also uses `.test.mjs` via `node --test`

## Data Contracts (do not rename fields)

- **Audit log** (`~/.echoes/audit.ndjson`): `AuditEvent` with `timestamp`, `source`, `tool`, `status`, optional `durationMs`/`metadata`. Written via `emitAudit` from `@cascade/shared-types/audit-client`.
- **GRUFF proportion v1** (`schemas/gruff-proportion-v1.schema.json`): Separate contract for wall-board control snapshots (phase, CoG, weights, metrics, `audioDrive`). Not an AuditEvent — do not append to `audit.ndjson` without an explicit metadata mapping.
- **Seeds snapshots** (`~/.seeds-server/snapshots/snapshot-{timestamp}.json`): `overallScore` (number) and `repos[].healthScore` (number). seeds-server writes, pulse-server reads latest by filename sort.
- **Command bus**: `dispatch`/`subscribe` via `@cascade/shared-types/command-bus`. `runId` format: `{service}.{kind}.{uuid}` (lowercase-kebab, no dots in service or kind).

## Known Issues

- **ori-server Fold 1**: 4 tests fail in recursive test environments (subprocess cascade / path env coupling) — expected CI failures, not regressions.
- **ori-server Fold 3**: 6 tests fail with `ENOENT` for a hardcoded path that doesn't exist — fixture-missing, not a code bug.
- **planes/ symlinks**: `tsc --noEmit` with strict `rootDir` may error when editing via `planes/services/X/`. Use the `CascadeProjects/Tools/MCPServers/X/` path for builds; symlinks are for navigation only.
- **GRID-main dual path**: `GRID-main/` (top-level) is read-only; all GRID development goes through `CascadeProjects/Projects/GRID-main/`.

## Git Rules

- Run `git status` and `git diff` before staging; avoid `git add .`
- Never commit secrets, `.env` files, `dist/`, `node_modules/`, `.venv/`, `*.tsbuildinfo`, or other generated artifacts
- Submodule pointer bumps: commit inside `CascadeProjects/` on its remote first, then commit the updated submodule reference in the umbrella
- Do not force-push or rewrite history without explicit instruction
- Grid identity auto-switches via `~/.gitconfig` `includeIf` — never override with `git config user.*`

## Safety

- Never weaken validation in `safety/`, `security/`, `boundaries/` modules
- Never add bypass paths or dev-mode shortcuts
- Always maintain audit trail integrity
- Local-first AI: Ollama + ChromaDB (no external APIs unless explicitly asked)
