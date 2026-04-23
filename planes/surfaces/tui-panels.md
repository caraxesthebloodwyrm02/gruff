# TUI panel surfaces (gruff)

The Ink-based `gruff` TUI renders four quadrants defined in `src/menu/Menu.tsx`.
Each panel is a React component under `src/menu/panels/`.

| Quadrant | Label | Component | Data sources | Relevant env |
|----------|-------|-----------|--------------|--------------|
| NW (green) | MCP signal | [`mcp.tsx`](../../src/menu/panels/mcp.tsx) | `mcp_config.json` (server names) · `~/.echoes/audit.ndjson` (last event status per source) · `~/.gruff/ingester.state` (ingester lag) | `CASCADE_WORKSPACE_ROOT` (path to `mcp_config.json`) |
| NE (red) | inference narrow-band | [`inference.tsx`](../../src/menu/panels/inference.tsx) | `~/.echoes/audit.ndjson` — latest `proportion` event: `audioDrive`, `theta`, `weights` | — |
| SW (yellow) | agency accumulated | [`agency.tsx`](../../src/menu/panels/agency.tsx) | `~/.gruff/trust.sqlite` via `listActors()` (top-5 actors, tiers, scores) · `~/.seeds-server/snapshots/*.json` (ecosystem `overallScore`) | — |
| SE (cyan) | horizon forward | [`horizon.tsx`](../../src/menu/panels/horizon.tsx) | GATE `incoming/` (pending envelopes) · Ori anticipation JSON · eligibility cycles JSON | `GATE_DIR` · `ORI_ANTICIPATION_PATH` · `ELIGIBILITY_CYCLES_PATH` |

## Fallback resolution

- **MCP config**: defaults to `~/gruff/workspace/CascadeProjects/mcp_config.json`; override with `CASCADE_WORKSPACE_ROOT`.
- **GATE dir**: defaults to `~/gruff/workspace/CascadeProjects/Projects/GATE`; override with `GATE_DIR`.
- **Ori anticipation**: checked in order — `ORI_ANTICIPATION_PATH` → `~/.ori-server/anticipation.json` → `CascadeProjects/.state/ori/anticipation.json`.
- **Eligibility cycles**: checked in order — `ELIGIBILITY_CYCLES_PATH` → `~/.eligibility-server/cycles.json` → `CascadeProjects/.state/eligibility/cycles.json`.
- All panels degrade gracefully when files are absent (dimmed "not found" text).

## Notes

- Panels refresh every **5 s** (driven by the `tick` prop from a `setInterval` in `Menu.tsx`).
- Press `q`, `Esc`, or `Ctrl-C` to exit.
- This file is the canonical surface artifact for `planes/surfaces/`: it ties UI areas to on-disk and env contracts without embedding long prose in components.