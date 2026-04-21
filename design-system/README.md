# GRID Design System

**GRID — Geometric Resonance Intelligence Driver.** A privacy-first, local-first code-intelligence framework. This design system captures GRID's visual and verbal brand so designs made here — slides, mocks, product UI, marketing — feel unmistakably GRID.

This is a **warm-tone reread** of GRID's canonical tokens. The source system ships two parallel palettes: a graphite + electric-cyan landing (for hype), and an oklch-blue app chrome (for trust). Both carry a latent amber wheel as the logo. Per the user's direction, this design system **promotes amber/orange to primary** and keeps cyan as a secondary accent. The voice stays measured — warnings and console subtlety consolidated into short, matter-of-fact notes — because GRID is an engineer's tool built by one engineer, and overclaim would ring false.

---

## Sources consulted

Primary sources this system was built from (read-only, treat as unavailable to readers):

- **GitHub — `GRID-INTELLIGENCE/GRID@main`** — canonical app + landing.
  - `README.md` — product positioning, 9 Cognition Patterns, story voice
  - `landing/branding.json`, `landing/css-variables.css`, `landing/brand.js`, `landing/theme.json` — graphite/cyan/amber system, typography (Space Grotesk, Manrope, JetBrains Mono)
  - `landing/assets/logo/wheel-icon.svg` — the wheel mark (copied into `assets/`)
  - `frontend/src/tokens/tokens.json`, `tokens.css`, `index.css` — oklch theme tokens (dark/light/mycelium), Geist font stack, radius/space/motion/shadow scales
  - `frontend/src/components/ui/{button,card,badge,input}.tsx` — component anatomy
  - `frontend/src/components/layout/{AppShell,Sidebar,TitleBar}.tsx` — app chrome
  - `frontend/src/pages/{Dashboard,ChatPage}.tsx` — canonical interior pages
- **Mounted folder `out/`** — a catalog of matplotlib signal-chain / geometric-constraint renders (`gruff_*`, `routine_*`, `signal_chain_*`, `sylveon_*`). These are research visualizations, not brand marketing art — they are GRID's *intellectual aesthetic* (orthogonal axes, constraint pivots, warm-cool contrast, dot grids, arc bundles).
- **GitHub — `caraxesthebloodwyrm02/python-craft`** — sibling research repo; context only, not mined for design.
- **`out/compass_artifact_wf-...text_markdown.md`** — long-form engineering brief; read for voice: specific, citation-heavy, unhurried, will not oversell.
- **`out/signal_chain_gruff.review.md`** — code-review memo; voice model for measured tone.

---

## Index (manifest of this folder)

```
README.md                 this file — start here
SKILL.md                  Claude Skill wrapper (download-compatible)
colors_and_type.css       all CSS custom properties — colors, type, spacing, motion
assets/
  wheel-icon.svg          the canonical wheel mark (amber gradient, 8 spokes)
  logomark-nodes.svg      in-app 4-node logo (used in TitleBar)
  gruff_sketch.png        flagship: GRID geometric field (dot grid + axes + circle)
  signal_chain_gruff.png  signal-chain arc render (data sketch, reference
                          aesthetic for technical figures and diagrams)
  routine_*.png           routine / constraint field variations
  gruff_*.png/gif         compass contrast, shift cycles
  *.gif                   motion references
preview/                  design-system preview cards (registered assets —
                          shown on the Design System tab)
ui_kits/
  app/                    in-app UI kit (Electron/web — Dashboard, Chat,
                          Sidebar, TitleBar)
  landing/                marketing site UI kit (hero, features, CTA)
```

---

## Content fundamentals

GRID's voice is **measured, specific, and quietly confident** — an engineer writing for other engineers. The source README states plainly, "**GRID is built by someone who cares about doing things right — principled, not perfect.**" That is the target register.

### Rules
- **Write to `you`, speak as `we`.** Documentation addresses the reader directly. Authorship is collective ("we build", "we ship") even when the engineer is solo. "I" appears only in the personal story passages ("The Story" section).
- **Sentence case, always.** Headings, buttons, menu items, stat labels. No Title Case except for proper nouns (GRID, Ollama, ChromaDB, Space Grotesk, Light of the Seven).
- **The brand is all-caps. GRID.** Wordmark is uppercase with `0.15em` letter-spacing. In prose, "GRID" stays uppercase; never "Grid".
- **Lead with the verb.** "Understand any codebase in minutes." "Run everything locally." "Pin the version."
- **Measured, not hyped.** Claims are specific and cite evidence: "4,490+ test functions", "+33–40% RAG precision lift", "≥75% coverage". No "revolutionary", "game-changing", "AI-powered" filler. Numbers carry the claim; adjectives do not.
- **Warnings are consolidated and declarative.** Don't echo console noise. Summarize: "Ollama offline — degraded mode" beats "Error: ECONNREFUSED 127.0.0.1:11434 at tcp_wrap.c:233". The source logs are raw; the UI message is the distilled note.
- **No emoji in product UI.** Emoji appears only in `branding.json` as a fallback logo (`🛞`) and occasional GitHub markdown blockquotes (`> [!IMPORTANT]`). Never in buttons, menus, toasts, or body copy.
- **Em dash, not arrow, for inline thought.** "Local-first by default — no data leaves your machine." Use `→` only in diagrams and flow descriptions ("Source → Compress → Limit → Output").

### Vocabulary
- **"Local-first"** (hyphenated) not "offline-first". "Privacy-first" not "private-first".
- **"Understand"** is the product verb. GRID doesn't "analyze" code — it helps you *understand* it. "Understand any codebase in minutes" is the tagline and should not be softened.
- **"Gate"** / **"pivot"** / **"resonance"** / **"fabric"** / **"mycelium"** / **"cognition pattern"** are proper system nouns. Capitalize when referring to the module; lowercase when used generically.
- **"Signal" and "noise"** — recurring frame. From the story: "separate signal from noise, compress it into a structured core, and keep moving." Use this framing instead of "performance" or "optimization" when context allows.
- **"MIST"** — the named state for "high confidence that we don't know". Epistemic humility is a core value; the system *admits* when it's uncertain.

### Examples
- ✓ *"Your code never leaves your machine."* (plain, specific, verifiable)
- ✗ *"Revolutionary privacy-first AI that empowers developers!"* (hype, vague, unearned)
- ✓ *"Ollama offline. Retrying in 3s."* (state + consequence)
- ✗ *"Oh no! Something went wrong 😔 Please try again later!"* (emotive, emoji, vague)
- ✓ *"9 Cognition Patterns. 200K lines. 4,490 tests. MIT."* (facts in sequence)
- ✓ *"Principled, not perfect."* (self-aware, low-fi confident)

---

## Visual foundations

### Palette (warm-tone reread)
- **Primary — amber / orange.** `#F59E0B` is primary; it darkens to `#D97706` on press and lightens to `#FBBF24` on hover. This carries heroes, CTAs, focus rings, active nav, and the logo gradient (`#FBBF24 → #F59E0B → #D97706`).
- **Neutrals — graphite.** An eleven-stop cool-dark ramp (`#FAFAFC → #0A0A0F`). The app runs dark-first; surfaces are `#14141A`, cards are `#17171F`, borders are translucent white at 8–18% alpha.
- **Secondary accent — electric cyan.** `#00D9FF` — kept from the landing palette for contrast glints in data viz (signal-chain arcs, success edges), never for CTAs.
- **Ember** (`#C2410C`, `#9A3412`) — reserved deeper orange used only for diagrams and rare high-contrast emphasis. Don't pair with amber in the same button.
- **Semantic** — success `#059669`, warning `#D97706` (same as primary-press — the system *is* the warning tone), error `#DC2626`, info `#0891B2`.

### Typography
- **Display** — Space Grotesk (500/600/700). Geometric, slightly quirky, reads technical without feeling brittle. Used for H1–H4, wordmarks, stat values.
- **Body** — Manrope (400/500/600). Calm, open counters, high x-height. Used for paragraphs, UI labels, metadata.
- **Mono** — JetBrains Mono (400/500). Used for code samples, version strings, telemetry readouts, numeric ratios.
- **Substitution note** — the canonical frontend ships **Geist Sans / Geist Mono** via local `@font-face`. We standardize on Space Grotesk / Manrope / JetBrains Mono here because they're all on Google Fonts and load cleanly in any HTML artifact. **If you have Geist Variable woff2s, drop them in `assets/fonts/` and swap the `@import` for a local `@font-face` block** — this is flagged as a substitution.
- **Scale** — see `colors_and_type.css`. Body default is 15px (0.9375rem) to match the app's tight density; display tops out at 64px for hero.
- **Tracking** — tight (`-0.02em`) for display, normal for body, `0.15em` for the GRID wordmark, `0.06em` for eyebrow meta.

### Spacing
4-px base grid. Canonical stops: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Interior card padding is typically 20–24. Gap between stat cards is 16. Page gutters are 24 on mobile, 48–64 on desktop.

### Radius
`sm 6 / md 10 / lg 14 / xl 20 / 2xl 28 / full`. The default from the app tokens is `0.625rem` (10px). Buttons are 6–10; cards are 14–20; modals and feature tiles are 20–28. Pills/badges are `full`.

### Backgrounds
- **Dark-first.** `#14141A` (graphite-900) is the default page; `#0A0A0F` (graphite-950) is for full-bleed heroes and deep framing panels.
- **No gradient backgrounds as decoration.** The landing page uses solid fills with a single amber-glow accent. Reserve gradients for the logo and for the occasional amber-radial hero halo (`radial-gradient(circle at 50% 0%, rgba(245,158,11,0.18), transparent 60%)`).
- **Technical renders as imagery.** The `assets/gruff_*.png` and `assets/routine_*.png` files — dot grids, constraint axes, signal-chain arcs — are GRID's native image vocabulary. Use them full-bleed for technical landing panels and slide backgrounds; they communicate the product's geometry-as-epistemology stance without stock-photo fake.
- **No stock photos. No AI-generated illustration.** If an image slot can't be filled with a real technical render or logo, leave a labeled placeholder.

### Animation
- **Durations** — fast 120, normal 200, slow 350, organic 600.
- **Easings** — `cubic-bezier(0.4,0,0.2,1)` as default. `cubic-bezier(0.34,1.56,0.64,1)` for organic entrances (mycelium/network metaphor). `cubic-bezier(0,0,0.2,1)` for decelerate.
- **`pulse-organic`** — the logomark breathes on 2s infinite (opacity 1 → 0.6 → 1). This is the only built-in looping animation; use sparingly.
- **`fade-in`** on page mount with 4px upward drift. `animate-shimmer` on skeleton loaders at 1.5s linear. `animate-grow` for newly-inserted graph nodes (scale 0.8 → 1.02 overshoot → 1, 600ms organic).
- **No bouncing UI chrome.** Organic easing is for the *content* metaphor (nodes growing, connections drawing). Buttons and menus use the straight `ease-std`.

### Hover / press
- **Hover on primary** — lightens by one stop (`--primary` → `--primary-hover`, i.e. `amber-500` → `amber-400`). Optional `glow-amber` box-shadow halo.
- **Hover on ghost / nav** — background becomes `accent` (amber at 14% alpha) and the row translates `0.5px` to the right. This "nudge" is the sidebar's signature.
- **Press** — darkens one stop (`--primary` → `--primary-press`). No shrink/scale — GRID doesn't squish.
- **Focus** — 2px ring at `--primary` with `focus-visible` only. Keyboard users see amber; mouse users see nothing extra.
- **Disabled** — opacity 0.5, pointer-events: none.

### Borders
Hairline (`rgba(255,255,255,0.08)`) is the default card edge. Emphasized borders (`0.12–0.18`) mark focus areas. Amber borders at 35% alpha (`--primary-border`) mark the *active* or *primary-soft* state (e.g. an amber chip on dark).

### Shadows / glow
- **Shadows are cool and soft** (`rgba(0,0,0,0.35)` at low blur, growing to `0.50` at xl). Use them sparingly on dark — depth in GRID comes from border contrast, not drop shadow.
- **Glow halos are reserved for primary.** `--glow-amber` (32px, 28% alpha) on hover of primary CTAs. `--glow-amber-strong` for the hero logomark and featured stat cards.
- **Cyan glow** only on data-viz success states — not chrome.

### Transparency & blur
Glass panels (`--surface-glass`) use `rgba(30, 30, 40, 0.55)` with `backdrop-filter: blur(12px)` and a 6% white hairline. Reserved for TitleBar, modal backdrops, and floating panels over content. Never behind primary body copy — legibility first.

### Corner radii, cards
- **Card** — 14–20px radius, `--surface-card` fill (`#17171F`), `--border-2` hairline, `--shadow-sm` (or none on dense grids). No inner shadow.
- **Hover card** — add `--glow-amber` at 15% strength (`hover:glow-primary` in the source).
- **Glass card** — `.glass` utility — background `oklch(0.17 0 0 / 0.6)`, 12px backdrop blur, 6% white border.

### Layout rules (fixed elements)
- **TitleBar** — 40px tall, sticks to top. Holds the nodes-logomark (pulsing) + "GRID" wordmark on the left; window controls on the right (Electron only).
- **Sidebar** — 224px (w-56), full-height under TitleBar, border-right hairline. Sections labelled with 10px uppercase widest-tracked meta. Active nav items get a 2×20px amber bar on the left and colored amber text (no fill).
- **Main** — remaining width, 24px padding, vertical scroll.

### Data viz
The matplotlib figures in `assets/` define the house style for diagrams: ivory backgrounds (when used), dot-grid baselines, straight orthogonal axes, arcs in layered amber/ember/cyan/graphite, labeled pivots at metric thresholds. Emulate this when producing new diagrams; don't drift into rainbow or pastel.

---

## Iconography

- **Primary icon set — Lucide.** The frontend imports `lucide-react` ubiquitously (`Bot`, `Circle`, `Shield`, `RefreshCw`, `Send`, `User`, `Minus`, `Square`, `X`, `Copy`, etc.). Stroke-based, 1.5–1.75 stroke width, rounded joins, 24×24 grid. **Ship CDN Lucide for all generic UI iconography.**
  - Load via `<script src="https://unpkg.com/lucide@latest"></script>` + `lucide.createIcons()` or inline SVG from [lucide.dev](https://lucide.dev).
- **Brand marks** (do not substitute):
  - `assets/wheel-icon.svg` — the **wheel**. 8 spokes, amber radial gradient (`#FBBF24 → #F59E0B → #D97706`), hub-and-rim topology, subtle Gaussian glow filter. Used as favicon, hero logomark, and as `🛞` (emoji) fallback in plain-text contexts.
  - `assets/logomark-nodes.svg` — the **nodes mark**. 4 nodes at corners of a square, 5 connecting edges (4 perimeter at 50% opacity, 1 diagonal at 30%), amber fills. Used in the Electron TitleBar at 20×20. Can be recolored to `currentColor` for inline use.
- **Emoji** — only `🛞` as logo fallback. Never as UI ornament, never in buttons, never in prose.
- **Unicode arrows** — `→` is used in diagrams and flow copy ("Source → Compress → Output"). `•` as separator. Em dash `—` for inline breaks. No `▶`, `✓`, `✗`, `★` in UI chrome.
- **Icons inside chips/stat cards** — 16–20px, colored `--primary` or `--fg-2`, inside a 40px square tile with `--accent-soft` fill and radius `md`.
- **Technical diagrams (`out/*.png`)** — these are not icons; they're full-bleed research figures. Don't try to extract or shrink them below 400px wide.

---

## What's here, briefly

- Design tokens: `colors_and_type.css`
- Brand assets: `assets/`
- Component preview cards: `preview/` (registered for the Design System tab)
- UI kit — in-app (Dashboard / Chat / Sidebar): `ui_kits/app/`
- UI kit — marketing landing: `ui_kits/landing/`
- Claude Skill wrapper: `SKILL.md`

Import `colors_and_type.css` into any HTML artifact to inherit the palette and type scale. Use the `ds-*` helper classes for quick semantic typography. Copy the SVGs in `assets/` rather than inlining them — the filters (`#glow`, `#wheelGradient`) are preserved.
