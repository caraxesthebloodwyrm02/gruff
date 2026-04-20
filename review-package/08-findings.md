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

**Fix**: Wrap the call at lines 179-194 in a narrow `except` naming the real failure modes, log the cause, fall through to `_use_fallback_chain()`. Implementation settled on `(ImportError, FileNotFoundError, OSError, json.JSONDecodeError, ValueError, KeyError)` — see N11 for the rationale. Note: the catalog path uses dataclasses (`model_catalog.ModelEntry`, `auto_selector.TaskRequest`), not Pydantic, so `pydantic.ValidationError` is **not** part of this contract.
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

### B3 — `_is_query_safe` Rejects All Real Queries — **FIXED**
**Theme**: Zed session additions — `workspace/mcp/servers/database/server.py`
**File**: `server.py:289-330` (pre-fix)
**Severity**: BLOCKER (now fixed)

`_is_query_safe` included `WHERE`, `OR`, `AND`, `JOIN` in its `dangerous_keywords` list and used plain `in sql_upper` substring matching. Any real SELECT query with a WHERE clause failed the safety check. `SQLInjectionValidator` (L24-79) was already defined with correct word-boundary structural matching but was never instantiated or called.

**Fix applied**: Added `self._validator = SQLInjectionValidator()` to `__init__`, replaced `_is_query_safe` body with single delegation to `self._validator.validate_query(sql)`.

---

### B4 — Credentials Regex Catastrophic False-Positive Rate — **FIXED**
**Theme**: Zed session additions — `src/grid/security/ai_security.py`
**File**: `ai_security.py:113-118` (pre-fix)
**Severity**: BLOCKER (now fixed)

Pattern `\b([a-zA-Z0-9_]{3,}):([a-zA-Z0-9_!@#$%^&*]{3,})\b` matched any `word:word` sequence — URLs (`http:www`), timestamps, key-value pair structures. Would suppress legitimate output or generate excessive noise in production.

**Fix applied**: Replaced with context-anchored pattern requiring known credential field names (`password`, `api_key`, `secret`, `token`, `auth_key`, `private_key`) before the colon/equals separator.

---

## NON-BLOCKERS (second pass — Zed session additions)

### N6 — `SQLInjectionValidator`/`ConnectionManager` Not Wired (RESOLVED via B3)
`SQLInjectionValidator` was defined but never instantiated; `ConnectionManager` defined but `ProductionDatabaseMCPServer` uses a plain `{}` dict for connections. B3 fix wires `SQLInjectionValidator`. `ConnectionManager` connection pool + idle-timeout logic remains unused — `self.connections` is still a plain dict. File follow-up to wire `ConnectionManager` if the server is promoted to production.

---

### N7 — `block_prompt_injections` Dead Config Field
**File**: `ai_security.py` — `AISecurityConfig.block_prompt_injections: bool = True`

Field is never read by any method in `InputValidator`, `OutputSanitizer`, or `AISecurityWrapper`. If intended to make injection blocking conditional, wire it to `InputValidator.validate_input()`. If not needed, remove it to avoid confusing callers who set it expecting behavior change.

---

### N8 — `risk_threshold: 0.5` Below Minimum Pattern Risk
**File**: `ai_security.py` — `AISecurityConfig.risk_threshold: float = 0.5`

All 7 `_INPUT_THREAT_PATTERNS` carry a minimum risk score of 0.7 per the pattern definition. With default threshold 0.5, a single matched pattern always exceeds it — the threshold is effectively never the binding gate at default. Document the intended calibration or raise default to 0.7.

---

### N9 — `_extra` Always Emits Fixed `"FILTERED_CUSTOM"` Token
**File**: `ai_security.py` — `OutputSanitizer.sanitize_output()` extra_patterns loop

Custom output patterns passed at call time all replace with the literal string `"FILTERED_CUSTOM"` regardless of pattern label. Callers can't distinguish which custom pattern triggered. Minor: if caller needs traceability across multiple custom patterns, the replacement token needs to be parameterized.

---

### N10 — `nomic_v2.py` Vestigial `continue` Branches
**File**: `src/tools/rag/embeddings/nomic_v2.py`

`models_to_try = [self.model]` is a single-element list. All `continue # Try next model` branches in the loop are dead code — no second model exists to try. Not harmful but misleads readers into thinking retry logic is active. Either restore multi-model fallback or collapse to a direct call.

---

### N11 — `factory.py` B2 Fix Uses Broad `except Exception`
**File**: `factory.py:196-217`

The initial B2 fix wrapped the catalog path in `except Exception`. Advisor recommendation was to narrow the clause to avoid masking unexpected errors (e.g., `AttributeError` from a partially-constructed catalog, `TypeError`/`NameError` from programmer mistakes).

**Resolved**: the except was narrowed to `(ImportError, FileNotFoundError, OSError, json.JSONDecodeError, ValueError, KeyError)`, with each entry mapped to a concrete failure mode in an inline comment:
- `ImportError` — optional `auto_selector` module unavailable
- `FileNotFoundError` — `ollama-model-catalog.json` missing
- `OSError` — unreadable catalog / overrides file
- `json.JSONDecodeError` — malformed catalog / overrides JSON (named explicitly even though it is a `ValueError` subclass, for reader intent)
- `ValueError`, `KeyError` — dataclass parsing in `model_catalog._parse_entry`

`pydantic.ValidationError` is intentionally absent: this path is dataclass-based, not Pydantic. Programmer errors (`AttributeError`, `TypeError`, `NameError`) are allowed to surface rather than silently fall through to path 2.

---

## Already-Applied Fixes (confirmed in tree)

1. `anticipation.ts:170,181` — mutex chain pattern (`.then(async () => {})` + `await this.mutex`)
2. `anticipation.ts:52,138,188` — `resolvedAt` field + TTL filter + resolution setter
3. `factory.py:111,122` — `max(1, timeout_ms // 1000)` timeout floor
4. `utils.py:8` — `typing.Any` import
5. `model_catalog.py:242` — `_hint` dead branch removed
6. `anticipation.ts:171-215` (B1) — mutex chain try/catch in `appendSignal`/`resolveSignal`
7. `factory.py:178-196` (B2) — catalog auto-select path wrapped in exception handler
8. `server.py:289-330` (B3) — `_is_query_safe` delegated to `SQLInjectionValidator.validate_query`
9. `ai_security.py:113-118` (B4) — credentials regex narrowed to credential-field-name anchors
10. `anticipation.ts:171-221` (N1) — safe-reset mutex pattern (`const ours = ...; if (this.mutex === ours) this.mutex = Promise.resolve()`) — prevents unbounded chain growth without racing concurrent callers
11. `ai_security.py:34` (N7) — `block_prompt_injections` wired into `InputValidator.validate_input()`; when False, returns `(True, reason, risk)` for observe-only mode
12. `ai_security.py:31` (N8) — `risk_threshold` default raised `0.5 → 0.7` to align with minimum `_INPUT_THREAT_PATTERNS` score
13. `ai_security.py:229-232` (N9) — `OutputSanitizer._extra` replacement token parameterized with index: `[FILTERED_CUSTOM_{i}]` + label `custom_policy_{i}`
14. `nomic_v2.py:74-79` (N10) — clarifying comment added; loop structure retained for inner retry logic, documented as not-live multi-model fallback
15. `factory.py:196-217` (N11) — except narrowed from `Exception` to `(ImportError, FileNotFoundError, OSError, json.JSONDecodeError, ValueError, KeyError)`; `json.JSONDecodeError` named explicitly (subclass of `ValueError`) for reader intent; `pydantic.ValidationError` intentionally excluded as the path is dataclass-based; programmer errors (`AttributeError`, `TypeError`, `NameError`) now surface

---

## Post-Fix Verification (2026-04-20 20:42 UTC+06)

| Suite | Result |
|---|---|
| `ori-server` vitest (9 files) | **114/114 passed** |
| `test_security_suite.py` + `test_model_catalog.py` | **39/39 passed** |

---

## Pre-flight Summary

All 4 suites green. See `07-preflight.log` for detail.

4 blockers (fixed) | 11 non-blockers (**6 fixed: N1, N7, N8, N9, N10, N11**; 5 follow-up: N2–N6) | 1 deferred (D1)
