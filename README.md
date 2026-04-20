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

## Read

- **`SPEC.md`** — architecture, vision, governance, known issues
- **`CENTRAL_PLAZA.md`** — plaza/district navigational UX (location vocabulary)
- **`WORKSPACE_GATES.md`** — 6-stage gated execution protocol
- **`CLAUDE.md`** + **`AGENTS.md`** — agent charters (workspace-scoped)

## Open

```bash
code ~/workspace/workspace.code-workspace       # VS Code
windsurf ~/workspace/workspace.code-workspace   # Windsurf
```

18 folders pre-grouped by plane.

## Roll back

```bash
rm -rf ~/workspace/{racks,design-system,hogsmade-design,scripts} \
       ~/workspace/{SPEC.md,CENTRAL_PLAZA.md,WORKSPACE_GATES.md,CLAUDE.md,AGENTS.md,README.md} \
       ~/workspace/{.gitignore,workspace.code-workspace}
```

`planes/` and `CascadeProjects/` (submodule) are part of this repository; remove them only if you intend to drop the submodule checkout from your working tree. `~/.echoes/` is always local-only.
