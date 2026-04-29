# Router + Ingester Operations Runbook

## Router Config Recovery

1. Validate router config:

```bash
node dist/cli.js route-config validate
```

2. If invalid, restore baseline config:

```bash
cp router_agents.json router_agents.json.bak.$(date +%s)
# then restore from VCS or known-good copy
```

3. Re-run validation and confirm route command works:

```bash
node dist/cli.js route-config validate
node dist/cli.js route proportion notebook-engine
```

## Ingester Replay / Recovery

State and data paths:

- Audit log: `~/.echoes/audit.ndjson`
- Ingester state: `~/.gruff/ingester.state`
- Trust DB: `~/.gruff/trust.sqlite`

1. Stop timer/service if running:

```bash
systemctl --user stop gruff-ingester.timer gruff-ingester.service
```

2. Optional snapshot of DB and state:

```bash
cp ~/.gruff/trust.sqlite ~/.gruff/trust.sqlite.bak.$(date +%s)
cp ~/.gruff/ingester.state ~/.gruff/ingester.state.bak.$(date +%s)
```

3. Force replay from beginning by resetting offset:

```bash
cat > ~/.gruff/ingester.state <<'JSON'
{"offset":0,"last_ts":"","malformed_count":0}
JSON
```

4. Run one-shot ingest:

```bash
node dist/trust/ingester.js
```

5. Re-enable automation:

```bash
systemctl --user start gruff-ingester.timer
```

## Runtime Gate

Ingestion is paused by default. The process exits immediately with an
informational message unless the gate is enabled:

```bash
GRUFF_TRUST_SCORES_ENABLED=true node dist/trust/ingester.js
```

To enable persistently via systemd:

```bash
systemctl --user edit gruff-ingester.service
# Add under [Service]:
# Environment=GRUFF_TRUST_SCORES_ENABLED=true
```

When the gate is off, `node dist/trust/ingester.js` exits 0 and writes:

```
[gruff-ingester] paused: set GRUFF_TRUST_SCORES_ENABLED=true to enable ingestion
```

## Troubleshooting

- `MALFORMED_AUDIT_LINE` warnings: verify NDJSON source is newline-delimited valid JSON.
- No actor data in CLI: ensure ingester state offset advances and `events` table has rows.
- Duplicate rows: dedupe is fingerprint-based; verify replay is against same normalized event payloads.
