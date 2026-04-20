# Theme Matrix — Ultrareview 2026-04-20

Each theme maps to reviewer questions and the exact file:line anchors to inspect.

---

## Theme 1 — Mutex Correctness

**Files**: `CascadeProjects/Tools/MCPServers/ori-server/src/anticipation.ts` L160–200

**Applied fix**: Changed from `.then(...).catch(...)` fire-and-forget pattern to `this.mutex = this.mutex.then(async () => { ... })` plus `await this.mutex` at call sites. Both `appendSignal` (L170) and `resolveSignal` (L181) now chain onto the single mutex promise.

**Reviewer questions**:
- Is the chain truly exhaustive? Are there any `await this.mutex` call sites that bypass the chain by reading `.signals` or `.resolvedSignals` outside the lock?
- What happens if the async body inside `.then()` throws — does the chain become permanently poisoned?
  **[CONFIRMED]** No inner try-catch exists. Both `.then()` bodies call `this.load()` / `this.save()` which throw on I/O error. Chain poisoning on first I/O failure = all subsequent append/resolve calls silently no-op. Fix: wrap body in try-catch to prevent poisoning.
- Is there a risk of unbounded promise chain growth under high-frequency signal resolution?

---

## Theme 2 — TTL / resolvedAt Semantics + Migration

**Files**: `anticipation.ts` L45–55 (interface), L130–145 (TTL filter), L180–200 (resolve path); `ori-server/src/storage.ts`

**Applied fix**: Added `resolvedAt?: string` to `ResolvedSignal` interface; set `signal.resolvedAt = new Date().toISOString()` on resolution (L188); TTL filter now uses `(s.resolvedAt ?? s.generatedAt) >= ttlCutoff` (L138).

**Reviewer questions**:
- Persisted stores written before this fix have no `resolvedAt` field. The `?? generatedAt` fallback means they could survive past their intended TTL if `generatedAt` is recent. Is this the correct semantic, or should pre-fix records be unconditionally evicted?
- Does `storage.ts` serialize/deserialize `resolvedAt` correctly, or does it drop the field during hydration?
- Is there a schema migration path, or is TTL drift in existing stores acceptable?

---

## Theme 3 — command-bus O(N) Subscriber Scalability

**Files**: `CascadeProjects/Components/shared-types/src/command-bus.ts` (125 L); `audit-client.ts` (152 L, `appendNdjsonLine` extraction); `tests/command-bus.test.mjs` (99 L)

**Known architectural issue (Bug #5 — not yet fixed)**: Each `subscribe()` call opens a new file read from byte offset 0 on every emitted event. With N subscribers, that's N full file re-reads per emission. No deduplication. Truncation resets offset, which silently causes subscribers to replay from the beginning.

**Reviewer questions**:
- At what subscriber count or audit-log size does this become operationally problematic (rough envelope math)?
- Is there a safe, minimal fix (e.g., shared tail cursor with fan-out in memory) that doesn't require a full rewrite?
- Does the truncation-resets-offset bug cause correctness issues (duplicate command processing) or just performance issues?
- Does `appendNdjsonLine` use a mutex or is concurrent append from multiple MCP servers a race condition?

---

## Theme 4 — LLM Factory 3-Path Resolution Edge Cases

**Files**: `GRID-main/src/tools/rag/llm/factory.py` (311 L); `auto_selector.py` (270 L, new); `model_catalog.py` (315 L, new); `config/ollama-model-catalog.json`; `ollama_local.py` (+71); `ollama_cloud.py` (+5)

**Applied fix**: `timeout_ms // 1000` truncation for sub-second values — now `max(1, resolved.timeout_ms // 1000)`.

**3-path resolution**: (1) catalog auto-select → (2) explicit config fallback → (3) legacy bare-model-name path.

**Reviewer questions**:
- What happens if the catalog JSON is malformed or stale — does path (1) silently fall through to path (2), or does it raise?
- At the boundary between path (1) and path (2): if auto-select returns a model that isn't in the explicit config, does the factory fail or partially configure it?
- `auto_selector.py` ranks by capability score. Is the scoring function monotone/deterministic? Could two models have equal scores and cause non-deterministic selection?
- `model_catalog.py` has a refresh routine — is it safe to call during an in-flight request, or does refresh create a race with `get_model_config`?
- Are all 3 paths tested end-to-end, or only unit-tested in isolation?

---

## Theme 5 — Security Settings Validation

**Files**: `GRID-main/tests/api/test_mothership_security_settings_validation.py` (56 L, new); `tests/api/test_phase3_security_guardrails.py` (+44); `tests/security/test_security_suite.py` (+92); `src/application/mothership/main.py` (+14)

**Reviewer questions**:
- Do the 5 new tests in `test_mothership_security_settings_validation.py` cover the `fail_fast` mode fully — specifically, does a test assert the server *refuses to start* (not just logs a warning) when a required security setting is absent?
- `test_security_suite.py` gained +92 lines. Are severity assertions (`CRITICAL` vs `WARNING`) verified, or just that the validator ran?
- `main.py` +14 lines: what startup-time security check was added? Is it enforced before the first request handler registers, or after?
- Is there a dev-mode degradation path that weakens security checks — and if so, is that path tested for correct behavior?

---

## Theme 6 — emitAudit Instrumentation (21 Call Sites)

**Files**: 5 MCP servers — `afloat-server/src/server.ts`, `craft-server/src/server.ts`, `echoes-server/src/server.ts`, `glimpse-server/src/server.ts`, `mangrove-server/src/server.ts`

**Data contract** (from `shared-types/src/audit-client.ts`): `{ timestamp: string, source: string, tool: string, status: 'ok'|'error'|'warn', durationMs?: number, metadata?: Record<string, unknown> }`

**Reviewer questions**:
- Do all 21 call sites include `timestamp` (ISO string) and `source` (server name string) — the two non-optional fields most likely to be omitted?
- Is `durationMs` measured correctly (wall clock from tool invocation to resolution), or are any sites recording 0 or omitting it when it should be present?
- Are any `metadata` values logged that could contain PII or secrets (e.g., user-supplied input echoed verbatim)?
- On error paths, are all 21 sites guaranteed to call `emitAudit` with `status: 'error'`, or do some catch-and-swallow?

---

## Theme 7 — echoes-server Automation Module

**Files**: `echoes-server/src/automation/signal_automation.ts` (513 L, new, untracked); `AUTOMATION.md`; `signal_automation.test.ts`

**Known test failures (pre-existing, not regressions)**:
1. `template.replace` type error ×2 — template variable is not a string at call site
2. `security_probe` classifier gap — classifier doesn't recognize the `security_probe` signal category

**Reviewer questions**:
- The `template.replace` failures suggest a type assumption in the automation engine.
  **[IDENTIFIED]** Object templates (e.g. `template-api-generic`) embed `"${{signalId}}"` placeholder strings inside nested object values. `interpolateTemplate()` returns non-string templates as-is (L193–195) — the `.replace()` calls are string-only. Placeholder expansion never runs for object templates; test assertions expecting expanded values will fail.
- The classifier gap for `security_probe`: is this a missing enum entry in the category list, or a regex that doesn't match the category string format?
  **[POSSIBLY RESOLVED]** `SignalRiskClassifier.classifySignal()` has an explicit fast-path at L104: `if (signal.type === "security_probe") return "critical"`. The "gap" may be from an earlier version without this line. Tests need to run to confirm whether this failure still manifests.
- Is `signal_automation.ts` currently imported/wired into `echoes-server/src/server.ts`, or is it a standalone module not yet connected to the live server?
- Are there any unintended side effects from `signal_automation.ts` importing from `shared-types` — specifically, does it trigger the O(N) command-bus re-read behavior at import time?
