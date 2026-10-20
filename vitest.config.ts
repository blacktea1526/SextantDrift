import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@sextant/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@sextant/web-report': path.resolve(__dirname, 'packages/web-report/src/index.ts'),
      '@sextant/mcp-server': path.resolve(__dirname, 'packages/mcp-server/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**', 'src/**'],
      exclude: ['**/tests/**', '**/fixtures/**', '**/dist/**'],
    },
  },
});

