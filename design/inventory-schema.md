# Inventory Schema — `INVENTORY.md` Spec

Companion to the operational plan at `~/.claude/plans/understood-the-copy-quiet-ripple.md` and to `design/ingestion-pattern.md`. Defines the concrete format of `INVENTORY.md` so the register + verify steps have an unambiguous target, and so `scripts/verify-planes.sh` can parse rows without a markdown parser.

---

## §1 Column spec

| Column         | Type           | Required | Source / rule                                                                 |
|----------------|----------------|:--------:|--------------------------------------------------------------------------------|
| `path`         | string         | yes      | `realpath` of asset, rendered relative to `~/workspace/`                       |
| `kind`         | enum           | yes      | package / mcp-server / app / lib / script-bundle / skill-bundle / plugin / submodule-alias / template / archive / doc / undeclared |
| `plane`        | enum           | yes      | services / runs / artifacts / surfaces / contracts / bus / infrastructure / `—` |
| `status`       | enum           | yes      | active / archived / stub / undeclared / submodule-alias                        |
| `last-scanned` | ISO-8601 UTC   | yes      | `date -u +%FT%TZ` captured at scan time                                        |
| `size`         | human          | yes      | `du -sh` for directories; line count (`Nℓ`) for single-file bundles            |
| `owner`        | string         | yes      | `git log -1 --format=%ae` on canonical path; fallback `prince`; `archived` if archived |
| `aliases`      | string         | no       | comma-separated symlink sources resolving to this `realpath`                   |
| `notes`        | string         | no       | one-line free-text; submodule-alias pointer encoded here as `→ <canonical>`    |

---

## §2 Sort order + grouping

- **Primary group:** `plane`, fixed order, each rendered as an H2 heading:
  1. `services`
  2. `runs`
  3. `artifacts`
  4. `surfaces`
  5. `contracts`
  6. `bus`
  7. `infrastructure`
  8. `—` (unassigned / template / doc)
- **Within group:** `status` ordinal (active → stub → submodule-alias → undeclared → archived), then `kind` alphabetical, then `path` alphabetical.
- **Archived rows** collapsed under a `<details><summary>archived</summary>…</details>` block per plane. Keeps them discoverable without dominating the view.
- **Undeclared rows** live in a terminal H2 **"Undeclared"** section *regardless of plane* (plane column reads `—`). This makes the triage queue a first-class artifact.

---

## §3 Auto-classification heuristics

Decision list — **first match wins**. Applied during the `classify` step.

| Signal                                                                   | → `kind`          | → `plane`        |
|--------------------------------------------------------------------------|-------------------|------------------|
| file ends in `.skill`                                                    | `skill-bundle` (via container) | `—`  |
| `package.json` has `"mcp"` key OR deps include `@modelcontextprotocol/*` | `mcp-server`      | `services`       |
| `package.json` + `next.config.*`                                         | `app`             | `surfaces`       |
| `package.json` + `src/server.ts` (ESM)                                   | `mcp-server`      | `services`       |
| `package.json` without next/server markers, TS types exposed             | `package`         | `contracts`      |
| `package.json` without next/server markers, UI components                | `package`         | `surfaces`       |
| `pyproject.toml` + `docker-compose*.yml`                                 | `app`             | `runs`           |
| `pyproject.toml` + FastAPI / uvicorn dependency                          | `app`             | `runs`           |
| `pyproject.toml` without app markers                                     | `lib`             | `contracts`      |
| directory listed in parent repo's `.gitmodules`                          | `submodule-alias` | (inherit canonical) |
| `plugin.yaml` or `manifest.json` at root                                 | `plugin`          | `services`       |
| path segment equals `archive` (case-sensitive)                           | (unchanged)       | override `status:archived` |
| path segment equals `templates`                                          | `template`        | `—`              |
| directory contains only `README.md` (+ maybe `LICENSE`)                  | `doc`             | `—`              |
| **fallback**                                                             | `undeclared`      | `—` (status:undeclared) |

The `archive` rule is a **status override**, not a kind classifier — it runs after kind is assigned so an archived MCP server is still recognizable as one.

---

## §4 Freshness-check format (parseable by `verify-planes.sh`)

### Header block

Top of `INVENTORY.md` — strict format so the shell script can `grep` reliably:

```
<!-- inventory-schema: v1 -->
<!-- last-full-scan: 2026-04-19T12:00:00Z -->
<!-- staleness-threshold-days: 14 -->
```

Exactly three comment lines, leading `<!-- ` and trailing ` -->` required. `verify-planes.sh` parses these with:

```
grep -oE '<!-- last-full-scan: [^ ]+ -->' INVENTORY.md
```

### Per-row check

For each parsed row, compare the row's `last-scanned` against `stat -c %Y <path>`:

- mtime newer than `last-scanned` → emit `STALE <path>`
- path does not exist on disk → emit `MISS <path>`

Output vocabulary extends the existing `verify-planes.sh` set (`ok` / `skip` / `DRIFT`) with `STALE` and `MISS`. No existing tokens are repurposed.

### Row regex (shell-parseable)

```
^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(active|archived|stub|undeclared|submodule-alias)\s*\|\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s*\|
```

Captures: `path`, `kind`, `plane`, `status`, `last-scanned`. Five groups — sufficient for freshness + drift correlation without awk gymnastics. The regex anchors on `^|` so heading/separator rows and prose are ignored.

---

## §5 Minimal example

Rendered excerpt showing header, one active MCP server, and one archived repo so an implementer has a concrete target.

```markdown
<!-- inventory-schema: v1 -->
<!-- last-full-scan: 2026-04-19T12:00:00Z -->
<!-- staleness-threshold-days: 14 -->

## services

| path | kind | plane | status | last-scanned | size | owner | aliases | notes |
|---|---|---|---|---|---|---|---|---|
| CascadeProjects/Tools/MCPServers/afloat-server | mcp-server | services | active | 2026-04-19T12:00:00Z | 4.2M | caraxesthebloodwyrm02@gmail.com |  |  |

## —

<details><summary>archived</summary>

| path | kind | plane | status | last-scanned | size | owner | aliases | notes |
|---|---|---|---|---|---|---|---|---|
| seed/archive/Atmosphere | archive | — | archived | 2026-04-19T12:00:00Z | 88M | archived |  | legacy |

</details>
```

The regex in §4 applied to the afloat-server row captures:

1. `CascadeProjects/Tools/MCPServers/afloat-server`
2. `mcp-server`
3. `services`
4. `active`
5. `2026-04-19T12:00:00Z`
