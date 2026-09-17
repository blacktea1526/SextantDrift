import path from 'node:path';
import fs from 'node:fs';

export interface TsConfigPaths {
  baseUrl?: string;
  paths?: Record<string, string[]>;
}

export type ResolvedTarget =
  | { type: 'internal'; targetPath: string }
  | { type: 'external'; packageName: string; rawSpecifier: string };

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
  return forward.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '').replace(/\/index$/, '');
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

/**
 * Resolves a module specifier to an internal relative file path or external package
 */
export function resolveModulePath(
  rootDir: string,
  sourceFilePath: string,
  rawSpecifier: string,
  tsConfigPaths?: TsConfigPaths | null
): ResolvedTarget {
  // 1. Relative paths: ./ or ../
  if (rawSpecifier.startsWith('./') || rawSpecifier.startsWith('../')) {
    const sourceDir = path.dirname(path.resolve(rootDir, sourceFilePath));
    const absoluteTarget = path.resolve(sourceDir, rawSpecifier);
    const relativeTarget = path.relative(rootDir, absoluteTarget);
    return {
      type: 'internal',
      targetPath: normalizePath(relativeTarget),
    };
  }

  // 2. tsconfig paths mapping
  if (tsConfigPaths?.paths) {
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
  }

  // 3. baseUrl resolution without explicit paths
  if (tsConfigPaths?.baseUrl) {
    const candidatePath = path.resolve(rootDir, tsConfigPaths.baseUrl, rawSpecifier);
    // If candidate exists with common extensions or as dir
    const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
    for (const ext of extensions) {
      if (fs.existsSync(candidatePath + ext) || fs.existsSync(path.join(candidatePath, 'index.ts'))) {
        const relativeTarget = path.relative(rootDir, candidatePath);
        return {
          type: 'internal',
          targetPath: normalizePath(relativeTarget),
        };
      }
    }
  }

  // 4. Otherwise, it is an external package
  return {
    type: 'external',
    packageName: getPackageName(rawSpecifier),
    rawSpecifier,
  };
}
