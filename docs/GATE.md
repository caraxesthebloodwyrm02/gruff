# [GATE: trust-routing] — Trust-based Actor Scoring

## Overview
The **trust-routing** gate is a middleware layer residing in `@cascade/proxy-server`. It intercepts all MCP tool calls to resolve the caller's trust tier based on cumulative workspace telemetry stored in `~/.gruff/trust.sqlite`.

---

## Gate Inventory

| Check | Status | Description |
|---|---|---|
| Ingester | ✓ PASS | Tailing `~/.echoes/audit.ndjson` into SQLite |
| Scorer | ✓ PASS | Recomputed per-actor via 10-attribute matrix |
| Routing Shim | ✓ PASS | Active in `proxy-server` |
| Cockpit UI | ✓ PASS | `npx gruff` 4-quadrant dashboard |

---

## Trust Attributes

| Attribute | Dimension | Channel |
|---|---|---|
| **provenance-traceability** | Governance | SW Yellow |
| **fail-closed-clarity** | Governance | NE Red |
| **operator-clarity** | Usability | SW Yellow |
| **entry-friction** | Usability | SE Blue |
| **tool-call-fit** | Integration | NW Green |
| **vertical-coverage** | Integration | NW Green |
| **credit-visibility** | Observability | SW Yellow |
| **formula-readiness** | Observability | SE Blue |
| **exclusive-boundary** | Operational Fit | NW Green |
| **runtime-parameter-shape**| Operational Fit | NE Red |

---

## Trust Tiers

[GATE: school] ✓ PASS — Full workspace scope granted (Score ≥ 75)
[GATE: practice] ⚠ PARTIAL — Sandboxed via `harness-server` (Score ≥ 40)
[GATE: hold] ✗ FAIL — Rejected; eligibility line held (Score < 40)

---

## Configuration & Schema

**Telemetry Store:** `~/.gruff/trust.sqlite`
**Routing Schema:** `schemas/trust-event-v1.schema.json`

### Fresh Initialization
```bash
# Register systemd user timer for automated learning
gruff init-automation

# Manual leaderboard check
gruff actors
```

---

## Phase 2 — Delivery Delta

| Metric | Start | Phase 1 | Final |
|---|---|---|---|
| Trust Store | 0 | 1 (SQLite) | 1 (Buffered) |
| Routing Logic | 0 | 1 (Shim) | 1 (Matrix) |
| Attributes | 0 | 0 | 10 (Active) |
| Active Tiers | 1 | 3 | 3 |

---

**Outlook: CLEAN** — Trust-routing is operational with attribute-aware scoring.
