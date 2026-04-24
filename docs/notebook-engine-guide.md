# Notebook Engine Guide

The canonical LO7 notebook runtime now lives in `python-prototype/` (at the repo root). It is manifest-first, revisioned, and bridge-aware.

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
- `PUT /api/manifest?expected_revision_id=<optional>`
- `GET /api/grid`
- `GET /api/blocks`
- `POST /api/blocks?expected_revision_id=<optional>`
- `DELETE /api/blocks/{id}?expected_revision_id=<optional>`
- `POST /api/blocks/clear?expected_revision_id=<optional>`
- `GET /api/revisions`
- `GET /api/events`
- `GET /api/exports/markdown`
- `POST /api/exports/csv-import?dry_run=true|false&partial=true|false&expected_revision_id=<optional>`
- `GET /api/compass/status`
- `POST /api/compass/render?profile=default|diagnostic|bridge`
- `GET /api/bridge/payload`
- `POST /api/bridge/payload`
- `WS /ws`

WebSocket protocol notes:

- Every frame includes a monotonic integer **`evt`** (including `hello`) so clients can **de-dupe** replays or double-deliveries.
- The initial **`hello`** also includes **`revisionId`** (current head), **`manifest`**, **`blocks`**, and a short **`revisions`** tail.
- Each `send_json` uses a **per-connection timeout** (default 5s); slow or dead peers are dropped from the hub so broadcasts do not wedge.

Event kinds emitted by the server:

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

## Concurrency and imports

- **Optimistic concurrency:** Any mutating block endpoint, full manifest replace, and CSV import accept optional `expected_revision_id` (the client’s last seen `current_revision_id`). When it does not match the server head, the API returns **409** so concurrent editors do not silently clobber each other.
- **CSV import:** Rows are validated (integer bounds, margin rules, allowed tones). Without `partial=true`, a single bad row aborts the import (**422** with a per-row `errors` list). With `partial=true`, well-formed rows are committed and bad rows are reported in `errors` (`skipped_count` reflects invalid rows).

## History size (manifest growth)

- Revisions and events are capped in the primary manifest file (default **500** entries; minimum enforced in code is **2** for sanity). Older pairs are **appended** to a sidecar archive: `notebook.manifest.json.history.jsonl` next to the manifest. Startup and in-process diffs stay bounded; use the archive for long-term audit if needed.

## Prototype Parity

Python is the feature-complete runtime. **Go and Rust are intentionally frozen** at their current scope (grid-oriented baselines): they are not chasing Python feature parity until a milestone is explicitly planned. That avoids silent drift and duplicate maintenance.

**Minimal parity roadmap (when you choose to un-freeze):**

1. Shared wire types / JSON schema for `notebook-manifest-v1` and revision events.
2. Read-only manifest load + block CRUD with the same `expected_revision_id` rules.
3. Optional: WebSocket event shape alignment with Python’s `/ws` contract.

| Runtime | Status | Notes |
| --- | --- | --- |
| Python | Canonical | Manifest, revisions, events, heatmap, craft hook, Gruff bridge |
| Go | Frozen secondary | Grid baseline; no manifest/craft/bridge parity unless scoped |
| Rust | Frozen secondary | Grid baseline; no manifest/craft/bridge parity unless scoped |

Reference docs:

- [LO7 notebook prototype](LO7_NOTEBOOK_PROTOTYPE.md)
- [LO7 runbook](LO7_RUNBOOK.md)
- [Packaging](PACKAGING.md)
- [Gruff wallboard bridge](GRUFF_WALLBOARD_BRIDGE.md)
