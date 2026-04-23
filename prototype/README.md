# notebook-engine

A Go web server that serves a browser canvas with a dot grid, ruled lines, amber margin line, and drag-to-draw block gestures. Blocks are persisted in-memory and exposed via a REST API. Undo (Ctrl+Z) and right-click delete are supported.

This runtime is now a secondary prototype. The canonical LO7 implementation lives in [`python-prototype`](/home/irfankabir/gruff/workspace/python-prototype) and adds manifest persistence, revisions/events, craft-backed compass rendering, and Gruff bridge payloads.

## Run

```bash
cd prototype
go run ./cmd/notebook-engine/
```

Open `http://127.0.0.1:8080` in a browser.

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `-host` | `127.0.0.1` | Bind address |
| `-port` | `8080` | Listen port |
| `-cell-px` | `24` | Grid cell size in pixels |
| `-margin-cols` | `2` | Left margin width in grid columns |
| `-cols` | `40` | Grid width in columns |
| `-rows` | `30` | Grid height in rows |

## Test

```bash
go test ./...
```

Test coverage: grid quantization (14 tests), blocks store + validation (9 tests), HTTP handlers (14 tests).

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | GET | Single-page canvas shell |
| `GET /api/grid` | GET | Grid config `{cell_px, margin_cols, cols, rows}` |
| `GET /api/blocks` | GET | List all blocks |
| `POST /api/blocks` | POST | Create block (start/end or bounds shape) |
| `DELETE /api/blocks/:id` | DELETE | Delete block by ID |
| `POST /api/blocks/clear` | POST | Clear all blocks |
| `GET /static/{file}` | GET | Embedded JS assets |

## Architecture

- `cmd/notebook-engine/` — CLI entry point with flag parsing and server startup
- `internal/grid/` — Grid configuration, quantization math, boundary clamping, NaN/Inf rejection
- `internal/blocks/` — Block store (in-memory, goroutine-safe) and payload validation
- `internal/handlers/` — HTTP handlers and embedded static assets

## Design tokens

| Element | Token | Value |
|---------|-------|-------|
| Background | `--graphite-950` | `#0A0A0F` |
| Grid dots | `--border-2` | `rgba(255,255,255,0.08)` |
| Ruled lines | `--border-1` | `rgba(255,255,255,0.05)` |
| Margin line | `--border-amber` | `rgba(245,158,11,0.35)` |
| Block fill | `--primary-soft` | `rgba(245,158,11,0.14)` |
| Block border | `--primary` | `#F59E0B` |
| Block glow | `--primary-glow` | `rgba(245,158,11,0.28)` |
