# Gruff Wallboard Bridge

The gruff Python runtime emits `gruff-proportion-v1` payloads for the existing Gruff proportion flow.

- Schema: `schemas/gruff-proportion-v1.schema.json`
- MCP tool: `record_gruff_proportion` (echoes-server)
- Payload builder: `python-prototype/src/gruff/bridge.py`

The tool persists payloads to `~/.echoes/gruff-proportions.ndjson` and writes a corresponding audit entry.
