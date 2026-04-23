# Gruff Wallboard Bridge

The LO7 notebook emits `gruff-proportion-v1` payloads for the existing Gruff proportion flow.

- Receiver stub: `bridges/gruff-echoes/receiver.py`
- Schema: `schemas/gruff-proportion-v1.schema.json`
- Local default endpoint: `http://127.0.0.1:8765/gruff/proportion`

Run the stub:

```bash
python3 bridges/gruff-echoes/receiver.py
```
