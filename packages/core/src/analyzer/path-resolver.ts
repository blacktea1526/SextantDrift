import path from 'node:path';
import fs from 'node:fs';

export interface TsConfigPaths {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

import { resolveModuleWithTsCompiler, clearTsResolverCache, ResolvedTarget } from './ts-project-resolver.js';
export { ResolvedTarget } from './ts-project-resolver.js';

/**
 * Loads compilerOptions baseUrl and paths from tsconfig.json
 */
export function loadTsConfigPaths(rootDir: string, customTsconfigPath?: string): TsConfigPaths | null {
  const tsconfigPath = customTsconfigPath
    ? (path.isAbsolute(customTsconfigPath) ? customTsconfigPath : path.resolve(rootDir, customTsconfigPath))
    : path.resolve(rootDir, 'tsconfig.json');

  if (!fs.existsSync(tsconfigPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf-8');
    // Remove comments from tsconfig JSON if any
    const sanitized = raw.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '$1');
    const parsed = JSON.parse(sanitized);
    const compilerOptions = parsed.compilerOptions || {};
    return {
      baseUrl: compilerOptions.baseUrl,
      paths: compilerOptions.paths,
    };
  } catch {
    return null;
  }
}

/**
 * Normalizes file path to strip extension and use forward slashes
 */
export function normalizePath(p: string): string {
  const forward = p.split(path.sep).join('/');
  return forward
    .replace(/\.(ts|tsx|js|jsx|mjs|cjs|py)$/, '')
    .replace(/\/index$/, '')
    .replace(/\/__init__$/, '');
}

/**
 * Extracts the base package name from an external specifier
 * e.g. '@prisma/client/runtime' -> '@prisma/client', 'lodash/get' -> 'lodash'
 */
export function getPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

const workspacePackageCache = new Map<string, Map<string, string>>();

export function clearWorkspacePackageCache(): void {
  workspacePackageCache.clear();
}

/**
 * Discovers and caches monorepo workspace packages from packages/*
 */
export function loadWorkspacePackages(rootDir: string): Map<string, string> {
  const cached = workspacePackageCache.get(rootDir);
  if (cached) return cached;

  const pkgMap = new Map<string, string>();
  const packagesDir = path.resolve(rootDir, 'packages');
  if (fs.existsSync(packagesDir)) {
    try {
      const pkgEntries = fs.readdirSync(packagesDir, { withFileTypes: true });
      for (const entry of pkgEntries) {
        if (entry.isDirectory()) {
          const pkgJsonPath = path.join(packagesDir, entry.name, 'package.json');
          if (fs.existsSync(pkgJsonPath)) {
            const rawPkg = fs.readFileSync(pkgJsonPath, 'utf-8');
            const pkgJson = JSON.parse(rawPkg);
            if (pkgJson.name) {
              const srcIndex = path.join('packages', entry.name, 'src', 'index.ts');
              const candidate = fs.existsSync(path.resolve(rootDir, srcIndex))
                ? srcIndex
                : path.join('packages', entry.name, pkgJson.main || 'src/index.ts');
              pkgMap.set(pkgJson.name, normalizePath(candidate));
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  workspacePackageCache.set(rootDir, pkgMap);
  return pkgMap;
}

const resolutionCache = new Map<string, ResolvedTarget>();

export function clearResolutionCache(): void {
  resolutionCache.clear();
  clearTsResolverCache();
}

/**
 * Resolves a module specifier to an internal relative file path, external package, or unresolved diagnostic
 */
export function resolveModulePath(
  rootDir: string,
  sourceFilePath: string,
  rawSpecifier: string,
  tsConfigPaths?: TsConfigPaths | null,
  options?: { customTsconfigPath?: string }
): ResolvedTarget {
  const normRootDir = rootDir.split('\\').join('/');
  const normSource = sourceFilePath.split('\\').join('/');
  const pathsKey = tsConfigPaths ? `${tsConfigPaths.baseUrl || ''}:${JSON.stringify(tsConfigPaths.paths || {})}` : '';
  const cacheKey = `${normRootDir}\0${normSource}\0${rawSpecifier}\0${pathsKey}\0${options?.customTsconfigPath || ''}`;
  const cached = resolutionCache.get(cacheKey);
  if (cached) return cached;

  // 1. If explicit in-memory tsConfigPaths is provided (e.g. In synthetic tests), try paths first
  if (tsConfigPaths?.paths) {
    const matched = resolveFromTsConfigPaths(rootDir, rawSpecifier, tsConfigPaths);
    if (matched) {
      resolutionCache.set(cacheKey, matched);
      return matched;
    }
  }

  // 2. Delegate to official TypeScript Compiler API module resolution
  const tsResult = resolveModuleWithTsCompiler(rootDir, sourceFilePath, rawSpecifier, {
    customTsconfigPath: options?.customTsconfigPath,
  });

  // If tsResult is unresolved but in-memory relative resolution is possible (e.g. synthetic non-disk tests)
  if (tsResult.type === 'unresolved' && (rawSpecifier.startsWith('./') || rawSpecifier.startsWith('../'))) {
    const normSourceRel = sourceFilePath.split('\\').join('/');
    const sourceDir = path.posix.dirname(normSourceRel);
    const resolvedRel = path.posix.normalize(path.posix.join(sourceDir, rawSpecifier));
    const fallback: ResolvedTarget = {
      type: 'internal',
      targetPath: normalizePath(resolvedRel),
    };
    resolutionCache.set(cacheKey, fallback);
    return fallback;
  }

  resolutionCache.set(cacheKey, tsResult);
  return tsResult;
}

function resolveFromTsConfigPaths(
  rootDir: string,
  rawSpecifier: string,
  tsConfigPaths: TsConfigPaths
): ResolvedTarget | null {
  if (!tsConfigPaths.paths) return null;
  const baseUrl = tsConfigPaths.baseUrl || '.';

  for (const [pattern, mappings] of Object.entries(tsConfigPaths.paths)) {
    if (pattern === rawSpecifier) {
      if (mappings.length > 0) {
        const mapped = mappings[0];
        const resolved = path.join(baseUrl, mapped);
        return {
          type: 'internal',
          targetPath: normalizePath(resolved),
        };
      }
    } else if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (rawSpecifier.startsWith(prefix + '/')) {
        const suffix = rawSpecifier.slice(prefix.length + 1);
        if (mappings.length > 0) {
          const mappedPattern = mappings[0];
          const mappedPrefix = mappedPattern.endsWith('/*')
            ? mappedPattern.slice(0, -2)
            : mappedPattern;
          const resolved = path.join(baseUrl, mappedPrefix, suffix);
          return {
            type: 'internal',
            targetPath: normalizePath(resolved),
          };
        }
      }
    }
  }

  return null;
}


