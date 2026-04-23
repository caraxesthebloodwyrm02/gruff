# Structured code review — narrow bundle (~72h)

**Cut date:** 2026-04-21 (workspace `main` + hogsmade `main` + GRID submodule pin)  
**Intent:** Full *visibility* for reviewers on a **bounded** delivery: upstream GRID test/integration alignment, hogsmade submodule + release notes, and what is **explicitly not** in this pass.

---

## 1. Executive map

| Layer | Repo / path | `main` @ | Role in this review |
| ----- | ----------- | -------- | --------------------- |
| Umbrella | `caraxesthebloodwyrm02/workspace` | `origin/main` (includes submodule + `planes/`) | PRs here: workspace glue, submodule pointer, plane symlinks, review artifacts |
| Monorepo | `caraxesthebloodwyrm02/hogsmade` (`CascadeProjects/`) | `c49c72f` | Submodule bump + `docs/RELEASE_READINESS.md` |
| GRID | `GRID-INTELLIGENCE/GRID` (`Projects/GRID-main/`) | `1c486b844264ca18ba88879e59f5dc141d852d65` | Merges **#110** (Vite plugin) + **#118** (test fixes) |

**GRID merge order on `main` (recent):** `…` → **#110** `@vitejs/plugin-react` 6.x (`ed03fb9`) → **#118** test alignment (`1c486b8`).

---

## 2. GRID (`GRID-INTELLIGENCE/GRID`)

### 2.1 PR #110 — `@vitejs/plugin-react` 6.x

| Field | Value |
| ----- | ----- |
| Status | Merged to `main` |
| Merge commit (on GRID `main`) | `ed03fb9` |
| Summary | Dependabot-style bump of `@vitejs/plugin-react` in `/frontend` (dev dependency). |

### 2.2 PR #118 — integration / test alignment

| Field | Value |
| ----- | ----- |
| Title | fix(tests): follow-up integration and path/auth alignment |
| URL | https://github.com/GRID-INTELLIGENCE/GRID/pull/118 |
| Merge commit | `1c486b8` |
| Tip commit | `b6d6a18` — *fix(tests): align auth mocks, path checks, navigation goals, RAG skips* |

**Reviewer focus (mapped to intent, not an exhaustive file list):**

| Area | Change |
| ---- | ------ |
| Auth refresh test | `refresh_access_token` is async → **`AsyncMock`**, assert with **`assert_awaited_once_with`** (`tests/api/test_api_endpoints_comprehensive.py`). |
| RAG path containment | Prefix checks use **lexical + resolved** paths so **`~/roots/GRID/...` symlinks** do not break containment tests. |
| MCP path tests | Assertions match **current wording** for paths that resolve outside allowed workspace roots. |
| Navigation | Goal strings satisfy **`min_length=10`**; tests accept **200 or 401** where optional auth + dev mode allows navigation without a valid user. |
| Conversational RAG | **`pytest.skip`** when Ollama lacks the configured embedding model (avoids hard failure). |
| Resonance learning | **`learn_from_resonance`** sets **`was_correct=True`** in line with test expectations. |

### 2.3 Explicitly *out of scope* for this bundle

A **full** `uv run pytest` on GRID still surfaces **other** failures (examples called out in delivery notes: `test_subprocess_security`, `test_overflow_protection`, `test_phantom_wrapper_audit` / LLM-key–sensitive tests). Treat as **separate** env/key/overflow follow-up, **not** regressions claimed fixed by #118.

**Suggested bounded verification (matches hogsmade `docs/RELEASE_READINESS.md`):**

```bash
cd CascadeProjects/Projects/GRID-main
uv run pytest tests/unit -q
# Optional broader: uv run pytest tests/api -q  # expect skips where services missing
```

---

## 3. Hogsmade (`CascadeProjects/`)

| Commit | Summary |
| ------ | ------- |
| `7f2b95f` | Submodule bump: `Projects/GRID-main` → GRID `main` @ `ed03fb9` (post–#110). |
| `c49c72f` | Submodule bump: `Projects/GRID-main` → GRID `main` @ `1c486b8` (**includes #118**). |

**Documentation:** `docs/RELEASE_READINESS.md` — **Recorded** `Projects/GRID-main` SHA **`1c486b844264ca18ba88879e59f5dc141d852d65`**, note on **full pytest** vs **optional services / skips** (Ollama embedding, etc.).

---

## 4. Workspace umbrella

- **`CascadeProjects/`** is a **submodule**; pinned revision in the parent repo should match **`c49c72f`** for this bundle (`git submodule status`).
- **`planes/`** symlinks are tracked for architectural visibility in umbrella PRs.

---

## 5. Local WIP *not* in hogsmade commits (decision needed)

The hogsmade working tree may still show **unstaged** edits from earlier debugging (not part of `c49c72f`):

| Path | Action for review |
| ---- | ----------------- |
| `Tools/MCPServers/ori-server/vitest.config.ts` | Commit with a clear message, **or** `git checkout --` to drop. |
| `Tools/MCPServers/school-server/tests/smoke.test.ts` | Same. |

**Review rule:** Until these are committed or reverted, treat them as **noise** against the structured bundle above.

---

## 6. Structured reviewer checklist

1. **Confirm pins:** GRID submodule at `Projects/GRID-main` = `1c486b844264ca18ba88879e59f5dc141d852d65`; hogsmade `main` includes `c49c72f`; workspace `main` submodule entry matches.
2. **Read:** hogsmade `docs/RELEASE_READINESS.md` (Recorded table + pytest guidance).
3. **GRID:** Open **#118** diff on GitHub; spot-check categories in §2.2 against merge commit `1c486b8`.
4. **GRID:** Confirm **#110** is present as parent history (`ed03fb9` before `1c486b8`).
5. **Run:** bounded pytest (`tests/unit` minimum per release doc); record pass/fail and **do not** expand into unrelated failing tests without a new scope.
6. **WIP:** Resolve or ignore §5 files before tagging or release-cutting.

---

## 7. Links (canonical)

- GRID PR #118: https://github.com/GRID-INTELLIGENCE/GRID/pull/118  
- GRID repo: https://github.com/GRID-INTELLIGENCE/GRID  
- Hogsmade: https://github.com/caraxesthebloodwyrm02/hogsmade  
- Workspace: https://github.com/caraxesthebloodwyrm02/workspace  
