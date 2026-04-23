# Cascade — Python Prototype

## Overview

Python implementation of `notebook-engine` — a physical-notebook drawing tool with grid quantization and block CRUD API. Synced to cascade integrity with Go (`prototype/`) and Rust (`rust-prototype/`) implementations.

## Architecture

```
src/notebook_engine/
├── __init__.py       — Package entry
├── main.py           — CLI / uvicorn runner
├── grid.py           — GridConfig + quantization math
├── blocks.py         — Block CRUD (Pydantic models + InMemoryBlockStore)
├── api.py            — FastAPI app (build_app factory)
└── static/
    ├── index.html    — Frontend HTML
    └── notebook.js   — Frontend JS (synced from rust-prototype)
```

## API Contract

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/grid` | `{"cell_px": 24, "margin_cols": 2}` |
| GET | `/api/blocks` | `list[Block]` |
| POST | `/api/blocks` | `Block` (201) or 422 |
| DELETE | `/api/blocks/{block_id}` | 204 or 404 |
| POST | `/api/blocks/clear` | 204 |

## Grid Math

Cell quantization: `cell_origin = floor(value / cell_px) * cell_px`

Margin: first `margin_cols` columns reserved.

## Run

```bash
cd python-prototype
uv sync
uv run uvicorn notebook_engine.main:app --reload --port 8000
```

## Test

```bash
uv run pytest tests/ -v
```

## Sync Status

- ✅ Grid math (quantization) — identical to Go + Rust
- ✅ API paths + response shapes — identical to Go + Rust
- ✅ Frontend (index.html + notebook.js) — synced from rust-prototype
- ✅ Block validation + error handling — Pydantic-native