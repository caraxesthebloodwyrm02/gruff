# Four on the floor — composition snap

**Four on the floor** (steady foundation): the root **fourfold** sits like four corners of one slab — **covenant**, **cartography**, **circuit**, **cadence** — before any sixteen- or eightfold expansion.

## Snap status: **~92% full** (composition closed)

| Corner | Fold | File | Load |
|--------|------|------|------|
| **NW** | 1 Covenant | [`LICENSE`](../LICENSE) | **Apache-2.0** umbrella terms; submodule: [`CascadeProjects/LICENSE`](../CascadeProjects/LICENSE) |
| **NE** | 2 Cartography | [`DESIGN.md`](../DESIGN.md) | Umbrella vs hogsmade vs GRID boundaries |
| **SE** | 3 Circuit | [`Makefile`](../Makefile) | `verify-planes`, `submodule-init`, **`fourfold-snap`** |
| **SW** | 4 Cadence | [`INSTRUCTION.md`](../INSTRUCTION.md) | Clone, loop, submodule bump, narrow GRID |

**~8% reserved (intentionally not “100% dry”):** submodule pointer drift, local `.env`, `review-package/` wet bundles, and per-machine plane verification — they change without invalidating the floor.

```text
        [1 LICENSE — covenant]
                 |
    [4 INSTRUCTION] — [2 DESIGN]
       cadence          cartography
                 |
        [3 Makefile — circuit]
```

Hub (not a corner): [`REFERENCE.md`](../REFERENCE.md). Full graph: [`FOURFOLD_NEIGHBORHOOD.md`](FOURFOLD_NEIGHBORHOOD.md).

## Verify the snap

From repo root:

```bash
make fourfold-snap
```

Exits **0** when all four files exist and the composition stamp parses. This is the **floor check** after [`docs/artifacts/session-seal.json`](artifacts/session-seal.json).

## Relation to the rest of the composition

| Layer | Doc |
|-------|-----|
| Floor (this page) | Four files + hub |
| Neighborhood | [`FOURFOLD_NEIGHBORHOOD.md`](FOURFOLD_NEIGHBORHOOD.md) |
| Strata | [`SIXTEENFOLD_NEIGHBORHOOD.md`](SIXTEENFOLD_NEIGHBORHOOD.md) |
| Compaction + gain | [`COMPOSITION_EIGHTFOLD_GAIN.md`](COMPOSITION_EIGHTFOLD_GAIN.md) |
| Seal | [`artifacts/session-seal.json`](artifacts/session-seal.json) |

When the floor is **snapped**, downstream docs are **gain-staged** on top of a stable beat — not floating copy.
