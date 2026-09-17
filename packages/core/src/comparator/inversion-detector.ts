import { TargetArchitecture, Component, Layer } from '../types/architecture.js';
import { ImportEvidence } from '../analyzer/ast-extractor.js';
import { ResolvedTarget } from '../analyzer/path-resolver.js';
import { matchesPatterns } from '../analyzer/noise-filter.js';
import { DependencyReference, ViolationEvidence, isDependencyAllowed } from './bypass-detector.js';

/**
 * Detects layer inversion violations (e.g. Layer 2 -> Layer 1, or Layer 3 -> Layer 2)
 */
export function detectLayerInversions(
  dependencies: DependencyReference[],
  arch: TargetArchitecture
): ViolationEvidence[] {
  const violations: ViolationEvidence[] = [];

  for (const dep of dependencies) {
    const { sourceComponent, sourceLayer, targetComponent, targetLayer, evidence } = dep;

    // Target layer has lower order number (i.e. is higher in the stack, e.g. Domain -> UI)
    if (targetLayer.order < sourceLayer.order) {
      if (isDependencyAllowed(sourceComponent, sourceLayer, targetComponent, targetLayer, arch)) {
        continue;
      }

      violations.push({
        id: `INVERSION_${sourceComponent.id}_${targetComponent.id}_${evidence.line}`,
        type: 'CRITICAL_INVERSION',
        severity: 'critical',
        message: `Layer inversion detected: "${sourceComponent.name}" in lower layer "${sourceLayer.name}" (order ${sourceLayer.order}) reverse-imports "${targetComponent.name}" in upper layer "${targetLayer.name}" (order ${targetLayer.order}).`,
        sourceFile: evidence.sourceFile,
        line: evidence.line,
        column: evidence.column,
        snippet: evidence.snippet,
        sourceComponent: sourceComponent.id,
        targetComponent: targetComponent.id,
      });
    }
  }

  return violations;
}

export interface RawFileDependency {
  sourceFile: string;
  evidence: ImportEvidence;
  resolved: ResolvedTarget;
  sourceComponent: Component | null;
}

/**
 * Detects forbidden imports (e.g. Presentation layer importing @prisma/client or database drivers)
 */
export function detectForbiddenImports(
  fileDependencies: RawFileDependency[],
  arch: TargetArchitecture
): ViolationEvidence[] {
  const violations: ViolationEvidence[] = [];

  for (const fileDep of fileDependencies) {
    const { sourceComponent, evidence, resolved } = fileDep;
    if (!sourceComponent) continue;

    const forbiddenList = sourceComponent.forbiddenImports ?? [];
    if (forbiddenList.length === 0) continue;

    for (const forbidden of forbiddenList) {
      let isForbidden = false;

      if (resolved.type === 'external') {
        if (
          resolved.packageName === forbidden ||
          resolved.rawSpecifier === forbidden ||
          resolved.rawSpecifier.startsWith(forbidden + '/')
        ) {
          isForbidden = true;
        }
      } else {
        // Internal target path
        if (matchesPatterns(resolved.targetPath, [forbidden])) {
          isForbidden = true;
        }
      }

      if (isForbidden) {
        violations.push({
          id: `FORBIDDEN_IMPORT_${sourceComponent.id}_${evidence.line}`,
          type: 'CRITICAL_FORBIDDEN_IMPORT',
          severity: 'critical',
          message: `Forbidden import detected: Component "${sourceComponent.name}" is forbidden from importing "${forbidden}".`,
          sourceFile: evidence.sourceFile,
          line: evidence.line,
          column: evidence.column,
          snippet: evidence.snippet,
          sourceComponent: sourceComponent.id,
        });
        break;
      }
    }
  }

  return violations;
}
