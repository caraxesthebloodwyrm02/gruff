# hogsmade-design

Design language, visual identity, and UI token system for the Hogsmade workspace — the board tooling and governance UI layer of the Mangrove ecosystem.

## Overview

`hogsmade-design` houses the design foundation that powers the Hogwarts governance board (`CascadeProjects/Hogwarts/board/`). It defines the visual contract between the operator-facing React+Vite UI and the underlying component system sourced from `gruff`'s design-system tokens.

## Structure

```
hogsmade-design/
├── README.md            # This file
├── tokens/              # Design token overrides (extends gruff design-system/tokens.json)
├── assets/              # Board-specific SVGs, icons, and illustrations
├── components/          # Shared React component stubs (Ink-compatible where applicable)
└── CHANGELOG.md         # Design change log
```

## Token Source

Base tokens are defined in `../design-system/tokens.json` and `../design-system/colors_and_type.css`. Hogsmade-specific overrides extend those tokens for governance-board density and contrast requirements.

```json
{
  "extends": "../design-system/tokens.json",
  "color": {
    "surface": "#0e0e12",
    "accent":  "#7c6af7"
  }
}
```

## SVG Assets

Board-specific SVG assets live in `assets/`. They must pass the `F1` asset-existence gate checked at build time.
Canonical brand assets (logomarks, mark) live in `../design-system/assets/`.

| File | Purpose |
|------|---------|
| `assets/board-mark.svg` | Governance board wordmark |
| `assets/gate-icon.svg`  | GATE envelope indicator icon |

## Usage

### In `board/` (React + Vite)

```ts
import tokens from "../../hogsmade-design/tokens/hogsmade.tokens.json";
```

### CSS custom properties

```css
@import "../../design-system/colors_and_type.css";
/* hogsmade overrides go here */
:root {
  --color-surface: #0e0e12;
  --color-accent:  #7c6af7;
}
```

## Relationship to `gruff` Design System

| Layer | Location | Owns |
|-------|----------|------|
| Core tokens | `design-system/tokens.json` | Color primitives, typography scale, spacing |
| Gruff brand | `design-system/assets/` | `gruff-mark.svg`, `logomark-nodes.svg`, `wheel-icon.svg` |
| Hogsmade overrides | `hogsmade-design/tokens/` | Surface/accent palettes for governance board |
| Board components | `CascadeProjects/Hogwarts/board/src/` | React UI consuming both layers |

## Governance

Changes to tokens that affect the governance board UI require a reviewed PR against `hogsmade` branch. Changes to the core `design-system/tokens.json` propagate automatically and must be backwards-compatible.

## Related

- [`../design-system/README.md`](../design-system/README.md) — base design system
- [`../design-system/SKILL.md`](../design-system/SKILL.md) — design skill reference
- [`CascadeProjects/Hogwarts/board/`](../CascadeProjects/Hogwarts/board/) — governance board UI
- [`CascadeProjects/governors/`](../CascadeProjects/Hogwarts/governors/) — contract YAML layer
