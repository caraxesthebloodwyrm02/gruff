# Alignment Calculation Procedure

> Step-by-step procedure for computing the alignment score of the MCP
> maintenance signal against the GRUFF 2026-04-06 baseline.
>
> **Spec:** `./signal-extraction.yaml`
> **Render hook:** `craft-server.render(gruff_compass_x)`

---

## Overview

```
  probe ──► tick-isolate ──► classify ──► finding-expand
                                               │
                                               ▼
                                         quantize (Q)
                                               │
                               ┌───────────────┴───────────────┐
                               ▼                               ▼
                           dispose                          align (A)
                       (adapt|roll|escalate)                     │
                                                                 ▼
                                                     render(gruff_compass_x)
```

Eight steps (S1–S8). Each is idempotent. Every step has a bridged-gap annotation.

---

## Step 1 — Probe Run

```bash
~/scripts/mcp-probe.sh > /tmp/probe.raw 2>&1
```

**Bridged gap:** `set -euo pipefail` with `((COUNT++))` on 0 returns exit 1 and kills the script. Fixed in helper: `COUNT=$((COUNT + 1))`.

**Exit codes:**
- `0` = all probes pass
- `1` = at least one FAIL emitted (expected when drift exists)

---

## Step 2 — Tick Isolation

```bash
# Filter to pre-REPORT-summary lines only (avoid double-counting verdict echo)
sed -n '/━━━ REPORT: summary ━━━/q; p' /tmp/probe.raw \
  | grep -E '^\s+(✅|🔴|⚠️|·)' \
  | sed 's/^\s*//' > /tmp/ticks.flat
```

**Bridged gap:** Raw probe output contains chrome (section headers `━━━`, box borders `╔═╗`) AND a verdict summary section at the end that re-echoes `🔴 FAIL: ...` and `⚠️ WARN: ...` lines. Without the `sed -n '/REPORT/q; p'` cutoff, the classifier double-counts summary echoes. Stop reading at the summary banner.

**Output:** One signal per line, leading whitespace stripped, verdict echoes excluded.

---

## Step 3 — Classify

```python
counts = {'pass': 0, 'fail': 0, 'warn': 0, 'detail': 0}
for line in open('/tmp/ticks.flat'):
    glyph = line[0]
    if   glyph == '✅': counts['pass']   += 1
    elif glyph == '🔴': counts['fail']   += 1
    elif glyph == '⚠': counts['warn']    += 1
    elif glyph == '·': counts['detail'] += 1
```

**Bridged gap:** `⚠️` is two codepoints (U+26A0 + U+FE0F); substring test on `line[0]` must handle the base codepoint only.

**Output:** `{pass: 26, fail: 1, warn: 1, detail: 14}` — matches mcp-probe-latest.

---

## Step 4 — Finding Expansion

```python
findings = []
current = None
for line in ticks:
    if line[0] in ('✅', '🔴', '⚠'):
        if current: findings.append(current)
        current = {'type': line[0], 'text': line[2:], 'children': []}
    elif line[0] == '·' and current:
        current['children'].append(line[2:])
if current: findings.append(current)
```

**Bridged gap:** Detail lines (`·`) are subordinate to their parent signal. Flat grep loses hierarchy; this step re-nests children under their parent finding.

**Output:** Tree structure where each 🔴/⚠️ has a `children[]` array of file paths.

---

## Step 5 — Quantize (Q score per finding)

For each leaf in the finding tree (each file path under a 🔴 signal):

```
Q = impact(0.40) + freshness(0.25) + sed_safety(0.20) + git_tracked(0.15)
```

### Input calculations

| Input | Calculation | Range |
|-------|-------------|-------|
| **impact** | Manual heuristic: runtime path resolution = 1.0, dead comment = 0.0 | [0, 1] |
| **freshness** | `max(0, 1 − age_days / 30)` | [0, 1] |
| **sed_safety** | Match uniqueness: 1.0 if `/home/caraxes/` is unambiguous, 0.5 if overlaps with other tokens, 0.0 if complex | [0, 1] |
| **git_tracked** | `git ls-files "$f"` returns non-empty → 1.0, else 0.0 | {0, 1} |

### Example

```
File: Projects/GATE/harness/src/harness/models.py
  impact      = 1.0   (Pydantic Field(default=...) → runtime path)
  freshness   = max(0, 1 - 10/30) = 0.67
  sed_safety  = 1.0   (clean /home/caraxes/CascadeProjects → swap)
  git_tracked = 1.0   (git ls-files returns path)
  Q = 0.40·1.0 + 0.25·0.67 + 0.20·1.0 + 0.15·1.0 = 0.9175 → 0.92
```

**Bridged gap:** The quantization formula must be applied per-leaf, not per-parent. The parent 🔴 ("Found 14 files") is a wrapper; the 14 children each get their own Q.

---

## Step 6 — Dispose

| Q range | Disposition | Action |
|---------|-------------|--------|
| **≥ 0.85 + runtime-break** | ESCALATE | URGENT tier — block startup |
| **0.50 – 0.84** | ADAPT | Fix in place (sed/edit) |
| **< 0.50** | ROLL | Accept as-is (defer / regenerate) |

**Bridged gap:** A file with high Q but zero runtime impact (e.g., stale comment in documentation) should still ADAPT because git-tracked source-of-truth deserves correctness. A file with low Q that's generated should ROLL regardless.

---

## Step 7 — Align (A score)

Alignment is a **ratio** of current PATH to baseline PATH:

```
A = PATH_current / PATH_baseline
```

### PATH_current computation

```
PATH_current = 100 × Σ [ weight_i · normalize(signal_i) ]
```

Where `signal_i` is aggregated across all findings:

| Signal | Weight | Computation |
|--------|:------:|-------------|
| health   | 0.30 | (pass / (pass + fail)) × 1.0 |
| trust    | 0.25 | 1.0 − (fail / total) |
| drift    | 0.20 | min(1.0, fail_files_count / 30) ← inverted (1 − drift) |
| fail     | 0.15 | fail_count / total_events ← inverted |
| momentum | 0.10 | default 0.5 (no evolution cycle active) |

### Current state calculation

```
pass = 26, fail = 1, warn = 1, detail = 14  (drift files under fail)

health   = 26 / 27 = 0.963
trust    = 1 − 1/28 = 0.964
drift    = 1 − min(1, 14/30) = 0.533
fail     = 1 − 1/28 = 0.964
momentum = 0.5

PATH_current = 100 · [0.30·0.963 + 0.25·0.964 + 0.20·0.533 + 0.15·0.964 + 0.10·0.5]
             = 100 · [0.289 + 0.241 + 0.107 + 0.145 + 0.050]
             = 100 · 0.832
             = 83.2
```

### PATH_baseline (GRUFF 2026-04-06)

Cluster-mean of CLEAR-tier reference entities:

```
PATH_baseline = mean(afloat, echoes, seeds-server) = mean(73.5, 69.5, 67.0) = 70.0
```

### Alignment

```
A = PATH_current / PATH_baseline
  = 83.2 / 70.0
  = 1.189
```

### Alignment tiers

| A range | Meaning |
|---------|---------|
| **A ≥ 1.00** | AT-OR-ABOVE baseline — ecosystem is healthier than reference |
| **0.85 – 0.99** | NEAR baseline — acceptable drift |
| **0.65 – 0.84** | BELOW baseline — investigate |
| **< 0.65** | CRITICAL DRIFT — block progression |

**Current state:** `A = 1.19` → **AT-OR-ABOVE baseline** ✅

**Bridged gap:** The baseline is a moving target — GRUFF 2026-04-06 reflects the Apr 6 ecosystem. After fixing ADAPT files, re-baseline with a new GRUFF snapshot (e.g., GRUFF-2026-04-20-post-adapt).

---

## Step 8 — Render (GRUFF Hook)

Visualize alignment as a Compass-X contrast render via `craft-server`:

```bash
# Via MCP client (any Cascade-compatible client)
npx -y tsx ~/workspace/CascadeProjects/Tools/MCPServers/craft-server/src/server.ts

# Tool call:
{
  "tool": "render_module",
  "args": {
    "module": "gruff_compass_x",
    "params": {
      "baseline": { "afloat": 73.5, "echoes": 69.5, "seeds-server": 67.0 },
      "current":  { "mcp-maintenance": 83.2 },
      "alignment": 1.19
    }
  }
}
```

**Output:** `~/workspace/CascadeProjects/Tools/MCPServers/craft-server/out/gruff_compass_x_contrast.png`

**Movement capture:** Use `gruff_shift_cycles` to render the baseline → post-urgent → post-adapt progression as a 5-cycle GIF.

**Bridged gap:** Numeric alignment (`A = 1.19`) is hard to read at a glance. GRUFF compass-X renders baseline and current as overlaid geometric fields — contrast is immediate visual.

---

## Full Reproducibility Example

```bash
# 1. Probe
~/scripts/mcp-probe.sh --report /tmp/probe.md > /tmp/probe.raw 2>&1

# 2. Isolate ticks
grep -E '^\s+(✅|🔴|⚠️|·)' /tmp/probe.raw | sed 's/^\s*//' > /tmp/ticks.flat

# 3. Classify + count
python3 << 'PY'
from collections import Counter
counts = Counter()
for line in open('/tmp/ticks.flat', encoding='utf-8'):
    g = line[0]
    if   g == '✅': counts['pass'] += 1
    elif g == '🔴': counts['fail'] += 1
    elif g == '⚠': counts['warn'] += 1
    elif g == '·': counts['detail'] += 1
print(counts)
PY

# 4. Compute PATH
python3 << 'PY'
pass_, fail, warn, detail = 26, 1, 1, 14
total = pass_ + fail + warn
health   = pass_ / (pass_ + fail)
trust    = 1 - fail / total
drift    = 1 - min(1, detail / 30)
fail_n   = 1 - fail / total
momentum = 0.5
PATH_current = 100 * (0.30*health + 0.25*trust + 0.20*drift + 0.15*fail_n + 0.10*momentum)
PATH_baseline = (73.5 + 69.5 + 67.0) / 3
A = PATH_current / PATH_baseline
print(f"PATH_current={PATH_current:.1f}  baseline={PATH_baseline:.1f}  A={A:.3f}")
PY
```

**Expected output:**
```
Counter({'pass': 26, 'detail': 14, 'fail': 1, 'warn': 1})
PATH_current=83.2  baseline=70.0  A=1.189
```

---

## References

- **Spec:** `./signal-extraction.yaml`
- **Probe:** `~/scripts/mcp-probe.sh`
- **Audit:** `~/.maintain-server/reports/signal-audit-adapt-vs-roll.md`
- **GRUFF renders:** `~/workspace/CascadeProjects/Tools/MCPServers/craft-server/out/`
- **LUMOS baseline:** `~/workspace/CascadeProjects/.windsurf/workflows/lumos.md`
