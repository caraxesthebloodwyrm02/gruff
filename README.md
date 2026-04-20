# Workspace

Plane-grouped view over the `CascadeProjects/` monorepo (tracked as a **git submodule** to `hogsmade`).

## Clone

```bash
git clone --recurse-submodules https://github.com/caraxesthebloodwyrm02/workspace.git ~/workspace
cd ~/workspace && git submodule update --init --recursive   # if you cloned without --recurse-submodules
```

## Navigate

- **`planes/`** — architectural view (bus, services, runs, artifacts, surfaces, contracts, infrastructure)
- **`CascadeProjects/`** — canonical source (hogsmade monorepo; submodule on `main`)
- **`racks/`** — cognitive overlay (patterns, routines, profiles, learning)
- **`design-system/`** — GRID design tokens + assets (read-only reference)
- **`hogsmade-design/`** — architecture sketches (Cockpit + Audit HTML)
- **`scripts/`** — on-demand tools (`verify-planes.sh` drift check)
- **`bridges/gruff-echoes/`** — local POST stub for GRUFF **proportion** JSON (Echoes contract rehearsal; see `bridges/gruff-echoes/README.md`)
- **`schemas/`** — JSON Schema for proportion v1 (`gruff-proportion-v1.schema.json`)

## Onboarding and ambiance

- **`docs/ONBOARDING.md`** — routine: **school/study** vs **workspace/market**, modes **read-write → practice-apply → research-test**, ambiance-first codebase walkthroughs
- **`docs/the-elevator-ride.md`** — draft: personal pacing, floors vs cab, **laps** and **curvature**, tying agent streams to named floors
- **`CONTRIBUTING.md`** — open source, submodule vs umbrella PRs, commits, review expectations

## Read

- **`docs/FOURFOLD_NEIGHBORHOOD.md`** — fourfold doc cascade (**LICENSE**, **DESIGN.md**, **Makefile**, **INSTRUCTION.md**) with **REFERENCE.md** as index; nearest-neighbor map and agent voices
- **`docs/SIXTEENFOLD_NEIGHBORHOOD.md`** — **16-fold** map: four **strata** (umbrella, hogsmade submodule, GRID nested submodule, operator overlay) × four **archetypes** (covenant, cartography, circuit, cadence); submodule chain + voice per fold
- **`docs/FOUR_ON_THE_FLOOR.md`** — foundation **snap** (~92%+); run **`make fourfold-snap`** to verify the root fourfold + session seal
- **`REFERENCE.md`** — one-hop index to SPEC, CLAUDE, CONTRIBUTING, nested `AGENTS.md` paths
- **`docs/GRUFF_WALLBOARD_BRIDGE.md`** — GRUFF wall board canvas + proportion contract + Echoes bridge (operator flow, audio mapping, dual-fold naming)
- **`SPEC.md`** — architecture, vision, governance, known issues
- **`CENTRAL_PLAZA.md`** — plaza/district navigational UX (location vocabulary)
- **`WORKSPACE_GATES.md`** — 6-stage gated execution protocol
- **`CLAUDE.md`** + **`AGENTS.md`** — agent charters (workspace-scoped)

## Open

```bash
code ~/workspace/workspace.code-workspace       # VS Code
windsurf ~/workspace/workspace.code-workspace   # Windsurf
```

Multi-root workspace includes `bridges/` and `schemas` when opened via `workspace.code-workspace`. The **GRUFF wall board** Cursor canvas lives under `~/.cursor/projects/<workspace>/canvases/gruff-wallboard.canvas.tsx` (IDE artifact, not in this repo).

## Roll back

```bash
rm -rf ~/workspace/{racks,design-system,hogsmade-design,scripts} \
       ~/workspace/{SPEC.md,CENTRAL_PLAZA.md,WORKSPACE_GATES.md,CLAUDE.md,AGENTS.md,README.md} \
       ~/workspace/{.gitignore,workspace.code-workspace}
```

`planes/` and `CascadeProjects/` (submodule) are part of this repository; remove them only if you intend to drop the submodule checkout from your working tree. `~/.echoes/` is always local-only.
