import path from 'node:path';
import fs from 'node:fs';
import ts from 'typescript';
import { resolveModuleWithTsCompiler } from './ts-project-resolver.js';
import { normalizePath } from './path-resolver.js';

export interface TracedExportTarget {
  targetPath: string;
  fullPath?: string;
  hopCount: number;
  chain: string[];
  isTypeOnly: boolean;
  importedSymbols?: string[];
}

export interface UnresolvedBarrelHop {
  rawSpecifier: string;
  sourceFile: string;
  hop: number;
  reason: string;
}

export interface BarrelTraceResult {
  isBarrel: boolean;
  tracedTargets: TracedExportTarget[];
  unresolvedHops: UnresolvedBarrelHop[];
}

export interface ExportedSymbolInfo {
  name: string;
  isTypeOnly: boolean;
}

export interface ReExportInfo {
  rawSpecifier: string;
  isWildcard: boolean;
  namespaceAlias?: string;
  namedExports?: Map<string, { originName: string; isTypeOnly: boolean }>;
  isTypeOnly: boolean;
  line: number;
  column: number;
}

export interface FileExportManifest {
  filePath: string;
  localExports: Map<string, ExportedSymbolInfo>;
  reExports: ReExportInfo[];
}

const barrelCache = new Map<string, BarrelTraceResult>();
const manifestCache = new Map<string, FileExportManifest>();

export function clearBarrelCache(): void {
  barrelCache.clear();
  manifestCache.clear();
}

/**
 * Parses export declarations and locally defined exports from a TypeScript/JavaScript source file.
 */
export function parseExportManifest(sourceFilePath: string, content: string): FileExportManifest {
  const normPath = normalizePath(sourceFilePath);
  const cached = manifestCache.get(normPath);
  if (cached) return cached;

  const sourceFile = ts.createSourceFile(sourceFilePath, content, ts.ScriptTarget.Latest, true);
  const localExports = new Map<string, ExportedSymbolInfo>();
  const reExports: ReExportInfo[] = [];

  function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    const modifiers = (node as any).modifiers;
    if (Array.isArray(modifiers)) {
      return modifiers.some((m: any) => m.kind === kind);
    }
    return false;
  }

  function extractBindingNames(pattern: ts.BindingName): string[] {
    const names: string[] = [];
    if (ts.isIdentifier(pattern)) {
      names.push(pattern.text);
    } else if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
      for (const el of pattern.elements) {
        if (ts.isBindingElement(el)) {
          names.push(...extractBindingNames(el.name));
        }
      }
    }
    return names;
  }

  for (const statement of sourceFile.statements) {
    const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

    if (ts.isFunctionDeclaration(statement)) {
      if (isExported) {
        if (statement.name) {
          localExports.set(statement.name.text, { name: statement.name.text, isTypeOnly: false });
        }
        if (isDefault) {
          localExports.set('default', { name: 'default', isTypeOnly: false });
        }
      }
    } else if (ts.isClassDeclaration(statement)) {
      if (isExported) {
        if (statement.name) {
          localExports.set(statement.name.text, { name: statement.name.text, isTypeOnly: false });
        }
        if (isDefault) {
          localExports.set('default', { name: 'default', isTypeOnly: false });
        }
      }
    } else if (ts.isVariableStatement(statement)) {
      if (isExported) {
        for (const decl of statement.declarationList.declarations) {
          const names = extractBindingNames(decl.name);
          for (const name of names) {
            localExports.set(name, { name, isTypeOnly: false });
          }
        }
      }
    } else if (ts.isInterfaceDeclaration(statement)) {
      if (isExported) {
        localExports.set(statement.name.text, { name: statement.name.text, isTypeOnly: true });
        if (isDefault) {
          localExports.set('default', { name: 'default', isTypeOnly: true });
        }
      }
    } else if (ts.isTypeAliasDeclaration(statement)) {
      if (isExported) {
        localExports.set(statement.name.text, { name: statement.name.text, isTypeOnly: true });
        if (isDefault) {
          localExports.set('default', { name: 'default', isTypeOnly: true });
        }
      }
    } else if (ts.isEnumDeclaration(statement)) {
      if (isExported) {
        localExports.set(statement.name.text, { name: statement.name.text, isTypeOnly: false });
      }
    } else if (ts.isModuleDeclaration(statement)) {
      if (isExported) {
        localExports.set(statement.name.text, { name: statement.name.text, isTypeOnly: false });
      }
    } else if (ts.isExportAssignment(statement)) {
      localExports.set('default', { name: 'default', isTypeOnly: false });
    } else if (ts.isExportDeclaration(statement)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
      const isStatementTypeOnly = statement.isTypeOnly;

      if (!statement.moduleSpecifier) {
        // Local export clause: export { a, b as c } (without 'from')
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const el of statement.exportClause.elements) {
            const expName = el.name.text;
            const elTypeOnly = isStatementTypeOnly || el.isTypeOnly;
            localExports.set(expName, { name: expName, isTypeOnly: elTypeOnly });
          }
        }
      } else {
        // Re-export: export ... from 'moduleSpecifier'
        if (
          ts.isStringLiteral(statement.moduleSpecifier) ||
          ts.isNoSubstitutionTemplateLiteral(statement.moduleSpecifier)
        ) {
          const rawSpecifier = statement.moduleSpecifier.text;

          if (!statement.exportClause) {
            // export * from '...'
            reExports.push({
              rawSpecifier,
              isWildcard: true,
              isTypeOnly: isStatementTypeOnly,
              line: line + 1,
              column: character + 1,
            });
          } else if (ts.isNamespaceExport(statement.exportClause)) {
            // export * as ns from '...'
            reExports.push({
              rawSpecifier,
              isWildcard: false,
              namespaceAlias: statement.exportClause.name.text,
              isTypeOnly: isStatementTypeOnly,
              line: line + 1,
              column: character + 1,
            });
          } else if (ts.isNamedExports(statement.exportClause)) {
            // export { a, b as c } from '...'
            const namedMap = new Map<string, { originName: string; isTypeOnly: boolean }>();
            for (const el of statement.exportClause.elements) {
              const expName = el.name.text;
              const originName = (el.propertyName || el.name).text;
              const elTypeOnly = isStatementTypeOnly || el.isTypeOnly;
              namedMap.set(expName, { originName, isTypeOnly: elTypeOnly });
            }
            reExports.push({
              rawSpecifier,
              isWildcard: false,
              namedExports: namedMap,
              isTypeOnly: isStatementTypeOnly,
              line: line + 1,
              column: character + 1,
            });
          }
        }
      }
    }
  }

  const manifest: FileExportManifest = {
    filePath: normPath,
    localExports,
    reExports,
  };
  manifestCache.set(normPath, manifest);
  return manifest;
}

/**
 * Traces multi-hop re-exports starting from a given barrel file.
 * Supports both full wildcard re-export exploration and symbol-specific re-export tracing.
 *
 * Overloads supported:
 * - traceBarrelExports(rootDir, barrelRelPath, fileContentMap, customTsconfigPath, maxHops)
 * - traceBarrelExports(rootDir, barrelRelPath, importedSymbols, fileContentMap, customTsconfigPath, maxHops)
 */
export function traceBarrelExports(
  rootDir: string,
  barrelRelPath: string,
  importedSymbolsOrFileMap?: string[] | Map<string, string>,
  fileContentMapOrTsconfig?: Map<string, string> | string,
  customTsconfigPathOrHops?: string | number,
  maxHopsArg?: number
): BarrelTraceResult {
  let importedSymbols: string[] | undefined;
  let fileContentMap: Map<string, string> | undefined;
  let customTsconfigPath: string | undefined;
  let maxHops: number = 10;

  if (Array.isArray(importedSymbolsOrFileMap)) {
    importedSymbols = importedSymbolsOrFileMap;
    if (fileContentMapOrTsconfig instanceof Map) {
      fileContentMap = fileContentMapOrTsconfig;
    }
    if (typeof customTsconfigPathOrHops === 'string') {
      customTsconfigPath = customTsconfigPathOrHops;
    }
    if (typeof maxHopsArg === 'number') {
      maxHops = maxHopsArg;
    }
  } else if (importedSymbolsOrFileMap instanceof Map) {
    fileContentMap = importedSymbolsOrFileMap;
    if (typeof fileContentMapOrTsconfig === 'string') {
      customTsconfigPath = fileContentMapOrTsconfig;
    }
    if (typeof customTsconfigPathOrHops === 'number') {
      maxHops = customTsconfigPathOrHops;
    }
  } else if (typeof fileContentMapOrTsconfig === 'string') {
    customTsconfigPath = fileContentMapOrTsconfig;
    if (typeof customTsconfigPathOrHops === 'number') {
      maxHops = customTsconfigPathOrHops;
    }
  }

  const normBarrel = normalizePath(barrelRelPath);
  const symKey = importedSymbols ? importedSymbols.slice().sort().join(',') : '*';
  const cacheKey = `${rootDir}\0${normBarrel}\0${symKey}\0${customTsconfigPath || ''}\0${maxHops}`;
  const cached = barrelCache.get(cacheKey);
  if (cached) return cached;

  const result: BarrelTraceResult = {
    isBarrel: false,
    tracedTargets: [],
    unresolvedHops: [],
  };

  // Helper to read file content
  function getFileContent(relPath: string): { content: string; actualRelPath: string } | null {
    if (fileContentMap) {
      if (fileContentMap.has(relPath)) {
        return { content: fileContentMap.get(relPath)!, actualRelPath: relPath };
      }
      for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
        const candidate = relPath + ext;
        if (fileContentMap.has(candidate)) {
          return { content: fileContentMap.get(candidate)!, actualRelPath: candidate };
        }
      }
    }

    const absPath = path.resolve(rootDir, relPath);
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      return { content: fs.readFileSync(absPath, 'utf-8'), actualRelPath: relPath };
    }
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
      const candidateAbs = absPath + ext;
      if (fs.existsSync(candidateAbs) && fs.statSync(candidateAbs).isFile()) {
        const candidateRel = path.relative(rootDir, candidateAbs);
        return { content: fs.readFileSync(candidateAbs, 'utf-8'), actualRelPath: candidateRel };
      }
    }

    return null;
  }

  function resolveSpecifier(
    sourceRelPath: string,
    rawSpecifier: string
  ): { type: 'internal'; targetPath: string; fullPath?: string } | { type: 'external' } | { type: 'unresolved'; reason: string } {
    let res = resolveModuleWithTsCompiler(rootDir, sourceRelPath, rawSpecifier, { customTsconfigPath });

    if (res.type === 'unresolved' && fileContentMap) {
      if (rawSpecifier.startsWith('./') || rawSpecifier.startsWith('../')) {
        const normSourceRel = sourceRelPath.split('\\').join('/');
        const sourceDir = path.posix.dirname(normSourceRel);
        const resolvedRel = path.posix.normalize(path.posix.join(sourceDir, rawSpecifier));
        const normalizedTarget = normalizePath(resolvedRel);

        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];
        let foundInMemory = false;
        for (const ext of extensions) {
          if (fileContentMap.has(normalizedTarget + ext)) {
            foundInMemory = true;
            break;
          }
        }
        if (foundInMemory) {
          res = {
            type: 'internal',
            targetPath: normalizedTarget,
          };
        }
      }
    }
    return res;
  }

  function checkSymbolInModule(
    relPath: string,
    symbol: string,
    visited: Set<string>
  ): { found: boolean; isTypeOnly: boolean; leafPath?: string; fullChain?: string[] } {
    const norm = normalizePath(relPath);
    if (visited.has(norm)) return { found: false, isTypeOnly: false };
    visited.add(norm);

    const fileData = getFileContent(norm);
    if (!fileData) return { found: false, isTypeOnly: false };
    const manifest = parseExportManifest(fileData.actualRelPath, fileData.content);

    // 1. Local export
    if (manifest.localExports.has(symbol)) {
      const loc = manifest.localExports.get(symbol)!;
      return { found: true, isTypeOnly: loc.isTypeOnly, leafPath: norm, fullChain: [norm] };
    }

    // 2. Named re-exports
    for (const rx of manifest.reExports) {
      if (rx.namedExports && rx.namedExports.has(symbol)) {
        const namedInfo = rx.namedExports.get(symbol)!;
        const res = resolveSpecifier(fileData.actualRelPath, rx.rawSpecifier);
        if (res.type === 'internal') {
          const sub = checkSymbolInModule(res.targetPath, namedInfo.originName, visited);
          if (sub.found) {
            return {
              found: true,
              isTypeOnly: rx.isTypeOnly || namedInfo.isTypeOnly || sub.isTypeOnly,
              leafPath: sub.leafPath || res.targetPath,
              fullChain: [norm, ...(sub.fullChain || [res.targetPath])],
            };
          }
        }
        return {
          found: true,
          isTypeOnly: rx.isTypeOnly || namedInfo.isTypeOnly,
          leafPath: res.type === 'internal' ? res.targetPath : undefined,
          fullChain: [norm],
        };
      }

      if (rx.namespaceAlias === symbol) {
        const res = resolveSpecifier(fileData.actualRelPath, rx.rawSpecifier);
        return {
          found: true,
          isTypeOnly: rx.isTypeOnly,
          leafPath: res.type === 'internal' ? res.targetPath : undefined,
          fullChain: [norm, ...(res.type === 'internal' ? [res.targetPath] : [])],
        };
      }
    }

    // 3. Wildcard re-exports
    for (const rx of manifest.reExports) {
      if (rx.isWildcard) {
        const res = resolveSpecifier(fileData.actualRelPath, rx.rawSpecifier);
        if (res.type === 'internal') {
          const sub = checkSymbolInModule(res.targetPath, symbol, visited);
          if (sub.found) {
            return {
              found: true,
              isTypeOnly: rx.isTypeOnly || sub.isTypeOnly,
              leafPath: sub.leafPath || res.targetPath,
              fullChain: [norm, ...(sub.fullChain || [res.targetPath])],
            };
          }
        }
      }
    }

    return { found: false, isTypeOnly: false };
  }

  const initialFile = getFileContent(barrelRelPath);
  if (!initialFile) {
    barrelCache.set(cacheKey, result);
    return result;
  }

  const initialManifest = parseExportManifest(initialFile.actualRelPath, initialFile.content);
  if (initialManifest.reExports.length === 0) {
    barrelCache.set(cacheKey, result);
    return result;
  }

  result.isBarrel = true;

  // Check unresolved re-exports in the initial barrel to catch broken imports
  for (const reExport of initialManifest.reExports) {
    const res = resolveSpecifier(initialFile.actualRelPath, reExport.rawSpecifier);
    if (res.type === 'unresolved') {
      result.unresolvedHops.push({
        rawSpecifier: reExport.rawSpecifier,
        sourceFile: initialFile.actualRelPath,
        hop: 1,
        reason: res.reason,
      });
    }
  }

  const isWildcardMode = !importedSymbols || importedSymbols.length === 0 || importedSymbols.includes('*');

  if (isWildcardMode) {
    interface QueueItem {
      currentRelPath: string;
      currentHop: number;
      chain: string[];
      isTypeOnly: boolean;
    }

    const queue: QueueItem[] = [];
    const visitedFiles = new Set<string>();
    visitedFiles.add(normBarrel);

    for (const exp of initialManifest.reExports) {
      const res = resolveSpecifier(initialFile.actualRelPath, exp.rawSpecifier);
      if (res.type === 'internal') {
        const targetNorm = normalizePath(res.targetPath);
        result.tracedTargets.push({
          targetPath: targetNorm,
          fullPath: res.fullPath,
          hopCount: 1,
          chain: [initialFile.actualRelPath, targetNorm],
          isTypeOnly: exp.isTypeOnly,
        });

        if (1 < maxHops && !visitedFiles.has(targetNorm)) {
          visitedFiles.add(targetNorm);
          queue.push({
            currentRelPath: targetNorm,
            currentHop: 2,
            chain: [initialFile.actualRelPath, targetNorm],
            isTypeOnly: exp.isTypeOnly,
          });
        }
      }
    }

    const seenTargets = new Set<string>(result.tracedTargets.map((t) => t.targetPath));

    while (queue.length > 0) {
      const item = queue.shift()!;
      const fileData = getFileContent(item.currentRelPath);
      if (!fileData) continue;

      const manifest = parseExportManifest(fileData.actualRelPath, fileData.content);
      for (const reExport of manifest.reExports) {
        const res = resolveSpecifier(fileData.actualRelPath, reExport.rawSpecifier);
        if (res.type === 'unresolved') {
          result.unresolvedHops.push({
            rawSpecifier: reExport.rawSpecifier,
            sourceFile: item.currentRelPath,
            hop: item.currentHop,
            reason: res.reason,
          });
          continue;
        }

        if (res.type === 'internal') {
          const targetNorm = normalizePath(res.targetPath);
          const isTypeOnly = item.isTypeOnly || reExport.isTypeOnly;
          const targetChain = [...item.chain, targetNorm];

          if (!seenTargets.has(targetNorm)) {
            seenTargets.add(targetNorm);
            result.tracedTargets.push({
              targetPath: targetNorm,
              fullPath: res.fullPath,
              hopCount: item.currentHop,
              chain: targetChain,
              isTypeOnly,
            });
          }

          if (item.currentHop < maxHops && !visitedFiles.has(targetNorm)) {
            visitedFiles.add(targetNorm);
            const nextFileData = getFileContent(targetNorm);
            if (nextFileData) {
              const nextManifest = parseExportManifest(nextFileData.actualRelPath, nextFileData.content);
              if (nextManifest.reExports.length > 0) {
                queue.push({
                  currentRelPath: targetNorm,
                  currentHop: item.currentHop + 1,
                  chain: targetChain,
                  isTypeOnly,
                });
              }
            }
          }
        }
      }
    }
  } else {
    // Symbol-specific tracing:
    // 1. Filter out symbols declared locally in this barrel
    const remainingSymbols = new Set<string>();
    const symbolsToTrace = importedSymbols || [];
    for (const sym of symbolsToTrace) {
      if (!initialManifest.localExports.has(sym)) {
        remainingSymbols.add(sym);
      }
    }

    if (remainingSymbols.size === 0) {
      // All imported symbols are declared locally in this barrel!
      // No re-exported dependencies are involved.
      barrelCache.set(cacheKey, result);
      return result;
    }

    const seenTargets = new Set<string>();

    for (const sym of remainingSymbols) {
      const searchVisited = new Set<string>();
      const match = checkSymbolInModule(initialFile.actualRelPath, sym, searchVisited);
      if (match.found && match.fullChain && match.fullChain.length > 1) {
        // Chain: [barrel, hop1, ..., leaf]
        // Add all intermediate hops and leaf
        for (let i = 1; i < match.fullChain.length; i++) {
          const targetNorm = normalizePath(match.fullChain[i]);
          if (!seenTargets.has(targetNorm)) {
            seenTargets.add(targetNorm);
            result.tracedTargets.push({
              targetPath: targetNorm,
              hopCount: i,
              chain: match.fullChain.slice(0, i + 1),
              isTypeOnly: match.isTypeOnly,
              importedSymbols: [sym],
            });
          }
        }
      }
    }
  }

  barrelCache.set(cacheKey, result);
  return result;
}
