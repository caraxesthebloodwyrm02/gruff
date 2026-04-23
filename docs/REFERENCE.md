# Reference — canonical index

This file is the **hub** of the [fourfold neighborhood](FOURFOLD_NEIGHBORHOOD.md): one-hop pointers to stable sources and adjacent docs.

## Umbrella (this repo)

| Doc | Role |
|-----|------|
| [`README.md`](../README.md) | Entry, clone, onboarding links |
| [`SPEC.md`](SPEC.md) | Architecture, vision, governance |
| [`CENTRAL_PLAZA.md`](CENTRAL_PLAZA.md) | Plaza / district vocabulary |
| [`WORKSPACE_GATES.md`](WORKSPACE_GATES.md) | Gated execution protocol |
| [`CLAUDE.md`](../CLAUDE.md) | Claude / data contracts, workspace rules |
| [`AGENTS.md`](../AGENTS.md) | Agent registry: prince, hermes, caraxes |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | OSS, submodule policy, PR expectations |
| [`ONBOARDING.md`](ONBOARDING.md) | Tracks, modes, ambiance walkthroughs |
| [`the-elevator-ride.md`](the-elevator-ride.md) | Pacing, floors, laps |
| [`FOURFOLD_NEIGHBORHOOD.md`](FOURFOLD_NEIGHBORHOOD.md) | Fourfold + nearest-neighbor map |
| [`SIXTEENFOLD_NEIGHBORHOOD.md`](SIXTEENFOLD_NEIGHBORHOOD.md) | 16-fold: 4 strata × 4 archetypes (git partitions + voices) |
| [`COMPOSITION_EIGHTFOLD_GAIN.md`](COMPOSITION_EIGHTFOLD_GAIN.md) | Session composition: chronology, **8 octants** (16→8), **~65% DRY / ~35% WET**, swing metrics vs gesture |
| [`artifacts/session-seal.json`](artifacts/session-seal.json) | **Session seal** (JSON): brand voice, doc graph, octants, discovery prompts — validates against [`schemas/session-seal-v1.schema.json`](../schemas/session-seal-v1.schema.json) |
| [`artifacts/gridstral-pattern-feed.json`](artifacts/gridstral-pattern-feed.json) | **GRIDSTRAL-style pattern feed** (JSON): four/sixteen/eightfold, graph, octants, gain — [`schemas/gridstral-pattern-v1.schema.json`](../schemas/gridstral-pattern-v1.schema.json) |
| [`FOUR_ON_THE_FLOOR.md`](FOUR_ON_THE_FLOOR.md) | **Four on the floor** — ~92%+ foundation snap; pair with `make fourfold-snap` |

## Fourfold files

| File | Fold |
|------|------|
| [`LICENSE`](../LICENSE) | Covenant — **Apache-2.0** (umbrella) |
| [`DESIGN.md`](DESIGN.md) | Cartography — boundaries |
| [`Makefile`](../Makefile) | Circuit — commands |
| [`INSTRUCTION.md`](INSTRUCTION.md) | Cadence — procedures |

## Submodule (`CascadeProjects/`)

| Doc | Role |
|-----|------|
| [`CascadeProjects/LICENSE`](../CascadeProjects/LICENSE) | Submodule license (**MIT** as published there; separate from umbrella) |
| [`CascadeProjects/AGENTS.md`](../CascadeProjects/AGENTS.md) | Same agent table + monorepo commands |

## Nested GRID (`CascadeProjects/Projects/GRID-main/`)

| Doc | Role |
|-----|------|
| [`AGENTS.md`](../CascadeProjects/Projects/GRID-main/AGENTS.md) | Security guardrails, debugging windows, `make`/`uv` slices |

## Pi workspace (`.pi/`)

| Doc | Role |
|-----|------|
| [`CascadeProjects/.pi/AGENTS.md`](../CascadeProjects/.pi/AGENTS.md) | Mangrove Pi tools, skills, network isolation notes |

## Nearest neighbors

| Neighbor | Why |
|----------|-----|
| [`LICENSE`](../LICENSE) | Legal baseline — **Apache-2.0** (umbrella). |
| [`DESIGN.md`](DESIGN.md) | Where work belongs (umbrella vs submodule). |
| [`INSTRUCTION.md`](INSTRUCTION.md) | Ordered steps for humans and CI. |
