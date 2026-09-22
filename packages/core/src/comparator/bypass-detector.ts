import { TargetArchitecture, Component, Layer } from '../types/architecture.js';
import { ImportEvidence } from '../analyzer/ast-extractor.js';
import { ResolvedTarget } from '../analyzer/path-resolver.js';
import { findComponentForFile } from '../analyzer/noise-filter.js';
import { ViolationEvidence } from '../types/report.js';

export type { ViolationEvidence };

export interface DependencyReference {
  evidence: ImportEvidence;
  resolved: ResolvedTarget;
  sourceComponent: Component;
  sourceLayer: Layer;
  targetComponent: Component;
  targetLayer: Layer;
}

/**
 * Checks if a dependency between two components or layers is explicitly allowed
 */
export function isDependencyAllowed(
  fromComp: Component,
  fromLayer: Layer,
  toComp: Component,
  toLayer: Layer,
  arch: TargetArchitecture
): boolean {
  for (const dep of arch.allowDependencies) {
    if (
      (dep.from === fromComp.id || dep.from === fromLayer.id) &&
      (dep.to === toComp.id || dep.to === toLayer.id)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Detects layer bypass violations (e.g. Layer 1 -> Layer 3, skipping Layer 2)
 */
export function detectLayerBypasses(
  dependencies: DependencyReference[],
  arch: TargetArchitecture
): ViolationEvidence[] {
  const violations: ViolationEvidence[] = [];

  for (const dep of dependencies) {
    const { sourceComponent, sourceLayer, targetComponent, targetLayer, evidence } = dep;

    // Check if target layer order is strictly greater than source layer order + 1
    // (i.e., skipping at least one intermediate layer)
    if (targetLayer.order > sourceLayer.order + 1) {
      // If explicitly exempted in allowDependencies, bypass is allowed
      if (isDependencyAllowed(sourceComponent, sourceLayer, targetComponent, targetLayer, arch)) {
        continue;
      }

      const intermediateLayers = (arch.layers || [])
        .filter((l) => l.order > sourceLayer.order && l.order < targetLayer.order)
        .sort((a, b) => a.order - b.order);

      const skippedStr = intermediateLayers.length > 0
        ? intermediateLayers.map((l) => `"${l.name}" (order ${l.order})`).join(', ')
        : 'intermediate layer(s)';

      const suggestion = intermediateLayers.length > 0
        ? `Route call through intermediate layer ${intermediateLayers.map((l) => `"${l.name}"`).join(' -> ')} (e.g. call a service in Domain instead of directly accessing "${targetComponent.name}"), or explicitly permit this bypass in sextant.json allowDependencies if intentional.`
        : `Route call through intermediate layer or declare an explicit dependency in sextant.json.`;

      violations.push({
        id: `BYPASS_${sourceComponent.id}_${targetComponent.id}_${evidence.line}`,
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: `Layer bypass detected: "${sourceComponent.name}" in layer "${sourceLayer.name}" (order ${sourceLayer.order}) directly calls "${targetComponent.name}" in layer "${targetLayer.name}" (order ${targetLayer.order}), bypassing ${skippedStr}.`,
        sourceFile: evidence.sourceFile,
        line: evidence.line,
        column: evidence.column,
        snippet: evidence.snippet,
        sourceComponent: sourceComponent.id,
        targetComponent: targetComponent.id,
        suggestion,
      });
    }
  }

  return violations;
}
