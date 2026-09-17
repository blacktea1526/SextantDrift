import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { scanSourceFiles } from '../../src/analyzer/file-scanner.js';

describe('File Scanner', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-scanner-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should scan source files and ignore node_modules and dist', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'node_modules/pkg'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });

    fs.writeFileSync(path.join(tmpDir, 'src/main.ts'), 'export const a = 1;');
    fs.writeFileSync(path.join(tmpDir, 'src/types.d.ts'), 'export type X = string;');
    fs.writeFileSync(path.join(tmpDir, 'node_modules/pkg/index.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(tmpDir, 'dist/bundle.js'), '// bundled');

    const files = scanSourceFiles(tmpDir);
    expect(files).toEqual(['src/main.ts']);
  });

  it('should support ts, tsx, js, jsx', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src/app.tsx'), 'export const App = () => null;');
    fs.writeFileSync(path.join(tmpDir, 'src/util.js'), 'export const util = {};');
    fs.writeFileSync(path.join(tmpDir, 'src/readme.md'), '# Readme');

    const files = scanSourceFiles(tmpDir);
    expect(files).toEqual(['src/app.tsx', 'src/util.js']);
  });
});
