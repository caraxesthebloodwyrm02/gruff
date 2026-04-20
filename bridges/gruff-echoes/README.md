# GRUFF proportion bridge (Echoes stub)

The Cursor canvas `~/.cursor/projects/<workspace>/canvases/gruff-wallboard.canvas.tsx` cannot open network connections. Copy the proportion JSON from the canvas, then POST it here (or to the real Echoes service once implemented).

## Run the stub

```bash
cd ~/workspace
python3 bridges/gruff-echoes/receiver.py
```

Default port is **8765**. If you see `Address already in use`, an old stub is still running. Free the port:

```bash
kill $(lsof -t -iTCP:8765 -sTCP:LISTEN)
```

Or use another port:

```bash
PORT=8766 python3 bridges/gruff-echoes/receiver.py
# curl ... http://127.0.0.1:8766/gruff/proportion
```

**GET vs POST:** Only **POST** accepts proportion JSON. A **GET** on `/gruff/proportion` returns **405** with a small JSON hint (for “is the server up?” checks without spamming tracebacks).

## curl example

Save JSON from the canvas **Copy JSON** button into `proportion.json`, then:

```bash
curl -sS -X POST http://127.0.0.1:8765/gruff/proportion \
  -H 'Content-Type: application/json' \
  -d @proportion.json
```

Or use the helper (from repo root):

```bash
chmod +x bridges/gruff-echoes/push-proportion.sh   # once
./bridges/gruff-echoes/push-proportion.sh bridges/gruff-echoes/examples/proportion-v1.example.json
```

Expected: HTTP `202` and `{"ok": true, "accepted": true, ...}`.

Fixture in this repo:

```bash
curl -sS -X POST http://127.0.0.1:8765/gruff/proportion \
  -H 'Content-Type: application/json' \
  -d @bridges/gruff-echoes/examples/proportion-v1.example.json
```

## Schema

See [`schemas/gruff-proportion-v1.schema.json`](../schemas/gruff-proportion-v1.schema.json).

## Production Echoes

Mount an equivalent route on the Echoes FastAPI app (e.g. `POST /gruff/proportion`), reuse the same JSON body, map `audioDrive` and `metrics.modulated` into DSP parameters per `docs/GRUFF_WALLBOARD_BRIDGE.md`.
