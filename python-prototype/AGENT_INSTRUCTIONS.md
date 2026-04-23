# Agent Instructions — Python Notebook Engine

**Target branch**: `python-prototype-scaffolding`  
**Working directory**: `~/gruff/workspace/python-prototype/`  
**Goal**: Build a notebook-engine HTTP server in Python that serves a browser canvas with a dot grid, ruled lines, amber margin line, and drag-to-draw block gestures. Grid quantization math lives in Python. The browser frontend is identical to the Rust prototype.

Read this entire document before making any changes. Execute steps in order. Do not skip ahead.

---

## Preconditions

Verify these before writing any code:

```bash
python3 --version           # must be >= 3.11
uv --version                # must be present (Mangrove standard package manager)
cd ~/gruff/workspace/python-prototype
cat pyproject.toml          # should show: Flask, pytest, hatchling
ls                          # should show: README.md pyproject.toml src/
ls src/                     # should show: main.py (single-route Flask stub)
```

If `uv` is not installed, run `pip install uv` and retry. Do not use bare `pip` for anything else.

---

## Step 1 — Rewrite pyproject.toml

Replace Flask with FastAPI + uvicorn. FastAPI gives type-checked routes and automatic JSON serialization via Pydantic — the Python equivalent of Rust's `serde`. This is the only breaking change from the stub.

**File**: `pyproject.toml`  
**Action**: Replace the entire file with the following content.

```toml
[project]
name = "notebook-engine"
version = "0.1.0"
description = "Physical-notebook drawing tool — Python prototype"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.29.0",
    "pydantic>=2.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "httpx>=0.27.0",
]

[project.scripts]
notebook-engine = "notebook_engine.main:main"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/notebook_engine"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]
```

After writing, install:

```bash
cd ~/gruff/workspace/python-prototype
uv sync --group dev
```

Expected output ends with something like:
```
Resolved N packages in Xs
Installed N packages in Xs
```

If `uv sync` fails, check that `pyproject.toml` has no syntax errors and that Python >= 3.11 is available.

---

## Step 2 — Delete the stub source file

The stub at `src/main.py` will be replaced by `src/notebook_engine/main.py`. Remove it now.

```bash
rm ~/gruff/workspace/python-prototype/src/main.py
```

Verify:

```bash
ls ~/gruff/workspace/python-prototype/src/
# Should be empty or the directory should be empty — no main.py
```

---

## Step 3 — Create the package directory structure

```bash
mkdir -p ~/gruff/workspace/python-prototype/src/notebook_engine
mkdir -p ~/gruff/workspace/python-prototype/tests
mkdir -p ~/gruff/workspace/python-prototype/static
```

Create the package init file:

**File**: `src/notebook_engine/__init__.py`  
**Action**: Create this file as empty (zero bytes).

```bash
touch ~/gruff/workspace/python-prototype/src/notebook_engine/__init__.py
```

Verify:

```bash
ls ~/gruff/workspace/python-prototype/src/notebook_engine/
# Expected: __init__.py
```

---

## Step 4 — Create the grid module

**File**: `src/notebook_engine/grid.py`  
**Action**: Create this file with exactly the following content.

```python
from __future__ import annotations

from pydantic import BaseModel


class GridConfig(BaseModel, frozen=True):
    cell_px: int = 24
    margin_cols: int = 2

    def quantize(self, x: float, y: float) -> tuple[int, int]:
        """Snap pixel coordinates to the nearest grid cell (col, row).

        The returned col is never less than margin_cols.
        """
        col = int(x // self.cell_px)
        row = int(y // self.cell_px)
        return max(col, self.margin_cols), row

    def cell_origin(self, col: int, row: int) -> tuple[float, float]:
        """Return the pixel coordinate of a cell's top-left corner."""
        return float(col * self.cell_px), float(row * self.cell_px)
```

Verify the module imports cleanly:

```bash
cd ~/gruff/workspace/python-prototype
uv run python -c "from notebook_engine.grid import GridConfig; print(GridConfig())"
# Expected: cell_px=24 margin_cols=2
```

If you see `ModuleNotFoundError: No module named 'notebook_engine'`, the `src/` directory is not on the Python path. Check that `pyproject.toml` has `pythonpath = ["src"]` under `[tool.pytest.ini_options]` and that you ran `uv sync`.

---

## Step 5 — Create the grid tests

**File**: `tests/test_grid.py`  
**Action**: Create this file with exactly the following content.

```python
import pytest
from notebook_engine.grid import GridConfig


@pytest.fixture
def cfg() -> GridConfig:
    return GridConfig(cell_px=24, margin_cols=2)


def test_quantize_whole_cells(cfg: GridConfig) -> None:
    assert cfg.quantize(0.0, 0.0) == (2, 0)
    assert cfg.quantize(24.0, 24.0) == (2, 1)
    assert cfg.quantize(48.0, 48.0) == (2, 2)


def test_quantize_fractional(cfg: GridConfig) -> None:
    assert cfg.quantize(12.5, 12.5) == (2, 0)
    assert cfg.quantize(36.5, 36.5) == (2, 1)


def test_quantize_respects_margin(cfg: GridConfig) -> None:
    col, _ = cfg.quantize(0.0, 0.0)
    assert col == 2, f"x=0 should clamp to margin 2, got {col}"
    col, _ = cfg.quantize(12.0, 0.0)
    assert col == 2, f"x=12 (inside margin cell) should clamp to 2, got {col}"
    col, _ = cfg.quantize(72.0, 0.0)
    assert col == 3, f"x=72 should return col 3, got {col}"


def test_cell_origin(cfg: GridConfig) -> None:
    assert cfg.cell_origin(2, 0) == (48.0, 0.0)
    assert cfg.cell_origin(3, 1) == (72.0, 24.0)
```

Run the tests now. All four must pass before continuing.

```bash
cd ~/gruff/workspace/python-prototype
uv run pytest tests/test_grid.py -v
# Expected:
# tests/test_grid.py::test_quantize_whole_cells PASSED
# tests/test_grid.py::test_quantize_fractional PASSED
# tests/test_grid.py::test_quantize_respects_margin PASSED
# tests/test_grid.py::test_cell_origin PASSED
# 4 passed
```

If any test fails, fix `grid.py` before proceeding. Do not continue with failing tests.

---

## Step 6 — Create the static files

### 6a — Write `static/index.html`

**File**: `static/index.html`  
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

### 6b — Write `static/notebook.js`

**File**: `static/notebook.js`  
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
ls ~/gruff/workspace/python-prototype/static/
# Expected: index.html  notebook.js
```

---

## Step 7 — Create the FastAPI routes

**File**: `src/notebook_engine/api.py`  
**Action**: Create this file with exactly the following content.

```python
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from notebook_engine.grid import GridConfig

_STATIC_DIR = Path(__file__).parent.parent.parent / "static"


def build_app(config: GridConfig) -> FastAPI:
    app = FastAPI(title="notebook-engine", version="0.1.0")

    _index_html = (_STATIC_DIR / "index.html").read_text()

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def index() -> str:
        return _index_html

    @app.get("/api/grid")
    async def api_grid() -> GridConfig:
        return config

    if _STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    return app
```

The `_STATIC_DIR` path resolves as:
- `api.py` is at `src/notebook_engine/api.py`
- `Path(__file__).parent` = `src/notebook_engine/`
- `.parent` = `src/`
- `.parent` = `python-prototype/`  ← project root
- `/ "static"` = `python-prototype/static/` ✓

Verify the import works:

```bash
cd ~/gruff/workspace/python-prototype
uv run python -c "
from notebook_engine.grid import GridConfig
from notebook_engine.api import build_app
app = build_app(GridConfig())
print('routes:', [r.path for r in app.routes])
"
# Expected output includes: routes: ['/', '/api/grid', '/static']
# (exact order may vary)
```

If `FileNotFoundError: index.html` appears, Step 6a was not completed or the file is in the wrong location.

---

## Step 8 — Create the main entry point

**File**: `src/notebook_engine/main.py`  
**Action**: Create this file with exactly the following content.

```python
from __future__ import annotations

import argparse
import logging

import uvicorn

from notebook_engine.api import build_app
from notebook_engine.grid import GridConfig

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("notebook-engine")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="notebook-engine")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--cell-px", type=int, default=24, dest="cell_px")
    parser.add_argument("--margin-cols", type=int, default=2, dest="margin_cols")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = GridConfig(cell_px=args.cell_px, margin_cols=args.margin_cols)
    logger.info(
        "starting notebook-engine host=%s port=%d cell_px=%d margin_cols=%d",
        args.host, args.port, config.cell_px, config.margin_cols,
    )
    app = build_app(config)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
```

Note: `argparse` uses `dest="cell_px"` and `dest="margin_cols"` so that `--cell-px` and `--margin-cols` (hyphenated) map to `args.cell_px` and `args.margin_cols` (underscored) without ambiguity.

---

## Step 9 — Create .gitignore

**File**: `.gitignore`  
**Action**: Create this file with exactly the following content.

```
__pycache__/
*.pyc
*.pyo
.venv/
dist/
build/
*.egg-info/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.DS_Store
.vscode/
.idea/
```

---

## Step 10 — Run all tests

```bash
cd ~/gruff/workspace/python-prototype
uv run pytest -v
# Expected:
# tests/test_grid.py::test_quantize_whole_cells PASSED
# tests/test_grid.py::test_quantize_fractional PASSED
# tests/test_grid.py::test_quantize_respects_margin PASSED
# tests/test_grid.py::test_cell_origin PASSED
# 4 passed
```

All tests must pass before proceeding.

---

## Step 11 — Smoke test the running server

Start the server in the background, run checks, then stop it.

```bash
cd ~/gruff/workspace/python-prototype

uv run python -m notebook_engine.main --cell-px 24 --margin-cols 2 &
SERVER_PID=$!
sleep 2

# Check /api/grid returns correct JSON
GRID=$(curl -s http://127.0.0.1:8080/api/grid)
echo "$GRID"
# Expected: {"cell_px":24,"margin_cols":2}

# Check HTML is served
HTML_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/)
echo "HTML status: $HTML_CODE"
# Expected: 200

# Check HTML contains the canvas element
HTML_BODY=$(curl -s http://127.0.0.1:8080/)
echo "$HTML_BODY" | grep -c 'id="nb"'
# Expected: 1

# Check JS is served
JS_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/static/notebook.js)
echo "JS status: $JS_CODE"
# Expected: 200

# Stop server
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null
```

All checks must pass. If `/api/grid` returns `{"cell_px":24,"margin_cols":2}` with extra quotes or wrong field names, re-check the Pydantic model in `grid.py`. FastAPI serializes Pydantic models using the field names directly — no extra configuration needed.

---

## Step 12 — Verify directory layout

```bash
find ~/gruff/workspace/python-prototype -type f | grep -v '.git' | grep -v '__pycache__' | grep -v '.venv' | sort
```

Expected output:

```
python-prototype/.gitignore
python-prototype/AGENT_INSTRUCTIONS.md
python-prototype/SCAFFOLD_GUIDE.md
python-prototype/README.md
python-prototype/pyproject.toml
python-prototype/src/notebook_engine/__init__.py
python-prototype/src/notebook_engine/api.py
python-prototype/src/notebook_engine/grid.py
python-prototype/src/notebook_engine/main.py
python-prototype/static/index.html
python-prototype/static/notebook.js
python-prototype/tests/test_grid.py
```

Also check the `.venv` and `uv.lock` exist (created by `uv sync`):

```bash
ls ~/gruff/workspace/python-prototype/.venv
ls ~/gruff/workspace/python-prototype/uv.lock 2>/dev/null && echo "uv.lock present"
```

The `.venv/` is excluded from git by `.gitignore`. The `uv.lock` should be committed if present.

---

## Step 13 — Commit

Stage only source files.

```bash
cd ~/gruff/workspace/python-prototype

git add pyproject.toml .gitignore
git add uv.lock 2>/dev/null || true    # commit if uv generated it
git add src/notebook_engine/__init__.py
git add src/notebook_engine/grid.py
git add src/notebook_engine/api.py
git add src/notebook_engine/main.py
git add static/index.html static/notebook.js
git add tests/test_grid.py

git status
# Verify: .venv/ is NOT staged
# Verify: __pycache__/ is NOT staged

git commit -m "feat: notebook-engine baseline (Python)

Grid quantization, FastAPI + uvicorn HTTP server, embedded canvas frontend.
Mirrors rust-prototype-scaffolding baseline.

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

---

## Failure reference

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: No module named 'notebook_engine'` | `src/` not on Python path | Add `pythonpath = ["src"]` to `[tool.pytest.ini_options]` in `pyproject.toml`; re-run `uv sync` |
| `FileNotFoundError: .../static/index.html` | `static/` dir missing or wrong path | Check `_STATIC_DIR` in `api.py` resolves to project root; verify Step 6 files |
| `/api/grid` returns `{}` | Pydantic model serialization issue | Pydantic v2 + FastAPI serializes fields by name; field names must be `cell_px` and `margin_cols` |
| `test_quantize_respects_margin FAILED` | `quantize` not clamping to `margin_cols` | `return max(col, self.margin_cols), row` — `max()` must be in the return, not a separate statement |
| `Address already in use: 8080` | Port occupied | `lsof -i :8080` to find and kill the conflicting process |
| `ImportError: cannot import name 'StaticFiles' from 'fastapi'` | `python-multipart` missing | Run `uv add python-multipart` or check `uvicorn[standard]` installed correctly |
| `uv: command not found` | uv not installed | `pip install uv` then retry |
