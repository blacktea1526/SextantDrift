import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'bin/mcp-server': 'src/bin/mcp-server.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
  noExternal: ['@sextant/core'],
  external: ['typescript', 'yaml'],
  define: {
    __MCP_VERSION__: JSON.stringify(pkg.version),
  },
});
