# Workspace Plaza

> **Two navigational layers.** This document is the **plaza/district** map — the human UX for finding your way around ("I'm in `roots/GRID`", "check `canopy/echoes` health"). The **architectural decomposition** — bus, services, runs, artifacts, surfaces, contracts — lives in `SPEC.md` §2 and is materialized at `../planes/`. Both are valid; both refer to the same territory. Use plaza vocabulary for **location**; use plane vocabulary for **role**. `SPEC.md` is canonical for how the system is structured; this document is canonical for how you move through it.

---

┌─────────────────────────────────────────────────────────────┐
│                  PRINCE · WORKSPACE PLAZA                   │
│                     (You Are Here)                          │
│                                                             │
│  [Explore Districts]      [Health Dashboard]      [Start]   │
│                                                             │
│  roots/GRID/           🟢 90%              🚀  Core Infra   │
│  canopy/afloat/        🟢 100%             💰  Finance      │
│  canopy/echoes/        🟢 100%             🔊  Audio        │
│  roots/Vision/         🟢 100%             👁️   Vision      │
│  roots/apiguard/        🟡 85%              🔒  Security     │
│  roots/glimpse-engine/ 🟡 85%              🔧  Tools         │
│  grove/hogsmade/        🟡 75%              🎨  Frontend     │
│  seeds/upwork-cli/      🟡 70%              💼  CLI          │
│  seeds/ai-web-demo/     🔴 60%              🧪  Experiments  │
│                                                             │
│                    [View Full City Map]                     │
└─────────────────────────────────────────────────────────────┘

## District Catalog

### 🏗️ Foundation Districts (Core Infrastructure)
| District | Status | Purpose | Entry Command | Health |
|----------|--------|---------|---------------|--------|
| **`roots/GRID/`** | 🟢 Active | AI/ML orchestration, ChromaDB, FastAPI | `cd roots/GRID && uv sync` | 90% |
| **`roots/apiguard/`** | 🟡 12 uncommitted | API security & rate limiting | `cd roots/apiguard && uv sync` | 85% |
| **`roots/Vision/`** | 🟢 Active | Computer vision pipelines | `cd roots/Vision && uv sync` | 100% |

### 🚀 Product Districts (Applications)
| District | Status | Purpose | Entry Command | Stack |
|----------|--------|---------|---------------|-------|
| **`canopy/afloat/`** | 🟢 Perfect | Finance platform (Stripe) | `cd canopy/afloat && npm install` | TypeScript/Next.js |
| **`canopy/echoes/`** | 🟢 Perfect | Audio processing platform | `cd canopy/echoes && uv sync` | Python/FastAPI |
| **`grove/hogsmade/`** | 🟡 12 uncommitted | Frontend component library | `cd grove/hogsmade && npm install` | TypeScript/React |

### 🔧 Utility Districts (Tools & Experiments)
| District | Status | Purpose | Entry Command | Notes |
|----------|--------|---------|---------------|-------|
| **`roots/glimpse-engine/`** | 🟡 1 uncommitted | Internal tooling | `cd roots/glimpse-engine && npm install` | 5 days idle |
| **`seeds/upwork-cli/`** | 🟡 11 uncommitted | CLI automation | `cd seeds/upwork-cli && uv sync` | 2 days quiet |
| **`seeds/ai-web-demo/`** | 🔴 Low health | Demo applications | `cd seeds/ai-web-demo` | Needs attention |

## 🚦 Health & Activity Dashboard

**Overall Workspace Health: 85%** (9 districts, 4 uncommitted zones)

### Active Construction Zones ⚠️
1. **`roots/GRID/`** — 13 uncommitted changes (RAG logger fix applied, needs commit)
2. **`grove/hogsmade/`** — 12 uncommitted changes
3. **`seeds/upwork-cli/`** — 11 uncommitted changes (2 days quiet)
4. **`roots/apiguard/`** — 12 uncommitted changes (2 days quiet)

### District Activity Timeline
- **🔥 Most Active**: `roots/Vision/` (2h ago), `canopy/afloat/` (20h), `canopy/echoes/` (19h)
- **⚡ Recently Active**: `roots/GRID/` (14h)
- **⚠️ Needs Attention**: `roots/glimpse-engine/` (5d quiet), `seeds/upwork-cli/` (2d quiet)
- **🔴 Stale**: `seeds/ai-web-demo/` (60% health)

## 🔧 RAG Logger Bug — FIXED ✅

**Bug**: `Logger._log() got an unexpected keyword argument 'provider'`
**Root Cause**: Two files used `logging.getLogger()` (stdlib) but called `logger.info()` with structlog-style keyword args (`provider=`, `model=`). Python's stdlib `Logger._log()` rejects unexpected keyword arguments.
**Fix Applied**:
- `src/tools/rag/llm/factory.py:112` — changed from keyword args to `%s`-format
- `src/tools/rag/embeddings/factory.py:81` — changed from keyword args to `%s`-format
**Status**: Fix on disk. RAG server needs restart to pick up changes.
**All other RAG files** (`model_resolver.py`, etc.) use `structlog.get_logger()` which supports keyword args — they're fine.

## 🎯 Quick Start by Persona

### I'm a **Backend Engineer** (Python/FastAPI)
```bash
cd roots/GRID          # Core ML infrastructure
uv sync
# See: roots/GRID/README.md
```

### I'm a **Frontend Engineer** (TypeScript/React)
```bash
cd canopy/afloat      # Production finance app
npm install
# See: canopy/afloat/README.md
```

### I'm a **Full-Stack Developer**
```bash
cd canopy/echoes      # Python backend + API
uv sync
# Connects to: canopy/afloat (frontend)
```

### I'm a **Security Engineer**
```bash
cd roots/apiguard     # API security layer
uv sync
# See: roots/apiguard/docs/security.md
```

### I'm a **DevOps/MLOps**
```bash
cd roots/GRID         # ChromaDB + FastAPI stack
uv sync
# Stack: Python 3.13+, uv, ChromaDB, FastAPI
```

## 🔗 Essential Links

### Documentation
- **Workspace Rules**: `~/.claude/rules/dev-rules.md`
- **Agent Guidelines**: [`AGENTS.md`](../AGENTS.md)
- **Safety Protocols**: `../CascadeProjects/Projects/GRID-main/.claude/rules/safety.md`
- **OS Guardrails**: `/mnt/arch_data/home/caraxes/skills/os-guardrails/SKILL.md` (archived)
- **Anthropic Official Plugins**: [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official)
- **Anthropic Official Skills**: [anthropics/skills](https://github.com/anthropics/skills)

### Git Configuration
- **Main Monorepo**: `../CascadeProjects/` (MCP servers, shared types)
- **GRID Submodule**: `../CascadeProjects/Projects/GRID-main/` → `roots/GRID/`
- **Different Identity**: `grove/` uses separate git config

### Environment Variables
```bash
export GRID_API_URL=http://localhost:8080
export OLLAMA_BASE_URL=http://localhost:11434
export GRID_VENV=./CascadeProjects/Projects/GRID-main/.venv/bin/python  # rebuild venv on Ubuntu
```

## 📊 Governance & Standards

### Build Order (Critical Path)
1. **First**: `CascadeProjects/shared-types/` → `npm install && npm run build`
2. **Then**: All other districts

### Package Managers (Never Mix!)
- **Python projects**: `uv` ONLY (never pip, poetry, conda)
- **TypeScript (CascadeProjects)**: `npm` (except `mcp-tool-experiment/` uses `pnpm`)
- **Check local docs**: Always verify per-district requirements

### Code Standards
- **Python**: 3.13+, ruff formatter, 120 char lines, type hints, structlog, Pydantic v2
- **TypeScript**: strict mode, ESLint + Prettier
- **Commits**: conventional format → `feat(scope):`, `fix(scope):`, `test(scope):`, `docs(scope):`

## ⚠️ Current Alerts & Blockers

### Audit Failures (6 in last 24h)
- **3× `daily-pass`**: workspace-maintenance daily passes failing (exit code 1)
- **3× `session-gate`**: cascade-scheduler hitting max turns limit
- **1× `ori-health`**: scheduler health check hitting max turns

### Network Isolation (UNPROVISIONED MODE)
- **Status**: 🔴 All external network access blocked
- **Allowed**: localhost only (127.0.0.1, ::1, localhost)

## 🛤️ Next Departures (Pending Actions)

1. **✅ DONE: Fix RAG Logger Bug** — `llm/factory.py` and `embeddings/factory.py` fixed (needs server restart)
2. **Commit GRID RAG fix** — 13 uncommitted changes including the logger bugfix
3. **Run Adaptive Security Challenge** — `adaptive-security-challenge` harness scenario pending
4. **Commit construction zones** — 49 total uncommitted changes across 4 districts
5. **Revive quiet districts** — `glimpse-engine` (5d idle), `upwork-cli` (2d), `apiguard` (2d)
6. **Improve `ai-web-demo` health** — currently 60%, lowest in workspace

## 🔄 Recent Updates

| Date | District | Update |
|------|----------|--------|
| 2026-04-15 | roots/GRID | **RAG logger bug fixed** in 2 files |
| 2026-04-15 | roots/Vision | Active development (2h ago) |
| 2026-04-15 | Workspace | Audit: 6 failures in 24h |
| 2026-04-11 | Harness | Completed `bastiodon`, `talonflame`, `exeggutor-a` |

---
**Welcome to the Workspace Plaza. Choose your district.**
