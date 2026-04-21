import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/cli.tsx",
    "trust/ingester": "src/trust/ingester.ts",
  },
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  dts: false,
  esbuildOptions(opts) {
    opts.jsx = "automatic";
  },
  external: [
    "better-sqlite3",
    "ink",
    "react",
    "ajv",
    "ajv-formats",
  ],
  noExternal: [],
});
