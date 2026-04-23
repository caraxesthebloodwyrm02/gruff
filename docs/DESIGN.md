# Design — umbrella shape

This file is **fold 2** of the [fourfold neighborhood](FOURFOLD_NEIGHBORHOOD.md): **cartography** — what exists, how it borders other systems, and where change belongs.

## What this workspace is

- **Umbrella repo**: `planes/` (symlink map), `racks/` (cognitive overlay), `bridges/`, `schemas/`, top-level docs — plus **`CascadeProjects/`** as a **git submodule** to the hogsmade monorepo (canonical app and MCP server source).
- **Not duplicated here**: day-to-day service and package development inside the monorepo; see submodule layout in [`AGENTS.md`](../AGENTS.md) and [`REFERENCE.md`](REFERENCE.md).

## Boundaries

| Concern | Lives here (umbrella) | Lives in submodule |
|--------|------------------------|-------------------|
| Operator docs, gates, plaza language | Yes | Sometimes mirrored |
| MCP servers, shared packages, apps | No (consume via submodule) | Yes |
| GRID product tree | Nested under `CascadeProjects/Projects/GRID-main` | Own repo history |

## Nearest neighbors

| Neighbor | Why |
|----------|-----|
| [`LICENSE`](../LICENSE) | **Apache-2.0** for this umbrella tree; submodule has its own [`CascadeProjects/LICENSE`](../CascadeProjects/LICENSE). |
| [`INSTRUCTION.md`](INSTRUCTION.md) | How to clone, sync submodule, run verification — procedural layer. |
| [`Makefile`](../Makefile) | Automatable gates (`verify-planes`, format hooks if added). |
| [`REFERENCE.md`](REFERENCE.md) | Canonical index: SPEC, CLAUDE, nested `AGENTS.md` paths. |

## Agent voices (from `AGENTS.md`)

Use these as **lenses**, not personalities to role-play:

- **`prince-runtime-intel`** — default implementation path: full Mangrove ecosystem, coding tasks.
- **`hermes`** — cross-project mediation: submodule bumps, `CascadeProjects` ↔ umbrella alignment.
- **`caraxes`** — marketplace and plugin scouting — peripheral until you integrate third-party surfaces.

Nested repos (for example **GRID-main**) carry their own [`AGENTS.md`](../CascadeProjects/Projects/GRID-main/AGENTS.md): four debugging **windows** (Python, frontend, Electron, landing) — read that file before widening scope there.

**Floor snap:** root fourfold closure (~92%+) — [`FOUR_ON_THE_FLOOR.md`](FOUR_ON_THE_FLOOR.md); verify with `make fourfold-snap`.
