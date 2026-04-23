# gruff-echoes bridge

Python **stdlib-only** HTTP receiver in [`receiver.py`](./receiver.py) that validates `gruff-proportion-v1` JSON and responds **202** to the local client.

## Local listener (this repo)

- **Bind:** `127.0.0.1:8765` by default (override with `PORT`).
- **Path:** `POST /gruff/proportion`
- **Behavior:** validate body (required keys + weight sum), print a short line to stdout, return **`202 Accepted`**. The client always gets 202 if validation passed — even if an optional upstream forward fails (failures are logged to stderr only).
- **Start:** `python3 bridges/gruff-echoes/receiver.py`

## Optional upstream (Echoes / FastAPI)

If **`ECHOES_URL`** is set, the receiver POSTs the **same raw body** to that URL after sending 202 to the local caller. Use **`ECHOES_TOKEN`** (optional) for `Authorization: Bearer …`. See [`receiver.py`](./receiver.py). Upstream errors do not change the local 202 response.

The **real** Echoes route for proportion payloads is still **team-specific** until the Echoes service ships a matching path — discover via OpenAPI (`/docs` or `GET /openapi.json`) on the running app (e.g. port **8000** in many dev setups).

| Variable       | Where            | Purpose |
| -------------- | ---------------- | ------- |
| `ECHOES_URL`   | `receiver.py`    | Full URL; when set, forward validated body upstream after local 202. |
| `ECHOES_TOKEN` | `receiver.py`    | Optional bearer token for upstream. |
| `PORT`         | `receiver.py`    | Local listener port (default `8765`). |

## CLI (`gruff proportion`)

`gruff proportion` posts to an HTTP URL from **`GRUFF_ECHOES_URL`**, or if unset, to `http://127.0.0.1:${PORT}/gruff/proportion` (default port **8765**). See [`src/commands/proportion.ts`](../src/commands/proportion.ts).

**Discovery:** (1) Run Echoes locally, (2) confirm path + auth, (3) set `GRUFF_ECHOES_URL` or run the Python stub and point the CLI at it.
