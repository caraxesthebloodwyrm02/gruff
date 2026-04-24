import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.tsx', 'src/trust/db.ts', 'src/trust/ingester.ts', 'src/trust/scorer.ts'],
  dts: false,
  splitting: false,
  outDir: 'dist',
  platform: 'node',
  format: ['cjs'],
  sourcemap: true,
});
