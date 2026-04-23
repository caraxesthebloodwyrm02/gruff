# Composition sequence — chronology, 8-fold compaction, DRY/WET gain, swing vs gesture

This document **closes the arc**: it compresses the conversation **in order**, **halves** the sixteenfold into **eight octants** for daily use, sets a **~65–70% DRY / ~30–35% WET** documentation “gain” target (like a mix knob: mostly clean repeatability, enough wet signal to avoid clipping), and turns **modular swing metrics** and **gesture** into **actions**.

---

## 1. Chronological capsule (what happened, in order)

1. **Fourfold + neighborhood** — Root files **`LICENSE`**, **`DESIGN.md`**, **`Makefile`**, **`INSTRUCTION.md`**, hub **`REFERENCE.md`**, plus **`docs/FOURFOLD_NEIGHBORHOOD.md`** (nearest-neighbor graph, agent voices: prince / hermes / caraxes, GRID windows, Pi).
2. **Partition ask** — Map **git modules/submodules**, repos, directories, and tie voices to partitions (CHARACTERS-style framing; not all assets landed as a separate `CHARACTERS.md` in-tree).
3. **Sixteenfold** — **`docs/SIXTEENFOLD_NEIGHBORHOOD.md`**: **4 strata × 4 archetypes** = **16** folds; folds **1–4** are the literal fourfold; **5–16** repeat covenant/cartography/circuit/cadence under hogsmade, GRID, and operator overlay.
4. **This doc** — **Half-state quantization**: **16 → 8** by **pairing strata** (see §2), **DRY/WET gain staging**, **ping-pong / triplet** patterns, **swing vs gesture** synthesis.

---

## 2. Post-compaction: eight octants (from 16)

**Rule:** collapse **two strata per archetype** into one octant — **ping-pong between stacks**:

| Stack merge | Strata paired | Meaning |
|-------------|---------------|---------|
| **Product stack** | Umbrella **+** hogsmade | Same archetype, **shipping/adjacent repos** (pointer + monorepo). |
| **Risk / operator stack** | GRID **+** operator overlay | Same archetype, **policy + plaza + gates** (nested product + umbrella-only navigation). |

**Eight octants** (fold IDs from [`SIXTEENFOLD_NEIGHBORHOOD.md`](SIXTEENFOLD_NEIGHBORHOOD.md)):

| Oct | Archetype | Composition (16-fold IDs) | Primary DRY anchors |
|-----|-----------|---------------------------|---------------------|
| **O1** | Covenant | **1 + 5** | [`LICENSE`](../LICENSE), [`CascadeProjects/LICENSE`](../CascadeProjects/LICENSE) |
| **O2** | Cartography | **2 + 6** | [`DESIGN.md`](../DESIGN.md), [`CascadeProjects/AGENTS.md`](../CascadeProjects/AGENTS.md) + workspace map |
| **O3** | Circuit | **3 + 7** | [`Makefile`](../Makefile), hogsmade `npm` / `pre-commit` |
| **O4** | Cadence | **4 + 8** | [`INSTRUCTION.md`](../INSTRUCTION.md), [`ONBOARDING.md`](ONBOARDING.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) submodule flow |
| **O5** | Covenant | **9 + 13** | GRID [`AGENTS.md`](../CascadeProjects/Projects/GRID-main/AGENTS.md) §Security, [`CLAUDE.md`](../CLAUDE.md) / trust |
| **O6** | Cartography | **10 + 14** | GRID four **windows** + [`SPEC.md`](../SPEC.md) / [`CENTRAL_PLAZA.md`](../CENTRAL_PLAZA.md) / `planes/` |
| **O7** | Circuit | **11 + 15** | GRID `make`/`uv`/`pytest` + `scripts/`, `bridges/`, `schemas/` |
| **O8** | Cadence | **12 + 16** | GRID weekly audit / subtractive analyst + [`WORKSPACE_GATES.md`](../WORKSPACE_GATES.md), [`the-elevator-ride.md`](the-elevator-ride.md), `racks/` |

**Hub (unchanged):** [`REFERENCE.md`](../REFERENCE.md) — still the **single routing table**; octants are **views** over the same hub.

---

## 3. Gain staging: ~65–70% DRY / ~30–35% WET

**Metaphor:** documentation behaves like a **signal chain**. Too **wet** (only local notes) → noise and drift; too **dry** (only links) → brittle, no session memory. A **65–70% DRY** mix keeps **one canonical spine** with **30–35% WET** allowance for **context** (branch names, review bundles, experiment paths) without duplicating policy.

| Band | Target | What to put there |
|------|--------|-------------------|
| **DRY ~65–70%** | Single sources: tables in `REFERENCE`, `SIXTEENFOLD`, `FOURFOLD`; root fourfold files; submodule pointers; `AGENTS` registries. |
| **WET ~30–35%** | `review-package/`, scratch notes, session-specific checklists, local env, elevator “lap” notes — **link outward**, don’t fork policy. |

**Ping-pong stroke (one back-and-forth per task):** **DRY read** (which octant?) → **WET act** (edit/repo) → **DRY reconcile** (one link or one line in REFERENCE-adjacent doc if the canon moved).

---

## 4. Triplet and dotted patterns

**Triplet (per decision):** `(octant, DRY anchor, wet note)`
Example: `(O7, Makefile + scripts/verify-planes.sh, "today only: geometry-box drift noted")`.

**Dotted rhythm (three beats):** `anchor … gesture … metric`
Example: [`REFERENCE.md`](../REFERENCE.md) **…** choose **hermes** for submodule bump **…** count **hops** from hub to edited file ≤ 3.

Use **triplets** when opening a PR; use **dotted** rhythm when **logging** a reconcile lap (elevator doc).

---

## 5. Modular swing metrics vs gesture

| | **Modular swing metrics** (repeatable, comparable) | **Gesture** (intent, qualitative) |
|---|------------------------------------------------------|-------------------------------------|
| **What** | Counts and distances on the **doc graph** | **Voice** + **stratum** you’re “moving” in |
| **Examples** | Hops from [`REFERENCE.md`](../REFERENCE.md) to anchor; number of submodules touched; whether change spans **O1–O4** vs **O5–O8** | **prince** = implement; **hermes** = align repos; **caraxes** = scout plugins; GRID = pick **one window**; overlay = **gates / elevator** lap |
| **Action** | If hops > 3, **add a REFERENCE row** or fold pointer (pull DRY forward) | If gesture conflicts with metric (e.g. hermes task but you’re editing GRID-only files), **re-scope** to the octant that matches the repo boundary |

**Synthesis (actionable):**

1. **Name the octant** (O1–O8) before touching code.
2. **Set the mix**: default **65% DRY** — touch a canon file or table once; cap **wet** notes at **~35%** of the artifact (e.g. review bundle).
3. **Ping-pong**: read hub → act → reconcile with one canonical update or pointer.
4. **Compare swing to gesture**: if **metric** says “two repos,” **gesture** should be **hermes**-shaped (submodule flow), not a deep **GRID** window session.

---

## 6. Links

- [`FOURFOLD_NEIGHBORHOOD.md`](FOURFOLD_NEIGHBORHOOD.md) — four folds + neighborhood graph
- [`SIXTEENFOLD_NEIGHBORHOOD.md`](SIXTEENFOLD_NEIGHBORHOOD.md) — sixteen folds + strata
- [`ONBOARDING.md`](ONBOARDING.md) — tracks, modes, ambiance
- [`the-elevator-ride.md`](the-elevator-ride.md) — laps / curvature
