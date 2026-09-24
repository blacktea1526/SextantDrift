import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';
import { normalizePath, getPackageName, loadWorkspacePackages } from './path-resolver.js';

export type ResolvedTarget =
  | { type: 'internal'; targetPath: string; fullPath?: string }
  | { type: 'external'; packageName: string; rawSpecifier: string }
  | { type: 'unresolved'; rawSpecifier: string; reason: string; sourceFile: string; line?: number; column?: number };

interface CachedConfig {
  configPath: string;
  commandLine: ts.ParsedCommandLine;
  resolutionCache: ts.ModuleResolutionCache;
  host: ts.ModuleResolutionHost;
}

const configCache = new Map<string, CachedConfig>();
const resolutionCache = new Map<string, ResolvedTarget>();

export function clearTsResolverCache(): void {
  configCache.clear();
  resolutionCache.clear();
}

/**
 * Searches upward from sourceFileDir to rootDir to locate the nearest tsconfig.json
 */
export function findNearestTsConfigFile(
  rootDir: string,
  sourceFilePath?: string,
  customTsconfigPath?: string
): string | null {
  if (customTsconfigPath) {
    const abs = path.isAbsolute(customTsconfigPath)
      ? customTsconfigPath
      : path.resolve(rootDir, customTsconfigPath);
    return fs.existsSync(abs) ? abs : null;
  }

  const normRootDir = path.resolve(rootDir);

  if (sourceFilePath) {
    const absSource = path.isAbsolute(sourceFilePath)
      ? sourceFilePath
      : path.resolve(normRootDir, sourceFilePath);
    let currentDir = path.dirname(absSource);

    while (currentDir.startsWith(normRootDir) || currentDir === normRootDir) {
      const candidate = path.join(currentDir, 'tsconfig.json');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break;
      currentDir = parent;
    }
  }

  const rootConfig = path.join(normRootDir, 'tsconfig.json');
  if (fs.existsSync(rootConfig)) {
    return rootConfig;
  }

  // Also check tsconfig.base.json in root if tsconfig.json doesn't exist
  const baseConfig = path.join(normRootDir, 'tsconfig.base.json');
  if (fs.existsSync(baseConfig)) {
    return baseConfig;
  }

  return null;
}

/**
 * Parses a tsconfig.json file using the official TypeScript Compiler API,
 * automatically resolving "extends" and "references".
 */
export function getParsedTsConfig(configPath: string, rootDir: string): CachedConfig {
  const normPath = path.resolve(configPath);
  const cached = configCache.get(normPath);
  if (cached) return cached;

  const basePath = path.dirname(normPath);

  const parseConfigHost: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory: ts.sys.readDirectory,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
  };

  const readResult = ts.readConfigFile(normPath, ts.sys.readFile);
  let commandLine: ts.ParsedCommandLine;

  if (readResult.error) {
    // Fallback to empty command line if read fails
    commandLine = {
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
      },
      fileNames: [],
      errors: [readResult.error],
    };
  } else {
    commandLine = ts.parseJsonConfigFileContent(
      readResult.config,
      parseConfigHost,
      basePath,
      {},
      normPath
    );
  }

  // If moduleResolution is not specified, default to NodeNext or Bundler
  if (!commandLine.options.moduleResolution) {
    commandLine.options.moduleResolution = ts.ModuleResolutionKind.NodeNext;
  }

  const resolutionHost: ts.ModuleResolutionHost = {
    fileExists: (fileName) => ts.sys.fileExists(fileName),
    readFile: (fileName) => ts.sys.readFile(fileName),
    directoryExists: (dirName) => ts.sys.directoryExists(dirName),
    getCurrentDirectory: () => rootDir,
    getDirectories: (dirName) => ts.sys.getDirectories(dirName),
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
  };

  const tsCache = ts.createModuleResolutionCache(
    basePath,
    (s) => (ts.sys.useCaseSensitiveFileNames ? s : s.toLowerCase()),
    commandLine.options
  );

  const entry: CachedConfig = {
    configPath: normPath,
    commandLine,
    resolutionCache: tsCache,
    host: resolutionHost,
  };

  configCache.set(normPath, entry);
  return entry;
}

/**
 * Resolves a module specifier using TypeScript's official module resolution engine.
 */
export function resolveModuleWithTsCompiler(
  rootDir: string,
  sourceFilePath: string,
  rawSpecifier: string,
  options?: {
    customTsconfigPath?: string;
  }
): ResolvedTarget {
  const normRootDir = path.resolve(rootDir).split('\\').join('/');
  const normSource = sourceFilePath.split('\\').join('/');
  const cacheKey = `${normRootDir}\0${normSource}\0${rawSpecifier}\0${options?.customTsconfigPath || ''}`;
  const cached = resolutionCache.get(cacheKey);
  if (cached) return cached;

  const absSourcePath = path.isAbsolute(sourceFilePath)
    ? sourceFilePath
    : path.resolve(rootDir, sourceFilePath);

  // 1. Locate config
  const configPath = findNearestTsConfigFile(rootDir, sourceFilePath, options?.customTsconfigPath);

  let compilerOptions: ts.CompilerOptions;
  let resolutionHost: ts.ModuleResolutionHost;
  let resCache: ts.ModuleResolutionCache | undefined;

  if (configPath) {
    const config = getParsedTsConfig(configPath, rootDir);
    compilerOptions = config.commandLine.options;
    resolutionHost = config.host;
    resCache = config.resolutionCache;
  } else {
    // Default fallback compiler options
    compilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      esModuleInterop: true,
      baseUrl: rootDir,
    };
    resolutionHost = {
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      directoryExists: ts.sys.directoryExists,
      getCurrentDirectory: () => rootDir,
      getDirectories: ts.sys.getDirectories,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    };
  }

  // 2. Call ts.resolveModuleName
  const resolved = ts.resolveModuleName(
    rawSpecifier,
    absSourcePath,
    compilerOptions,
    resolutionHost,
    resCache
  );

  // Check monorepo workspace package (e.g. @sextant/core in packages/*)
  const workspacePkgs = loadWorkspacePackages(rootDir);
  const matchedTarget = workspacePkgs.get(rawSpecifier);
  if (matchedTarget) {
    const result: ResolvedTarget = {
      type: 'internal',
      targetPath: matchedTarget,
      fullPath: path.resolve(rootDir, matchedTarget),
    };
    resolutionCache.set(cacheKey, result);
    return result;
  }

  if (resolved.resolvedModule) {
    const resolvedFileName = resolved.resolvedModule.resolvedFileName;
    const normResolved = resolvedFileName.split('\\').join('/');

    // Check if it's an external library import
    const isNodeModules = normResolved.includes('/node_modules/');
    const isExternal = resolved.resolvedModule.isExternalLibraryImport || isNodeModules;

    if (isExternal) {
      const result: ResolvedTarget = {
        type: 'external',
        packageName: getPackageName(rawSpecifier),
        rawSpecifier,
      };
      resolutionCache.set(cacheKey, result);
      return result;
    }

    // It is an internal file
    const relToRoot = path.relative(rootDir, resolvedFileName);
    const result: ResolvedTarget = {
      type: 'internal',
      targetPath: normalizePath(relToRoot),
      fullPath: resolvedFileName,
    };
    resolutionCache.set(cacheKey, result);
    return result;
  }

  // 4. Resolution failed. Determine if it was an internal import or external package.
  const isRelative = rawSpecifier.startsWith('./') || rawSpecifier.startsWith('../');
  const isSubpath = rawSpecifier.startsWith('#') || rawSpecifier.startsWith('/');

  // Check if rawSpecifier matches any paths aliases configured in tsconfig
  let matchesPathAlias = false;
  if (compilerOptions.paths) {
    for (const pattern of Object.keys(compilerOptions.paths)) {
      if (pattern === rawSpecifier) {
        matchesPathAlias = true;
        break;
      }
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (rawSpecifier.startsWith(prefix + '/')) {
          matchesPathAlias = true;
          break;
        }
      }
    }
  }

  if (isRelative || isSubpath || matchesPathAlias) {
    // Definite internal module that failed to resolve -> UNRESOLVED DIAGNOSTIC!
    const result: ResolvedTarget = {
      type: 'unresolved',
      rawSpecifier,
      reason: `Could not resolve internal module specifier "${rawSpecifier}" from "${sourceFilePath}". Verify file exists and tsconfig paths/extends are configured.`,
      sourceFile: sourceFilePath,
    };
    resolutionCache.set(cacheKey, result);
    return result;
  }

  // If it's a bare specifier not matching paths, check if package.json has it
  const isBarePackage = !rawSpecifier.startsWith('.') && !rawSpecifier.startsWith('/');
  if (isBarePackage) {
    const pkgName = getPackageName(rawSpecifier);
    // If it looks like an npm package, treat as external
    const result: ResolvedTarget = {
      type: 'external',
      packageName: pkgName,
      rawSpecifier,
    };
    resolutionCache.set(cacheKey, result);
    return result;
  }

  const result: ResolvedTarget = {
    type: 'unresolved',
    rawSpecifier,
    reason: `Module "${rawSpecifier}" could not be resolved from "${sourceFilePath}".`,
    sourceFile: sourceFilePath,
  };
  resolutionCache.set(cacheKey, result);
  return result;
}
