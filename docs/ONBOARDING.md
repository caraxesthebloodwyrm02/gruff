# Onboarding routine

Welcome. This workspace mixes **human navigation** (plaza), **architecture** (planes), and a **submodule monorepo** (hogsmade). Use this page to pick a **track**, a **mode**, and a **walkthrough ambiance** so you do not drown in surface area.

**Doc graph:** The **fourfold** (**[`LICENSE`](../LICENSE)**, **[`DESIGN.md`](../DESIGN.md)**, **[`Makefile`](../Makefile)**, **[`INSTRUCTION.md`](../INSTRUCTION.md)**) and hub **[`REFERENCE.md`](../REFERENCE.md)** are wired in [`FOURFOLD_NEIGHBORHOOD.md`](FOURFOLD_NEIGHBORHOOD.md) with **nearest-neighbor** links and short **agent voice** notes from [`AGENTS.md`](../AGENTS.md) (and nested GRID / `.pi` when you land there).

## Two tracks (pick one primary per season)

| Track | What it is | Typical cadence | Primary folders |
|--------|------------|-----------------|-----------------|
| **School / study** | Learning, cognition practice, course-shaped work, skill ladders, experiments that may not ship | Weekly or slower; notebooks, drafts, `racks/learning/` | `racks/`, `design-system/` (reference), `hogsmade-design/`, personal notes beside the repo |
| **Workspace / market** | Shipping, integration, MCP servers, submodule bumps, PRs, schedules, stakeholder-visible output | Daily or sprint-aligned; CI-conscious | `CascadeProjects/`, `planes/`, `bridges/`, `scripts/`, review bundles under `review-package/` |

Both tracks use the **same** structural spine ([`SPEC.md`](../SPEC.md), [`CLAUDE.md`](../CLAUDE.md)). The difference is **risk and audience**: study tolerates throwaway branches; market expects contracts and audit hygiene.

## Three modes (rotate; do not skip reconcile)

| Mode | Intent | You touch | You exit with |
|------|--------|-----------|---------------|
| **Read–write** | Understand and align docs and small edits | `SPEC.md`, `AGENTS.md`, manifests, symlinks, `routine.yaml` stubs | Clearer map; PR-sized doc commits |
| **Practice–apply** | Run tools locally, stubs, canvases, proportion JSON | `bridges/gruff-echoes/`, Cursor canvases, `make`/`npm` targets, smoke tests | Muscle memory; logs or screenshots |
| **Research–test** | Hypothesis, diff review, narrow bundles, verification scripts | `review-package/`, `scripts/verify-*.sh`, submodule diffs | Evidence files, not vibes |

A healthy week hits **each mode at least once** on your primary track, with one **lap** (see [`the-elevator-ride.md`](the-elevator-ride.md)) that explicitly reconciles what agents produced.

## Ambiance-based codebase walkthroughs

**Ambiance** means: choose a *mood* first, then follow a *path* so the tree reads as a story instead of a pile.

1. **Quiet / survey (read-heavy)** — Open [`workspace.code-workspace`](../workspace.code-workspace), skim [`CENTRAL_PLAZA.md`](../CENTRAL_PLAZA.md), then [`SPEC.md`](../SPEC.md) §2. Stop before editing. *Ambiance:* orientation, no ship pressure.
2. **Workshop / hands (practice-heavy)** — From `CascadeProjects/`, run one MCP server smoke or `Components/geometry-box` tests. Touch `bridges/gruff-echoes/receiver.py` only after reading [`GRUFF_WALLBOARD_BRIDGE.md`](GRUFF_WALLBOARD_BRIDGE.md). *Ambiance:* tactile, local-only.
3. **Audit / ship (research-heavy)** — Compare submodule pointer, read `review-package/*` if present, run `scripts/verify-planes.sh` if configured. *Ambiance:* evidence, reviewers in mind.

Repeat walkthroughs when the repo **feels** unfamiliar—after long breaks or big upstream merges.

## Schedules and repetition

- Put recurring work on **calendar or bot schedules** outside this file; here, only the **rule**: same loop, shorter meetings with yourself. Momentum is **structured repetition**, not intensity spikes.
- Agentic and cognitive tooling: treat outputs as **drafts** until a gate says otherwise ([`WORKSPACE_GATES.md`](../WORKSPACE_GATES.md)).

## Contributing and open source

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for licenses, submodule policy, and how to open PRs to this umbrella repo versus hogsmade.

## Cognitive tools (explicit non-goals)

This onboarding does **not** prescribe a specific AI product. It assumes you may use **coding agents, canvases, and proportion/GRUFF experiments** as *inputs*. The repo’s job is to give those inputs **a place to land** (docs, schemas, stubs)—not to optimize your inner life.

When you leave a session, leave an **artifact**: commit, note, or ticket—so the next lap starts from a named floor.
