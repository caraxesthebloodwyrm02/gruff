# Repository Guidelines

## Agent Registry

| Chain Position | Agent                  | Routing Role                                                              | Artifact Type    | Output Format | Default          | Definition                                 |
| -------------- | ---------------------- | ------------------------------------------------------------------------- | ---------------- | ------------- | ---------------- | ------------------------------------------ |
| 1 — Intake     | `prince-runtime-intel` | Primary dev agent — receives raw task, routes to sub-agents or executes  | `pattern_report` | `markdown`    | **YES**          | `~/.claude/agents/prince-runtime-intel.md` |
| 2 — Mediate    | `hermes`               | Cross-project coordination — relays feedback between submodule boundaries | `pattern_report` | `markdown`    | context-switched | `~/.claude/agents/hermes.md`               |
| 3 — Scout      | `caraxes`              | Marketplace / plugin scouting — terminal node, returns enriched findings  | `pattern_report` | `markdown`    | context-switched | `~/.claude/agents/caraxes.md`              |

### Feedback Chain

```
[User Input]
     │
     ▼
[prince-runtime-intel]  ← Chain Position 1 — Intake & route
     │  artifact_type: pattern_report
     │  sections: [ Introduction, Foundations, ... ]
     │  output_format: markdown
     │
     ├──► [hermes]          ← Chain Position 2 — Cross-repo mediation
     │        sub_sections: [ Trade Centers, Infrastructure, ... ]
     │        feedback: routed patch or resolution back to prince
     │
     └──► [caraxes]         ← Chain Position 3 — Scouting (terminal)
              sub_sections: [ Modern Analyses, Network Theory, ... ]
              feedback: enriched findings → conclusion payload → prince
                                                                    │
                                                              [conclusion]
                                                              output rendered
```

### Schema Contract (`router_agents.json` reference)

| Field           | Value            | Notes                                              |
| --------------- | ---------------- | -------------------------------------------------- |
| `artifact_type` | `pattern_report` | All agents emit this type on structured output     |
| `content.title` | task-derived     | Set by intake agent (`prince`)                     |
| `sections`      | ordered array    | Top-level report divisions; required               |
| `sub_sections`  | nested array     | Optional per section; used for routing granularity |
| `conclusion`    | string           | Final synthesis; emitted by terminal node          |
| `output_format` | `markdown`       | All agents render to markdown                      |

**Default agent:** `prince-runtime-intel` is the workspace default for all development tasks in this repo unless explicitly overridden. To activate: prefix with `@prince` or run `echo "prince" > ~/.claude/.active_persona`.

**Behavioral rules:** Agent operational protocols in `~/.claude/rules/prince-agent.md` (problem-type routing, skill dispatch, output templates) and `~/.claude/rules/dev-rules.md` (governance pointers to TUV-001 and this repo’s baselines). Full trust contract text: `~/seed/templates/development-contract.md`. Rules are not duplicated here.

**Documentation neighborhood:** [`docs/FOURFOLD_NEIGHBORHOOD.md`](docs/FOURFOLD_NEIGHBORHOOD.md) maps **LICENSE**, **DESIGN.md**, **Makefile**, **INSTRUCTION.md**, and **REFERENCE.md** — use it to pick the right doc before a long chat. [`docs/SIXTEENFOLD_NEIGHBORHOOD.md`](docs/SIXTEENFOLD_NEIGHBORHOOD.md) expands that to **16 folds** (four strata × four archetypes) across git boundaries. **prince** = default build path; **hermes** = submodule / cross-repo alignment; **caraxes** = marketplace and plugins. Nested **GRID-main** and **`.pi`** carry their own `AGENTS.md` for four debugging windows and Pi isolation, respectively.

## Primary agent operating model

This repository is a **gruff** umbrella: this directory contains the **@irfankabir002/gruff** package ([`package.json`](package.json)); [`CascadeProjects/`](CascadeProjects/) is a **git submodule** to the hogsmade monorepo. Primary, high-context agents should:

- **Prioritize** correctness, integration, and cross-module coherence over speed. Read call sites and shared contracts (for example `Components/shared-types`, MCP tool schemas, and gruff `schemas/`) before editing.
- **Verify at the right scope** for the files you changed. For the gruff package only, run from this directory: `npm run lint`, `npm test`, and `npm run orchestrate` when the orchestration script is relevant. For work inside [`CascadeProjects/`](CascadeProjects/), use that tree’s `npm run lint:all`, `npm run test:all`, and `npm run build:all` (or workspace-scoped `npm run --workspace <path> <script>`) as documented in [Build, Test, and Development Commands](#build-test-and-development-commands). Do not use gruff-only tests to validate submodule-only changes, or a full `*:all` run when a narrow check suffices.
- **PR discipline:** small, reviewable steps; one logical change with tests; submodule pointer updates in a separate commit when required.
- **Route** trivial work (markdown nits, mechanical renames, “run a script and paste the output” requests) to a light agent; keep the primary thread for cross-boundary and integration risk.
- **Echoes and infrastructure** URLs and auth: do not invent base URLs, paths, or auth flows. Mark unconfirmed details as **TBD** until confirmed in-repo or by a maintainer. (In full workspace checkouts, Echoes may appear under `canopy/echoes/`; see the closest `CLAUDE.md`.)

On each **scoped** task: orient (which layer and which contracts) → plan the smallest safe delta with tests → run the layer-appropriate `npm` commands (add `pre-commit run --all-files` when hooks or repo-wide formatting change) → report what changed, what you ran, and any **TBD** items.

---

## Project Structure & Module Organization

This repository is a **workspace umbrella**: the root tracks `planes/` (symlink map) plus `CascadeProjects/` as a **git submodule** to the hogsmade monorepo (MCP servers, shared packages, apps, nested `Projects/GRID-main`, etc.). Open PRs against this repo to review the submodule pointer, plane layout, and workspace glue; use the hogsmade repo for day-to-day monorepo commits.

Inside the submodule, the layout is a Node workspaces monorepo:

- `Tools/MCPServers/`: first-party MCP servers (`afloat-server`, `grid-server`, `echoes-server`, etc.).
- `Components/`: shared packages and cross-workspace scripts (`shared-types`, `shared-resilience`, `shared-pipeline`).
- `Applications/`: product apps and engines (`glimpse-artifact`, `glimpse-engine`, `pi-mangrove`).
- `Projects/`: operational projects and nested repos (notably `Projects/GRID-main` as a submodule).
- `Documentation/`: architecture notes, audits, and workflow references.

Keep changes scoped to the relevant workspace; avoid unrelated edits across directories.

## Build, Test, and Development Commands

Run from repo root unless noted.

- `npm run format` / `npm run format:check`: apply or verify Prettier formatting.
- `npm run lint:all`: run each workspace lint script.
- `npm run build:all`: build all workspaces.
- `npm run test:all`: execute workspace tests.
- `npm run --workspace Tools/MCPServers/grid-server test`: run one package’s tests while iterating.
- `pre-commit run --all-files`: run repo hooks (format, secret scan, manifest checks).

## Coding Style & Naming Conventions

- Formatting is enforced by Prettier (`.prettierrc.json`): 2-space indent, semicolons, double quotes, trailing commas, LF endings.
- Use ESM (`"type": "module"`) and explicit, descriptive names.
- Naming: `kebab-case` for folders/files, `camelCase` for functions/variables, `PascalCase` for React components/types.
- Keep server-specific logic inside its workspace; share common code via `Components/*`.

## Testing Guidelines

- Primary framework: Vitest across TS/JS workspaces.
- Test files use `*.test.ts`, `*.test.js`, or `*.test.mjs` (example: `tests/smoke.test.ts`).
- Add or update tests with every behavior change; include smoke coverage for MCP server endpoints/tools.
- Before opening a PR, run tests for changed workspaces at minimum, then `npm run test:all` when feasible.

## Commit & Pull Request Guidelines

- Follow Conventional Commits with scope, matching repo history:
  - `fix(ci): ...`
  - `docs(workspace): ...`
  - `chore(submodule): ...`
- Keep commits focused and atomic; one logical change per commit.
- PRs must include: clear summary, affected paths, test evidence, and linked issue (if applicable).
- For UI changes, attach screenshots or short recordings.

## Security & Configuration Tips

- Never commit secrets or tokens; pre-commit `detect-secrets` is enabled but not a substitute for review.
- Start from `.env.example`; keep machine-specific overrides out of git.
- Treat submodules/nested repos (for example `Projects/GRID-main`) as independent histories when contributing.

### Git hygiene and source protection

- Honor each repo’s **`.gitignore`** and **`core.excludesfile`** (`~/.config/git/ignore` when configured). Treat ignored paths as non-source; do not `git add` generated artifacts (`dist/`, `build/`, `.next/`, `coverage/`, `.venv/`, `node_modules/`, `*.tsbuildinfo`), caches, local env files, or IDE scratch unless the human explicitly overrides.
- Be deliberate with git: use **`git status`** / **`git diff`** before staging; avoid blind **`git add .`**. Do not **force-push** or rewrite **history** unless the human asks. For **GRID-main** under CascadeProjects, follow this repo’s GRID/submodule rules in `CLAUDE.md`.
- **Source vs generated:** Edit source trees and generators; do not hand-edit `dist/` or lockfiles without clear intent.
- **Secrets:** Never commit API keys, tokens, or `.env` secrets. If something sensitive is tracked or staged, stop, flag it, add ignore rules, and involve the human for **`git rm --cached`** or history cleanup / rotation.
- **Templates / audit:** `~/seed/templates/gitignore-*.template`, `~/scripts/gitignore-audit.sh`.
