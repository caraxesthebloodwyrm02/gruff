# Notebook Engine Guide

The canonical LO7 notebook runtime now lives in [`python-prototype`](/home/irfankabir/gruff/workspace/python-prototype). It is manifest-first, revisioned, and bridge-aware.

## Daily Flow

1. Seed or inspect the manifest:

```bash
cd python-prototype
uv run lo7-manifest show --json
```

2. Start the browser runtime:

```bash
uv run notebook-engine --manifest-path data/notebook.manifest.json
```

3. Open `http://127.0.0.1:8080`, draw blocks, and watch revisions update in the sidebar.

4. Generate artifacts:

```bash
uv run lo7-heatmap --manifest-path data/notebook.manifest.json --output data/heatmap.html --json
uv run lo7-compass metrics --manifest-path data/notebook.manifest.json --json
uv run lo7-compass render --manifest-path data/notebook.manifest.json --profile diagnostic --json
uv run lo7-compass emit-bridge --manifest-path data/notebook.manifest.json --json
```

## What The Python Runtime Owns

- `notebook-manifest-v1` is the only mutable source of truth.
- Every block mutation creates a revision and an event record.
- WebSocket clients receive typed manifest and revision events from `/ws`.
- Compass render metadata and Gruff bridge payload refs persist back into the manifest.

The main manifest file defaults to:

`python-prototype/data/notebook.manifest.json`

## Required Craft Integration

Compass rendering is hard-required by default. Set a renderer command before calling `lo7-compass render` or starting the server in strict mode:

```bash
export LO7_CRAFT_RENDER_COMMAND="/absolute/path/to/craft-wrapper"
```

The wrapper contract is simple:

```text
craft-wrapper <input-json> <output-json> <profile> gruff_compass_x
```

It must write a JSON response like:

```json
{
  "artifact_path": "/absolute/path/to/render.png",
  "metadata": {
    "renderer": "craft-server"
  }
}
```

If you want to inspect the runtime without a live renderer, start the app with:

```bash
uv run notebook-engine --allow-missing-craft
```

## API Surface

Core endpoints:

- `GET /api/health`
- `GET /api/manifest`
- `PUT /api/manifest`
- `GET /api/grid`
- `GET /api/blocks`
- `POST /api/blocks`
- `DELETE /api/blocks/{id}`
- `POST /api/blocks/clear`
- `GET /api/revisions`
- `GET /api/events`
- `GET /api/exports/markdown`
- `POST /api/exports/csv-import?dry_run=true|false`
- `GET /api/compass/status`
- `POST /api/compass/render?profile=default|diagnostic|bridge`
- `GET /api/bridge/payload`
- `POST /api/bridge/payload`
- `WS /ws`

WebSocket event kinds emitted by the server:

- `hello`
- `manifest.updated`
- `revision.created`
- `compass.render.started`
- `compass.render.completed`
- `compass.render.failed`
- `export.generated`

## CLI Surface

The Python package now exposes three operator commands:

- `lo7-manifest`
  - `show`
  - `validate`
  - `watch`
  - `diff <other-manifest>`
- `lo7-heatmap`
- `lo7-compass`
  - `metrics`
  - `render`
  - `status`
  - `emit-bridge`

All three support `--manifest-path`, and the output-producing commands support `--json`.

## Repo Health Repairs Included

This integration also restores the referenced assets that were missing from the checkout:

- [`gruff-proportion-v1.schema.json`](/home/irfankabir/gruff/workspace/schemas/gruff-proportion-v1.schema.json)
- [`trust-event-v1.schema.json`](/home/irfankabir/gruff/workspace/schemas/trust-event-v1.schema.json)
- [`notebook-manifest-v1.schema.json`](/home/irfankabir/gruff/workspace/schemas/notebook-manifest-v1.schema.json)
- [`receiver.py`](/home/irfankabir/gruff/workspace/bridges/gruff-echoes/receiver.py)
- [`schema.sql`](/home/irfankabir/gruff/workspace/src/trust/schema.sql)
- [`LO7_NOTEBOOK_PROTOTYPE.md`](/home/irfankabir/gruff/workspace/docs/LO7_NOTEBOOK_PROTOTYPE.md)
- [`LO7_RUNBOOK.md`](/home/irfankabir/gruff/workspace/docs/LO7_RUNBOOK.md)
- [`PACKAGING.md`](/home/irfankabir/gruff/workspace/docs/PACKAGING.md)
- [`GRUFF_WALLBOARD_BRIDGE.md`](/home/irfankabir/gruff/workspace/docs/GRUFF_WALLBOARD_BRIDGE.md)

## Prototype Parity

Python is now the feature-complete runtime.

| Runtime | Status | Notes |
| --- | --- | --- |
| Python | Canonical | Manifest, revisions, events, heatmap, craft hook, Gruff bridge |
| Go | Secondary | Grid and block APIs remain healthy; no manifest or craft integration yet |
| Rust | Secondary | Grid baseline remains green; no manifest or bridge parity yet |

Reference docs:

- [LO7 notebook prototype](/home/irfankabir/gruff/workspace/docs/LO7_NOTEBOOK_PROTOTYPE.md)
- [LO7 runbook](/home/irfankabir/gruff/workspace/docs/LO7_RUNBOOK.md)
- [Packaging](/home/irfankabir/gruff/workspace/docs/PACKAGING.md)
- [Gruff wallboard bridge](/home/irfankabir/gruff/workspace/docs/GRUFF_WALLBOARD_BRIDGE.md)
