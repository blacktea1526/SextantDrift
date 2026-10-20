import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { resolveTargetArchitecture } from './parser/spec-resolver.js';
import { extractDependenciesFromSource } from './analyzer/ast-extractor.js';
import { extractPythonDependencies } from './analyzer/python-ast-extractor.js';
import { extractGoDependencies } from './analyzer/go-ast-extractor.js';
import { loadTsConfigPaths, resolveModulePath } from './analyzer/path-resolver.js';
import { resolvePythonModulePath } from './analyzer/python-resolver.js';
import { resolveGoModulePath } from './analyzer/go-resolver.js';
import { detectSourceLanguage } from './analyzer/source-language.js';
import { findComponentForFile, clearComponentLookupCache } from './analyzer/noise-filter.js';
import { detectLayerBypasses, DependencyReference } from './comparator/bypass-detector.js';
import {
  detectLayerInversions,
  detectForbiddenImports,
  RawFileDependency,
} from './comparator/inversion-detector.js';
import { executeInvariantsEngine } from './invariants/engine.js';
import { computeViolationFingerprint } from './baseline/fingerprint.js';
import { Layer } from './types/architecture.js';
import { DriftViolation } from './types/report.js';

export interface CheckFileOptions {
  rootDir: string;
  filePath: string;
  fileContent: string;
  specPath?: string;
  tsconfigPath?: string;
}

export interface CheckFileResult {
  valid: boolean;
  filePath: string;
  componentId?: string;
  layerId?: string;
  violations: DriftViolation[];
  steeringAdvice?: string;
  durationMs: number;
}

/**
 * High-speed incremental single-file architectural drift guardrail (<20ms).
 * Intended for real-time pre-write verification by AI Coding Agents and MCP tools.
 */
export function checkFileDrift(options: CheckFileOptions): CheckFileResult {
  clearComponentLookupCache();
  const startTime = performance.now();
  const rootDir = path.resolve(options.rootDir);
  const normalizedFilePath = path.isAbsolute(options.filePath)
    ? path.relative(rootDir, options.filePath).split(path.sep).join('/')
    : options.filePath.split(path.sep).join('/');

  const arch = resolveTargetArchitecture(rootDir, options.specPath);
  const layerMap = new Map<string, Layer>();
  for (const layer of arch.layers) {
    layerMap.set(layer.id, layer);
  }

  const language = detectSourceLanguage(normalizedFilePath);
  const evidences =
    language === 'python'
      ? extractPythonDependencies(normalizedFilePath, options.fileContent)
      : language === 'go'
        ? extractGoDependencies(normalizedFilePath, options.fileContent)
        : extractDependenciesFromSource(normalizedFilePath, options.fileContent);

  const sourceComp = findComponentForFile(normalizedFilePath, arch.components);
  const tsConfigPaths = language === 'typescript' ? loadTsConfigPaths(rootDir, options.tsconfigPath) : {};

  const rawFileDependencies: RawFileDependency[] = [];
  const componentDependencies: DependencyReference[] = [];

  for (const evidence of evidences) {
    if (evidence.isTypeOnly) continue;

    const resolved =
      language === 'python'
        ? resolvePythonModulePath(rootDir, normalizedFilePath, evidence.rawSpecifier)
        : language === 'go'
          ? resolveGoModulePath(rootDir, normalizedFilePath, evidence.rawSpecifier)
          : resolveModulePath(rootDir, normalizedFilePath, evidence.rawSpecifier, tsConfigPaths, {
              customTsconfigPath: options.tsconfigPath,
            });

    rawFileDependencies.push({
      sourceFile: normalizedFilePath,
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
        }
      }
    }
  }

  // 1. Detect layer bypasses
  const bypassViolations = detectLayerBypasses(componentDependencies, arch);

  // 2. Detect layer inversions
  const inversionViolations = detectLayerInversions(componentDependencies, arch);

  // 3. Detect forbidden imports
  const forbiddenImportViolations = detectForbiddenImports(rawFileDependencies, arch);

  // 4. Invariants matching for this single file
  const invariantViolations =
    arch.invariants && arch.invariants.length > 0
      ? executeInvariantsEngine({
          rootDir,
          filePaths: [normalizedFilePath],
          rules: arch.invariants,
          fileContentMap: new Map([[normalizedFilePath, options.fileContent]]),
        })
      : [];

  const violations: DriftViolation[] = [
    ...bypassViolations,
    ...inversionViolations,
    ...forbiddenImportViolations,
    ...invariantViolations,
  ];

  for (const v of violations) {
    if (!v.fingerprint) {
      v.fingerprint = computeViolationFingerprint(v);
    }
  }

  const valid = violations.length === 0;
  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  let steeringAdvice: string | undefined;
  if (!valid) {
    const hints = violations
      .map((v) => v.suggestion || v.message)
      .filter(Boolean);
    steeringAdvice = hints.join('\n');
  }

  return {
    valid,
    filePath: normalizedFilePath,
    componentId: sourceComp?.id,
    layerId: sourceComp?.layerId,
    violations,
    steeringAdvice,
    durationMs,
  };
}
