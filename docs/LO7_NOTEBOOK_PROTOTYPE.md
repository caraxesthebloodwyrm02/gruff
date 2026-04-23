# LO7 Notebook Prototype

The canonical LO7 runtime now lives in `python-prototype`.

- State persists to `python-prototype/data/notebook.manifest.json`
- Runtime service owns blocks, revisions, events, compass artifacts, and bridge payload refs
- Browser UI talks to the manifest-backed API and WebSocket stream

Quick start:

```bash
cd python-prototype
uv run notebook-engine --manifest-path data/notebook.manifest.json
```
