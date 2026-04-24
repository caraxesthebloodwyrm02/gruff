# LO7 Runbook

Daily flow:

1. Generate or open a manifest with `lo7-manifest show`.
2. Start the notebook server with `uv run notebook-engine`.
3. Render heatmap output with `uv run lo7-heatmap`.
4. Render compass output with `uv run lo7-compass render`.
5. Emit bridge payload with `uv run lo7-compass emit-bridge`.

Required env for craft render:

```bash
export LO7_CRAFT_RENDER_COMMAND="/path/to/craft-wrapper"
```

Audit emission to trust ingester stream:

```bash
# default sink: ~/.echoes/audit.ndjson
export LO7_DISABLE_AUDIT_EMIT=0
# optional override
export LO7_AUDIT_PATH="/abs/path/audit.ndjson"
```

Operator procedures for router config recovery and ingester replay:

- [OPERATIONS_ROUTER_INGESTER.md](/home/irfankabir/gruff/workspace/docs/OPERATIONS_ROUTER_INGESTER.md)

---

## Manifest Retention & Compaction

The manifest maintains an inline history of revisions and events. Over time this grows unbounded; compaction archives the oldest records while keeping the current head valid.

### Retention Policy Knobs (in `notebook.manifest.json`)

| Field | Default | Description |
|-------|---------|-------------|
| `max_revisions` | `100` | Max inline revisions before compaction triggers |
| `max_events` | `200` | Max inline events before compaction triggers |
| `archive_path` | `null` | Path to archive artifact (set automatically after first compaction) |
| `next_revision_number` | — | Monotonic counter — **never derive from `len(revisions)`** |
| `next_event_sequence` | — | Monotonic counter — **never derive from `len(events)`** |

### CLI: Estimate Impact (Dry Run)

```bash
uv run lo7-compact --manifest-path data/notebook.manifest.json --dry-run
```

Output example:
```json
{
  "counts": {
    "pruned_revisions": 5,
    "pruned_events": 5,
    "excess_revisions": 5,
    "excess_events": 5
  },
  "current_revision_id": "rev-abc123",
  "next_revision_number": 47
}
```

### CLI: Execute Compaction

```bash
# Default retention (dry-run):
uv run lo7-compact --manifest-path data/notebook.manifest.json

# Override knobs inline:
uv run lo7-compact \
  --manifest-path data/notebook.manifest.json \
  --max-revisions 50 \
  --max-events 100 \
  --execute
```

### API: Dry Run

```bash
curl -X POST "http://localhost:8080/api/manifest/compact?dry_run=true"
```

### API: Execute

```bash
curl -X POST "http://localhost:8080/api/manifest/compact?dry_run=false"
```

Response:
```json
{
  "dry_run": false,
  "pruned_revisions": 5,
  "pruned_events": 5,
  "archive_path": "data/notebook.manifest.archive.json",
  "current_revision_id": "rev-abc123"
}
```

### Crash Safety

Compaction writes in this order:
1. **Archive artifact** → temp file → `fsync` → atomic `rename`
2. **Manifest rewrite** → temp file → `fsync` → atomic `rename`

If Step 1 fails, the manifest is untouched. If Step 2 fails, the archive is written but the manifest roll is rolled back. Always check `archive_path` in the response after execution.

### Restore from Archive

If a manifest is corrupted or you need to recover historical state:

1. **Identify the archive file:**
   ```bash
   cat data/notebook.manifest.archive.json | jq '.archived_at, .notebook_id'
   ```

2. **View archived revisions:**
   ```bash
   cat data/notebook.manifest.archive.json | jq '.pruned_revisions[] | .revision_id, .summary'
   ```

3. **Reconstruct a full history** (merge archive + current):
   ```python
   import json
   from pathlib import Path
   from notebook_engine.manifest import NotebookManifest

   manifest = NotebookManifest.model_validate_json(Path("data/notebook.manifest.json").read_text())
   archive = json.loads(Path("data/notebook.manifest.archive.json").read_text())

   # Full history: archived oldest + current newest
   archived_revs = [NotebookRevision.model_validate(r) for r in archive['pruned_revisions']]
   full_revisions = archived_revs + manifest.revisions
   ```

4. **Write merged manifest** (optional — only if you want a single-file history):
   ```python
   manifest.revisions = full_revisions
   manifest.max_revisions = 999999  # disable future compaction
   manifest.save()
   ```

5. **Verify integrity**:
   ```bash
   uv run lo7-manifest validate --manifest-path data/notebook.manifest.json
   ```

### Monitoring

After compaction, `next_revision_number` and `next_event_sequence` continue incrementing — they are never reset. If you see these numbers jump unexpectedly, a compaction has occurred.
