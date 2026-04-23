# Notebook Engine — Baseline Status

## Overview

**Branch**: `rust-prototype-scaffolding`
**Commit**: 04164dd (feat: notebook-engine baseline with grid quantization and canvas UI)
**Status**: ✅ Building, Testing, and Running

The `rust-prototype/` directory now contains a minimal but complete implementation of a modern physical-notebook-style drawing tool served by Actix-web on port 8080.

## Architecture

### Backend (Rust)
- **Framework**: Actix-web 4
- **HTTP Routes**:
  - `GET /` → single-page HTML shell
  - `GET /api/grid` → JSON config (cell_px, margin_cols)
  - `GET /static/{file}` → embedded JavaScript

- **CLI Arguments**:
  - `--host` (default: 127.0.0.1)
  - `--port` (default: 8080)
  - `--cell-px` (default: 24)
  - `--margin-cols` (default: 2)

- **Core Module**: `src/grid.rs`
  - `GridConfig::quantize(x, y)` → snaps pixel coordinates to nearest cell, enforces margin
  - `GridConfig::cell_origin(col, row)` → pixel origin of a grid cell

### Frontend (Canvas + JavaScript)
- **Canvas Rendering**:
  - Dot grid at intersections (1.5px radius, graphite-200)
  - Ruled horizontal lines (0.5px, graphite-100)
  - Margin line (1px, amber border)

- **Pointer Gestures**:
  - `pointerdown` → begin drag (store start cell)
  - `pointermove` → update end cell, draw dashed preview
  - `pointerup` → commit block, fill with amber, add border
  - Blocks stored in-memory; re-render on each state change

- **Design Tokens**:
  - Background: `#0A0A0F` (graphite-950)
  - Primary blocks: `#F59E0B` (amber-500)
  - Borders/dots: rgba(10,10,15,0.06–0.16)

## Building and Running

```bash
cd ~/gruff/workspace/rust-prototype

# Build
cargo build

# Run (with defaults)
cargo run

# Run with custom grid
cargo run -- --cell-px 32 --margin-cols 3 --port 9000

# Run tests (12 tests, all passing)
cargo test
```

## Test Coverage

**Unit Tests** (`src/grid.rs`):
- Whole cell quantization
- Fractional pixel rounding
- Margin enforcement
- Cell origin calculation

**Integration Tests** (`tests/grid_quantize.rs`):
- Same 4 tests, testing the public lib API

All tests pass. No dead code warnings.

## Interactive Verification

```bash
# 1. Start the server
cargo run

# 2. Open browser
open http://127.0.0.1:8080

# 3. Test interactions
# - Click-drag across cells → blocks drawn with amber border
# - Resize window → canvas redraws, grid stays aligned
# - Check API
curl http://127.0.0.1:8080/api/grid | jq .
```

## What's NOT Included Yet

- **Persistence**: Blocks are in-memory only (lost on refresh)
- **Real-time Sync**: No WebSocket, no multi-client support
- **Undo/Redo**: No command history
- **Text Editing**: No text input inside blocks
- **Stylus/Pressure**: Pointer events only, no pressure sensitivity
- **Serialization**: No JSON export/import

These are designed for next iterations — the baseline is minimal but **interactive and extensible**.

## Files

| Path | Purpose |
|------|---------|
| `Cargo.toml` | Package manifest, dependencies |
| `src/lib.rs` | Library root |
| `src/main.rs` | CLI + server startup |
| `src/grid.rs` | Grid quantization math |
| `src/handlers.rs` | HTTP routes |
| `static/index.html` | Single-page shell |
| `static/notebook.js` | Canvas renderer + gestures |
| `tests/grid_quantize.rs` | Integration tests |
| `.gitignore` | Build artifacts excluded |

## Next Steps

1. **Browser Testing**: Verify drawing, snapping, colors, margin line
2. **Go Prototype**: Apply same pattern to `go-prototype/`
3. **Python Prototype**: Apply same pattern to `python-prototype/`
4. **Persistence**: SQLite or JSON file storage
5. **Real-time Sync**: WebSocket for collaborative editing
6. **Cell Metadata**: Attach properties (color, layer, tags) to blocks

---

**Branch**: `rust-prototype-scaffolding`
**Ready to**: Open in browser, draw blocks, verify grid quantization
**Status**: ✅ MVP complete, iterable
