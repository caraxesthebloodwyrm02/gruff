# GRID Design System — Skill

When the user is designing anything for **GRID** (Geometric Resonance Intelligence Driver), load this design system first.

## What to read

1. **`README.md`** — brand voice, content fundamentals, visual foundations, iconography. Read end-to-end before producing any artifact.
2. **`colors_and_type.css`** — the single source of truth for CSS custom properties. Import into every HTML artifact:
   ```html
   <link rel="stylesheet" href="<path>/colors_and_type.css">
   ```
3. **`preview/`** — per-token reference cards. Use as visual ground truth for colors, type, spacing, components.
4. **`ui_kits/landing/index.html`** — marketing / landing reference.
5. **`ui_kits/app/index.html`** — in-product (TitleBar + sidebar + Dashboard + Chat) reference.
6. **`assets/`** — the wheel icon, nodes logomark, and the technical render imagery (`gruff_*.png`, `signal_chain_*.png`, `routine_*.png`). Use these as-is; don't recreate.

## Hard rules

- **Primary is amber** (`var(--primary)` = `#F59E0B`). Hover → `--amber-400`; press → `--amber-600`. Cyan (`#00D9FF`) is a secondary accent for data-viz glints only, never for CTAs.
- **Dark-first.** Default page is `--bg-1` (`#14141A`); hero backgrounds are `--bg-0` (`#0A0A0F`). Light theme exists via `[data-theme="light"]`.
- **Fonts** — Space Grotesk (display), Manrope (body), JetBrains Mono (code). Already `@import`-ed at the top of `colors_and_type.css`.
- **Wordmark** — GRID is uppercase, `0.15em` tracked, 700 weight. Never "Grid".
- **No emoji** in UI chrome (except `🛞` as text-fallback for the wheel).
- **Icons** — use Lucide, 1.5–1.75 stroke, rounded joins. Do not draw bespoke icon sets.
- **No decorative gradients.** Only the logo uses gradient; hero halos use a single amber radial. Backgrounds are flat.
- **Voice is measured.** Specific numbers, no hype. Consolidate warnings ("Ollama offline — degraded mode", not raw stack traces). Em-dash for inline breaks; `→` only in flow diagrams.
- **"Understand"** is the product verb. "MIST" is the named epistemic-humility state. "Signal vs. noise" is the recurring frame. Capitalize cognition pattern names when referring to the module.

## Quick reference

| Need | Token |
|------|-------|
| Primary CTA bg | `var(--primary)` / `var(--amber-500)` |
| Primary CTA text | `var(--primary-fg)` (`#1A0F00`) |
| Body text | `var(--fg-1)` |
| Muted text | `var(--fg-2)` / `var(--fg-3)` |
| Card bg | `var(--surface-card)` (`#17171F`) |
| Card border | `var(--border-2)` |
| Focus ring | `0 0 0 3px rgba(245,158,11,0.20)` |
| Card radius | `var(--radius-lg)` (14) or `--radius-xl` (20) |
| Card padding | 20–24 (`var(--space-5)` / `--space-6`) |
| Primary glow | `var(--glow-amber)` |

## Ready-made recipes

- `.ds-h1 / .ds-h2 / .ds-h3 / .ds-h4` — display headings
- `.ds-p / .ds-lede / .ds-meta / .ds-code / .ds-wordmark` — body recipes
- `.ds-surface` — dark page base

## When in doubt

- Match the **app UI kit** for anything inside the product (settings, modals, new views).
- Match the **landing UI kit** for anything public-facing (marketing, blog, docs hero).
- Pull real research renders from `assets/` before reaching for placeholders.
- If a component isn't covered, extend from tokens — don't invent new colors. Ask.
