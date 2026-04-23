# Canvas Wheel Integration — MCP Probe Signals

Bridge `mcp-probe.sh` signal extraction to the GRID Canvas EnvironmentWheel for real-time ecosystem health visualization.

---

## Architecture

```
  mcp-probe.sh ──► ~/scripts/mcp-probe-adapter.py ──► payload.json
                           │                              │
                           ├─► ASCII wheel (standalone)   │
                           │   (works without server)     │
                           │                              ▼
                           └─► POST /api/v1/canvas/probe-alignment
                                       (when Canvas API server is live)
                                              │
                                              ▼
                                   EnvironmentWheel.add_agent()
                                              │
                                              ▼
                                   Wheel state updated with probe agents
                                              │
                                              ▼
                                   craft-server.render(gruff_compass_x)
                                   (if alignment ≥ 1.0)
```

---

## Signal → Canvas Wheel Zone Mapping

The existing `WheelZone` enum (CORE, COGNITIVE, APPLICATION, TOOLS, ARENA, AGENTIC, INTERFACES, CANVAS) is reused — new semantic labels are encoded in agent metadata.

| Signal | Zone | Color | Weight | Label | Agent Glyph |
|:------:|:----:|-------|:------:|:-----:|:-----------:|
| ✅ PASS | `canvas` | `#2A9D8F` cool | 1.0 | CLEAR | `o` |
| 🔴 FAIL | `tools` | `#E76F51` warm | 0.0 | ACT | `X` |
| ⚠️ WARN | `agentic` | `#F4A261` amber | 0.5 | WATCH | `~` |
| · DETAIL | — | — | — | — | (not mapped, subordinate) |

**Rationale for zone choice:**
- PASS → `canvas` — the routing/visualization hub, healthy state
- FAIL → `tools` — action layer, requires intervention
- WARN → `agentic` — agent-monitored, needs observation

---

## Payload Schema

```json
{
  "probe_id": "mcp-maintenance-2026-04-20T01:39:30Z",
  "timestamp": "2026-04-20T01:39:30Z",
  "signals": { "pass": 26, "fail": 1, "warn": 1, "detail": 14 },
  "findings": [
    { "type": "pass", "text": "echoes-server: ...", "children": [] },
    { "type": "fail", "text": "Found 14 stale...", "children": ["file1.py", ...] },
    { "type": "warn", "text": "Found 10 context-only...", "children": [] }
  ],
  "agents": [
    { "id": "mcp-...-pass-0",
      "name": "echoes-server: ...",
      "zone": "canvas", "weight": 1.0,
      "color": "#2A9D8F", "label": "CLEAR" }
  ],
  "path_score": 83.13,
  "baseline_score": 70.0,
  "alignment": 1.188,
  "verdict": "AT-OR-ABOVE"
}
```

---

## Usage

### Standalone mode (no Canvas server required)

```bash
# Compact summary
~/scripts/mcp-probe-adapter.py
# → SIGNALS: {'pass': 26, 'fail': 1, 'warn': 1, 'detail': 14}  PATH=83.13  A=1.188  verdict=AT-OR-ABOVE

# ASCII wheel rendering
~/scripts/mcp-probe-adapter.py --ascii

# Full JSON payload
~/scripts/mcp-probe-adapter.py --json
```

### Piped from probe

```bash
~/scripts/mcp-probe.sh | ~/scripts/mcp-probe-adapter.py --ascii
```

### POST to Canvas API (when live)

```bash
# Start Canvas API (in GRID-main)
cd ~/workspace/CascadeProjects/Projects/GRID-main
uv run uvicorn src.application.api.main:app --port 8000

# In another shell — post probe results
~/scripts/mcp-probe-adapter.py --post
```

---

## Canvas-Side Integration (Proposed)

The adapter currently targets `POST /api/v1/canvas/probe-alignment`, which does NOT yet exist in GRID-main. To wire the server side, apply the proposed patch at `~/.maintain-server/patches/canvas-probe-alignment.patch`.

The patch adds:
- `ProbeAlignmentRequest` / `ProbeAlignmentResponse` Pydantic models in `api.py`
- `POST /probe-alignment` endpoint handler
- `Canvas.apply_probe_signals()` method in `canvas.py` that:
  - Iterates over agents in the payload
  - Calls `wheel.add_agent(zone=WheelZone(zone_str), metadata={...})` per agent
  - Spins the wheel once with `delta_time=0.5`
  - Returns wheel state + alignment verdict

Because GRID-main is a submodule with independent history (per `CascadeProjects/AGENTS.md`), the patch is saved rather than applied.

---

## Verification

### Validate adapter matches alignment-procedure.md

Expected output (matching worked example):
```
SIGNALS: {'pass': 26, 'fail': 1, 'warn': 1, 'detail': 14}
PATH=83.13  baseline=70.0  A=1.188  verdict=AT-OR-ABOVE
```

### Validate server integration (when patch applied)

```bash
# 1. Apply patch in GRID-main
cd ~/workspace/CascadeProjects/Projects/GRID-main
git apply ~/.maintain-server/patches/canvas-probe-alignment.patch

# 2. Start server
uv run uvicorn src.application.api.main:app --port 8000

# 3. POST probe results
~/scripts/mcp-probe-adapter.py --post

# 4. View wheel
curl 'http://localhost:8000/api/v1/canvas/wheel?format=text'
```

---

## Reference Files

- Adapter: `~/scripts/mcp-probe-adapter.py`
- Probe: `~/scripts/mcp-probe.sh`
- Signal spec: `../signal-extraction.yaml`
- Alignment math: `../alignment-procedure.md`
- Proposed patch: `~/.maintain-server/patches/canvas-probe-alignment.patch`
- GRID Canvas source:
  - `workspace/CascadeProjects/Projects/GRID-main/src/application/canvas/api.py`
  - `workspace/CascadeProjects/Projects/GRID-main/src/application/canvas/canvas.py`
  - `workspace/CascadeProjects/Projects/GRID-main/src/application/canvas/wheel.py`
