import { copyFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = existsSync(join(__dirname, "../package.json"))
  ? resolve(__dirname, "..")
  : resolve(__dirname, "../..");

export async function runInit(outDir: string): Promise<void> {
  const target = resolve(process.cwd(), outDir);
  mkdirSync(target, { recursive: true });

  const copies: Array<{ src: string; dest: string; label: string }> = [
    {
      src: join(PKG_ROOT, "design-system/colors_and_type.css"),
      dest: join(target, "tokens.css"),
      label: "tokens.css",
    },
    {
      src: join(PKG_ROOT, "design-system/tokens.json"),
      dest: join(target, "tokens.json"),
      label: "tokens.json",
    },
    {
      src: join(PKG_ROOT, "design-system/README.md"),
      dest: join(target, "voice.md"),
      label: "voice.md",
    },
    {
      src: join(PKG_ROOT, "templates/gruff.md"),
      dest: join(target, "gruff.md"),
      label: "gruff.md",
    },
    {
      src: join(PKG_ROOT, "schemas/gruff-proportion-v1.schema.json"),
      dest: join(target, "gruff-proportion-v1.schema.json"),
      label: "gruff-proportion-v1.schema.json",
    },
  ];

  for (const { src, dest, label } of copies) {
    if (!existsSync(src)) {
      process.stderr.write(`  skipped ${label} (source not found at ${src})\n`);
      continue;
    }
    copyFileSync(src, dest);
    process.stdout.write(`  wrote  ${dest}\n`);
  }

  process.stdout.write("\ngruff init complete. See gruff.md for usage.\n");
}
