# Planes

**Planes** is the named layer for **runtime contracts, cross-service events, and deployment-facing artifacts** in the Gruff/GRID constellation. Each subdirectory is a *bucket* for future or optional material; nothing here is required for the `gruff` npm package or CLI to run.

| Directory | Purpose |
|-----------|---------|
| `bus/` | Event routing contracts, channel names, and envelope shapes between services. |
| `contracts/` | JSON Schema / API agreements shared between services (versioned files). |
| `infrastructure/` | IaC snippets, k8s/service manifests, or environment templates (as needed). |
| `runs/` | Human-oriented run logs, experiment IDs, or execution receipts (not app logs). |
| `services/` | One manifest or README per long-lived service the constellation depends on. |
| `surfaces/` | UI or TUI “surface” definitions: panel contracts, design tokens links, Ink layout notes. |
| `artifacts/` | Build outputs, exported bundles, or generated specs checked in for review. |

If a subfolder stays unused, keep this README and leave the directory empty, or remove the folder after a deliberate prune (see `racks/README.md` and release notes).
