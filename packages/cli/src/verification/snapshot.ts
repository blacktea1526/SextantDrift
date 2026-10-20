import fs from 'node:fs';
import path from 'node:path';
import { resolveTargetArchitecture, createVersionBinding } from '@sextant/core';
import type { TargetArchitecture, VersionBinding, ContentFile } from '@sextant/core';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.sextant',
  'dist',
  'coverage',
  '.omx',
  '.scratch',
]);

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function isExcludedPath(posixPath: string): boolean {
  return posixPath.split('/').some((part) => EXCLUDED_DIRS.has(part));
}

function scanFilesRecursively(dir: string, rootDir: string): ContentFile[] {
  const results: ContentFile[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFilesRecursively(fullPath, rootDir));
    } else if (entry.isFile()) {
      const relPath = toPosixPath(path.relative(rootDir, fullPath));
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        results.push({ path: relPath, content });
      } catch {
        // Skip unreadable files
      }
    }
  }
  return results;
}

function resolveConfigRelPath(rootDir: string, customSpecPath?: string): string | null {
  if (customSpecPath) {
    const full = path.isAbsolute(customSpecPath) ? customSpecPath : path.resolve(rootDir, customSpecPath);
    return toPosixPath(path.relative(rootDir, full));
  }
  if (fs.existsSync(path.resolve(rootDir, 'sextant.json'))) {
    return 'sextant.json';
  }
  if (fs.existsSync(path.resolve(rootDir, '.sextant/architecture.json'))) {
    return '.sextant/architecture.json';
  }
  if (fs.existsSync(path.resolve(rootDir, 'ARCHITECTURE.md'))) {
    return 'ARCHITECTURE.md';
  }
  if (fs.existsSync(path.resolve(rootDir, 'AGENTS.md'))) {
    return 'AGENTS.md';
  }
  return null;
}

const compareBytes = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort(compareBytes).map((key) => [key, item[key]]));
    }
    return item;
  });
}

function getConfigContentWithoutConfirmation(fullPath: string): string {
  const raw = fs.readFileSync(fullPath, 'utf8');
  if (fullPath.endsWith('.json')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.acceptance && typeof parsed.acceptance === 'object') {
          delete parsed.acceptance.confirmation;
        }
        return canonicalJson(parsed);
      }
    } catch {
      // ignore
    }
  }
  return raw;
}

export function snapshotVerification(
  rootDir: string,
  configPath?: string,
): { architecture: TargetArchitecture; versions?: VersionBinding } {
  const architecture = resolveTargetArchitecture(rootDir, configPath);
  if (!architecture.acceptance) {
    return { architecture };
  }

  const acceptance = architecture.acceptance;
  const configRelPath = resolveConfigRelPath(rootDir, configPath);

  // 1. Source files: tracked source/config inputs under root, at minimum src/** plus package.json/tsconfig/vitest config
  const sourceMap = new Map<string, string>();
  const srcDir = path.resolve(rootDir, 'src');
  if (fs.existsSync(srcDir)) {
    for (const file of scanFilesRecursively(srcDir, rootDir)) {
      sourceMap.set(file.path, file.content);
    }
  }

  const rootCandidateFiles = [
    'package.json',
    'tsconfig.json',
    'vitest.config.ts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.config.cjs',
    'vitest.config.mts',
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
    'vite.config.mts',
  ];
  for (const name of rootCandidateFiles) {
    const full = path.resolve(rootDir, name);
    if (fs.existsSync(full)) {
      sourceMap.set(name, fs.readFileSync(full, 'utf8'));
    }
  }

  // Also check component paths for any other source directories (e.g. lib/**, packages/**)
  for (const comp of architecture.components || []) {
    for (const pattern of comp.paths || []) {
      const baseDir = pattern.replace(/[\*\?\[\]].*$/, '').replace(/\/+$/, '');
      if (baseDir && !baseDir.startsWith('.') && !baseDir.startsWith('/')) {
        const full = path.resolve(rootDir, baseDir);
        if (fs.existsSync(full) && fs.statSync(full).isDirectory() && baseDir !== 'src') {
          for (const file of scanFilesRecursively(full, rootDir)) {
            if (!sourceMap.has(file.path)) {
              sourceMap.set(file.path, file.content);
            }
          }
        }
      }
    }
  }

  // If still empty (e.g. no src/ and no configs), fallback scan rootDir excluding EXCLUDED_DIRS, tests and docs
  if (sourceMap.size === 0) {
    const entries = fs.readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry.name) || ['tests', 'test', 'docs', 'doc'].includes(entry.name)) continue;
      const full = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        for (const file of scanFilesRecursively(full, rootDir)) {
          sourceMap.set(file.path, file.content);
        }
      } else if (entry.isFile()) {
        const rel = toPosixPath(path.relative(rootDir, full));
        sourceMap.set(rel, fs.readFileSync(full, 'utf8'));
      }
    }
  }

  const sourceFiles: ContentFile[] = Array.from(sourceMap.entries()).map(([p, content]) => ({
    path: p,
    content,
  }));

  // 2. Design files: referenced by requirement.designRef before # anchors + fallback config file so manifest is non-empty
  const designMap = new Map<string, string>();
  for (const req of acceptance.requirements || []) {
    if (!req.designRef) continue;
    const designFileRef = req.designRef.split('#')[0].trim();
    if (!designFileRef) continue;

    if (
      path.isAbsolute(designFileRef) ||
      designFileRef.startsWith('/') ||
      designFileRef.split('/').some((part) => part === '.' || part === '..')
    ) {
      throw new Error(`Referenced design file must be a project-relative POSIX path: "${designFileRef}"`);
    }

    const full = path.resolve(rootDir, designFileRef);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw new Error(`Referenced design file not found: "${designFileRef}"`);
    }

    designMap.set(toPosixPath(designFileRef), fs.readFileSync(full, 'utf8'));
  }

  // Fallback to config file if design files manifest is otherwise empty
  if (designMap.size === 0 && configRelPath) {
    if (!isExcludedPath(configRelPath)) {
      const full = path.resolve(rootDir, configRelPath);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        designMap.set(configRelPath, getConfigContentWithoutConfirmation(full));
      }
    }
  }

  const designFiles: ContentFile[] = Array.from(designMap.entries()).map(([p, content]) => ({
    path: p,
    content,
  }));

  // 3. Acceptance files: configured check.testFile files plus config file content, excluding output dirs
  const acceptanceMap = new Map<string, string>();
  for (const check of acceptance.checks || []) {
    if (!check.testFile) {
      throw new Error(`Configured check test file must be a non-empty string`);
    }
    const testFile = check.testFile.trim();
    if (
      path.isAbsolute(testFile) ||
      testFile.startsWith('/') ||
      testFile.split('/').some((part) => part === '.' || part === '..')
    ) {
      throw new Error(`Configured check test file must be a project-relative POSIX path: "${testFile}"`);
    }

    const full = path.resolve(rootDir, testFile);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw new Error(`Configured check test file not found: "${testFile}"`);
    }

    const relPosix = toPosixPath(testFile);
    if (!isExcludedPath(relPosix)) {
      acceptanceMap.set(relPosix, fs.readFileSync(full, 'utf8'));
    }
  }

  if (configRelPath && !isExcludedPath(configRelPath)) {
    const full = path.resolve(rootDir, configRelPath);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      acceptanceMap.set(configRelPath, getConfigContentWithoutConfirmation(full));
    }
  }

  const acceptanceFiles: ContentFile[] = Array.from(acceptanceMap.entries()).map(([p, content]) => ({
    path: p,
    content,
  }));

  const versions = createVersionBinding({
    sourceFiles,
    designFiles,
    acceptanceFiles,
    config: architecture,
  });

  return { architecture, versions };
}
