# notebook-engine

A Go web server that serves a browser canvas with a dot grid, ruled lines, amber margin line, and drag-to-draw block gestures.

## Run

```bash
cd prototype
go run ./cmd/notebook-engine/
```

Flags:
- `-host` Bind address (default: 127.0.0.1)
- `-port` Listen port (default: 8080)
- `-cell-px` Grid cell size in pixels (default: 24)
- `-margin-cols` Left margin width in grid columns (default: 2)

## Test

```bash
go test ./...
```

## Architecture

- `cmd/notebook-engine/` — CLI entry point with flag parsing and server startup
- `internal/grid/` — Grid configuration and quantization math
- `internal/handlers/` — HTTP handlers and embedded static assets

## Design tokens

| Element | Token | Value |
|---------|-------|-------|
| Background | — | `#0A0A0F` |
| Grid dots | — | `rgba(10,10,15,0.10)` |
| Ruled lines | — | `rgba(10,10,15,0.06)` |
| Margin line | — | `rgba(245,158,11,0.35)` |
| Block fill | — | `rgba(245,158,11,0.14)` |
| Block border | — | `#F59E0B` |
