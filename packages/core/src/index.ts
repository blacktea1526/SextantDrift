import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { TargetArchitecture, Component, Layer } from './types/architecture.js';
import { DriftReport, DriftSummary, DriftViolation, AnalyzeOptions } from './types/report.js';
import { resolveTargetArchitecture } from './parser/spec-resolver.js';
import { scanSourceFiles } from './analyzer/file-scanner.js';
import { extractDependenciesFromSource, ImportEvidence } from './analyzer/ast-extractor.js';
import { loadTsConfigPaths, resolveModulePath } from './analyzer/path-resolver.js';
import { findComponentForFile } from './analyzer/noise-filter.js';
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

export const VERSION = '0.1.0';

export * from './types/index.js';
export * from './errors/config-error.js';
export * from './parser/json-spec-parser.js';
export * from './parser/mermaid-adapter.js';
export * from './parser/spec-resolver.js';
export * from './analyzer/file-scanner.js';
export * from './analyzer/ast-extractor.js';
export * from './analyzer/path-resolver.js';
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

/**
 * Builds Mermaid flowchart representing the actual detected component dependencies,
 * annotating violations with red warning lines.
 */
export function generateActualMermaid(
  arch: TargetArchitecture,
  componentGraph: DirectedGraph,
  violations: ViolationEvidence[]
): string {
  const lines: string[] = ['flowchart TD'];

  // Add layers and components
  const sortedLayers = [...arch.layers].sort((a, b) => a.order - b.order);
  for (const layer of sortedLayers) {
    lines.push(`    subgraph ${layer.id} ["${layer.name}"]`);
    const layerComps = arch.components.filter((c) => c.layerId === layer.id);
    for (const comp of layerComps) {
      lines.push(`        ${comp.id}["${comp.name}"]`);
    }
    lines.push('    end');
  }

  lines.push('');

  // Collect violating component pairs
  const violatingEdges = new Set<string>();
  for (const v of violations) {
    if (v.sourceComponent && v.targetComponent) {
      violatingEdges.add(`${v.sourceComponent}->${v.targetComponent}`);
    }
  }

  // Add actual edges
  const edges = componentGraph.getEdges();
  let edgeIndex = 0;
  const violatingIndices: number[] = [];

  for (const edge of edges) {
    const isViolating = violatingEdges.has(`${edge.from}->${edge.to}`);
    if (isViolating) {
      lines.push(`    ${edge.from} -.->|DRIFT!| ${edge.to}`);
      violatingIndices.push(edgeIndex);
    } else {
      lines.push(`    ${edge.from} --> ${edge.to}`);
    }
    edgeIndex++;
  }

  // Style violating edges red
  for (const idx of violatingIndices) {
    lines.push(`    linkStyle ${idx} stroke:#E5484D,stroke-width:2px,color:#E5484D;`);
  }

  return lines.join('\n');
}

/**
 * Main Pure Analysis Entrypoint.
 * Evaluates target architecture against physical TypeScript code, returning DriftReport.
 */
export async function analyzeModuleDrift(options: AnalyzeOptions): Promise<DriftReport> {
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

  // 4. Extract dependencies from each file
  for (const relPath of filePaths) {
    const fullPath = path.resolve(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const evidences = extractDependenciesFromSource(relPath, content);
    const sourceComp = findComponentForFile(relPath, arch.components);

    for (const evidence of evidences) {
      totalDependencies++;
      const resolved = resolveModulePath(rootDir, relPath, evidence.rawSpecifier, tsConfigPaths);

      rawFileDependencies.push({
        sourceFile: relPath,
        evidence,
        resolved,
        sourceComponent: sourceComp,
      });

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
      }
    }
  }

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
        })
      : [];

  // 6. Aggregate violations
  const allViolations: DriftViolation[] = [
    ...bypassViolations,
    ...inversionViolations,
    ...cycleViolations,
    ...forbiddenImportViolations,
    ...invariantViolations,
  ];

  const summary: DriftSummary = {
    totalFiles: filePaths.length,
    totalDependencies,
    totalViolations: allViolations.length,
    bypassCount: bypassViolations.length,
    inversionCount: inversionViolations.length,
    cycleCount: cycleViolations.length,
    forbiddenImportCount: forbiddenImportViolations.length,
    invariantViolationCount: invariantViolations.length,
  };

  const actualMermaid = generateActualMermaid(arch, componentGraph, allViolations);
  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
  const passed = allViolations.length === 0;

  return {
    passed,
    exitCode: passed ? 0 : 1,
    summary,
    violations: allViolations,
    targetArchitecture: arch,
    actualMermaid,
    durationMs,
  };
}
