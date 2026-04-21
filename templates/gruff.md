# gruff — workspace tokens and voice

You ran `gruff init`. These files were dropped here:

| File | Purpose |
|---|---|
| `tokens.css` | CSS custom properties — import this in any web project for the full design system |
| `tokens.json` | Same tokens as JSON — for React Native, Figma plugins, or non-CSS tooling |
| `voice.md` | Brand voice guide — language rules, vocabulary, and tone for all written copy |
| `gruff-proportion-v1.schema.json` | JSON Schema for GRUFF proportion payloads (wallboard contract) |
| `gruff.md` | This file |

## Using tokens.css

```css
@import './tokens.css';

.my-button {
  background: var(--amber-500);
  color: var(--primary-fg);
  font-family: var(--font-body);
  border-radius: var(--radius-md);
}
```

## Using tokens.json

```js
import tokens from './tokens.json' assert { type: 'json' };
const primary = tokens['--amber-500']; // '#F59E0B'
```

## Key token reference

```
--amber-500      #F59E0B   primary brand
--cyan-500       #00D9FF   secondary accent
--graphite-950   #0A0A0F   darkest bg
--graphite-900   #14141A   page bg (dark)
--fg-1           #F5F5F8   primary text (dark)
--font-display   Space Grotesk
--font-body      Manrope
--font-mono      JetBrains Mono
```

## Voice in brief

Write to `you`, speak as `we`. Sentence case. GRID all-caps. Measured — not hyped. No emoji. Em dash for interruption. Vocabulary: local-first, understand, gate/pivot/resonance, signal/noise.

See `voice.md` for the full guide.
