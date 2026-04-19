# Workspace

Plane-grouped view over the `CascadeProjects/` monorepo.

## Navigate

- **`planes/`** — architectural view (bus, services, runs, artifacts, surfaces, contracts, infrastructure)
- **`CascadeProjects/`** — canonical source (monorepo; dirty branch preserved)
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
rm -rf ~/workspace/{planes,racks,design-system,hogsmade-design,scripts} \
       ~/workspace/{SPEC.md,CENTRAL_PLAZA.md,WORKSPACE_GATES.md,CLAUDE.md,AGENTS.md,README.md} \
       ~/workspace/{.gitignore,workspace.code-workspace}
```

`CascadeProjects/` and `~/.echoes/` are untouched by rollback.
