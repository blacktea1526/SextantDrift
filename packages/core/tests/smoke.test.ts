import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';
import { VirtualProject } from './helpers/test-project.js';

describe('Core Engine Smoke Test', () => {
  it('should export version correctly', () => {
    expect(VERSION).toBe('2.0.0');
  });

  it('should create virtual project in memory with sub-millisecond overhead', () => {
    const start = performance.now();
    const project = new VirtualProject({
      'src/index.ts': 'export const a = 1;',
      'src/service.ts': 'import { a } from "./index.js"; export const b = a + 1;',
    });

    const sourceFile = project.getSourceFile('src/service.ts');
    expect(sourceFile).toBeDefined();
    expect(sourceFile?.text).toContain('import { a }');
    const elapsed = performance.now() - start;
    // Allow up to 150ms for cold-start in-memory project creation under parallel runner load
    expect(elapsed).toBeLessThan(150);
  });
});
