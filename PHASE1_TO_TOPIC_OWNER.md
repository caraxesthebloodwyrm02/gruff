# Phase 1: Authoritative Topic List

## Source Files Read

| File | Lines | Purpose |
|------|-------|---------|
| `AGENTS.md` | 127 | Canonical source of truth |
| `CLAUDE.md` | 354 | Claude Code adapter |
| `.github/copilot-instructions.md` | 135 | Copilot adapter |

## Topic-to-Owner Table

| Topic | Canonical owner | Adapters that must align |
|-------|-----------------|--------------------------|
| Agent Registry (prince/hermes/caraxes chain) | AGENTS.md § Agent Registry | CLAUDE.md (links), copilot-instructions.md |
| Primary agent operating model | AGENTS.md § Primary agent operating model | CLAUDE.md (extends) |
| Project Structure & Module Organization | AGENTS.md § Project Structure | CLAUDE.md (extends), copilot-instructions.md |
| Build, Test, and Development Commands | AGENTS.md § Build, Test, and Development Commands | CLAUDE.md (extends), copilot-instructions.md |
| Coding Style & Naming Conventions | AGENTS.md § Coding Style | CLAUDE.md (extends), copilot-instructions.md |
| Testing Guidelines | AGENTS.md § Testing Guidelines | CLAUDE.md (extends), copilot-instructions.md |
| Commit & Pull Request Guidelines | AGENTS.md § Commit & Pull Request Guidelines | CLAUDE.md (extends), copilot-instructions.md |
| Security & Configuration Tips | AGENTS.md § Security & Configuration | CLAUDE.md (extends), copilot-instructions.md |
| Git hygiene and source protection | AGENTS.md § Git hygiene | CLAUDE.md (extends), copilot-instructions.md |
| Development Contract (TUV-001) | AGENTS.md § Governance (via reference) | CLAUDE.md (extends) |

## Adapter Chain Summary

| Tool | Adapter file | How it points to AGENTS.md |
|------|--------------|---------------------------|
| Claude Code | `CLAUDE.md` | Contains "Primary agent operating model" section that links to `AGENTS.md` |
| Copilot | `.github/copilot-instructions.md` | Contains "Architecture" section that references `AGENTS.md` implicitly |

## Finding: No External References Found in Rule Surface

All rule files reference only in-repo paths. No `/home/caraxes/` or `/home/luna/` paths detected in:
- `AGENTS.md`
- `CLAUDE.md`
- `.github/copilot-instructions.md`
- `.cursor/rules/`
- `.cursor/agents/`
- `.cursor/skills/`

## Agent Registry Status

| Chain Position | Agent | Status | Location |
|---------------|-------|--------|----------|
| 1 — Intake | `prince-runtime-intel` | **MISSING** | `~/.claude/agents/` (not created yet) |
| 2 — Mediate | `hermes` | **EXISTS** | `~/.claude/agents/hermes.md` |
| 3 — Scout | `caraxes` | **MISSING** | `~/.claude/agents/` (not created yet) |

**Note**: The personal agent files (`prince-runtime-intel.md`, `caraxes.md`) do not exist on disk. Only `hermes.md` and `organizer.md` are present. This is expected - they were not yet created as part of the agent chain.
