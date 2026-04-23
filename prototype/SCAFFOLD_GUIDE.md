# Go Prototype — Notebook Engine Scaffold Guide

Mirrors the Rust `notebook-engine` baseline already committed on `rust-prototype-scaffolding`.
Target branch: `go-prototype-scaffolding`.

---

## Current stub state

```
go-prototype/
├── README.md          # minimal run/test instructions
├── go.mod             # module "go-prototype", gin v1.9.1
└── src/main.go        # single-route stub — GET / returns JSON message
```

No geometry module, no grid quantization, no static serving, no tests.

---

## Target layout

```
go-prototype/
├── cmd/
│   └── notebook-engine/
│       └── main.go          # CLI flags + server startup
├── internal/
│   ├── grid/
│   │   ├── grid.go          # GridConfig struct + Quantize + CellOrigin
│   │   └── grid_test.go     # unit tests (whole cells, fractional, margin, origin)
│   └── handlers/
│       └── handlers.go      # HTTP handlers (index, api_grid, static)
├── static/
│   ├── index.html           # dark-theme canvas shell
│   └── notebook.js          # canvas renderer + pointer gestures
├── go.mod                   # updated module name + embed tag
├── .gitignore
└── README.md                # (keep existing, extend with new commands)
```

---

## Step 1 — Update go.mod

Replace the stub module name and add the standard library embed:

```
module notebook-engine

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
)
```

No extra runtime dependencies needed. `embed` is in the standard library since Go 1.16.

Run after editing:

```bash
cd go-prototype
go mod tidy
```

---

## Step 2 — Grid module (`internal/grid/grid.go`)

This is the geometry primitive. The only math that matters:
- `Quantize`: floor-divide x/y by cell_px, then clamp col to margin_cols minimum.
- `CellOrigin`: multiply col/row by cell_px to get pixel top-left.

```go
package grid

// GridConfig holds the two parameters that define the notebook grid.
type GridConfig struct {
    CellPx     uint32 `json:"cell_px"`
    MarginCols uint32 `json:"margin_cols"`
}

// Quantize snaps a pixel coordinate to the nearest grid cell (col, row).
// The returned col is never less than MarginCols.
func (g GridConfig) Quantize(x, y float32) (uint32, uint32) {
    col := uint32(x / float32(g.CellPx))
    row := uint32(y / float32(g.CellPx))
    if col < g.MarginCols {
        col = g.MarginCols
    }
    return col, row
}

// CellOrigin returns the pixel coordinate of a cell's top-left corner.
func (g GridConfig) CellOrigin(col, row uint32) (float32, float32) {
    return float32(col) * float32(g.CellPx), float32(row) * float32(g.CellPx)
}
```

---

## Step 3 — Grid tests (`internal/grid/grid_test.go`)

Four test cases that mirror the Rust integration tests exactly:

```go
package grid_test

import (
    "testing"

    "notebook-engine/internal/grid"
)

func cfg() grid.GridConfig {
    return grid.GridConfig{CellPx: 24, MarginCols: 2}
}

func TestQuantizeWholeCells(t *testing.T) {
    g := cfg()
    cases := [][4]float32{
        {0, 0, 2, 0},
        {24, 24, 2, 1},
        {48, 48, 2, 2},
    }
    for _, c := range cases {
        col, row := g.Quantize(c[0], c[1])
        if col != uint32(c[2]) || row != uint32(c[3]) {
            t.Errorf("Quantize(%v,%v) = (%v,%v), want (%v,%v)", c[0], c[1], col, row, uint32(c[2]), uint32(c[3]))
        }
    }
}

func TestQuantizeFractional(t *testing.T) {
    g := cfg()
    col, row := g.Quantize(12.5, 12.5)
    if col != 2 || row != 0 {
        t.Errorf("got (%v,%v), want (2,0)", col, row)
    }
    col, row = g.Quantize(36.5, 36.5)
    if col != 2 || row != 1 {
        t.Errorf("got (%v,%v), want (2,1)", col, row)
    }
}

func TestQuantizeRespectsMargin(t *testing.T) {
    g := cfg()
    col, _ := g.Quantize(0, 0)
    if col != 2 {
        t.Errorf("x=0 should clamp to margin 2, got %v", col)
    }
    col, _ = g.Quantize(12, 0)
    if col != 2 {
        t.Errorf("x=12 (inside margin) should clamp to 2, got %v", col)
    }
    col, _ = g.Quantize(72, 0)
    if col != 3 {
        t.Errorf("x=72 should return col 3, got %v", col)
    }
}

func TestCellOrigin(t *testing.T) {
    g := cfg()
    ox, oy := g.CellOrigin(2, 0)
    if ox != 48.0 || oy != 0.0 {
        t.Errorf("CellOrigin(2,0) = (%v,%v), want (48,0)", ox, oy)
    }
    ox, oy = g.CellOrigin(3, 1)
    if ox != 72.0 || oy != 24.0 {
        t.Errorf("CellOrigin(3,1) = (%v,%v), want (72,24)", ox, oy)
    }
}
```

---

## Step 4 — HTTP handlers (`internal/handlers/handlers.go`)

Use Go's `embed` directive so static files are compiled into the binary — no runtime file I/O, same approach as Rust's `include_str!`.

```go
package handlers

import (
    _ "embed"
    "net/http"

    "github.com/gin-gonic/gin"

    "notebook-engine/internal/grid"
)

//go:embed ../../static/index.html
var indexHTML string

//go:embed ../../static/notebook.js
var notebookJS string

// Index serves the notebook single-page app.
func Index(c *gin.Context) {
    c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(indexHTML))
}

// APIGrid returns the grid configuration as JSON.
func APIGrid(cfg grid.GridConfig) gin.HandlerFunc {
    return func(c *gin.Context) {
        c.JSON(http.StatusOK, cfg)
    }
}

// StaticFile serves files from the embedded static directory.
func StaticFile(c *gin.Context) {
    name := c.Param("file")
    switch name {
    case "/notebook.js":
        c.Data(http.StatusOK, "application/javascript", []byte(notebookJS))
    default:
        c.Status(http.StatusNotFound)
    }
}
```

> The `//go:embed` paths are relative to the file containing the directive. With `handlers.go`
> at `internal/handlers/`, use `../../static/` to reach the top-level `static/` directory.

---

## Step 5 — Main entry (`cmd/notebook-engine/main.go`)

```go
package main

import (
    "flag"
    "fmt"
    "log/slog"
    "os"

    "github.com/gin-gonic/gin"

    "notebook-engine/internal/grid"
    "notebook-engine/internal/handlers"
)

func main() {
    host := flag.String("host", "127.0.0.1", "bind address")
    port := flag.Int("port", 8080, "listen port")
    cellPx := flag.Uint("cell-px", 24, "grid cell size in pixels")
    marginCols := flag.Uint("margin-cols", 2, "left margin width in grid columns")
    flag.Parse()

    log := slog.New(slog.NewTextHandler(os.Stdout, nil))
    log.Info("starting notebook-engine", "host", *host, "port", *port, "cell_px", *cellPx, "margin_cols", *marginCols)

    cfg := grid.GridConfig{
        CellPx:     uint32(*cellPx),
        MarginCols: uint32(*marginCols),
    }

    gin.SetMode(gin.ReleaseMode)
    r := gin.New()
    r.Use(gin.Logger(), gin.Recovery())

    r.GET("/", handlers.Index)
    r.GET("/api/grid", handlers.APIGrid(cfg))
    r.GET("/static/*file", handlers.StaticFile)

    addr := fmt.Sprintf("%s:%d", *host, *port)
    if err := r.Run(addr); err != nil {
        log.Error("server failed", "err", err)
        os.Exit(1)
    }
}
```

---

## Step 6 — Static files

### `static/index.html`

Copy verbatim from `rust-prototype/static/index.html`. The file is language-agnostic — it only fetches `/api/grid` and loads `/static/notebook.js`. No changes needed.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notebook Engine</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0A0A0F; }
    #nb { display: block; width: 100vw; height: 100vh; cursor: crosshair; }
    #info {
      position: fixed; bottom: 12px; right: 16px;
      font: 11px/1.6 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
      color: rgba(245,158,11,0.55); pointer-events: none;
    }
  </style>
</head>
<body>
  <canvas id="nb"></canvas>
  <div id="info">—</div>
  <script src="/static/notebook.js"></script>
</body>
</html>
```

### `static/notebook.js`

Copy verbatim from `rust-prototype/static/notebook.js`. Same `/api/grid` endpoint, same design tokens. No changes needed.

---

## Step 7 — .gitignore

```
/go-prototype          # compiled binary (matches module name)
/notebook-engine       # compiled binary (matches cmd name)
*.test
*.out
vendor/
.DS_Store
.vscode/
.idea/
```

---

## Step 8 — Delete or repurpose `src/main.go`

The stub at `src/main.go` is replaced by `cmd/notebook-engine/main.go`. Delete `src/` entirely:

```bash
rm -rf go-prototype/src
```

---

## Verification

```bash
cd ~/gruff/workspace/go-prototype

# Tidy deps
go mod tidy

# Run tests
go test ./internal/grid/...
# Expected: 4 tests pass

# Run all tests
go test ./...

# Build
go build -o notebook-engine ./cmd/notebook-engine/

# Run server
./notebook-engine --cell-px 24 --margin-cols 2
# Server starts on 127.0.0.1:8080

# In another terminal:
curl http://127.0.0.1:8080/api/grid
# Expected: {"cell_px":24,"margin_cols":2}

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/
# Expected: 200

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/static/notebook.js
# Expected: 200
```

Open `http://127.0.0.1:8080` in a browser and verify:
- Dark graphite background (`#0A0A0F`)
- Dot grid at every cell intersection
- Horizontal ruled lines at each row boundary
- Vertical amber margin line
- Click-drag to draw amber-bordered blocks; release snaps to grid

---

## Design token reference (unchanged from Rust)

| Canvas element | Token | Value |
|---|---|---|
| Background | `--graphite-950` | `#0A0A0F` |
| Dots | `--border-2` | `rgba(10,10,15,0.10)` |
| Ruled lines | `--border-1` | `rgba(10,10,15,0.06)` |
| Margin line | `--border-amber` | `rgba(245,158,11,0.35)` |
| Block fill | `--primary-soft` | `rgba(245,158,11,0.14)` |
| Block border | `--primary` | `#F59E0B` |

---

## What this does NOT include (next iterations)

- WebSocket real-time sync
- Persistent block storage (SQLite via `database/sql` + `mattn/go-sqlite3`)
- Undo/redo
- Text input inside blocks
- Touch pressure / stylus support
