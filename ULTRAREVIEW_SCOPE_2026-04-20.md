# Ultrareview Scope — 2026-04-20

Holistic snapshot of all changes across the Mangrove workspace for cloud advisor review.
Generated from live `git status` / `git log` across all active repos.

---

## Repo Map

| Repo | Branch | State |
|------|--------|-------|
| `workspace/` (root) | `feat/mcp-fleet-remediation-2026-04-20` | 1 uncommitted modified |
| `CascadeProjects/` | `feat/mcp-fleet-remediation-clean` | 6 commits ahead of origin; 4 modified + 6 untracked |
| `CascadeProjects/Projects/GRID-main/` | `main` | 15 modified + 6 untracked (all uncommitted) |

---

## Part 1 — CascadeProjects: Committed Branch Scope

### Commit 3f4a3d8 — `chore(mcp-fleet): remediate 14 TS servers — P0–P3 + test coverage`

**39 files changed** across all MCP servers.

| Priority | What |
|----------|------|
| P0 | Add `harness-server` to npm workspaces (was missing — startup blocker) |
| P1a | Bump `@modelcontextprotocol/sdk` ^1.28.0 → ^1.29.0 across 12 servers |
| P1b | Add `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch` to tsconfig (13 servers) |
| P2 | Instrument `emitAudit` in afloat, craft, echoes, glimpse, mangrove (+21 call sites) |
| P3 | Relocate `integration-review/` → `ori-server/integration-review/` |
| Tests | +10 smoke cases: afloat-server, maintain-server, seeds-server |

**Files:**
- `Tools/MCPServers/afloat-server/` — package.json, server.ts, tsconfig.json, tests/smoke.test.ts (new)
- `Tools/MCPServers/craft-server/` — package.json, server.ts, tsconfig.json
- `Tools/MCPServers/echoes-server/` — package.json, server.ts, tsconfig.json
- `Tools/MCPServers/eligibility-server/` — package.json
- `Tools/MCPServers/glimpse-server/` — package.json, server.ts, tsconfig.json
- `Tools/MCPServers/grid-server/` — package.json, tsconfig.json
- `Tools/MCPServers/harness-server/` — package.json, tsconfig.json
- `Tools/MCPServers/lots-server/` — package.json, tsconfig.json
- `Tools/MCPServers/maintain-server/` — package.json, tsconfig.json, tests/smoke.test.ts (new)
- `Tools/MCPServers/mangrove-server/` — package.json, server.ts, tsconfig.json
- `Tools/MCPServers/ori-server/` — package.json, tsconfig.json
- `Tools/MCPServers/overview-server/` — package.json, tsconfig.json
- `Tools/MCPServers/pulse-server/` — package.json, tsconfig.json
- `Tools/MCPServers/seeds-server/` — (smoke tests)
- `.windsurf/workflows/mufliato.md`
- `integration-review/` → `ori-server/integration-review/` (11 docs relocated)

---

### Commit 6e60ad5 — `feat(shared-types,ori-server): command-bus + anticipation engine`

**22 files changed; 8684 insertions** (includes package-lock churn).

**New modules:**

| File | What |
|------|------|
| `Components/shared-types/src/command-bus.ts` | `dispatch`/`subscribe` primitive over Echoes NDJSON audit log |
| `Components/shared-types/src/id.ts` | `generateRunId`, `parseRunId`, `isRunId`, `RunId` type; format `{service}.{kind}.{uuid}` |
| `Components/shared-types/tests/command-bus.test.mjs` | 99-line test suite |
| `Components/shared-types/tests/id.test.mjs` | 49-line test suite |
| `Tools/MCPServers/ori-server/src/anticipation.ts` | Pipeline failure prediction engine (407 lines) — `PipelineAnticipationStore`, `PipelineAnticipationEngine`, 3 MCP tool exports |
| `Tools/MCPServers/ori-server/tests/anticipation.test.ts` | 210-line test suite |
| `Tools/MCPServers/ori-server/docs/ROUTINE_PHASES.md` | Fold/phase test execution results + envelope reference |

**Modified:**
- `Components/shared-types/src/audit-client.ts` — `appendNdjsonLine` extraction, queue-depth ceiling, `sanitizeForNdjson` export
- `Components/shared-types/src/index.ts` — 6 new export paths
- `Components/shared-types/package.json` — new entry points
- `Tools/MCPServers/ori-server/src/server.ts` — +68 lines: 3 new MCP tools wired to anticipation engine
- `Tools/MCPServers/ori-server/src/storage.ts` — +12 lines: adapt to new signal shapes
- `Tools/MCPServers/eligibility-server/src/routing.ts` — minor adjustment
- `Applications/glimpse-engine/dashboard.html` — +457 lines: dashboard update
- `.gitignore`, `CLAUDE.md`, `opencode.json`

---

### Commits 585c570, d3957de, 848b134, a0db2fc — housekeeping

| Commit | What |
|--------|------|
| `585c570` | DIO governance scaffolding: `.pre-commit-config.yaml`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md` |
| `d3957de` | GATE archive: `Projects/GATE/archived/envelope_commit-wave-2026-04.json` |
| `848b134` | Viz: `Projects/projects/viz/idea-risk-map.html` (573-line HTML exploration) |
| `a0db2fc` | Submodule bump: `Projects/GRID-main` → `2cc792a` |

---

## Part 2 — CascadeProjects: Uncommitted Changes

### Modified (not yet committed)

| File | Nature |
|------|--------|
| `.windsurf/workflows/startup.md` | Workflow update |
| `CLAUDE.md` | Docs/instructions update |
| `Components/shared-types/src/audit-client.ts` | In-flight changes to audit client |
| `Tools/MCPServers/ori-server/src/anticipation.ts` | Bug fixes applied this session (mutex race, TTL, dead branch) |

### Untracked (new files, not yet committed)

| File | Nature |
|------|--------|
| `TODO_SHORTLIST.md` | Session shortlist artifact |
| `Tools/MCPServers/echoes-server/src/automation/AUTOMATION.md` | New automation module docs |
| `Tools/MCPServers/echoes-server/src/automation/index.ts` | New automation module entry |
| `Tools/MCPServers/echoes-server/src/automation/signal_automation.ts` | Signal automation implementation |
| `Tools/MCPServers/echoes-server/src/automation/signal_automation.test.ts` | Automation tests |
| `Tools/MCPServers/ori-server/src/envelope.ts` | Phased test pipeline with modulation gates |

---

## Part 3 — GRID-main: Uncommitted Changes (all on `main`)

### Modified (15 files, 422 insertions / 117 deletions)

| File | Category | LoC delta |
|------|----------|-----------|
| `src/application/mothership/main.py` | Security/startup | +14 |
| `src/grid/services/llm/llm_client.py` | LLM client | +53 |
| `src/tools/rag/config.py` | RAG config | +2 |
| `src/tools/rag/embeddings/nomic_v2.py` | Embeddings | +13 |
| `src/tools/rag/indexer/distributed_spark_indexer.py` | Indexer | +22 |
| `src/tools/rag/llm/factory.py` | LLM factory | +129 |
| `src/tools/rag/llm/functions.py` | LLM functions | +2 |
| `src/tools/rag/llm/ollama_cloud.py` | Ollama cloud | +5 |
| `src/tools/rag/llm/ollama_local.py` | Ollama local | +71 |
| `src/tools/rag/llm/structured.py` | Structured LLM | +2 |
| `src/tools/rag/utils.py` | RAG utils | +52 |
| `tests/api/test_phase3_security_guardrails.py` | Security tests | +44 |
| `tests/security/test_security_suite.py` | Security tests | +92 |
| `research/experiments/rl/GATE.md` | Research | +36 |
| `.vscode/settings.json` | IDE config | +2 |

### Untracked (6 new files)

| File | Category |
|------|----------|
| `src/tools/rag/auto_selector.py` | New: catalog-based model auto-selector |
| `src/tools/rag/model_catalog.py` | New: catalog loader + refresh routine |
| `config/ollama-model-catalog.json` | New: model catalog data file |
| `tests/api/test_mothership_security_settings_validation.py` | New: runtime security config tests (5 tests) |
| `tests/unit/rag/test_model_catalog.py` | New: catalog unit tests |
| `docs/archive/sessions/COMMIT_SCOPE_MEMO_2026-04-20.md` | Session memo |

---

## Part 4 — Bug Fixes Applied This Session (in-flight, not committed)

Applied to the files above during this session — now present in the uncommitted diffs:

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `ori-server/src/anticipation.ts` | Mutex race in `appendSignal`/`resolveSignal` — replace pattern instead of chain | Changed to `this.mutex = this.mutex.then(...)` + `await this.mutex` |
| 2 | `ori-server/src/anticipation.ts` | TTL filter used `generatedAt` instead of resolution time | Added `resolvedAt?: string` to interface; set on resolution; filter by `resolvedAt ?? generatedAt` |
| 3 | `GRID-main/src/tools/rag/model_catalog.py` | Dead branch `{"_hint": ... if False else None}` always writes `None` | Changed to `{}` |
| 4 | `GRID-main/src/tools/rag/utils.py` | `dict[str, any]` (lowercase) in 3 annotations — not `typing.Any` | Added `from typing import Any`; fixed all 3 |
| 5 | `GRID-main/src/tools/rag/llm/factory.py` | `timeout_ms // 1000` truncates to 0 for sub-second values | `max(1, resolved.timeout_ms // 1000)` for both ollama-local and ollama-cloud paths |

*(Bug #5 command-bus O(N) subscriber re-reads — architectural, lower priority, not yet fixed)*

---

## Total Scope Summary

| Repo | Committed files | Uncommitted files | Total |
|------|----------------|-------------------|-------|
| CascadeProjects (branch) | ~61 source files (2 key commits) | 4 modified + 6 untracked | ~71 |
| GRID-main | 0 (all uncommitted) | 15 modified + 6 untracked | 21 |
| Workspace root | ~0 | 1 modified | 1 |
| **Total** | | | **~93 files** |

### Themes for reviewer attention

1. **Mutex correctness** — `anticipation.ts` (fixed this session; verify the chain pattern is exhaustive)
2. **TTL semantics** — `resolvedAt` field: backward compat via `?? generatedAt` fallback, but persisted stores pre-fix still have no `resolvedAt`; schema migration needed for production
3. **command-bus subscriber scalability** — O(N) file re-reads; no deduplication; truncation resets offset (Bug #5)
4. **LLM factory 3-path resolution** — catalog auto-select / fallback chain / legacy explicit — edge cases at boundaries
5. **Security settings validation** — `test_mothership_security_settings_validation.py`: verify severity assertions cover all paths (fail_fast, dev-mode degradation)
6. **emitAudit instrumentation** — 21 new call sites across 5 MCP servers; confirm all use correct field shapes per data contract
7. **echoes-server/automation** — new untracked module (signal_automation.ts) not yet committed; 3 known test failures (template.replace type error ×2, security_probe classifier gap)
