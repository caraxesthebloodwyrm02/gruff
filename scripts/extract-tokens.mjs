/**
 * Extracts CSS custom properties from design-system/colors_and_type.css
 * and writes design-system/tokens.json for non-CSS consumers.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const css = readFileSync(join(root, "design-system/colors_and_type.css"), "utf8");

const tokens = {};
const varRe = /--([\w-]+)\s*:\s*([^;]+);/g;
let m;
while ((m = varRe.exec(css)) !== null) {
  tokens[`--${m[1]}`] = m[2].trim();
}

// Resolve simple var() references one level deep
for (const [key, val] of Object.entries(tokens)) {
  const ref = val.match(/^var\(--([\w-]+)\)$/);
  if (ref) {
    const resolved = tokens[`--${ref[1]}`];
    if (resolved && !resolved.startsWith("var(")) {
      tokens[key] = resolved;
    }
  }
}

const out = join(root, "design-system/tokens.json");
writeFileSync(out, JSON.stringify(tokens, null, 2) + "\n");
console.log(`wrote ${Object.keys(tokens).length} tokens to ${out}`);
