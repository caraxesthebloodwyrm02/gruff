# Phase 3: Target State Design

## Principles

1. **One file per scope.** Never two files covering the same scope partially.
2. **Every file declares its scope in the first three lines.**
3. **Adapters ≤ 1 hop from canonical.** No chains like Cursor -> CLAUDE.md -> AGENTS.md.
4. **Zero external filesystem refs.** No `/home/caraxes/`, `/home/luna/`, `~/seed/`, `~/roots/`.
5. **Tool-specific scope files exist only when behavior differs.**
6. **Every tool reproduces the same topic set.**

## Target State by Tool

---

### Tool: Claude Code

**Current files:**
- `CLAUDE.md` (adapter)
- `~/.claude/agents/hermes.md` (agent)
- `~/.claude/agents/organizer.md` (agent)
- `~/.claude/rules/` (empty - no files)

**Target files:**
```
CLAUDE.md                                              ← thin top-level pointer to AGENTS.md
~/.claude/agents/prince-runtime-intel.md              ← NEW: intake agent (required per AGENTS.md)
~/.claude/agents/hermes.md                             ← existing: cross-project mediation
~/.claude/agents/caraxes.md                            ← NEW: scout agent (required per AGENTS.md)
```

**Status:** **NO CHANGES NEEDED for repo files**. The personal agents (`~/.claude/agents/`) are owner-machine config that require explicit per-file approval before deletion.

**Rationale:**
- `CLAUDE.md` already points correctly to AGENTS.md
- Personal agents are not in the repo, require manual approval
- No rules files to consolidate (empty directory)

---

### Tool: Cursor

**Current files:**
- `.cursor/rules/review-prioritization.mdc` (delta)
- `.cursor/agents/recent-ship-curator.md` (skill)
- `.cursor/skills/shipping-prioritization/SKILL.md` (skill)
- `.cursor/hooks/recent-ship-session-context.py` (hook)
- `.cursor/hooks.json` (config)

**Target files:**
```
.cursorrules                                           ← thin top-level pointer to AGENTS.md (NEW)
.cursor/rules/review-prioritization.mdc                ← keep: Cursor-specific review filter
.cursor/agents/recent-ship-curator.md                  ← keep: Cursor-specific subagent
.cursor/skills/shipping-prioritization/SKILL.md        ← keep: Cursor-specific skill
.cursor/hooks/recent-ship-session-context.py           ← keep: Cursor-specific session hook
.cursor/hooks.json                                     ← keep: Cursor-specific hook config
```

**Status:** **REWRITE** `.cursorrules` (create pointer file), **KEEP** all other files.

**Rationale:**
- `.cursorrules` doesn't exist yet - needs to be created as thin pointer
- Delta files are Cursor-specific, non-overlapping, scope-declared
- No external refs in any file

---

### Tool: Windsurf

**Current files:**
- None (no `.windsurf/` directory in repo)

**Target files:**
- **NO TOOL-SPECIFIC FILES REQUIRED**. Windsurf aligns via shared `AGENTS.md`.

**Rationale:**
- No Windsurf rules directory in this repo
- Windsurf would use `windsurf/rules/*.md` if it had rules
- Since no rules exist, Windsurf falls back to `AGENTS.md` directly

---

### Tool: Zed

**Current files:**
- None (no `.zed/` directory in repo)

**Target files:**
- **NO TOOL-SPECIFIC FILES REQUIRED**. Zed aligns via shared `AGENTS.md`.

**Rationale:**
- No Zed rules directory in this repo
- Zed settings.json only contains MCP config (not behavior rules)
- Falls back to `AGENTS.md` directly

---

### Tool: GitHub Copilot

**Current files:**
- `.github/copilot-instructions.md` (pointer/adapter)

**Target files:**
```
.github/copilot-instructions.md                        ← keep: pointer to AGENTS.md
```

**Status:** **KEEP** - already correctly points to AGENTS.md

**Rationale:**
- Already aligned via Architecture section referencing AGENTS.md
- No duplication or external refs

---

### Tool: Codex

**Current files:**
- None (MCP config only)

**Target files:**
- **NO TOOL-SPECIFIC FILES REQUIRED**. Codex aligns via shared `AGENTS.md`.

**Rationale:**
- Codex uses `.codex/config.toml` for MCP config (not behavior rules)
- Falls back to `AGENTS.md` directly

---

### Tool: OpenCode

**Current files:**
- None (settings only)

**Target files:**
- **NO TOOL-SPECIFIC FILES REQUIRED**. OpenCode aligns via shared `AGENTS.md`.

**Rationale:**
- OpenCode settings only (no behavior rules)
- Falls back to `AGENTS.md` directly

---

### Tool: Antigravity

**Current files:**
- None (settings only)

**Target files:**
- **NO TOOL-SPECIFIC FILES REQUIRED**. Antigravity aligns via shared `AGENTS.md`.

**Rationale:**
- Antigravity settings only (no behavior rules)
- Falls back to `AGENTS.md` directly

---

### Tool: Devin

**Current files:**
- None (no `.agents/` directory in repo)

**Target files:**
- **NO TOOL-SPECIFIC FILES REQUIRED**. Devin aligns via shared `AGENTS.md`.

**Rationale:**
- No Devin skills directory in this repo
- Falls back to `AGENTS.md` directly

---

## Summary Table: Before/After

| Tool | Before Files | After Files | Change |
|------|--------------|-------------|--------|
| Claude Code | 2 personal agents | 2 personal agents + prince-runtime-intel + caraxes | +2 personal files (requires approval) |
| Cursor | 5 files (rules + hooks + skills + config) | 5 files + .cursorrules pointer | +1 file (.cursorrules) |
| Windsurf | 0 files | 0 files | No change |
| Zed | 0 files | 0 files | No change |
| Copilot | 1 file | 1 file | No change |
| Codex | 0 files | 0 files | No change |
| OpenCode | 0 files | 0 files | No change |
| Antigravity | 0 files | 0 files | No change |
| Devin | 0 files | 0 files | No change |

**Total repo changes:** +2 files (Cursor rules pointer + personal agents for prince/caraxes)
