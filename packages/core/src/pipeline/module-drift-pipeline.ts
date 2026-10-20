import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ConfigValidationError, ConfigSyntaxError } from '../errors/config-error.js';
import { TargetArchitecture, Component } from '../types/architecture.js';
import { DriftReport, DriftSummary, DriftViolation, AnalyzeOptions, ViolationEvidence } from '../types/report.js';
import { resolveTargetArchitecture } from '../parser/spec-resolver.js';
import { scanSourceFiles } from '../analyzer/file-scanner.js';
import { loadTsConfigPaths, clearResolutionCache } from '../analyzer/path-resolver.js';
import { clearTsResolverCache } from '../analyzer/ts-project-resolver.js';
import { clearBarrelCache } from '../analyzer/barrel-tracer.js';
import { clearGoModuleCache } from '../analyzer/go-resolver.js';
import { findComponentForFile, clearComponentLookupCache } from '../analyzer/noise-filter.js';
import { buildActualDependencyGraph } from './actual-graph-builder.js';
import { detectCycles } from '../graph/tarjan.js';
import { detectLayerBypasses } from '../comparator/bypass-detector.js';
import { detectLayerInversions, detectForbiddenImports } from '../comparator/inversion-detector.js';
import { executeInvariantsEngine } from '../invariants/engine.js';
import { computeViolationFingerprint } from '../baseline/fingerprint.js';
import { loadBaseline, diffWithBaseline, DEFAULT_BASELINE_FILENAME } from '../baseline/manager.js';
import { extractAndVerifyStateDiagrams } from '../state/index.js';
import { extractSequenceDiagrams, diffCausality, SequenceDiagramSpec } from '../causality/index.js';
import { verifyContractAlignment } from '../contract/index.js';
import { buildC4GraphData } from '../c4/index.js';
import { generateActualMermaid, generateUnifiedMermaid } from '../parser/mermaid-generator.js';
import { projectBusinessRequirements } from '../requirements/project.js';
import type { ExecutionTrace } from '../trace/types.js';

/**
 * Resets all in-memory resolution, AST, barrel, and lookup caches.
 */
export function clearAllAnalysisCaches(): void {
  clearResolutionCache();
  clearTsResolverCache();
  clearBarrelCache();
  clearGoModuleCache();
  clearComponentLookupCache();
}

/**
 * Main Stage-driven Execution Pipeline for Module Drift Analysis.
 */
export async function executeModuleDriftPipeline(options: AnalyzeOptions): Promise<DriftReport> {
  clearAllAnalysisCaches();
  const startTime = performance.now();
  const rootDir = path.resolve(options.rootDir);

  // Stage 1: Resolve target architecture specification
  const arch = resolveTargetArchitecture(rootDir, options.specPath);

  // Stage 2: Scan source files and pre-load file contents
  const filePaths = options.files ?? scanSourceFiles(rootDir);
  const tsConfigPaths = loadTsConfigPaths(rootDir, options.tsconfigPath);

  const fileContentMap = new Map<string, string>();
  for (const relPath of filePaths) {
    const fullPath = path.resolve(rootDir, relPath);
    if (fs.existsSync(fullPath)) {
      fileContentMap.set(relPath, fs.readFileSync(fullPath, 'utf-8'));
    }
  }

  // Stage 3: Extract AST dependencies & build actual component dependency graph
  const graphResult = buildActualDependencyGraph({
    rootDir,
    filePaths,
    arch,
    fileContentMap,
    tsConfigPaths: tsConfigPaths || undefined,
    customTsconfigPath: options.tsconfigPath,
    countTypeOnly: options.countTypeOnly,
  });

  const {
    componentGraph,
    componentDependencies,
    rawFileDependencies,
    resolutionWarnings,
    componentFileCounts,
    totalDependencies,
    unresolvedImportCount,
    partialBarrelCount,
  } = graphResult;

  // Validate component coverage and empty component patterns
  const emptyComponentViolations: ViolationEvidence[] = [];
  if (!options.files) {
    const allowEmpty = options.allowEmptyComponents ?? true;
    for (const comp of arch.components) {
      const count = componentFileCounts.get(comp.id) || 0;
      if (count === 0) {
        if (!allowEmpty) {
          throw new ConfigValidationError(
            `Architecture spec component "${comp.id}" matched 0 files with paths: [${comp.paths.join(', ')}]`,
            { field: `components.${comp.id}.paths` }
          );
        }
        emptyComponentViolations.push({
          id: `EMPTY_COMP_${comp.id}`,
          type: 'WARN_EMPTY_COMPONENT',
          severity: 'warning',
          message: `Architecture component "${comp.id}" matched 0 files with paths: [${comp.paths.join(', ')}] (Declared skeleton component pending implementation)`,
          sourceFile: comp.paths[0] || '',
          line: 1,
          column: 1,
          snippet: `component: ${comp.id} (0 files matched)`,
          sourceComponent: comp.id,
          suggestion: `Implement files matching paths: [${comp.paths.join(', ')}] or remove unused component "${comp.id}" from architecture spec.`,
        });
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

  // Stage 4: Run modular drift detectors
  // A. Tarjan cycles
  const cycleViolations: ViolationEvidence[] = [];
  const detectedCycles = detectCycles(componentGraph);
  for (const cycle of detectedCycles) {
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
    const isExplicitTrace = Boolean(options.tracePath);
    const traceFile = options.tracePath
      ? path.resolve(rootDir, options.tracePath)
      : path.resolve(rootDir, '.sextant/trace.json');
    if (fs.existsSync(traceFile)) {
      try {
        const rawJson = fs.readFileSync(traceFile, 'utf-8');
        traceData = JSON.parse(rawJson);
      } catch (err: any) {
        if (isExplicitTrace) {
          throw new ConfigSyntaxError(
            `Malformed runtime trace file at "${traceFile}": ${err?.message || 'Invalid JSON'}`,
            { snippet: traceFile }
          );
        }
      }
    } else if (isExplicitTrace) {
      throw new ConfigValidationError(`Runtime trace file not found at: ${traceFile}`);
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

  // Stage 5: Aggregate violations and synthesize DriftReport
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
    ...emptyComponentViolations,
  ];

  for (const v of allViolations) {
    if (!v.fingerprint) {
      v.fingerprint = computeViolationFingerprint(v);
    }
  }

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
    emptyComponentCount: emptyComponentViolations.length,
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

  const businessRequirementView = arch.businessRequirements
    ? projectBusinessRequirements(arch.businessRequirements)
    : undefined;

  return {
    passed,
    exitCode: passed ? 0 : 1,
    summary,
    violations: newViolations,
    exemptions,
    targetArchitecture: arch,
    graphData,
    ...(businessRequirementView ? { businessRequirementView } : {}),
    hasUnresolvedImports: unresolvedImportCount > 0,
    hasPartialBarrels: partialBarrelCount > 0,
    actualMermaid,
    unifiedMermaid,
    durationMs,
  };
}
