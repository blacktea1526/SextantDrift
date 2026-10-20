import fs from 'node:fs';
import path from 'node:path';
import { ResolvedTarget } from './path-resolver.js';

export interface GoReplaceDirective {
  oldPath: string;
  newPath: string;
}

export interface GoResolverOptions {
  scannedFiles?: Set<string>;
  /** When set, skip go.mod on disk and use this module identity. */
  modulePath?: string;
  /** Directory of go.mod relative to rootDir. Empty string means the project root. */
  moduleRoot?: string;
  replaces?: GoReplaceDirective[];
}

/**
 * Top-level Go standard library path prefixes (Go 1.22–1.24).
 * A match is external and is not an architecture edge.
 */
export const GO_STDLIB_MODULES = new Set<string>([
  'archive',
  'bufio',
  'builtin',
  'bytes',
  'cmp',
  'compress',
  'container',
  'context',
  'crypto',
  'database',
  'debug',
  'embed',
  'encoding',
  'errors',
  'expvar',
  'flag',
  'fmt',
  'go',
  'hash',
  'html',
  'image',
  'index',
  'io',
  'iter',
  'log',
  'maps',
  'math',
  'mime',
  'net',
  'os',
  'path',
  'plugin',
  'reflect',
  'regexp',
  'runtime',
  'slices',
  'sort',
  'strconv',
  'strings',
  'structs',
  'sync',
  'syscall',
  'testing',
  'text',
  'time',
  'unicode',
  'unique',
  'unsafe',
  'weak',
]);

interface GoModuleInfo {
  modulePath: string;
  moduleRootRel: string;
  replaces: GoReplaceDirective[];
}

const goModCache = new Map<string, { key: string; info: GoModuleInfo | null }>();

export function clearGoModuleCache(): void {
  goModCache.clear();
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

function unquote(token: string): string {
  if (token.length >= 2) {
    const q = token[0];
    if ((q === '"' || q === '`') && token.endsWith(q)) {
      return token.slice(1, -1);
    }
  }
  return token;
}

function stripGoModComment(line: string): string {
  let inQuote: '"' | '`' | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === '`') {
      inQuote = ch;
      continue;
    }
    if (ch === '/' && line[i + 1] === '/') return line.slice(0, i);
  }
  return line;
}

function parseReplaceClause(clause: string): GoReplaceDirective | null {
  const parts = clause.split('=>');
  if (parts.length !== 2) return null;
  const left = unquote((parts[0].trim().split(/\s+/)[0] ?? '').trim());
  const right = unquote((parts[1].trim().split(/\s+/)[0] ?? '').trim());
  if (!left || !right) return null;
  return { oldPath: left, newPath: right };
}

export function parseGoMod(content: string): { modulePath: string; replaces: GoReplaceDirective[] } | null {
  let modulePath = '';
  const replaces: GoReplaceDirective[] = [];
  let block: 'none' | 'replace' | 'other' = 'none';

  for (const rawLine of content.split('\n')) {
    const trimmed = stripGoModComment(rawLine).trim();
    if (!trimmed) continue;

    if (trimmed === ')') {
      block = 'none';
      continue;
    }
    if (block === 'other') continue;
    if (block === 'replace') {
      const directive = parseReplaceClause(trimmed);
      if (directive) replaces.push(directive);
      continue;
    }

    if (trimmed.startsWith('module ') || trimmed === 'module') {
      const token = unquote((trimmed.slice('module'.length).trim().split(/\s+/)[0] ?? '').trim());
      if (token) modulePath = token;
      continue;
    }

    if (trimmed.startsWith('replace ') || trimmed === 'replace') {
      const rest = trimmed.slice('replace'.length).trim();
      if (rest.startsWith('(')) {
        const inner = rest.slice(1).trim();
        const close = inner.indexOf(')');
        if (close === -1) {
          block = 'replace';
        } else {
          const directive = parseReplaceClause(inner.slice(0, close));
          if (directive) replaces.push(directive);
        }
      } else {
        const directive = parseReplaceClause(rest);
        if (directive) replaces.push(directive);
      }
      continue;
    }

    if (/^(require|exclude|retract)\b/.test(trimmed) && trimmed.endsWith('(')) {
      block = 'other';
    }
  }

  if (!modulePath) return null;
  return { modulePath, replaces };
}

function isMajorVersionSegment(segment: string): boolean {
  return /^v(0|[1-9][0-9]*)$/.test(segment) && segment !== 'v0' && segment !== 'v1';
}

function isInModule(specifier: string, modulePath: string): boolean {
  if (specifier === modulePath) return true;
  const prefix = modulePath + '/';
  if (!specifier.startsWith(prefix)) return false;
  const next = specifier.slice(prefix.length).split('/')[0] ?? '';
  // github.com/acme/app/v2 is a different module from github.com/acme/app.
  if (isMajorVersionSegment(next) && !modulePath.endsWith('/' + next)) return false;
  return true;
}

function isLocalReplacePath(newPath: string): boolean {
  return newPath.startsWith('./') || newPath.startsWith('../');
}

function resolveLocalDir(moduleRootRel: string, relPath: string): string | null {
  const base = moduleRootRel === '' ? '.' : moduleRootRel;
  const normalized = path.posix.normalize(path.posix.join(base, relPath));
  if (normalized === '..' || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
    return null;
  }
  if (normalized === '.') return '';
  return normalized;
}

function findGoModFile(rootDir: string, sourceFilePath: string): string | null {
  const root = path.resolve(rootDir);
  const sourceDir = path.resolve(root, toPosix(sourceFilePath), '..');
  const sourceRel = path.relative(root, sourceDir);
  let dir = sourceRel.startsWith('..') || path.isAbsolute(sourceRel) ? root : sourceDir;

  for (;;) {
    const candidate = path.join(dir, 'go.mod');
    if (fs.existsSync(candidate)) return candidate;
    if (path.resolve(dir) === root) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    const parentRel = path.relative(root, parent);
    if (parentRel.startsWith('..') || path.isAbsolute(parentRel)) return null;
    dir = parent;
  }
}

function loadGoModule(rootDir: string, sourceFilePath: string): GoModuleInfo | null {
  const goModPath = findGoModFile(rootDir, sourceFilePath);
  if (!goModPath) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(goModPath);
  } catch {
    return null;
  }
  const cacheKey = `${stat.mtimeMs}:${stat.size}`;
  const cached = goModCache.get(goModPath);
  if (cached && cached.key === cacheKey) {
    return cached.info;
  }

  let content: string;
  try {
    content = fs.readFileSync(goModPath, 'utf-8');
  } catch {
    return null;
  }
  const parsed = parseGoMod(content);
  const moduleRootRel = toPosix(path.relative(path.resolve(rootDir), path.dirname(goModPath)));
  const info: GoModuleInfo | null = parsed
    ? {
        modulePath: parsed.modulePath,
        moduleRootRel: moduleRootRel === '' || moduleRootRel === '.' ? '' : moduleRootRel,
        replaces: parsed.replaces,
      }
    : null;
  goModCache.set(goModPath, { key: cacheKey, info });
  return info;
}

function listGoFilesInDir(
  rootDir: string,
  dirRel: string,
  scanned?: Set<string>
): string[] {
  const prefix = dirRel === '' ? '' : dirRel.replace(/\/$/, '') + '/';
  if (scanned) {
    const matches: string[] = [];
    for (const file of scanned) {
      if (!file.endsWith('.go')) continue;
      if (prefix === '') {
        if (!file.includes('/')) matches.push(file);
      } else if (file.startsWith(prefix) && !file.slice(prefix.length).includes('/')) {
        matches.push(file);
      }
    }
    return matches.sort();
  }

  const abs = path.resolve(rootDir, dirRel === '' ? '.' : dirRel);
  let names: string[];
  try {
    names = fs.readdirSync(abs);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.endsWith('.go'))
    .map((name) => (prefix === '' ? name : prefix + name))
    .sort();
}

function pickPackageFile(files: string[]): string | null {
  return files.find((file) => !file.endsWith('_test.go')) ?? files[0] ?? null;
}

function internalTarget(rootDir: string, targetPath: string): ResolvedTarget {
  return {
    type: 'internal',
    targetPath,
    fullPath: path.resolve(rootDir, targetPath),
  };
}

/**
 * Resolves a Go import path to an internal package file, an external module, or an unresolved diagnostic.
 * Internal edges require a go.mod module path (or an explicit modulePath option) so third-party modules stay external.
 */
export function resolveGoModulePath(
  rootDir: string,
  sourceFilePath: string,
  rawSpecifier: string,
  options?: GoResolverOptions
): ResolvedTarget {
  const specifier = rawSpecifier.trim();
  if (!specifier) {
    return {
      type: 'unresolved',
      rawSpecifier,
      reason: 'Empty Go import path',
      sourceFile: sourceFilePath,
    };
  }

  if (specifier === 'C') {
    return { type: 'external', packageName: 'C', rawSpecifier: specifier };
  }

  const module: GoModuleInfo | null =
    options?.modulePath !== undefined
      ? {
          modulePath: options.modulePath,
          moduleRootRel: options.moduleRoot ?? '',
          replaces: options.replaces ?? [],
        }
      : loadGoModule(rootDir, sourceFilePath);

  const scanned = options?.scannedFiles;
  const replaces = [...(module?.replaces ?? [])].sort((a, b) => b.oldPath.length - a.oldPath.length);
  let effective = specifier;
  let localDir: string | null = null;

  for (const directive of replaces) {
    if (specifier !== directive.oldPath && !specifier.startsWith(directive.oldPath + '/')) continue;
    const suffix = specifier === directive.oldPath ? '' : specifier.slice(directive.oldPath.length + 1);
    if (isLocalReplacePath(directive.newPath)) {
      const relocated = resolveLocalDir(
        module?.moduleRootRel ?? '',
        suffix ? `${directive.newPath}/${suffix}` : directive.newPath
      );
      if (relocated === null) {
        return {
          type: 'unresolved',
          rawSpecifier: specifier,
          reason: `Go replace for "${specifier}" points outside the project root`,
          sourceFile: sourceFilePath,
        };
      }
      localDir = relocated;
    } else {
      effective = suffix ? `${directive.newPath}/${suffix}` : directive.newPath;
    }
    break;
  }

  if (localDir !== null) {
    const file = pickPackageFile(listGoFilesInDir(rootDir, localDir, scanned));
    if (!file) {
      return {
        type: 'unresolved',
        rawSpecifier: specifier,
        reason: `Replaced Go package "${specifier}" has no .go files in "${localDir || '.'}"`,
        sourceFile: sourceFilePath,
      };
    }
    return internalTarget(rootDir, file);
  }

  if (module && isInModule(effective, module.modulePath)) {
    const sub = effective === module.modulePath ? '' : effective.slice(module.modulePath.length + 1);
    if (sub.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
      return {
        type: 'unresolved',
        rawSpecifier: specifier,
        reason: `Go import "${specifier}" is not a clean path under module "${module.modulePath}"`,
        sourceFile: sourceFilePath,
      };
    }
    const dir = sub ? (module.moduleRootRel ? `${module.moduleRootRel}/${sub}` : sub) : module.moduleRootRel;
    const file = pickPackageFile(listGoFilesInDir(rootDir, dir, scanned));
    if (!file) {
      return {
        type: 'unresolved',
        rawSpecifier: specifier,
        reason: `Go package "${specifier}" matched module "${module.modulePath}" but no .go file was found in "${dir || '.'}"`,
        sourceFile: sourceFilePath,
      };
    }
    return internalTarget(rootDir, file);
  }

  const top = effective.split('/')[0] ?? effective;
  if (top.includes('.') || GO_STDLIB_MODULES.has(top)) {
    return { type: 'external', packageName: effective, rawSpecifier: specifier };
  }

  return {
    type: 'unresolved',
    rawSpecifier: specifier,
    reason: module
      ? `Go import "${specifier}" is not in module "${module.modulePath}" and is not a known standard library package`
      : `Go import "${specifier}" could not be resolved because no go.mod module path was found`,
    sourceFile: sourceFilePath,
  };
}
