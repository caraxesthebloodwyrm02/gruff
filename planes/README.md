# Planes

**Planes** is the named layer for **runtime contracts, cross-service events, and deployment-facing artifacts** in the Gruff/GRID constellation. The `gruff` npm package and CLI do not require anything under `planes/` to run — this tree is the **workspace-level map** the `ingest` loop and `scripts/verify-planes.sh` walk when reconciling filesystem vs inventory.

Each subdirectory is a stable *bucket* that holds symlinks into the canonical source trees (`CascadeProjects/`, `canopy/`, `roots/`, …) plus occasional per-plane README/index files. See `design/ingestion-pattern.md` for the classification rules that assign a repo or file to a plane.

| Directory | Contents today | Purpose |
|-----------|----------------|---------|
| `artifacts/` | `GATE/`, `echoes-runtime/` | Generated specs, run manifests, and reviewed exports. |
| `bus/` | `shared-types/` | Event routing contracts, channel names, envelope shapes. |
| `contracts/` | `geometry-box/`, `shared-pipeline/`, `shared-resilience/`, `shared-types/` | JSON Schema / API agreements shared between services (versioned). |
| `infrastructure/` | `README.md`, `scripts-home/` | IaC snippets, service manifests, environment templates. |
| `runs/` | `DIO/`, `GRID-main/`, `echoes/` | Human-oriented run logs, experiment IDs, execution receipts (not app logs). |
| `services/` | 27 entries (MCP servers + core services) | One manifest per long-lived service the constellation depends on. |
| `surfaces/` | 16 entries + `tui-panels.md` | UI / TUI surface definitions: panel contracts, design-token links, Ink layout notes. `tui-panels.md` is canonical for the 4-quadrant gruff TUI. |

## Rules

- **Additions** go through the ingest loop (`discover → classify → link → register → verify`) — do not hand-link without updating the relevant `INVENTORY.md`.
- **Empty subdir** is acceptable as a placeholder; leave this README in place.
- **Removing** a subdir requires a deliberate prune commit with a note in the release log.
- **Symlink drift** is caught by `bash ./scripts/verify-planes.sh`; run it before committing plane changes.

See `racks/README.md` for the sibling layer (durable human-curated knowledge — gitignored by design).
