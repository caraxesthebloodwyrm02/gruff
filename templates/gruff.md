# Gruff in this directory

[Gruff](https://github.com/caraxesthebloodwyrm02/gruff) is a workspace cockpit: design-system tokens, a four-quadrant TUI, and a trust-routing / actor-scoring layer over your MCP audit stream (`~/.echoes/audit.ndjson` → `~/.gruff/trust.sqlite`).

## Common commands

| Command | What it does |
|--------|----------------|
| `gruff` | Open the 4-quadrant TUI (MCP, trust, routes, horizon). |
| `gruff actors` | List or inspect actor trust profiles from the local trust DB. |
| `gruff route` | Show or exercise routing decisions tied to the trust tier system. |
| `gruff proportion` | Validate a `gruff-proportion-v1` JSON document (schema) and POST it to the configured proportion endpoint. |
| `gruff init-automation` | Register systemd user timer for `gruff-ingester`. |

## Docs

- Package README and schemas ship with the npm package; see `schemas/gruff-proportion-v1.schema.json` for the proportion payload.

Use `gruff init` in a project folder to drop this file and optional automation.
