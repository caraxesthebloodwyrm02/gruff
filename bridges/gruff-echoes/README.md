# gruff-echoes bridge

Python **stdlib-only** HTTP receiver in [`receiver.py`](./receiver.py) that validates `gruff-proportion-v1` JSON and responds **202** for local/contract tests.

## Local stub — current implementation

- **Bind:** `127.0.0.1:8765` by default (override with `PORT` env var).
- **Path:** `POST /gruff/proportion`
- **Behavior:** validates payload against required fields + weight sum, prints summary, returns `202 Accepted`. No upstream forwarding and no persistence — contract testing only.
- **Start:** `python3 bridges/gruff-echoes/receiver.py`

## Echoes FastAPI (upstream) — TBD

Echoes is the stack's FastAPI app. Local dev is typically **Uvicorn on port 8000**. There is not yet a `POST /gruff/proportion` route in the Echoes codebase — treat the real ingest endpoint as **deployment-specific / TBD** until the Echoes service exposes a matching route.

**Discovery steps:**
1. Run Echoes locally (`uvicorn app.main:app --reload`).
2. List available routes: `GET http://127.0.0.1:8000/openapi.json` or open `/docs`.
3. Confirm the agreed proportion-ingest path with the team.
4. Set `ECHOES_URL` (see below) once the endpoint is confirmed.

## Env vars (planned — Wave 1)

The following env vars are designed but **not yet wired** in `receiver.py` or `src/commands/proportion.ts`. They are documented here so Wave 1 work has a clear contract to implement against.

| Variable | Component | Purpose |
|----------|-----------|---------|
| `ECHOES_URL` | `receiver.py` | Full upstream URL. When set, receiver forwards the validated raw body to Echoes after responding 202. **Not yet implemented.** |
| `ECHOES_TOKEN` | `receiver.py` | Optional Bearer token. Forwarded requests include `Authorization: Bearer <token>`. **Not yet implemented.** |
| `GRUFF_ECHOES_URL` | `src/commands/proportion.ts` | Overrides the default `127.0.0.1:8765` target, letting `gruff proportion` POST directly to Echoes. **Not yet implemented** — currently only `PORT` affects the target host. |

**Auth:** For other schemes, extend `receiver.py` (e.g. custom headers from env).

## CLI alignment

`gruff proportion` currently targets `http://127.0.0.1:${PORT ?? 8765}/gruff/proportion`. Point it at the stub while developing locally. Direct Echoes targeting via `GRUFF_ECHOES_URL` is Wave 1 work (`src/commands/proportion.ts`).
