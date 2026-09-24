import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/sextant-drift': 'src/bin/sextant-drift.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
  banner: {
    js: `import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);`,
  },
  noExternal: ['@sextant/core', 'yaml', 'cac', 'picocolors'],
  external: ['@sextant/web-report'],
});
