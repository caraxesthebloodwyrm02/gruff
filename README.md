# 🏰 Workspace — GRUFF Cockpit & Trust-Routing

This repository acts as the umbrella for the Mangrove ecosystem, providing a unified control surface for telemetry, actor-scoring, and design-system reproducibility.

---

## [GATE: cockpit] ✓ PASS — Workspace Control Surface

The [**`@caraxesthebloodwyrm02/gruff`**](https://www.npmjs.com/package/@caraxesthebloodwyrm02/gruff) npm package layers presentation and routing logic over the existing MCP fleet.

**Install (pre-release)** — requires Node ≥22; `better-sqlite3` builds a native binding on install.

```bash
npx @caraxesthebloodwyrm02/gruff@next              # one-shot
npm install -g @caraxesthebloodwyrm02/gruff@next   # global: puts `gruff` + `gruff-ingester` on PATH
```

- **Cockpit UI** — `npx gruff` renders a 4-quadrant dashboard (MCP / Inference / Agency / Horizon).
- **Trust Routing** — SQL-backed actor profiling that partitions the fleet into **School** (full reach) and **Practice** (sandboxed).
- **Reproducibility** — `npx gruff init` drops visual tokens and voice guides into any project.

---

## 🗺️ Navigation

| District | Path | Function |
|---|---|---|
| **Central Plaza** | `~/workspace/` | Entry point & root documentation |
| **Foundation** | `CascadeProjects/` | Monorepo source (submodule) |
| **Planes** | `planes/` | Architectural symlink map |
| **Intelligence** | `~/.gruff/` | Trust store & ingester state |
| **Telemetry** | `~/.echoes/` | Authoritative audit stream |

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

## 📚 Core Reference

- **SPEC.md** — Architecture, vision, and governance
- **DESIGN.md** — Visual foundations & palette
- **CLAUDE.md** — Agent charters & operational rules
- **ONBOARDING.md** — Routine: school vs market modes

---

**Outlook: CLEAN** — Workspace dressed for presentation.
