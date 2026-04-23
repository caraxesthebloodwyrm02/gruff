# Contributing

The root **`LICENSE`** (**Apache License 2.0**) applies to this umbrella repository. The **`CascadeProjects/`** submodule publishes its **own** terms (currently **MIT** in `CascadeProjects/LICENSE` — unchanged here). For how these files connect, see **`docs/FOURFOLD_NEIGHBORHOOD.md`** and **`docs/REFERENCE.md`**.

## Repositories

| Repo | Role | Typical PRs |
|------|------|-------------|
| **workspace** (this repo) | Umbrella: `planes/`, `racks/`, docs, `CascadeProjects` **submodule pointer**, workspace glue | Layout, governance docs, review bundles, bridges/schemas next to the umbrella |
| **hogsmade** (`CascadeProjects/` submodule) | Monorepo: MCP servers, `shared-types`, apps | Feature work, server changes, `Components/*` packages (e.g. `geometry-box`) |

**Rule of thumb:** code that **builds and ships** as services or libraries usually belongs in **hogsmade**; **orchestration, operator docs, and symlink views** stay in **workspace**.

## Submodule

- After pulling, run: `git submodule update --init --recursive`
- To bump the pointer: commit inside `CascadeProjects/` on its remote, then commit the updated submodule reference in workspace.

## Commits

- Prefer **conventional** prefixes: `feat`, `fix`, `docs`, `chore`, `test`, as already used in this ecosystem.
- Keep commits **focused**; unrelated drive-by edits make review harder.

## Agents and automation

- Follow [`AGENTS.md`](AGENTS.md) and workspace [`CLAUDE.md`](CLAUDE.md) for agent defaults and data contracts (e.g. audit stream vs GRUFF proportion payloads).
- Do not put secrets in the tree; use environment variables and local-only paths documented in `CLAUDE.md`.

## Code review

- For workspace PRs: confirm `docs/SPEC.md` alignment when changing planes or gates.
- For hogsmade PRs: run package `test` / `typecheck` as indicated in each `package.json`.

## Conduct

- Be direct and respectful; assume good intent.
- For security-sensitive reports, use maintainer-preferred private channels if published in repo metadata.

## Questions

- Architecture: [`docs/SPEC.md`](docs/SPEC.md)
- Plaza language vs plane roles: [`docs/CENTRAL_PLAZA.md`](docs/CENTRAL_PLAZA.md) + SPEC §5
- Onboarding paths: [`docs/ONBOARDING.md`](docs/ONBOARDING.md)
