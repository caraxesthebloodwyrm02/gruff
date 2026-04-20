# Instruction — procedures

This file is **fold 4** of the [fourfold neighborhood](docs/FOURFOLD_NEIGHBORHOOD.md): **cadence** — ordered steps and exits. Pair with [`DESIGN.md`](DESIGN.md) for *what* and [`Makefile`](Makefile) for *automation*.

## First-time clone

```bash
git clone --recurse-submodules <remote-url> ~/workspace
cd ~/workspace
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

## Daily / sprint loop

1. **Orient** — Skim [`REFERENCE.md`](REFERENCE.md) for the doc you need; check [`AGENTS.md`](AGENTS.md) for default agent (`prince-runtime-intel`) and when to think **`hermes`** (cross-repo) vs **`caraxes`** (marketplace/plugins).
2. **Align** — For umbrella changes, confirm [`SPEC.md`](SPEC.md); for submodule work, work inside `CascadeProjects/` and its remote.
3. **Verify** — From repo root: `make help` then `make verify-planes` when touching `planes/`.
4. **Reconcile** — Leave an artifact (commit, note, or review bundle). See [`docs/ONBOARDING.md`](docs/ONBOARDING.md) for **read–write / practice–apply / research–test** modes.

## Submodule pointer bump

1. Commit and push changes **inside** `CascadeProjects/` on the hogsmade remote.
2. In the umbrella repo, commit the updated submodule reference.
3. PR the umbrella if this repo tracks the pointer for reviewers.

## Nested GRID

Do **not** widen scope across GRID “windows” at once. Follow the order in [`CascadeProjects/Projects/GRID-main/AGENTS.md`](CascadeProjects/Projects/GRID-main/AGENTS.md): reproduce in one window, run the smallest gate, fix, re-run narrow then wide checks.

## Pi / isolation

When working against **`.pi`** settings, read [`CascadeProjects/.pi/AGENTS.md`](CascadeProjects/.pi/AGENTS.md) for allowed tools and **UNPROVISIONED** network rules before calling external APIs.

## Composition snap (four on the floor)

When you need to confirm the **foundation** is present before stacking sixteen- or eightfold docs: read [`docs/FOUR_ON_THE_FLOOR.md`](docs/FOUR_ON_THE_FLOOR.md) and run:

```bash
make fourfold-snap
```

## Nearest neighbors

| Neighbor | Why |
|----------|-----|
| [`Makefile`](Makefile) | `make verify-planes`, `make fourfold-snap` |
| [`LICENSE`](LICENSE) | **Apache-2.0** — redistribution and attribution (see file headers / NOTICE when contributing) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | PR and conduct expectations |
