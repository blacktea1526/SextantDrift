import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { ConfigValidationError } from './errors/config-error.js';
import { TargetArchitecture, Component, Layer } from './types/architecture.js';
import { DriftReport, DriftSummary, DriftViolation, AnalyzeOptions } from './types/report.js';
import { resolveTargetArchitecture } from './parser/spec-resolver.js';
import { scanSourceFiles } from './analyzer/file-scanner.js';
import { extractDependenciesFromSource, ImportEvidence } from './analyzer/ast-extractor.js';
import { loadTsConfigPaths, resolveModulePath, clearResolutionCache } from './analyzer/path-resolver.js';
import { findComponentForFile, clearComponentLookupCache } from './analyzer/noise-filter.js';
import { DirectedGraph } from './graph/directed-graph.js';
import { detectCycles } from './graph/tarjan.js';
import {
  detectLayerBypasses,
  DependencyReference,
  ViolationEvidence,
} from './comparator/bypass-detector.js';
import {
  detectLayerInversions,
  detectForbiddenImports,
  RawFileDependency,
} from './comparator/inversion-detector.js';
import { executeInvariantsEngine } from './invariants/engine.js';
import { computeViolationFingerprint } from './baseline/fingerprint.js';
import {
  loadBaseline,
  diffWithBaseline,
  DEFAULT_BASELINE_FILENAME,
} from './baseline/manager.js';
import { extractAndVerifyStateDiagrams } from './state/index.js';
import { extractSequenceDiagrams, diffCausality, SequenceDiagramSpec } from './causality/index.js';
import { verifyContractAlignment } from './contract/index.js';
import { buildC4GraphData } from './c4/index.js';
import { generateActualMermaid, generateUnifiedMermaid } from './parser/mermaid-generator.js';
import type { ExecutionTrace } from './trace/types.js';

export const VERSION = '2.0.0';

export * from './types/index.js';
export * from './errors/config-error.js';
export * from './parser/json-spec-parser.js';
export * from './parser/mermaid-adapter.js';
export * from './parser/mermaid-generator.js';
export * from './parser/spec-resolver.js';
export * from './analyzer/file-scanner.js';
export * from './analyzer/ast-extractor.js';
export * from './analyzer/path-resolver.js';
export {
  resolveModuleWithTsCompiler,
  clearTsResolverCache,
  findNearestTsConfigFile,
  getParsedTsConfig,
} from './analyzer/ts-project-resolver.js';
export * from './analyzer/barrel-tracer.js';
export * from './analyzer/noise-filter.js';
export * from './graph/directed-graph.js';
export * from './graph/tarjan.js';
export * from './comparator/bypass-detector.js';
export * from './comparator/inversion-detector.js';
export * from './invariants/parser.js';
export * from './invariants/sequence-matcher.js';
export * from './invariants/import-matcher.js';
export * from './invariants/config-matcher.js';
export * from './invariants/engine.js';
export * from './baseline/fingerprint.js';
export * from './baseline/manager.js';
export * from './state/index.js';
export * from './trace/index.js';
export * from './causality/index.js';
export * from './contract/index.js';
export * from './c4/index.js';

import { clearBarrelCache, traceBarrelExports } from './analyzer/barrel-tracer.js';
import { clearTsResolverCache } from './analyzer/ts-project-resolver.js';

/**
 * Main Pure Analysis Entrypoint.
 * Evaluates target architecture against physical TypeScript code, returning DriftReport.
 */
export async function analyzeModuleDrift(options: AnalyzeOptions): Promise<DriftReport> {
  clearResolutionCache();
  clearTsResolverCache();
  clearBarrelCache();
  clearComponentLookupCache();
  const startTime = performance.now();
  const rootDir = path.resolve(options.rootDir);

  // 1. Resolve target architecture
  const arch = resolveTargetArchitecture(rootDir, options.specPath);

  // 2. Scan source files
  const filePaths = options.files ?? scanSourceFiles(rootDir);

  // 3. Load tsconfig paths mapping
  const tsConfigPaths = loadTsConfigPaths(rootDir, options.tsconfigPath);

  // Index layers & components
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
  const fileContentMap = new Map<string, string>();
  const resolutionWarnings: ViolationEvidence[] = [];
  let unresolvedImportCount = 0;
  let partialBarrelCount = 0;

  // Pre-load all file contents into fileContentMap so barrel-tracer has full access
  for (const relPath of filePaths) {
    const fullPath = path.resolve(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      fileContentMap.set(relPath, fs.readFileSync(fullPath, 'utf-8'));
    }
  }

  // 4. Extract dependencies from each file
  for (const relPath of filePaths) {
    const fullPath = path.resolve(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fileContentMap.get(relPath) || fs.readFileSync(fullPath, 'utf-8');
    const evidences = extractDependenciesFromSource(relPath, content);
    const sourceComp = findComponentForFile(relPath, arch.components);

    if (sourceComp) {
      componentFileCounts.set(sourceComp.id, (componentFileCounts.get(sourceComp.id) || 0) + 1);
    }

    for (const evidence of evidences) {
      totalDependencies++;
      // Skip purely compile-time type imports for structural drift unless explicitly requested
      if (evidence.isTypeOnly && !options.countTypeOnly) {
        continue;
      }

      const resolved = resolveModulePath(rootDir, relPath, evidence.rawSpecifier, tsConfigPaths, {
        customTsconfigPath: options.tsconfigPath,
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
          message: `Unresolved module import: "${evidence.rawSpecifier}" imported by "${relPath}" could not be resolved by TypeScript Compiler API (${resolved.reason})`,
          sourceFile: relPath,
          line: evidence.line,
          column: evidence.column,
          snippet: evidence.snippet,
          sourceComponent: sourceComp?.id,
          suggestion: 'Check that the module or file exists and that tsconfig.json "paths" / "extends" mappings are properly configured.',
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

        // Barrel Multi-Hop Tracing: trace re-exported dependencies through barrels
        const barrelTrace = traceBarrelExports(
          rootDir,
          resolved.targetPath,
          evidence.importedSymbols,
          fileContentMap,
          options.tsconfigPath
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
            if (traced.isTypeOnly && !options.countTypeOnly) {
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

  // 4.1 Validate component coverage and empty component patterns
  if (!options.files) {
    for (const comp of arch.components) {
      const count = componentFileCounts.get(comp.id) || 0;
      if (count === 0) {
        throw new ConfigValidationError(
          `Architecture spec component "${comp.id}" matched 0 files with paths: [${comp.paths.join(', ')}]`,
          { field: `components.${comp.id}.paths` }
        );
      }
    }
  }

  const mappedFilesCount = Array.from(fileContentMap.keys()).filter((relPath) =>
    Boolean(findComponentForFile(relPath, arch.components))
  ).length;
  const totalFilesCount = fileContentMap.size;
  const unmappedFilesCount = totalFilesCount - mappedFilesCount;
  const coveragePercentage = totalFilesCount > 0
    ? Math.round((mappedFilesCount / totalFilesCount) * 10000) / 100
    : 0;

  if (options.unmappedFiles === 'forbid' && unmappedFilesCount > 0) {
    throw new ConfigValidationError(
      `Forbidden unmapped files detected: ${unmappedFilesCount} file(s) are not claimed by any component (${coveragePercentage}% coverage).`,
      { field: 'components' }
    );
  }

  const componentCoverage = {
    totalFiles: totalFilesCount,
    mappedFiles: mappedFilesCount,
    unmappedFiles: unmappedFilesCount,
    coveragePercentage,
  };

  // 5. Run detectors
  // A. Tarjan cycles
  const cycleViolations: ViolationEvidence[] = [];
  const detectedCycles = detectCycles(componentGraph);
  for (const cycle of detectedCycles) {
    // Find matching evidence if any
    const fromComp = cycle.nodes[0];
    const toComp = cycle.nodes[1];
    const matchingDep = componentDependencies.find(
      (d) => d.sourceComponent.id === fromComp && d.targetComponent.id === toComp
    );

    cycleViolations.push({
      id: `CYCLE_${cycle.nodes.join('_')}`,
      type: 'CRITICAL_CYCLE',
      severity: 'critical',
      message: `Circular dependency detected between components: ${cycle.chain}`,
      sourceFile: matchingDep ? matchingDep.evidence.sourceFile : '',
      line: matchingDep ? matchingDep.evidence.line : 1,
      column: matchingDep ? matchingDep.evidence.column : 1,
      snippet: matchingDep ? matchingDep.evidence.snippet : '',
      sourceComponent: fromComp,
      targetComponent: toComp,
      cycle: cycle.nodes,
      suggestion: `Break circular dependency cycle between "${fromComp}" and "${toComp}". Extract shared interfaces/types into a common contracts module, or decouple via Dependency Injection or Event Bus.`,
    });
  }

  // B. Layer bypasses
  const bypassViolations = detectLayerBypasses(componentDependencies, arch);

  // C. Layer inversions
  const inversionViolations = detectLayerInversions(componentDependencies, arch);

  // D. Forbidden imports
  const forbiddenImportViolations = detectForbiddenImports(rawFileDependencies, arch);

  // E. Invariant violations
  const invariantViolations =
    arch.invariants && arch.invariants.length > 0
      ? executeInvariantsEngine({
          rootDir,
          filePaths,
          rules: arch.invariants,
          fileContentMap,
        })
      : [];

  // F. State machine verifier
  const stateViolations: ViolationEvidence[] = [];
  const candidateDocs: string[] = [];

  if (options.specPath && options.specPath.endsWith('.md')) {
    candidateDocs.push(options.specPath);
  } else {
    for (const doc of ['ARCHITECTURE.md', 'AGENTS.md']) {
      const fullDoc = path.resolve(rootDir, doc);
      if (fs.existsSync(fullDoc)) {
        candidateDocs.push(doc);
      }
    }
  }

  for (const relDoc of candidateDocs) {
    const fullDoc = path.resolve(rootDir, relDoc);
    if (fs.existsSync(fullDoc)) {
      const content = fs.readFileSync(fullDoc, 'utf-8');
      if (content.includes('stateDiagram') || content.includes('stateDiagram-v2')) {
        const results = extractAndVerifyStateDiagrams(content, relDoc);
        for (const res of results) {
          for (const v of res.violations) {
            stateViolations.push({
              id: v.id,
              type: v.type,
              severity: v.severity,
              message: v.message,
              sourceFile: v.sourceFile,
              line: v.line,
              column: v.column,
              snippet: v.snippet,
              stateId: v.stateId,
              diagramTitle: v.diagramTitle,
              suggestion: v.suggestion,
            });
          }
        }
      }
    }
  }

  // G. Dynamic Trace & Causality Verifier
  const dynamicViolations: ViolationEvidence[] = [];
  let traceData: ExecutionTrace | undefined = options.trace;

  if (!traceData) {
    const traceFile = options.tracePath
      ? path.resolve(rootDir, options.tracePath)
      : path.resolve(rootDir, '.sextant/trace.json');
    if (fs.existsSync(traceFile)) {
      try {
        const rawJson = fs.readFileSync(traceFile, 'utf-8');
        traceData = JSON.parse(rawJson);
      } catch {
        // Silently ignore malformed trace
      }
    }
  }

  if (traceData && traceData.spans && traceData.spans.length > 0) {
    const seqDiagrams: SequenceDiagramSpec[] = [];
    for (const relDoc of candidateDocs) {
      const fullDoc = path.resolve(rootDir, relDoc);
      if (fs.existsSync(fullDoc)) {
        const content = fs.readFileSync(fullDoc, 'utf-8');
        if (content.includes('sequenceDiagram')) {
          seqDiagrams.push(...extractSequenceDiagrams(content, relDoc));
        }
      }
    }


    if (seqDiagrams.length > 0) {
      const drifts = diffCausality(seqDiagrams, traceData);
      for (const d of drifts) {
        dynamicViolations.push({
          id: d.id,
          type: d.type,
          severity: d.severity,
          message: d.message,
          sourceFile: d.sourceDoc,
          line: d.line,
          column: 1,
          snippet: d.span
            ? `${d.span.caller} -> ${d.span.callee}.${d.span.action}`
            : d.expectedOrder || '',
          sourceComponent: d.span?.caller,
          targetComponent: d.span?.callee,
          targetCall: d.span?.action,
          traceId: traceData.traceId,
          spanId: d.span?.spanId,
          suggestion: d.suggestion,
        });
      }
    }
  }

  // H. Lightweight API Contract Alignment Verifier
  const contractResult = verifyContractAlignment({
    rootDir,
    contractPath: options.contractPath,
    contractContent: options.contractContent,
    files: filePaths,
    fileContentMap,
  });
  const contractViolations = contractResult.violations;
  const contractEndpointCount = contractResult.actualEndpoints?.length || contractResult.targetSpec?.endpoints?.length || 0;

  // 6. Aggregate violations
  const allViolations: DriftViolation[] = [
    ...bypassViolations,
    ...inversionViolations,
    ...cycleViolations,
    ...forbiddenImportViolations,
    ...invariantViolations,
    ...stateViolations,
    ...dynamicViolations,
    ...contractViolations,
    ...resolutionWarnings,
  ];

  // 7. Ensure every violation has a deterministic semantic fingerprint
  for (const v of allViolations) {
    if (!v.fingerprint) {
      v.fingerprint = computeViolationFingerprint(v);
    }
  }

  // 8. Baseline evaluation if baseline file exists or is specified
  const baselineFile = options.baselinePath
    ? path.resolve(rootDir, options.baselinePath)
    : path.resolve(rootDir, DEFAULT_BASELINE_FILENAME);

  const baseline = loadBaseline(baselineFile);
  const { newViolations, exemptions } = diffWithBaseline(allViolations, baseline);

  const summary: DriftSummary = {
    totalFiles: filePaths.length,
    totalDependencies,
    totalViolations: allViolations.length,
    exemptedViolations: exemptions.length,
    newViolations: newViolations.length,
    bypassCount: bypassViolations.length,
    inversionCount: inversionViolations.length,
    cycleCount: cycleViolations.length,
    forbiddenImportCount: forbiddenImportViolations.length,
    invariantViolationCount: invariantViolations.length,
    stateViolationCount: stateViolations.length,
    dynamicViolationCount: dynamicViolations.length,
    contractViolationCount: contractViolations.length,
    contractEndpointCount,
    unresolvedImportCount,
    partialBarrelCount,
    componentCoverage,
  };

  const graphData = buildC4GraphData(arch, componentGraph, allViolations, {
    componentFileCounts,
  });

  const actualMermaid = generateActualMermaid(arch, componentGraph, allViolations);
  const unifiedMermaid = generateUnifiedMermaid(arch, componentGraph, allViolations);
  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const hasCritical = newViolations.some((v) => v.severity === 'critical');
  const hasWarning = newViolations.some((v) => v.severity === 'warning');
  const passed = options.strict ? (!hasCritical && !hasWarning) : !hasCritical;

  return {
    passed,
    exitCode: passed ? 0 : 1,
    summary,
    violations: newViolations,
    exemptions,
    targetArchitecture: arch,
    graphData,
    hasUnresolvedImports: unresolvedImportCount > 0,
    hasPartialBarrels: partialBarrelCount > 0,
    actualMermaid,
    unifiedMermaid,
    durationMs,
  };
}

