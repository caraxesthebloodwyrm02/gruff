# notebook-engine (python-prototype)

FastAPI notebook engine scaffold with typed grid and block APIs.

## Run
```bash
cd python-prototype
uv sync --group dev
uv run notebook-engine --cell-px 24 --margin-cols 2
```

## Test
```bash
cd python-prototype
uv run pytest -v
```

## API
- `GET /` — notebook HTML shell
- `GET /api/grid` — active grid config
- `GET /api/blocks` — list blocks
- `POST /api/blocks` — create block (bounds or start/end payload)
- `DELETE /api/blocks/{block_id}` — delete one block
- `POST /api/blocks/clear` — clear all blocks
