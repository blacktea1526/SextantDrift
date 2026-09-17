import fs from 'node:fs';
import path from 'node:path';

export interface FileScannerOptions {
  extensions?: string[];
  ignoredDirs?: string[];
}

const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const DEFAULT_IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage',
];

/**
 * Recursively scans project root directory for source code files,
 * strictly ignoring generated and dependency directories.
 * Returns normalized relative paths from rootDir.
 */
export function scanSourceFiles(rootDir: string, options: FileScannerOptions = {}): string[] {
  const extensions = new Set(options.extensions ?? DEFAULT_EXTENSIONS);
  const ignoredDirs = new Set(options.ignoredDirs ?? DEFAULT_IGNORED_DIRS);
  const results: string[] = [];

  function traverse(currentDir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          traverse(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        // Skip .d.ts files
        if (entry.name.endsWith('.d.ts')) continue;

        if (extensions.has(ext)) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(rootDir, fullPath).split(path.sep).join('/');
          results.push(relativePath);
        }
      }
    }
  }

  traverse(rootDir);
  return results.sort();
}
