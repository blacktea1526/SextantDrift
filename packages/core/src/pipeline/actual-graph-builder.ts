import fs from 'node:fs';
import path from 'node:path';
import { TargetArchitecture, Component, Layer } from '../types/architecture.js';
import { ViolationEvidence } from '../types/report.js';
import { DirectedGraph } from '../graph/directed-graph.js';
import { DependencyReference } from '../comparator/bypass-detector.js';
import { RawFileDependency } from '../comparator/inversion-detector.js';
import { extractDependenciesFromSource, ImportEvidence } from '../analyzer/ast-extractor.js';
import { extractPythonDependencies } from '../analyzer/python-ast-extractor.js';
import { extractGoDependencies } from '../analyzer/go-ast-extractor.js';
import { resolveModulePath, TsConfigPaths } from '../analyzer/path-resolver.js';
import { resolvePythonModulePath } from '../analyzer/python-resolver.js';
import { resolveGoModulePath } from '../analyzer/go-resolver.js';
import { detectSourceLanguage, SourceLanguage } from '../analyzer/source-language.js';
import { findComponentForFile } from '../analyzer/noise-filter.js';
import { traceBarrelExports } from '../analyzer/barrel-tracer.js';

export interface BuildActualGraphOptions {
  rootDir: string;
  filePaths: string[];
  arch: TargetArchitecture;
  fileContentMap: Map<string, string>;
  tsConfigPaths?: TsConfigPaths;
  customTsconfigPath?: string;
  countTypeOnly?: boolean;
}

export interface ActualGraphBuildResult {
  componentGraph: DirectedGraph;
  componentDependencies: DependencyReference[];
  rawFileDependencies: RawFileDependency[];
  resolutionWarnings: ViolationEvidence[];
  componentFileCounts: Map<string, number>;
  totalDependencies: number;
  unresolvedImportCount: number;
  partialBarrelCount: number;
}

function extractLanguageDependencies(
  language: SourceLanguage,
  relPath: string,
  content: string
): ImportEvidence[] {
  if (language === 'python') return extractPythonDependencies(relPath, content);
  if (language === 'go') return extractGoDependencies(relPath, content);
  return extractDependenciesFromSource(relPath, content);
}

/**
 * Deterministically constructs actual component dependency graph and collects
 * all raw file dependencies, warnings, and barrel-traced multi-hop hops.
 */
export function buildActualDependencyGraph(options: BuildActualGraphOptions): ActualGraphBuildResult {
  const {
    rootDir,
    filePaths,
    arch,
    fileContentMap,
    tsConfigPaths,
    customTsconfigPath,
    countTypeOnly,
  } = options;

  // Index layers
  const layerMap = new Map<string, Layer>();
  for (const layer of arch.layers) {
    layerMap.set(layer.id, layer);
  }

  const rawFileDependencies: RawFileDependency[] = [];
  const componentDependencies: DependencyReference[] = [];
  const componentGraph = new DirectedGraph();

  // Initialize nodes in graph
  for (const comp of arch.components) {
    componentGraph.addNode(comp.id);
  }

  let totalDependencies = 0;
  const componentFileCounts = new Map<string, number>();
  const resolutionWarnings: ViolationEvidence[] = [];
  let unresolvedImportCount = 0;
  let partialBarrelCount = 0;

  const scannedFileSet = new Set(filePaths);

  // Extract dependencies from each file
  for (const relPath of filePaths) {
    const fullPath = path.resolve(rootDir, relPath);
    let content = fileContentMap.get(relPath);
    if (content === undefined) {
      if (fs.existsSync(fullPath)) {
        content = fs.readFileSync(fullPath, 'utf-8');
        fileContentMap.set(relPath, content);
      } else {
        continue;
      }
    }

    const language = detectSourceLanguage(relPath);
    const evidences = extractLanguageDependencies(language, relPath, content);
    const sourceComp = findComponentForFile(relPath, arch.components);

    if (sourceComp) {
      componentFileCounts.set(sourceComp.id, (componentFileCounts.get(sourceComp.id) || 0) + 1);
    }

    for (const evidence of evidences) {
      totalDependencies++;
      // Skip purely compile-time type imports for structural drift unless explicitly requested
      if (evidence.isTypeOnly && !countTypeOnly) {
        continue;
      }

      const resolved =
        language === 'python'
          ? resolvePythonModulePath(rootDir, relPath, evidence.rawSpecifier, {
              scannedFiles: scannedFileSet,
            })
          : language === 'go'
            ? resolveGoModulePath(rootDir, relPath, evidence.rawSpecifier, {
                scannedFiles: scannedFileSet,
              })
            : resolveModulePath(rootDir, relPath, evidence.rawSpecifier, tsConfigPaths, {
                customTsconfigPath,
              });

      rawFileDependencies.push({
        sourceFile: relPath,
        evidence,
        resolved,
        sourceComponent: sourceComp,
      });

      if (resolved.type === 'unresolved') {
        unresolvedImportCount++;
        resolutionWarnings.push({
          id: `unresolved-${relPath}-${evidence.line}-${evidence.column}`,
          type: 'WARN_UNRESOLVED_IMPORT',
          severity: 'warning',
          message:
            language === 'python'
              ? `Unresolved Python module import: "${evidence.rawSpecifier}" imported by "${relPath}" (${resolved.reason})`
              : language === 'go'
                ? `Unresolved Go import: "${evidence.rawSpecifier}" imported by "${relPath}" (${resolved.reason})`
                : `Unresolved module import: "${evidence.rawSpecifier}" imported by "${relPath}" could not be resolved by TypeScript Compiler API (${resolved.reason})`,
          sourceFile: relPath,
          line: evidence.line,
          column: evidence.column,
          snippet: evidence.snippet,
          sourceComponent: sourceComp?.id,
          suggestion:
            language === 'python'
              ? 'Check that the Python module or file exists and that internal package paths or virtual environments are properly configured.'
              : language === 'go'
                ? 'Check go.mod module path and replace directives, and that the target package directory contains a non-test .go file.'
                : 'Check that the module or file exists and that tsconfig.json "paths" / "extends" mappings are properly configured.',
        });
        continue;
      }

      if (resolved.type === 'internal' && sourceComp) {
        const targetComp = findComponentForFile(resolved.targetPath, arch.components);
        if (targetComp && sourceComp.id !== targetComp.id) {
          const sourceLayer = layerMap.get(sourceComp.layerId);
          const targetLayer = layerMap.get(targetComp.layerId);

          if (sourceLayer && targetLayer) {
            componentDependencies.push({
              evidence,
              resolved,
              sourceComponent: sourceComp,
              sourceLayer,
              targetComponent: targetComp,
              targetLayer,
            });

            componentGraph.addEdge(sourceComp.id, targetComp.id);
          }
        }

        // Barrel Multi-Hop Tracing (TypeScript/JavaScript only): trace re-exported dependencies through barrels
        if (language === 'typescript') {
          const barrelTrace = traceBarrelExports(
            rootDir,
            resolved.targetPath,
            evidence.importedSymbols,
            fileContentMap,
            customTsconfigPath
          );
          if (barrelTrace.isBarrel) {
            // Record any unresolved hops in the barrel
            for (const unres of barrelTrace.unresolvedHops) {
              partialBarrelCount++;
              resolutionWarnings.push({
                id: `partial-barrel-${unres.sourceFile}-${unres.hop}`,
                type: 'WARN_PARTIAL_BARREL_RESOLUTION',
                severity: 'warning',
                message: `Barrel file "${unres.sourceFile}" contains unresolvable re-export "${unres.rawSpecifier}" at hop ${unres.hop}: ${unres.reason}`,
                sourceFile: unres.sourceFile,
                line: 1,
                column: 1,
                snippet: `export * from '${unres.rawSpecifier}'`,
                sourceComponent: sourceComp?.id,
                suggestion: 'Verify intermediate re-export target. Partial barrel resolution means some underlying dependencies could not be verified.',
              });
            }

            // For each traced underlying target:
            for (const traced of barrelTrace.tracedTargets) {
              if (traced.isTypeOnly && !countTypeOnly) {
                continue;
              }
              const underlyingComp = findComponentForFile(traced.targetPath, arch.components);
              if (underlyingComp && sourceComp.id !== underlyingComp.id) {
                const sourceLayer = layerMap.get(sourceComp.layerId);
                const targetLayer = layerMap.get(underlyingComp.layerId);

                if (sourceLayer && targetLayer) {
                  componentDependencies.push({
                    evidence: {
                      ...evidence,
                      snippet: `${evidence.snippet} (via barrel: ${traced.chain.join(' -> ')})`,
                    },
                    resolved: {
                      type: 'internal',
                      targetPath: traced.targetPath,
                      fullPath: traced.fullPath,
                    },
                    sourceComponent: sourceComp,
                    sourceLayer,
                    targetComponent: underlyingComp,
                    targetLayer,
                  });
                  componentGraph.addEdge(sourceComp.id, underlyingComp.id);
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    componentGraph,
    componentDependencies,
    rawFileDependencies,
    resolutionWarnings,
    componentFileCounts,
    totalDependencies,
    unresolvedImportCount,
    partialBarrelCount,
  };
}
