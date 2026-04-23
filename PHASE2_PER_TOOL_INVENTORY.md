# Phase 2: Per-Tool Inventory

## File Records

### Repository Files (gruff workspace)

| File | Tool | Type | Topic | Scope | Depth | Status |
|------|------|------|-------|-------|-------|--------|
| `AGENTS.md` | All (canonical) | rule | All topics | All-sessions | canonical | **keep** |
| `CLAUDE.md` | Claude Code | adapter | All topics | All-sessions | pointer | **keep** |
| `.github/copilot-instructions.md` | Copilot | adapter | Build/commands | All-sessions | pointer | **keep** |
| `.cursor/rules/review-prioritization.mdc` | Cursor | delta | Review discipline | Cursor-specific | delta | **keep** |
| `.cursor/agents/recent-ship-curator.md` | Cursor | skill | Recent ship curation | Cursor-specific | delta | **keep** |
| `.cursor/skills/shipping-prioritization/SKILL.md` | Cursor | skill | Shipping prioritization | Cursor-specific | delta | **keep** |
| `.cursor/hooks/recent-ship-session-context.py` | Cursor | hook | Session start context | Cursor-specific | delta | **keep** |
| `.cursor/hooks.json` | Cursor | config | Hook configuration | Cursor-specific | delta | **keep** |

### Personal Config Files (not in repo)

| File | Tool | Type | Status |
|------|------|------|--------|
| `~/.claude/agents/hermes.md` | Claude Code | agent | **keep** (prince chain member) |
| `~/.claude/agents/organizer.md` | Claude Code | agent | **keep** (prince chain member) |
| `~/.claude/agents/prince-runtime-intel.md` | Claude Code | agent | **missing** (needed per AGENTS.md) |
| `~/.claude/agents/caraxes.md` | Claude Code | agent | **missing** (needed per AGENTS.md) |
| `~/.claude/rules/` | Claude Code | rules dir | **empty** (no rules to consolidate) |
| `~/.codex/config.toml` | Codex | MCP config | **MCP only** (not behavior rules) |
| `~/.config/zed/settings.json` | Zed | settings | **No rules** (only MCP config) |
| `~/.config/opencode/config.json` | OpenCode | settings | **No rules** |
| `~/.config/Antigravity/User/settings.json` | Antigravity | settings | **No rules** |

## File Count Summary

| Tool | Rules | Skills | Hooks | Agents | Config |
|------|-------|--------|-------|--------|--------|
| Canonical (AGENTS.md) | 1 | - | - | - | - |
| Claude Code | 0 (rules dir empty) | - | - | 2 (hermes, organizer) | - |
| Cursor | 1 | 1 | 1 | 1 (recent-ship-curator) | 1 (hooks.json) |
| Copilot | 0 (pointer) | - | - | - | - |

## External Refs Check

### grep results for `/home/caraxes/|/home/luna/|~/seed/|~/roots/`:

| Path | Results |
|------|---------|
| `AGENTS.md` | None |
| `CLAUDE.md` | None (except in comments as example) |
| `.github/copilot-instructions.md` | None |
| `.cursor/rules/` | None |
| `.cursor/agents/` | None |
| `.cursor/skills/` | None |

## Overlap Analysis

| Topic | Files covering it | Overlap status |
|-------|------------------|----------------|
| Agent chain (prince/hermes/caraxes) | AGENTS.md, CLAUDE.md, copilot-instructions.md | **No overlap** - all point to AGENTS.md |
| Build commands | AGENTS.md, CLAUDE.md, copilot-instructions.md | **No overlap** - all point to AGENTS.md |
| Coding style | AGENTS.md, CLAUDE.md, copilot-instructions.md | **No overlap** - all point to AGENTS.md |
| Git hygiene | AGENTS.md, CLAUDE.md, copilot-instructions.md | **No overlap** - all point to AGENTS.md |
| Cursor-specific shipping filter | Cursor files only | **No overlap** - unique to Cursor |

## Delta Files Analysis

### Cursor delta files (scope-specific, non-overlapping):

| File | Unique purpose | Not duplicating |
|------|----------------|-----------------|
| `review-prioritization.mdc` | Filter reviews to last 14 days | AGENTS.md |
| `recent-ship-curator.md` | Subagent for multi-root git forensics | AGENTS.md |
| `shipping-prioritization/SKILL.md` | Prioritization skill for shipping work | AGENTS.md |
| `recent-ship-session-context.py` | Session hook for auto-injection | AGENTS.md |

**Conclusion**: All Cursor delta files are scope-specific and non-overlapping. They add Cursor-specific behavior not present in AGENTS.md.
