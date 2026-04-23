# Gruff — architecture snapshot

`@irfankabir002/gruff` is an npm package that provides:

1. **CLI + TUI** — Four-quadrant Ink interface (`gruff`) for MCP fleet and trust at a glance. Entry: [`src/cli.tsx`](../src/cli.tsx) → panel modules under `src/menu/panels/`.
2. **Trust layer** — SQLite in `~/.gruff/trust.sqlite`, fed by the optional **`gruff-ingester`** which tails `~/.echoes/audit.ndjson`. Scoring and tier transitions live in [`src/trust/scorer.ts`](../src/trust/scorer.ts).
3. **Proportion contract** — JSON schema [`schemas/gruff-proportion-v1.schema.json`](../schemas/gruff-proportion-v1.schema.json); [`gruff proportion`](../src/commands/proportion.ts) validates and POSTs to a stub or Echoes. Env: `GRUFF_ECHOES_URL`, `PORT` (default listener port for localhost URL).
4. **Design system** — Tokens in `design-system/` (build extracts `tokens.json`).

## Constellation layout

- **`bridges/gruff-echoes/`** — Python stub receiver; optional `ECHOES_URL` upstream forward.
- **`planes/`** — Long-lived **contracts, surfaces, and ops artifacts** (see [`planes/README.md`](../planes/README.md)). [`planes/surfaces/tui-panels.md`](../planes/surfaces/tui-panels.md) maps UI to env paths.
- **`racks/`** — Human-curated **knowledge** exports (see [`racks/README.md`](../racks/README.md)).

## Data flow (trust)

```mermaid
flowchart LR
  Echoes[Echoes audit] --> file[/.echoes/audit.ndjson]
  file --> ingester[gruff-ingester]
  ingester --> sqlite[trust.sqlite]
  sqlite --> tui[gruff TUI]
```

## Build

`npm run build` (tsup + token extraction) populates `dist/`. `npm test` runs unit tests. `prepublishOnly` runs build + `tsc --noEmit`.

## Maintainer notes

**Non-interactive exit**: `gruff` renders via Ink/React on a TTY. When stdout
is closed (e.g. `node dist/cli.js </dev/null`, piped output, or CI without a
pseudo-TTY), Ink detects the non-TTY environment and exits — this is expected
behaviour, not a crash. `scripts/orchestrate.sh smoke` pipes output through
`head -n 8` and treats any exit code as acceptable; seeing rendered output
lines before exit confirms the TUI started correctly.

**Native binding rebuild**: `better-sqlite3` embeds a native Node.js add-on
compiled against a specific `NODE_MODULE_VERSION`. After a Node.js major
upgrade (e.g. Node 22 → 24), run `npm rebuild better-sqlite3` in the repo
root to recompile the binding. The `wave1` unit tests and the `agency`
quadrant both rely on this binding at runtime.
