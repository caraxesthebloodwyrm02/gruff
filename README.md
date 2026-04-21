# 🏰 Gruff — Cockpit & Trust-Routing

This repository acts as the umbrella for the Mangrove ecosystem, providing a unified control surface for telemetry, actor-scoring, and design-system reproducibility.

---

## [GATE: cockpit] ✓ PASS — Workspace Control Surface

The [**`@irfankabir002/gruff`**](https://www.npmjs.com/package/@irfankabir002/gruff) npm package layers presentation and routing logic over the existing MCP fleet.

**Install (pre-release)** — requires Node ≥22; `better-sqlite3` builds a native binding on install.

```bash
npx @irfankabir002/gruff@next              # one-shot
npm install -g @irfankabir002/gruff@next   # global: puts `gruff` + `gruff-ingester` on PATH
```

- **Cockpit UI** — `npx gruff` renders a 4-quadrant dashboard (MCP / Inference / Agency / Horizon).
- **Trust Routing** — SQL-backed actor profiling that partitions the fleet into **School** (full reach) and **Practice** (sandboxed).
- **Reproducibility** — `npx gruff init` drops visual tokens and voice guides into any project.

---

## 🗺️ Navigation

| District | Path | Function |
|---|---|---|
| **Central Plaza** | `~/gruff/` | Entry point & root documentation |
| **Workspace** | `workspace/` | Main development tree |
| **School** | `school/` | Practice & sandbox mode |
| **Telemetry** | `~/.echoes/` | Authoritative audit stream |
| **Intelligence** | `~/.gruff/` | Trust store & ingester state |

---

## 🛠️ Operational Routine

### Contributing / from source
```bash
npm install && npm run build
gruff init-automation
```

### Dashboard Access
```bash
gruff
```

### Telemetry Reports
```bash
gruff actors
gruff actors --sql "SELECT tool, count(*) FROM events GROUP BY 1"
```

---

## 🚦 Ecosystem Gates

[GATE: central-plaza] ✓ PASS — Universal entry point (`CENTRAL_PLAZA.md`)
[GATE: trust-routing] ✓ PASS — Trust-based actor partition (`GATE.md`)
[GATE: foundation] ✓ PASS — Shared-types build sequence (`CLAUDE.md`)
[GATE: execution] ✓ PASS — 6-stage execution protocol (`WORKSPACE_GATES.md`)

---

## 🩺 Diagnostic Tool

Health checks for workspace paths, code patterns, and structural issues.

```bash
# Stage 1: Path diagnostics only
node scripts/diagnostic-paths.mjs

# Stage 1 + 2: Paths + bug scan
node scripts/diagnostic-paths.mjs --bugs

# All stages: Paths + bugs + format checks
node scripts/diagnostic-paths.mjs --bugs --format
```

Runs weekly via systemd timer ( Mondays 9am).

---

## 📚 Core Reference

- **SPEC.md** — Architecture, vision, and governance
- **DESIGN.md** — Visual foundations & palette
- **CLAUDE.md** — Agent charters & operational rules
- **ONBOARDING.md** — Routine: school vs market modes
- **docs/DIAGNOSTIC_PATHS.md** — Diagnostic tool documentation

---

**Version:** 0.1.2
**Outlook: CLEAN** — Workspace dressed for presentation.
