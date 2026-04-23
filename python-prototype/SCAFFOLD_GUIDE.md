# Python Prototype — Notebook Engine Scaffold Guide

Mirrors the Rust `notebook-engine` baseline already committed on `rust-prototype-scaffolding`.
Target branch: `python-prototype-scaffolding`.

---

## Current stub state

```
python-prototype/
├── README.md          # minimal run/test instructions
├── pyproject.toml     # Flask >=3.0, pytest >=8.0, hatchling build backend
└── src/main.py        # single-route Flask app, argparse CLI, basic logging
```

No geometry module, no grid quantization, no static serving, no typed config, no tests.

---

## Framework upgrade: Flask → FastAPI

The Mangrove ecosystem (echoes, GRID) runs FastAPI + uvicorn. FastAPI gives:
- Automatic JSON serialization via Pydantic models (equivalent to Rust's `serde`)
- Type-checked route parameters
- Built-in OpenAPI docs at `/docs`

Replace the Flask dependency in `pyproject.toml` with FastAPI + uvicorn + pydantic. This is the only breaking change from the stub.

---

## Target layout

```
python-prototype/
├── src/
│   └── notebook_engine/
│       ├── __init__.py          # package root (empty)
│       ├── grid.py              # GridConfig dataclass + quantize + cell_origin
│       ├── api.py               # FastAPI app + routes
│       └── main.py              # CLI entry (argparse) + uvicorn startup
├── static/
│   ├── index.html               # dark-theme canvas shell
│   └── notebook.js              # canvas renderer + pointer gestures
├── tests/
│   └── test_grid.py             # pytest tests (whole cells, fractional, margin, origin)
├── pyproject.toml               # updated deps
└── .gitignore
```

The stub's `src/main.py` is replaced by `src/notebook_engine/main.py`. Remove or clear the old file.

---

## Step 1 — Update pyproject.toml

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
```

Install after editing:

```bash
cd python-prototype
uv sync --group dev
```

---

## Step 2 — Grid module (`src/notebook_engine/grid.py`)

Direct translation of `rust-prototype/src/grid.rs`. Uses a frozen Pydantic model so it can be passed to FastAPI routes and serialized to JSON automatically.

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

---

## Step 3 — Grid tests (`tests/test_grid.py`)

Four test cases that mirror the Rust integration tests exactly:

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
    assert col == 2, f"x=12 (inside margin) should clamp to 2, got {col}"
    col, _ = cfg.quantize(72.0, 0.0)
    assert col == 3, f"x=72 should return col 3, got {col}"


def test_cell_origin(cfg: GridConfig) -> None:
    assert cfg.cell_origin(2, 0) == (48.0, 0.0)
    assert cfg.cell_origin(3, 1) == (72.0, 24.0)
```

---

## Step 4 — FastAPI routes (`src/notebook_engine/api.py`)

FastAPI serves static files via `StaticFiles` mount and returns `GridConfig` as JSON directly (Pydantic handles serialization).

```python
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from notebook_engine.grid import GridConfig

STATIC_DIR = Path(__file__).parent.parent.parent / "static"


def build_app(config: GridConfig) -> FastAPI:
    app = FastAPI(title="notebook-engine", version="0.1.0")

    # Serve the single-page HTML shell at /
    _index_html = (STATIC_DIR / "index.html").read_text()

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def index() -> str:
        return _index_html

    # Grid configuration endpoint
    @app.get("/api/grid")
    async def api_grid() -> GridConfig:
        return config

    # Serve JS/CSS from /static/
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    return app
```

---

## Step 5 — Main entry (`src/notebook_engine/main.py`)

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
    parser = argparse.ArgumentParser(description="notebook-engine — physical notebook drawing tool")
    parser.add_argument("--host", default="127.0.0.1", help="bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="listen port (default: 8080)")
    parser.add_argument("--cell-px", type=int, default=24, help="grid cell size in pixels (default: 24)")
    parser.add_argument("--margin-cols", type=int, default=2, help="left margin width in columns (default: 2)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = GridConfig(cell_px=args.cell_px, margin_cols=args.margin_cols)
    logger.info("starting notebook-engine host=%s port=%d cell_px=%d margin_cols=%d",
                args.host, args.port, config.cell_px, config.margin_cols)
    app = build_app(config)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
```

Also create `src/notebook_engine/__init__.py` as an empty file:

```python
```

---

## Step 6 — Static files

### `static/index.html`

Copy verbatim from `rust-prototype/static/index.html`. No changes — it only fetches `/api/grid` and loads `/static/notebook.js`.

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

## Step 8 — Remove old stub

The `src/main.py` stub is replaced by `src/notebook_engine/main.py`. Either remove the old file or clear its contents:

```bash
rm python-prototype/src/main.py
# src/ directory will now only hold the notebook_engine package
```

If `src/` should remain as the top-level source root, update `pyproject.toml`'s `[tool.hatch.build.targets.wheel]` accordingly — which already has `packages = ["src/notebook_engine"]`.

---

## Verification

```bash
cd ~/gruff/workspace/python-prototype

# Install deps
uv sync --group dev

# Run tests
uv run pytest
# Expected: 4 tests pass

# Run server
uv run python -m notebook_engine.main --cell-px 24 --margin-cols 2
# or via the installed script:
uv run notebook-engine --cell-px 24 --margin-cols 2
# Server starts on http://127.0.0.1:8080

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

FastAPI auto-docs available at: `http://127.0.0.1:8080/docs`

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

## Module map vs Rust equivalent

| Rust | Python |
|------|--------|
| `src/grid.rs` → `GridConfig` struct | `src/notebook_engine/grid.py` → `GridConfig` Pydantic model |
| `src/handlers.rs` → actix handlers | `src/notebook_engine/api.py` → FastAPI routes |
| `src/main.rs` → clap CLI + actix startup | `src/notebook_engine/main.py` → argparse + uvicorn startup |
| `tests/grid_quantize.rs` | `tests/test_grid.py` |
| `include_str!("../static/index.html")` | `Path(__file__).parent.parent.parent / "static" / "index.html"` |

---

## What this does NOT include (next iterations)

- WebSocket real-time sync
- Persistent block storage (SQLite via `aiosqlite`)
- Undo/redo
- Text input inside blocks
- Touch pressure / stylus support
