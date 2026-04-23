# windsurf cascade — GRID-Aware Notebook Engine Workflow

## What It Is

**windsurf cascade** is a GRID-aware development workflow pattern used in the `gruff` ecosystem that orchestrates multi-language notebook-engine prototypes (Rust, Go, Python) to enable physical-notebook-style drawing in a browser canvas. It implements the "cascade pattern" — a sequential, language-specific prototyping approach where each implementation mirrors the same core geometry and UI behavior, ensuring consistency across the Mangrove constellation.

The pattern draws from the **notebook engine prototype** which serves a canvas with:
- Dot grid at intersections (1.5px radius)
- Horizontal ruled lines (0.5px)
- Vertical amber margin line at configurable column width
- Click-drag gestures to draw blocks that snap to grid cells
- Grid configuration returned as JSON (`/api/grid` endpoint)

## Core Purpose

Enable **GRID (Grid Infrastructure Development)** teams to work with a shared physical-notebook metaphor regardless of language stack. The cascade:

1. Provides identical grid quantization math across languages (Rust `grid.rs` → Go `internal/grid/grid.go` → Python `src/notebook_engine/grid.py`)
2. Maintains the same design system (GRID tokens from `design-system/tokens.json`)
3. Serves a browser canvas that renders identically in all three implementations
4. Enables rapid iteration where language choice depends on ecosystem needs (e.g., Rust for MCP server integration, Python for FastAPI bridge, Go for lightweight standalone)

## Ecosystem Context

```
gruff/workspace/prototype/
├── cmd/notebook-engine/main.go      # CLI entry point with flags
├── internal/
│   ├── grid/
│   │   ├── grid.go                 # GridConfig struct + Quantize + CellOrigin
│   │   └── grid_test.go            # 4 unit tests
│   └── handlers/
│       ├── handlers.go             # HTTP handlers with go:embed directives
│       └── static/
│           ├── index.html          # Canvas HTML shell
│           └── notebook.js         # Canvas renderer + pointer gestures
├── go.mod / go.sum                 # Complete dependency tree
└── notebook-engine                 # Compiled binary (~12MB)
```

## Architecture

### Grid Geometry (Language-Independent)

The core math is identical across all implementations:

```
Quantize(x, y) → (col, row):
  col = floor(x / cell_px)
  row = floor(y / cell_px)
  col = max(col, margin_cols)  // never less than margin

CellOrigin(col, row) → (x, y):
  x = col * cell_px
  y = row * cell_px
```

### HTTP API

| Endpoint | Method | Response | Description |
|----------|--------|----------|-------------|
| `GET /` | GET | HTML | Single-page canvas shell |
| `GET /api/grid` | GET | JSON | Grid config `{cell_px, margin_cols, cols, rows}` |
| `GET /api/blocks` | GET | JSON | List all blocks |
| `POST /api/blocks` | POST | JSON | Create block (start/end or bounds shape) |
| `DELETE /api/blocks/:id` | DELETE | — | Delete block by ID |
| `POST /api/blocks/clear` | POST | — | Clear all blocks |
| `GET /static/{file}` | GET | JS | Embedded canvas renderer |

### Design System

| Canvas Element | Token | Value |
|----------------|-------|-------|
| Background | `--graphite-950` | `#0A0A0F` |
| Grid dots | `--border-2` | `rgba(10,10,15,0.10)` |
| Ruled lines | `--border-1` | `rgba(10,10,15,0.06)` |
| Margin line | `--border-amber` | `rgba(245,158,11,0.35)` |
| Block fill | `--primary-soft` | `rgba(245,158,11,0.14)` |
| Block border | `--primary` | `#F59E0B` |

## How to Use It

### Run

```bash
cd ~/gruff/workspace/prototype
go run ./cmd/notebook-engine/
```

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-host` | `127.0.0.1` | Bind address |
| `-port` | `8080` | Listen port |
| `-cell-px` | `24` | Grid cell size |
| `-margin-cols` | `2` | Left margin width |

### Example

```bash
go run ./cmd/notebook-engine/ -port 3000 -cell-px 20
```

Open `http://127.0.0.1:8080` in a browser.

### Test & Build

```bash
go test ./...          # Run tests
go build -o notebook-engine ./cmd/notebook-engine/  # Build binary
```

## Why It's Good

- **Embedded assets**: Single binary, no runtime file I/O (like Rust's `include_str!`)
- **Grid precision**: Deterministic quantization math (`floor(x/24)`, clamped margin)
- **Performance**: Gin's lightweight routing + Go's efficient static serving
- **Architecture**: Clean separation—`grid/` math, `handlers/` routing, `cmd/` CLI

## Useful Scenarios

| Scenario | Target |
|----------|--------|
| Local scratchpad for sketches | Developers, designers |
| Embedded canvas in dev workflows | MCP servers, tooling |
| Stylable notebook frontend | Educational tools |
| Standalone binary | CLI workflows, demos |

## Cascade Pattern (Multi-Language Sync)

When extending to other languages:

1. **Port grid math first** (Rust → Go → Python)
2. **Mirror API semantics** (same endpoints, same JSON)
3. **Copy static assets** (index.html + notebook.js)
4. **Verify cascade integrity**:
```bash
curl -s http://127.0.0.1:8080/api/grid  # All implementations
# Expected: {"cell_px":24,"margin_cols":2}
```

## Key Files

| Path | Purpose |
|------|---------|
| `cmd/notebook-engine/main.go` | CLI flags + Gin startup |
| `internal/grid/grid.go` | GridConfig struct + Quantize + CellOrigin |
| `internal/grid/grid_test.go` | 14 unit tests (quantize, boundary, NaN/Inf, subnormal) |
| `internal/blocks/blocks.go` | Block store + DTOs + margin enforcement |
| `internal/blocks/blocks_test.go` | 9 unit tests (shapes, validation, lifecycle) |
| `internal/handlers/handlers.go` | Gin handlers + embedded static |
| `internal/handlers/handlers_test.go` | 14 HTTP tests (endpoints, CRUD, errors) |
| `internal/handlers/static/notebook.js` | Canvas renderer + pointer gestures |
| `go.mod` | Module: `notebook-engine`, Gin v1.9.1 |

## Verification Commands

```bash
# Test and build
go test ./... && go build -o notebook-engine ./cmd/notebook-engine/

# Run with custom config
./notebook-engine --host 0.0.0.0 --port 9000 --cell-px 32 --margin-cols 3

# API check
curl http://127.0.0.1:8080/api/grid
```
