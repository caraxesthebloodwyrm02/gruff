# GRUFF wall board: canvas, proportion schema, Echoes bridge

This document ties together the **Cursor canvas** (visual + interaction only), the **proportion JSON contract**, the **local stub receiver**, and how a real **Echoes** service would consume the payload.

## Artifacts

| Piece | Path |
|-------|------|
| Canvas | `~/.cursor/projects/home-irfankabir-workspace/canvases/gruff-wallboard.canvas.tsx` |
| JSON Schema | `~/workspace/schemas/gruff-proportion-v1.schema.json` |
| Stub HTTP receiver | `~/workspace/bridges/gruff-echoes/receiver.py` |
| Stub usage | `~/workspace/bridges/gruff-echoes/README.md` |

## Dual-fold naming (do not conflate)

| Term | Meaning |
|------|---------|
| **Geometric phase (`theta`)** | Wall board master clock in `[0,1)`, drives **clockwise** SVG motion and synthetic metrics. Lives entirely in the canvas / GRUFF geometry metaphor. |
| **Ori / envelope folds** | **Process** modulation in phased test pipelines (e.g. `FOLD_1_CORE`, failure thresholds, hard-halt). Documented in workspace `CLAUDE.md` when `ori-server` is present; **not** the same variable as `theta`. |

Using the same word “fold” for both is easy; routing docs should always qualify **geometric** vs **envelope**.

## Audio mapping (proportionality)

Echoes (or any DSP host) should treat the canvas output as **control voltages**, not audio samples.

| Field | Suggested mapping |
|-------|-------------------|
| `audioDrive` | **0..1** master gain / sidechain depth for a bed track or filter resonance. |
| `weights.sound` | Scales how strongly `audioDrive` follows `metrics.modulated.signal` vs a neutral curve. |
| `weights.gesture` | Maps to **human-in-the-loop** emphasis (e.g. macro variation depth); optional. |
| `weights.calculation` | Bias toward **deterministic** modulation (e.g. link cutoff to `metrics.modulated.noise` with low weight). |
| `metrics.modulated.signal` / `noise` | After canvas clamps: use as **slow LFO** inputs (Hz << audio rate) to avoid zipper noise. |

**Invariant:** `weights.sound + weights.gesture + weights.calculation ≈ 1` (stub allows 0.02 slack).

## curl workflow

1. Open **GRUFF wall board** canvas in Cursor.
2. Toggle **Play automation** or adjust sliders; click **Copy JSON**.
3. Save clipboard to `proportion.json` (or paste into `-d '...'`).
4. Run `python3 bridges/gruff-echoes/receiver.py`.
5. `curl` as in `bridges/gruff-echoes/README.md`.

## Surfaces routing (SPEC)

Per `SPEC.md` §2, long-lived **data viz** apps belong on **Surfaces** (`glimpse-engine`, `glimpse-artifact`, `board`, …). This canvas is an **operator lab** beside chat; a production board should live under those planes when you promote it.
