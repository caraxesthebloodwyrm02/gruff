# Gate 2/3 Recovery Evidence — 2026-04-20

Timestamp: `2026-04-20T22:42:55+06:00`

## 1) Gate 2 — Foundation (shared-types) status

### Shared-types rebuild

Commands run in `CascadeProjects/Components/shared-types`:

```bash
npm install
npm run build
npm test
```

Result:
- Build: **PASS**
- Tests: **PASS** (`10/10`)

### Build artifact hashes (evidence sample)

Command:

```bash
sha256sum dist/*.js dist/*.d.ts
```

Representative outputs:
- `dist/index.js`: `edf9c604ac5fa3d52570f919722d058f5c83279fc6c2db96b516c5450a7f9065`
- `dist/index.d.ts`: `4e5477abd4bee9405067c6c395d84fadd240a8902e67f31be315d4dff7777201`
- `dist/security-policy.js`: `35631e1c6959e5ff90542f888a654ebd60d820ab416743247232f347b1b02d27`
- `dist/command-bus.js`: `5c01a13299b68804bd8bd12329a6d52e82a154b13e58a5c309b1d1e7da324056`

## 2) High/Medium MCP rebuild sequence

### Initial dependency order result

Rebuild/test commands were run for:
- `grid-server` (High)
- `afloat-server` (High)
- `echoes-server` (Medium)
- `ori-server` (Medium)

Observed:
- `afloat-server`: build/test **PASS** (`6/6`)
- `echoes-server`: build/test **PASS** (`10/10`)
- `grid-server`: initially failed build due to missing `@cascade/shared-resilience` artifacts
- `ori-server`: build PASS, full suite had known failing executor/registry tests in this environment (`4 failed, 105 passed`)

### Dependency correction applied

Commands run in `CascadeProjects/Components/shared-resilience`:

```bash
npm install
npm run build
npm test
```

Result:
- Build: **PASS**
- Tests: **PASS** (`31/31`)

Then `grid-server` rebuild/test was retried and passed:
- Build: **PASS**
- Tests: **PASS** (`11/11`)

## 3) Gate 3 smoke checks (promotion criteria path)

Commands run from `CascadeProjects` root:

```bash
npm --workspace Tools/MCPServers/grid-server test -- tests/smoke.test.ts
npm --workspace Tools/MCPServers/afloat-server test -- tests/smoke.test.ts
npm --workspace Tools/MCPServers/echoes-server test -- tests/smoke.test.ts
npm --workspace Tools/MCPServers/ori-server test -- tests/smoke.test.ts
```

Result:
- `grid-server`: **PASS** (`9/9`)
- `afloat-server`: **PASS** (`6/6`)
- `echoes-server`: **PASS** (`10/10`)
- `ori-server`: **PASS** (`10/10`)

## 4) Risk controls R1–R5 (applied + verified)

A control verifier was added:
- `scripts/verify-gate23-controls.sh`

Command:

```bash
bash scripts/verify-gate23-controls.sh
```

Result: **PASS** (`failures=0`)

### R1 — Type drift across MCP boundary
- Control: validate shared-types export artifacts exist and high/medium servers pin local `@cascade/shared-types`.
- Verification: script checks passed.

### R2 — Silent JSON shape changes
- Control: schema sentinel checks for:
  - `shared-types/src/audit.ts` (`timestamp`, `source`, `tool`, `status`, `durationMs`, `metadata`)
  - `ori-server/src/anticipation.ts` (`id`, `category`, `confidence`, `horizon`, `target`, `transition`, `evidence`, `action`, `generatedAt`, `resolved`)
- Verification: script checks passed.

### R3 — GRID submodule policy confusion
- Control: assert `Projects/GRID-main` submodule declaration and `.gitmodules` presence.
- Verification: script checks passed.

### R4 — False green CI
- Control: enforce smoke-test presence for `grid`, `afloat`, `echoes`, `ori`.
- Verification: smoke files detected by script and smoke suites executed/passed.

### R5 — Audit narrative vs evidence drift
- Control: require evidence anchors (`review-package/08-findings.md`, `review-package/07-preflight.log`) before promotion.
- Verification: script checks passed.

## 5) Echoes snapshot error triage — `afloat-server.fetch_policy` 500

Reproduction command (executed in `Tools/MCPServers/afloat-server`):

```bash
for i in 1 2; do
  node --import tsx -e "const m=await import('./src/server.ts'); const s=m.buildServer(); const t=s._registeredTools||{}; const req={tool:'fetch_policy',arguments:{}}; if(!t.fetch_policy){ console.log(JSON.stringify({attempt:$i,request:req,response:{status:500,error:'tool_not_found',message:'afloat-server.fetch_policy is not registered'}},null,2)); process.exit(1);} const r=await t.fetch_policy.handler(req.arguments,{}); console.log(JSON.stringify({attempt:$i,request:req,response:{status:200,result:r}},null,2));" || true
done
```

Observed response (both retries):

```json
{
  "attempt": 1,
  "request": { "tool": "fetch_policy", "arguments": {} },
  "response": {
    "status": 500,
    "error": "tool_not_found",
    "message": "afloat-server.fetch_policy is not registered"
  }
}
```

Root-cause classification:
- **Deterministic contract mismatch (R2)**.
- `afloat-server` registers:
  - `health_check`
  - `workflow_create`
  - `workflow_list`
  - `workflow_get`
  - `workflow_execute`
  - `workflow_history`
- No `fetch_policy` tool exists in current server contract, so retries cannot succeed.

## 6) Gate decision

- Gate 2 (Foundation): **GREEN** for shared package rebuild path (`shared-types`, plus required `shared-resilience` prerequisite for `grid-server`).
- Gate 3 (Canopy dependency path through high/medium MCPs): **GREEN with documented caveat**:
  - Required smoke suites for `grid`, `afloat`, `echoes`, `ori` are all passing.
  - `ori` full-suite executor/registry failures remain environment-sensitive and outside smoke gate; they are tracked in existing docs.
- Outstanding action from triage: align snapshot caller contract to existing afloat tools or implement `fetch_policy` in `afloat-server`.
