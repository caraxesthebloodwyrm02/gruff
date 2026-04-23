# Agent Instructions — Go Notebook Engine

**Target branch**: `go-prototype-scaffolding`
**Working directory**: `~/gruff/workspace/go-prototype/`
**Goal**: Build a notebook-engine HTTP server in Go that serves a browser canvas with a dot grid, ruled lines, amber margin line, and drag-to-draw block gestures. Grid quantization math lives in Go. The browser frontend is identical to the Rust prototype.

Read this entire document before making any changes. Execute steps in order. Do not skip ahead.

---

## Preconditions

Verify these before writing any code:

```bash
go version          # must be >= 1.21
cd ~/gruff/workspace/go-prototype
cat go.mod          # should show: module go-prototype, go 1.21, gin v1.9.1
ls                  # should show: README.md go.mod src/
ls src/             # should show: main.go (single-route stub)
```

If `go version` fails, stop and report. Do not proceed without Go 1.21+.

---

## Step 1 — Rename module in go.mod

The current module name is `go-prototype`. Rename it to `notebook-engine` to match the binary name.

**File**: `go.mod`
**Action**: Replace the entire file with the following content.

```
module notebook-engine

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
)
```

After writing, verify:

```bash
head -1 go.mod
# Expected: module notebook-engine
```

---

## Step 2 — Delete the stub source file

The stub at `src/main.go` is replaced by `cmd/notebook-engine/main.go` in a later step. Remove it now so there is no competing `main` package.

```bash
rm -rf ~/gruff/workspace/go-prototype/src
```

Verify:

```bash
ls ~/gruff/workspace/go-prototype/
# Should NOT contain src/
```

---

## Step 3 — Create the grid module

Create directory `internal/grid/` and write `grid.go`.

**File**: `internal/grid/grid.go`
**Action**: Create this file with exactly the following content.

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

Verify the file exists and compiles:

```bash
ls ~/gruff/workspace/go-prototype/internal/grid/
# Expected: grid.go

cd ~/gruff/workspace/go-prototype
go build ./internal/grid/
# Expected: no output (success)
```

---

## Step 4 — Create the grid tests

**File**: `internal/grid/grid_test.go`
**Action**: Create this file with exactly the following content.

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
		wantCol, wantRow := uint32(c[2]), uint32(c[3])
		if col != wantCol || row != wantRow {
			t.Errorf("Quantize(%.1f,%.1f) = (%d,%d), want (%d,%d)", c[0], c[1], col, row, wantCol, wantRow)
		}
	}
}

func TestQuantizeFractional(t *testing.T) {
	g := cfg()
	col, row := g.Quantize(12.5, 12.5)
	if col != 2 || row != 0 {
		t.Errorf("Quantize(12.5,12.5) = (%d,%d), want (2,0)", col, row)
	}
	col, row = g.Quantize(36.5, 36.5)
	if col != 2 || row != 1 {
		t.Errorf("Quantize(36.5,36.5) = (%d,%d), want (2,1)", col, row)
	}
}

func TestQuantizeRespectsMargin(t *testing.T) {
	g := cfg()
	col, _ := g.Quantize(0, 0)
	if col != 2 {
		t.Errorf("x=0 should clamp to margin 2, got %d", col)
	}
	col, _ = g.Quantize(12, 0)
	if col != 2 {
		t.Errorf("x=12 (inside margin cell) should clamp to 2, got %d", col)
	}
	col, _ = g.Quantize(72, 0)
	if col != 3 {
		t.Errorf("x=72 should return col 3, got %d", col)
	}
}

func TestCellOrigin(t *testing.T) {
	g := cfg()
	ox, oy := g.CellOrigin(2, 0)
	if ox != 48.0 || oy != 0.0 {
		t.Errorf("CellOrigin(2,0) = (%.1f,%.1f), want (48.0,0.0)", ox, oy)
	}
	ox, oy = g.CellOrigin(3, 1)
	if ox != 72.0 || oy != 24.0 {
		t.Errorf("CellOrigin(3,1) = (%.1f,%.1f), want (72.0,24.0)", ox, oy)
	}
}
```

Run the tests now. All four must pass before continuing.

```bash
cd ~/gruff/workspace/go-prototype
go test ./internal/grid/
# Expected:
# ok  	notebook-engine/internal/grid	0.XXXs
```

If any test fails, fix `grid.go` before proceeding. Do not continue with failing tests.

---

## Step 5 — Create the static asset package

Go's `//go:embed` directive requires assets to live in the same directory tree as (or a subdirectory of) the file that embeds them. Place static files under `internal/handlers/static/` so `handlers.go` can embed them with simple relative paths.

### 5a — Write `internal/handlers/static/index.html`

**File**: `internal/handlers/static/index.html`
**Action**: Create this file with exactly the following content. Do not modify it.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>notebook-engine</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #0A0A0F;
            font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
            color: #14141A;
            overflow: hidden;
        }

        canvas {
            display: block;
            width: 100vw;
            height: 100vh;
            touch-action: none;
        }

        .info {
            position: fixed;
            bottom: 12px;
            left: 12px;
            font-size: 11px;
            color: rgba(90, 90, 110, 0.7);
            background: rgba(10, 10, 15, 0.8);
            padding: 8px 12px;
            border: 1px solid rgba(10, 10, 15, 0.16);
            border-radius: 6px;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <canvas id="nb"></canvas>
    <div class="info">
        <div>drag to draw blocks • cell: <span id="cell-display">—</span></div>
    </div>
    <script src="/static/notebook.js"></script>
</body>
</html>
```

### 5b — Write `internal/handlers/static/notebook.js`

**File**: `internal/handlers/static/notebook.js`
**Action**: Create this file with exactly the following content. Do not modify it.

```javascript
const canvas = document.getElementById('nb');
const ctx = canvas.getContext('2d');

let gridConfig = null;
let blocks = [];
let dragState = null;

async function init() {
    // Fetch grid config from backend
    try {
        const resp = await fetch('/api/grid');
        gridConfig = await resp.json();
        console.log('Grid config:', gridConfig);
    } catch (e) {
        console.error('Failed to fetch grid config:', e);
        gridConfig = { cell_px: 24, margin_cols: 2 };
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    draw();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

function quantize(x, y) {
    const col = Math.max(
        gridConfig.margin_cols,
        Math.floor(x / gridConfig.cell_px)
    );
    const row = Math.floor(y / gridConfig.cell_px);
    return [col, row];
}

function cellOrigin(col, row) {
    return [
        col * gridConfig.cell_px,
        row * gridConfig.cell_px,
    ];
}

function onPointerDown(e) {
    const [col, row] = quantize(e.offsetX, e.offsetY);
    dragState = { startCol: col, startRow: row, endCol: col, endRow: row };
    updateCellDisplay(col, row);
    draw();
}

function onPointerMove(e) {
    if (!dragState) return;
    const [col, row] = quantize(e.offsetX, e.offsetY);
    dragState.endCol = col;
    dragState.endRow = row;
    updateCellDisplay(col, row);
    draw();
}

function onPointerUp(e) {
    if (!dragState) return;
    // Commit block
    const minCol = Math.min(dragState.startCol, dragState.endCol);
    const maxCol = Math.max(dragState.startCol, dragState.endCol);
    const minRow = Math.min(dragState.startRow, dragState.endRow);
    const maxRow = Math.max(dragState.startRow, dragState.endRow);

    blocks.push({
        minCol,
        maxCol,
        minRow,
        maxRow,
    });

    dragState = null;
    draw();
}

function onPointerCancel(e) {
    dragState = null;
    draw();
}

function updateCellDisplay(col, row) {
    document.getElementById('cell-display').textContent = `${col},${row}`;
}

function draw() {
    // Clear
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid();

    // Draw committed blocks
    blocks.forEach(block => drawBlock(block));

    // Draw drag preview
    if (dragState) {
        const minCol = Math.min(dragState.startCol, dragState.endCol);
        const maxCol = Math.max(dragState.startCol, dragState.endCol);
        const minRow = Math.min(dragState.startRow, dragState.endRow);
        const maxRow = Math.max(dragState.startRow, dragState.endRow);

        const [x1, y1] = cellOrigin(minCol, minRow);
        const [x2, y2] = cellOrigin(maxCol + 1, maxRow + 1);
        const w = x2 - x1;
        const h = y2 - y1;

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, y1, w, h);
        ctx.setLineDash([]);
    }
}

function drawGrid() {
    const cellPx = gridConfig.cell_px;
    const marginPx = gridConfig.margin_cols * cellPx;
    const cols = Math.ceil(canvas.width / cellPx) + 1;
    const rows = Math.ceil(canvas.height / cellPx) + 1;

    // Dots at intersections
    ctx.fillStyle = 'rgba(10, 10, 15, 0.10)';
    for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
            const x = col * cellPx;
            const y = row * cellPx;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Ruled horizontal lines
    ctx.strokeStyle = 'rgba(10, 10, 15, 0.06)';
    ctx.lineWidth = 0.5;
    for (let row = 1; row < rows; row++) {
        const y = row * cellPx;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Margin line
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginPx, 0);
    ctx.lineTo(marginPx, canvas.height);
    ctx.stroke();
}

function drawBlock(block) {
    const [x1, y1] = cellOrigin(block.minCol, block.minRow);
    const [x2, y2] = cellOrigin(block.maxCol + 1, block.maxRow + 1);
    const w = x2 - x1;
    const h = y2 - y1;

    // Fill
    ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
    ctx.fillRect(x1, y1, w, h);

    // Border
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, w, h);
}

init();
```

Verify both files exist:

```bash
ls ~/gruff/workspace/go-prototype/internal/handlers/static/
# Expected: index.html  notebook.js
```

---

## Step 6 — Create the HTTP handlers

**File**: `internal/handlers/handlers.go`
**Action**: Create this file with exactly the following content.

The `//go:embed` directives reference `static/index.html` and `static/notebook.js` relative to this file's location. The files written in Step 5 satisfy these paths.

```go
package handlers

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"

	"notebook-engine/internal/grid"
)

//go:embed static/index.html
var indexHTML string

//go:embed static/notebook.js
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

// StaticFile serves embedded static assets.
func StaticFile(c *gin.Context) {
	switch c.Param("file") {
	case "/notebook.js":
		c.Data(http.StatusOK, "application/javascript", []byte(notebookJS))
	default:
		c.Status(http.StatusNotFound)
	}
}
```

Verify compilation:

```bash
cd ~/gruff/workspace/go-prototype
go build ./internal/handlers/
# Expected: no output (success)
```

If you see `pattern static/index.html: no matching files found`, the files in Step 5 are missing or misnamed. Check the paths exactly.

---

## Step 7 — Create the CLI entry point

Create directory `cmd/notebook-engine/` and write `main.go`.

**File**: `cmd/notebook-engine/main.go`
**Action**: Create this file with exactly the following content.

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
	log.Info("starting notebook-engine",
		"host", *host,
		"port", *port,
		"cell_px", *cellPx,
		"margin_cols", *marginCols,
	)

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
	log.Info("listening", "addr", addr)
	if err := r.Run(addr); err != nil {
		log.Error("server failed", "err", err)
		os.Exit(1)
	}
}
```

---

## Step 8 — Create .gitignore

**File**: `.gitignore`
**Action**: Create this file with exactly the following content.

```
notebook-engine
*.test
*.out
vendor/
.DS_Store
.vscode/
.idea/
```

---

## Step 9 — Tidy and build

```bash
cd ~/gruff/workspace/go-prototype

# Download dependencies and update go.sum
go mod tidy

# Full build
go build -o notebook-engine ./cmd/notebook-engine/

# Verify binary exists
ls -lh notebook-engine
# Expected: a file, e.g. -rwxr-xr-x 1 ... 9.8M ... notebook-engine
```

If `go mod tidy` fails with a network error, check internet access. If it fails with a module error, verify `go.mod` has the correct module name `notebook-engine` (Step 1).

---

## Step 10 — Run all tests

```bash
cd ~/gruff/workspace/go-prototype
go test ./...
# Expected:
# ok  	notebook-engine/internal/grid	0.XXXs
```

All 4 tests must pass. If any fail, fix the failing assertion in `grid.go` before the next step.

---

## Step 11 — Smoke test the running server

Start the server in the background, run checks, then stop it.

```bash
cd ~/gruff/workspace/go-prototype

./notebook-engine --cell-px 24 --margin-cols 2 &
SERVER_PID=$!
sleep 1

# Check /api/grid returns correct JSON
GRID=$(curl -s http://127.0.0.1:8080/api/grid)
echo "$GRID"
# Expected: {"cell_px":24,"margin_cols":2}

# Check HTML is served
HTML_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/)
echo "HTML status: $HTML_CODE"
# Expected: 200

# Check JS is served
JS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/static/notebook.js)
echo "JS status: $JS_CODE"
# Expected: 200

# Stop server
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
```

All three checks must pass. If `/api/grid` returns `{}` or missing fields, the `GridConfig` JSON tags are wrong — check Step 3. If HTML returns 404, the embed in Step 5/6 failed.

---

## Step 12 — Verify directory layout

```bash
find ~/gruff/workspace/go-prototype -type f | grep -v '.git' | sort
```

Expected output (order may vary):

```
go-prototype/.gitignore
go-prototype/AGENT_INSTRUCTIONS.md
go-prototype/SCAFFOLD_GUIDE.md
go-prototype/README.md
go-prototype/cmd/notebook-engine/main.go
go-prototype/go.mod
go-prototype/go.sum
go-prototype/internal/grid/grid.go
go-prototype/internal/grid/grid_test.go
go-prototype/internal/handlers/handlers.go
go-prototype/internal/handlers/static/index.html
go-prototype/internal/handlers/static/notebook.js
go-prototype/notebook-engine
```

The compiled `notebook-engine` binary is listed but is excluded from git via `.gitignore`.

---

## Step 13 — Commit

Stage only source files. Do not stage the compiled binary.

```bash
cd ~/gruff/workspace/go-prototype

git add go.mod go.sum .gitignore
git add cmd/notebook-engine/main.go
git add internal/grid/grid.go internal/grid/grid_test.go
git add internal/handlers/handlers.go
git add internal/handlers/static/index.html internal/handlers/static/notebook.js

git status
# Verify: no binary (notebook-engine) is staged
# Verify: go.sum is staged (new file from go mod tidy)

git commit -m "feat: notebook-engine baseline (Go)

Grid quantization, Gin HTTP server, embedded canvas frontend.
Mirrors rust-prototype-scaffolding baseline.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Failure reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| `no matching files found` on embed | static files not at `internal/handlers/static/` | Re-check Step 5 paths |
| `go: module go-prototype/internal/grid: not in module go-prototype` | old module name still in go.mod | Re-check Step 1 |
| `cannot use .. in embed path` | tried to use `//go:embed ../../static/` | static files must be under the package dir; use `internal/handlers/static/` |
| `/api/grid` returns `{}` | JSON struct tags missing or incorrect | Check `grid.go` — both fields need `json:"cell_px"` and `json:"margin_cols"` |
| tests fail: `Quantize(0,0) = (0,0), want (2,0)` | margin clamp missing in `Quantize` | `if col < g.MarginCols { col = g.MarginCols }` block must be in place |
| `gin: listen tcp :8080: bind: address already in use` | port already occupied | `lsof -i :8080` to find and kill the conflicting process |
