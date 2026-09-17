import { defineConfig } from 'vitest/config';

export default defineConfig({
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
