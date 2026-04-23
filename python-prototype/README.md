# notebook-engine (python-prototype)

This is the canonical LO7 notebook runtime. It owns manifest persistence, revisions, events, heatmap output, craft-backed compass renders, and Gruff bridge payload emission.

## Run

```bash
cd python-prototype
uv sync --group dev
uv run notebook-engine --manifest-path data/notebook.manifest.json --allow-missing-craft
```

For strict craft mode:

```bash
export LO7_CRAFT_RENDER_COMMAND="/absolute/path/to/craft-wrapper"
uv run notebook-engine --manifest-path data/notebook.manifest.json
```

## CLI

```bash
uv run lo7-manifest show --json
uv run lo7-heatmap --output data/heatmap.html --json
uv run lo7-compass metrics --json
uv run lo7-compass render --profile diagnostic --json
uv run lo7-compass emit-bridge --json
```

## Test

```bash
cd python-prototype
./.venv/bin/pytest -q
```

## API Highlights

- `GET /api/manifest`
- `PUT /api/manifest`
- `GET /api/revisions`
- `GET /api/events`
- `GET /api/exports/markdown`
- `POST /api/exports/csv-import`
- `GET /api/compass/status`
- `POST /api/compass/render`
- `GET /api/bridge/payload`
- `POST /api/bridge/payload`
- `WS /ws`

The broader integration story is documented in [notebook-engine-guide.md](/home/irfankabir/gruff/workspace/docs/notebook-engine-guide.md).
