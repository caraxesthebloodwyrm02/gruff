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

## Ori Registry (ori-server)

Project registry from `registry-data.ts` — 28 projects tracked:

| Category | Projects |
|----------|----------|
| Core | GRID-main, echoes, afloat, DIO |
| Shared | shared-types, shared-resilience, shared-pipeline |
| Apps | glimpse-artifact, glimpse-engine |
| MCP Servers | 13 servers (afloat, echoes, grid, eligibility, glimpse, lots, maintain, mangrove, overview, pulse, seeds, ori) |
| Root | apiguard, Vision |

Seed: `~/.ori/registry/registry.json` (auto-created on first run)

Run discovery: `listProjects()`, `discoverTestSuites(id)`

## Regex Pattern Board (ori-server)

Most interacted patterns from `patterns.ts`:

| Pattern ID | Label | Regex | Severity |
|-----------|-------|-------|----------|
| `assertion_error` | Assertion failure | `/AssertionError\|assert\s+failed\|expect.*to\s+be/i` | critical |
| `timeout` | Timeout detected | `/TimeoutError\|timed?\s*out\|Exceeded\s+timeout\|ETIMEDOUT/i` | critical |
| `unhandled_rejection` | Unhandled promise rejection | `/UnhandledPromiseRejection\|unhandled\s+rejection\|promise.*reject/i` | critical |
| `race_condition` | Race condition signal | `/race\s+condition\|concurrent\s+modif\|deadlock\|lock\s+contention/i` | critical |
| `type_error` | Type mismatch | `/TypeError\|Cannot\s+read\s+propert\|undefined\s+is\s+not/i` | warning |
| `network_error` | Network failure | `/ECONNREFUSED\|ENOTFOUND\|fetch\s+failed\|network\s+error/i` | warning |
| `deprecation` | Deprecation warning | `/deprecat(ed\|ion)\|will\s+be\s+removed\|no\s+longer\s+supported/i` | warning |
| `memory_leak` | Memory concern | `/memory\s+leak\|heap\s+(out\|exhausted)\|MaxListenersExceeded/i` | warning |
| `flaky_test` | Flaky test signal | `/flaky?\s+test\|intermittent\s+(fail\|error)\|non-determin/i` | warning |
| `console_warn` | Console warning | `/console\.warn\|WARN\s*[:\]]/i` | info |
| `test_skip` | Skipped test | `/skip(ped)?\|todo\|pending\|disabled\s+test/i` | info |

Run classifier: `classifyLine(line)` → `{severity, matchedPatterns[]}`

## Post-Hook Action Exercises (ori-server executor)

Post-run actions from `executor.ts`:

| Action | Description |
|--------|-------------|
| `runTestSuite(projectId)` | Execute single project test suite |
| `runAllTests(projectIds?)` | Execute multi-project sequentially |
| `getRunResult(runId)` | Retrieve past run by ID |
| `listRuns({limit?, offset?})` | List past runs (default 20) |

Post-run status values:

| Status | Meaning | Health |
|--------|---------|--------|
| `passed` | All tests pass | healthy |
| `failed` | Tests failed | failing |
| `error` | Execution error | failing |
| `timeout` | Timed out | degraded |

Output artifacts:

- `~/.ori/runs/{runId}.stdout` — raw stdout
- `~/.ori/runs/{runId}.stderr` — raw stderr
- `~/.ori/runs/{runId}.json` — structured result

Signal persistence: Only lines matching ≥1 pattern are logged.

## Transformation Schema (Biochem-Inspired)

Inspired by Mystique's shapeshifting + biochemistry Hox genes:

### File Extension Transformations

| From | To | Method |
|------|-----|--------|
| `.ts` | `.js` | `tsc` / `esbuild` |
| `.tsx` | `.jsx` | `swc` |
| `.py` | `.pyc` | `compile` |
| `.md` | `.html` | `marked` / `pandoc` |
| `.json` | `.ts` | `json2ts` |
| `.yaml` | `.json` | `js-yaml` |
| `.sql` | `.duckdb` | `duckdb` |
| `.pdf` | `.txt` | `pdftotext` |
| `.png` | `.txt` | `tesseract` (OCR) |
| `.wav` | `.txt` | `whisper` (STT) |

### Multimodal Transfigurations

| Mode | Source | Target | Tool |
|------|--------|--------|------|
| code↔doc | `.ts` | `.md` | `typedoc` |
| image↔text | `.png` | `.txt` | `tesseract` |
| audio↔text | `.mp3` | `.txt` | `whisper` |
| video↔frames | `.mp4` | `.jpg` | `ffmpeg` |
| pdf↔html | `.pdf` | `.html` | `pdf2html` |
| db↔sql | `.duckdb` | `.sql` | `.duckdump` |

### Dimensional Cross-References

Cross-dimension mapping (inspired by Hox gene colinearity):

```typescript
// Dimensional axes: syntax ↔ semantics ↔ runtime
type Dimension = "syntax" | "semantics" | "runtime";

// Colinear mapping: index position maps to body region
// File path position maps to transformation tier
const TRANSFORM_TIER = {
  tier0: "parsing",    // index 0: raw input
  tier1: "parsing",   // index 1: AST
  tier2: "semantics",  // index 2: typed AST
  tier3: "codegen",   // index 3: output
} as const;
```

### Baseline Transformer Rules (Thumbs)

Based on Mystique's limits + Hox gene regulation:

| Rule | Description |
|------|-------------|
| **Mass conservation** | Input ≈ output (no data expansion) |
| **No power mimicry** | Transform structure, not behavior |
| **Concentration required** | Mental effort for complex transforms |
| **Time limit** | Extreme transforms ≤2min hold |
| **Colinearity** | Order maps to order (index preservation) |
| **Selector→Realizator** | Parse → Emit pipeline |

### Hook Architecture

```typescript
// Hook: pre-transform & post-transform
interface TransformHook<TIn, TOut> {
  before?: (input: TIn) => TIn;
  after?: (output: TOut) => TOut;
  // Inspired by: Mystique's psionic control
}

// Registry-based transformation
const transformerRegistry = {
  ".ts": { to: ".js", tool: "esbuild", tier: "codegen" },
  ".md": { to: ".html", tool: "marked", tier: "emit" },
  // Colinear: tier index maps to transform stage
};
```

Pure programming definition:

```typescript
type Transform<TIn, TOut> = (input: TIn) => TOut;

interface Transformer<T> {
  readonly sourceExt: string;
  readonly targetExt: string;
  readonly transform: Transform<T, T>;
  readonly tier: 0 | 1 | 2 | 3;  // Hox colinearity
}
```

## Architecture/Attention Matrix (Transformation Feature)

Deeply embedded in notebook.ts + ori-server:

### Feature Matrix

| Feature | Location | Status |
|---------|----------|--------|
| TransformRegistry | notebook.ts:250 | ✅ |
| TransformationEntry type | notebook.ts:55 | ✅ |
| logTransformation() | notebook.ts:282 | ✅ |
| getTransformationHistory() | notebook.ts:305 | ✅ |
| getTransformStats() | notebook.ts:318 | ✅ |
| Category: "transformation" | notebook.ts:43 | ✅ |

### Attention Weights (Tier Mapping)

| Tier | Layer | Attention | Function |
|------|-------|-----------|-----------|
| 0 | parsing | low | Input→raw |
| 1 | AST | medium | Parse tree |
| 2 | semantics | high | Type checking |
| 3 | codegen | critical | Output emit |

### Hook Wiring

```typescript
// Notebook transform hook (pre/post)
interface TransformHook<TIn, TOut> {
  before?: (input: TIn) => TIn;  // Mystique: concentration
  after?: (output: TOut) => TOut; // Hox: realizator
  tier: 0 | 1 | 2 | 3;
}
```

### Phenomenon References

- **Mystique**: psionic cell control, mass conservation, time limits
- **Hox genes**: colinearity, selector→realizator
- **Biochem**: dedifferentiation, transdifferentiation
