import { TargetArchitecture, Layer, Component } from '../types/architecture.js';
import {
  C4GraphData,
  C4GraphNode,
  C4GraphEdge,
  C4GraphContainer,
  C4EdgeViolationType,
} from '../types/report.js';
import { DirectedGraph } from '../graph/directed-graph.js';
import { ViolationEvidence } from '../types/report.js';

export interface BuildC4GraphOptions {
  componentFileCounts?: Map<string, number>;
}

export function buildC4GraphData(
  arch: TargetArchitecture,
  componentGraph: DirectedGraph,
  violations: ViolationEvidence[] = [],
  options: BuildC4GraphOptions = {}
): C4GraphData {
  const fileCounts = options.componentFileCounts || new Map<string, number>();

  // 1. Layer & Container Lookups
  const layerMap = new Map<string, Layer>();
  for (const layer of arch.layers || []) {
    layerMap.set(layer.id, layer);
  }

  // Map components to layer
  const compMap = new Map<string, Component>();
  for (const comp of arch.components || []) {
    compMap.set(comp.id, comp);
  }

  // 2. Identify Violations per Component and Edge
  const violatingCompMap = new Map<string, ViolationEvidence[]>();
  const violatingEdgeMap = new Map<string, ViolationEvidence[]>();

  for (const v of violations) {
    if (v.sourceComponent) {
      if (!violatingCompMap.has(v.sourceComponent)) violatingCompMap.set(v.sourceComponent, []);
      violatingCompMap.get(v.sourceComponent)!.push(v);
    }
    if (v.targetComponent) {
      if (!violatingCompMap.has(v.targetComponent)) violatingCompMap.set(v.targetComponent, []);
      violatingCompMap.get(v.targetComponent)!.push(v);
    }
    if (v.sourceComponent && v.targetComponent) {
      const edgeKey = `${v.sourceComponent}->${v.targetComponent}`;
      if (!violatingEdgeMap.has(edgeKey)) violatingEdgeMap.set(edgeKey, []);
      violatingEdgeMap.get(edgeKey)!.push(v);
    }
  }

  // 3. Build Nodes
  const nodes: C4GraphNode[] = (arch.components || []).map((comp) => {
    const layer = layerMap.get(comp.layerId);
    const compViolations = violatingCompMap.get(comp.id) || [];
    const isDrift = compViolations.length > 0;

    return {
      id: comp.id,
      name: comp.name || comp.id,
      layerId: comp.layerId,
      layerName: layer?.name || comp.layerId,
      containerId: comp.containerId || comp.layerId,
      containerName: layer?.name || comp.layerId,
      technology: comp.technology || 'TypeScript',
      description: comp.description || '',
      paths: comp.paths || [],
      fileCount: fileCounts.get(comp.id) || 0,
      status: isDrift ? 'drift' : 'compliant',
      violationCount: compViolations.length,
    };
  });

  // 4. Build Containers (from arch.containers or fallback to arch.layers)
  const containers: C4GraphContainer[] = [];
  const sortedLayers = [...(arch.layers || [])].sort((a, b) => a.order - b.order);

  if (arch.containers && arch.containers.length > 0) {
    const sortedContainers = [...arch.containers].sort((a, b) => a.order - b.order);
    for (const c of sortedContainers) {
      const compIds = nodes.filter((n) => n.containerId === c.id).map((n) => n.id);
      const hasDrift = compIds.some((id) => violatingCompMap.has(id));
      containers.push({
        id: c.id,
        name: c.name,
        order: c.order,
        description: c.description,
        technology: c.technology,
        type: c.type || 'application',
        status: hasDrift ? 'drift' : 'compliant',
        componentIds: compIds,
      });
    }
  } else {
    for (const layer of sortedLayers) {
      const compIds = nodes.filter((n) => n.layerId === layer.id).map((n) => n.id);
      const hasDrift = compIds.some((id) => violatingCompMap.has(id));
      containers.push({
        id: layer.id,
        name: layer.name,
        order: layer.order,
        description: layer.description,
        technology: layer.technology || 'TypeScript Module',
        type: 'library',
        status: hasDrift ? 'drift' : 'compliant',
        componentIds: compIds,
      });
    }
  }

  // Helper to map violation type to C4 edge violation type
  const mapViolationType = (v: ViolationEvidence): C4EdgeViolationType => {
    switch (v.type) {
      case 'CRITICAL_BYPASS':
        return 'bypass';
      case 'CRITICAL_INVERSION':
        return 'inversion';
      case 'CRITICAL_CYCLE':
        return 'cycle';
      case 'CRITICAL_FORBIDDEN_IMPORT':
        return 'forbidden_import';
      case 'INVARIANT_BROKEN':
        return 'invariant_broken';
      case 'DYNAMIC_OUT_OF_ORDER':
      case 'DYNAMIC_UNEXPECTED_CALL':
      case 'DYNAMIC_MISSING_CALL':
        return 'dynamic';
      case 'STATE_DEADLOCK':
      case 'STATE_UNREACHABLE':
      case 'STATE_MISSING_FALLBACK':
        return 'state';
      default:
        return 'bypass';
    }
  };

  // 5. Build Actual Edges
  const actualEdges: C4GraphEdge[] = [];
  const actualEdgeSet = new Set<string>();

  for (const edge of componentGraph.getEdges()) {
    const key = `${edge.from}->${edge.to}`;
    actualEdgeSet.add(key);

    const edgeViolations = violatingEdgeMap.get(key) || [];
    const isDrift = edgeViolations.length > 0;
    const violationType = edgeViolations.length > 0 ? mapViolationType(edgeViolations[0]) : 'allowed';

    actualEdges.push({
      id: key,
      from: edge.from,
      to: edge.to,
      status: isDrift ? 'drift' : 'compliant',
      type: violationType,
      violations: edgeViolations.map((v) => v.id),
      violationSummaries: edgeViolations.map((v) => v.message),
      protocol: 'imports',
    });
  }

  // 6. Build Target Edges
  const targetEdges: C4GraphEdge[] = [];
  const targetEdgeSet = new Set<string>();

  for (const dep of arch.allowDependencies || []) {
    const isFromComp = compMap.has(dep.from);
    const isToComp = compMap.has(dep.to);

    if (isFromComp && isToComp) {
      // Explicit component-to-component dependency design intent
      if (dep.from === dep.to) continue;
      const key = `${dep.from}->${dep.to}`;
      if (!targetEdgeSet.has(key)) {
        targetEdgeSet.add(key);
        targetEdges.push({
          id: key,
          from: dep.from,
          to: dep.to,
          status: 'compliant',
          type: 'allowed',
          description: dep.description,
          technology: dep.technology,
          protocol: dep.protocol || 'calls',
        });
      }
    } else {
      // Layer-level boundary permission (e.g. engine -> infrastructure)
      // Layer rules are permissions/allowlists, NOT mandatory obligations for all component pairs.
      // We map actual compliant edges that conform to this layer permission into target architecture.
      const fromLayerId = dep.from;
      const toLayerId = dep.to;

      if (actualEdges.length > 0) {
        for (const actualEdge of actualEdges) {
          if (actualEdge.status !== 'compliant') continue;
          const fromComp = compMap.get(actualEdge.from);
          const toComp = compMap.get(actualEdge.to);
          if (!fromComp || !toComp) continue;

          const matchesFrom =
            fromComp.layerId === fromLayerId ||
            fromComp.containerId === fromLayerId ||
            actualEdge.from === fromLayerId;
          const matchesTo =
            toComp.layerId === toLayerId ||
            toComp.containerId === toLayerId ||
            actualEdge.to === toLayerId;

          if (matchesFrom && matchesTo) {
            const key = actualEdge.id;
            if (!targetEdgeSet.has(key)) {
              targetEdgeSet.add(key);
              targetEdges.push({
                id: key,
                from: actualEdge.from,
                to: actualEdge.to,
                status: 'compliant',
                type: 'allowed',
                description: dep.description,
                technology: dep.technology,
                protocol: dep.protocol || 'calls',
              });
            }
          }
        }
      } else {
        // Fallback for empty repository / zero actual edges (early architectural blueprint)
        // If there are exactly 1 component per layer, connect them.
        const fromComps = (arch.components || []).filter(
          (c) => c.layerId === fromLayerId || c.containerId === fromLayerId
        ).map((c) => c.id);
        const toComps = (arch.components || []).filter(
          (c) => c.layerId === toLayerId || c.containerId === toLayerId
        ).map((c) => c.id);
        if (fromComps.length === 1 && toComps.length === 1 && fromComps[0] !== toComps[0]) {
          const key = `${fromComps[0]}->${toComps[0]}`;
          if (!targetEdgeSet.has(key)) {
            targetEdgeSet.add(key);
            targetEdges.push({
              id: key,
              from: fromComps[0],
              to: toComps[0],
              status: 'compliant',
              type: 'allowed',
              description: dep.description,
              technology: dep.technology,
              protocol: dep.protocol || 'calls',
            });
          }
        }
      }
    }
  }

  // 7. Build Unified Diff Edges (Combining Actual Reality & Planned Target)
  const unifiedEdges: C4GraphEdge[] = [];
  const processedUnifiedKeys = new Set<string>();

  // A. Actual Edges (Either Compliant or Drift)
  for (const actualEdge of actualEdges) {
    processedUnifiedKeys.add(actualEdge.id);
    unifiedEdges.push({ ...actualEdge });
  }

  // B. Planned Target Edges not present in Actual
  for (const targetEdge of targetEdges) {
    if (!processedUnifiedKeys.has(targetEdge.id)) {
      processedUnifiedKeys.add(targetEdge.id);
      unifiedEdges.push({
        id: targetEdge.id,
        from: targetEdge.from,
        to: targetEdge.to,
        status: 'planned',
        type: 'planned',
        description: targetEdge.description || 'Planned in target architecture',
        technology: targetEdge.technology,
        protocol: targetEdge.protocol || 'planned',
      });
    }
  }

  // 8. Build Container-Level Edges (Level 2 Multi-Level Aggregation)
  const getContainerId = (compId: string): string => {
    const comp = compMap.get(compId);
    if (comp) return comp.containerId || comp.layerId;
    return compId;
  };

  const actualContainerEdgeMap = new Map<
    string,
    {
      from: string;
      to: string;
      status: 'compliant' | 'drift';
      type: C4EdgeViolationType;
      violations: string[];
      violationSummaries: string[];
      componentEdgeCount: number;
    }
  >();

  for (const edge of actualEdges) {
    const fromContainer = getContainerId(edge.from);
    const toContainer = getContainerId(edge.to);

    if (!fromContainer || !toContainer || fromContainer === toContainer) {
      continue;
    }

    const key = `${fromContainer}->${toContainer}`;
    let existing = actualContainerEdgeMap.get(key);
    if (!existing) {
      existing = {
        from: fromContainer,
        to: toContainer,
        status: 'compliant',
        type: 'allowed',
        violations: [],
        violationSummaries: [],
        componentEdgeCount: 0,
      };
      actualContainerEdgeMap.set(key, existing);
    }

    existing.componentEdgeCount++;
    if (edge.status === 'drift') {
      existing.status = 'drift';
      if (edge.type && edge.type !== 'allowed') {
        existing.type = edge.type;
      }
      if (edge.violations) {
        for (const v of edge.violations) {
          if (!existing.violations.includes(v)) existing.violations.push(v);
        }
      }
      if (edge.violationSummaries) {
        for (const vs of edge.violationSummaries) {
          if (!existing.violationSummaries.includes(vs)) existing.violationSummaries.push(vs);
        }
      }
    }
  }

  const actualContainerEdges: C4GraphEdge[] = Array.from(actualContainerEdgeMap.entries()).map(
    ([key, data]) => ({
      id: key,
      from: data.from,
      to: data.to,
      status: data.status,
      type: data.type,
      violations: data.violations,
      violationSummaries: data.violationSummaries,
      protocol: 'imports',
      description: `${data.componentEdgeCount} component dependency flow(s)`,
    })
  );

  // Build Target Container Edges
  const targetContainerEdgeMap = new Map<string, C4GraphEdge>();
  const containerIdSet = new Set(containers.map((c) => c.id));

  for (const dep of arch.allowDependencies || []) {
    let fromContainer: string | undefined;
    let toContainer: string | undefined;

    if (containerIdSet.has(dep.from)) {
      fromContainer = dep.from;
    } else {
      fromContainer = compMap.get(dep.from)?.containerId || compMap.get(dep.from)?.layerId;
    }

    if (containerIdSet.has(dep.to)) {
      toContainer = dep.to;
    } else {
      toContainer = compMap.get(dep.to)?.containerId || compMap.get(dep.to)?.layerId;
    }

    if (fromContainer && toContainer && fromContainer !== toContainer) {
      const key = `${fromContainer}->${toContainer}`;
      if (!targetContainerEdgeMap.has(key)) {
        targetContainerEdgeMap.set(key, {
          id: key,
          from: fromContainer,
          to: toContainer,
          status: 'compliant',
          type: 'allowed',
          protocol: dep.protocol || 'calls',
          technology: dep.technology,
          description: dep.description,
        });
      }
    }
  }

  const targetContainerEdges: C4GraphEdge[] = Array.from(targetContainerEdgeMap.values());

  // Unified Container Edges (actual + planned target)
  const unifiedContainerEdges: C4GraphEdge[] = [];
  const processedContainerKeys = new Set<string>();

  for (const ace of actualContainerEdges) {
    processedContainerKeys.add(ace.id);
    unifiedContainerEdges.push({ ...ace });
  }

  for (const tce of targetContainerEdges) {
    if (!processedContainerKeys.has(tce.id)) {
      processedContainerKeys.add(tce.id);
      unifiedContainerEdges.push({
        id: tce.id,
        from: tce.from,
        to: tce.to,
        status: 'planned',
        type: 'planned',
        protocol: tce.protocol || 'planned',
        technology: tce.technology,
        description: tce.description || 'Planned container dependency',
      });
    }
  }

  return {
    systemName: arch.name || arch.systemName || 'SextantDrift System',
    systemContext: arch.systemContext,
    containers,
    nodes,
    edges: unifiedEdges,
    targetEdges,
    actualEdges,
    containerEdges: unifiedContainerEdges,
    targetContainerEdges,
    actualContainerEdges,
  };
}
