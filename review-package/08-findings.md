# Review Findings — Ultrareview 2026-04-20

Advisor call completed. storage.ts verified post-call (see Theme 2 note).

---

## BLOCKERS (fix before merging to main)

### B1 — Mutex Chain Poisoning
**Theme**: 1 — Mutex Correctness
**File**: `CascadeProjects/Tools/MCPServers/ori-server/src/anticipation.ts:169-201`
**Severity**: BLOCKER

No try/catch inside the `.then()` body of the mutex chain. Both `this.load()` and `this.save()` can throw on I/O error. First throw permanently rejects the chain → all subsequent `appendSignal`/`resolveSignal` calls silently no-op. Anticipation engine stops predicting after one disk hiccup with no operator signal.

**Fix**: Wrap `.then(async () => { ... })` body in try/catch, log the error, and continue (do not re-throw).
Estimated: ~5 lines.

---

### B2 — LLM Factory Path 1 No Fallback
**Theme**: 4 — LLM Factory 3-Path Resolution
**File**: `CascadeProjects/Projects/GRID-main/src/tools/rag/llm/factory.py:179-194`
**Severity**: BLOCKER

`_use_catalog_auto_select()` has no `try/except`. Malformed `ollama-model-catalog.json` or corrupted overrides file raises an unhandled exception — factory crashes and never falls through to path 2. For a 3-path resolver, graceful degradation is the contract.

**Fix**: Wrap the call at lines 179-194 in `except (json.JSONDecodeError, FileNotFoundError, ValidationError)`, log the cause, fall through to `_use_fallback_chain()`.
Estimated: ~6 lines.

---

## NON-BLOCKERS (file follow-up)

### N1 — Unbounded Mutex Chain Growth
**Theme**: 1 — Mutex Correctness
**File**: `anticipation.ts:169-201`

Each call extends the promise chain; prior segments retained by closure. Linear memory with call count. Low risk at current frequency but trivially fixed by reassigning `this.mutex = Promise.resolve()` after `await this.mutex`. Defer to same commit as B1.

---

### N2 — TTL resolvedAt Round-Trip (CONFIRMED SAFE)
**Theme**: 2 — TTL / resolvedAt Semantics
**File**: `anticipation.ts` + `storage.ts`

Post-advisor verification: `storage.ts` only handles `LogEntry` NDJSON — it never touches `AnticipationSignal` objects. Signal persistence is in `anticipation.ts` itself via plain `JSON.parse(raw)` / `JSON.stringify(this.store)` with no schema filter. `resolvedAt` field is preserved through all load/save round-trips. Pre-fix records with no `resolvedAt` use `?? generatedAt` fallback — semantically acceptable, bounded by generatedAt + TTL. No migration required but flag in release notes.

---

### N3 — command-bus Truncation-Reset Idempotence
**Theme**: 3 — command-bus O(N) Subscribers
**File**: `CascadeProjects/Components/shared-types/src/command-bus.ts:66-68`

Truncation detection resets offset to 0 — subscribers replay from beginning. Whether this is a correctness bug depends on consumer idempotence. Review what each `subscribe()` consumer does with replayed events before any audit log rotation policy is added. O(N) re-read perf issue is a separate known concern (Bug #5, not yet fixed).

---

### N4 — Security Validation Test Coverage Gaps
**Theme**: 5 — Security Settings Validation
**File**: `GRID-main/tests/api/test_mothership_security_settings_validation.py`

Three gaps:
1. `fail_fast=True + environment="development"` combination untested.
2. No minimum secret key length assertion.
3. Server refusal-to-start not directly asserted — no `pytest.raises(SystemExit)` equivalent for the startup check.

File follow-up test ticket. Existing 5 tests are correct and passing.

---

### N5 — emitAudit durationMs + Metadata Path Disclosure
**Theme**: 6 — emitAudit Instrumentation
**Files**: all 5 servers (21 call sites)

- `durationMs`: zero of 21 sites measure it. Optional per contract, but all 5 servers were touched in this session — decide once: backfill or explicitly document as intentionally omitted.
- Filesystem path disclosure: `craft-server` emits `outputPath`; `mangrove-server` emits `targetPath`/`dioRoot` in metadata. Non-issue for local audit log; flag if audit shipping is ever considered.

---

## DEFERRED

### D1 — echoes Automation Object Template Interpolation
**Theme**: 7 — echoes-server Automation Module
**File**: `echoes-server/src/automation/signal_automation.ts:192-201`

`interpolateTemplate()` returns object templates as-is — `"${{signalId}}"` placeholders in nested object values never expand. Module is untracked and not imported into `server.ts` — not on any hot path. **Do not wire into server.ts until this is fixed.**

`SignalRiskClassifier` `security_probe` fast-path at L104 likely resolves the classifier gap from scope doc. Test suite excludes `src/automation/` from vitest `include` pattern — 3 documented failures are not currently observable.

---

## Already-Applied Fixes (confirmed in tree)

1. `anticipation.ts:170,181` — mutex chain pattern (`.then(async () => {})` + `await this.mutex`)
2. `anticipation.ts:52,138,188` — `resolvedAt` field + TTL filter + resolution setter
3. `factory.py:111,122` — `max(1, timeout_ms // 1000)` timeout floor
4. `utils.py:8` — `typing.Any` import
5. `model_catalog.py:242` — `_hint` dead branch removed

---

## Pre-flight Summary

All 4 suites green. See `07-preflight.log` for detail.

2 blockers | 5 non-blockers | 1 deferred
