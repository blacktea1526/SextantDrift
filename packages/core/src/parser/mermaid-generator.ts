import { TargetArchitecture, Layer } from '../types/architecture.js';
import { DirectedGraph } from '../graph/directed-graph.js';
import { ViolationEvidence } from '../types/report.js';

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
  const firstComps: string[] = [];
  const compToLayer = new Map<string, Layer>();

  for (const layer of sortedLayers) {
    lines.push(`    subgraph ${layer.id} ["Layer ${layer.order} • ${layer.name}"]`);
    const layerComps = arch.components.filter((c) => c.layerId === layer.id);
    if (layerComps.length > 0) {
      firstComps.push(layerComps[0].id);
    }
    for (const comp of layerComps) {
      compToLayer.set(comp.id, layer);
      lines.push(`        ${comp.id}["${comp.name}"]`);
    }
    lines.push('    end');
  }

  lines.push('');

  // Collect violating components and layer IDs
  const violatingCompIds = new Set<string>();
  const violatingEdges = new Set<string>();
  const violatingLayerIds = new Set<string>();

  for (const v of violations) {
    if (v.sourceComponent) violatingCompIds.add(v.sourceComponent);
    if (v.targetComponent) violatingCompIds.add(v.targetComponent);
    if (v.sourceComponent && v.targetComponent) {
      violatingEdges.add(`${v.sourceComponent}->${v.targetComponent}`);
    }
  }

  for (const compId of violatingCompIds) {
    const layer = compToLayer.get(compId);
    if (layer) violatingLayerIds.add(layer.id);
  }

  // Add actual edges
  const edges = componentGraph.getEdges();
  const linkStyles: string[] = [];

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const isViolating = violatingEdges.has(`${edge.from}->${edge.to}`);
    if (isViolating) {
      lines.push(`    ${edge.from} -.->|DRIFT!| ${edge.to}`);
      linkStyles.push(`    linkStyle ${i} stroke:#E5484D,stroke-width:3px,color:#E5484D;`);
    } else {
      lines.push(`    ${edge.from} --> ${edge.to}`);
      const fromLayer = compToLayer.get(edge.from);
      const toLayer = compToLayer.get(edge.to);
      const isContracts =
        toLayer?.id === 'contracts' ||
        toLayer?.order === sortedLayers[sortedLayers.length - 1]?.order;

      if (isContracts) {
        // Foundation / Contracts edges: light green
        linkStyles.push(`    linkStyle ${i} stroke:#86EFAC,stroke-width:1.5px;`);
      } else if (fromLayer?.id !== toLayer?.id) {
        // Cross-layer primary control flow: bold emerald green
        linkStyles.push(`    linkStyle ${i} stroke:#16A34A,stroke-width:2.2px;`);
      } else {
        // Intra-layer link: green dashed
        linkStyles.push(`    linkStyle ${i} stroke:#22C55E,stroke-width:1.6px,stroke-dasharray: 3 3;`);
      }
    }
  }

  // Add link styles
  for (const ls of linkStyles) {
    lines.push(ls);
  }

  // Style subgraphs as clean swimlanes: Mint green for compliant, soft red for layers with violations
  for (const layer of sortedLayers) {
    if (violatingLayerIds.has(layer.id)) {
      lines.push(`    style ${layer.id} fill:#FFF5F5,stroke:#FCA5A5,stroke-width:2px,stroke-dasharray: 4 4;`);
    } else {
      lines.push(`    style ${layer.id} fill:#F4FAF6,stroke:#86EFAC,stroke-width:1.5px,stroke-dasharray: 4 4;`);
    }
  }

  // Class definitions for nodes (Red vs Green)
  lines.push('    classDef compliant fill:#FFFFFF,stroke:#16A34A,stroke-width:2px,color:#14532D;');
  lines.push('    classDef drift fill:#FEF2F2,stroke:#E5484D,stroke-width:3px,color:#991B1B,stroke-dasharray: 4 4;');

  const compliantComps = arch.components.filter((c) => !violatingCompIds.has(c.id)).map((c) => c.id);
  const driftComps = arch.components.filter((c) => violatingCompIds.has(c.id)).map((c) => c.id);

  if (compliantComps.length > 0) {
    lines.push(`    class ${compliantComps.join(',')} compliant;`);
  }
  if (driftComps.length > 0) {
    lines.push(`    class ${driftComps.join(',')} drift;`);
  }

  lines.push('');

  // INVISIBLE LAYOUT CONSTRAINTS (At the very end, so they NEVER interfere with linkStyle indices)
  // Grid layout for components inside subgraphs with >= 3 components
  for (const layer of sortedLayers) {
    const layerComps = arch.components.filter((c) => c.layerId === layer.id);
    const cols = layerComps.length >= 6 ? 3 : 2;
    for (let i = 0; i < layerComps.length - cols; i++) {
      lines.push(`    ${layerComps[i].id} ~~~ ${layerComps[i + cols].id}`);
    }
  }

  // Enforce strict vertical swimlane hierarchy between layers
  for (let i = 0; i < firstComps.length - 1; i++) {
    lines.push(`    ${firstComps[i]} ~~~ ${firstComps[i + 1]}`);
  }

  return lines.join('\n');
}

/**
 * Generates a single Unified Overlay Diff Mermaid diagram merging Target Architecture (Intent)
 * and Actual Code Topology (Reality) onto a single canvas.
 * - Solid Green arrows: Compliant paths present in both Target and Actual
 * - Red dashed arrows (|DRIFT!|): Actual violations (bypasses, inversions, illegal dependencies)
 * - Subtle Grey dashed arrows (|PLAN|): Planned in Target but not yet used directly in Actual
 * - Compliant nodes: Green
 * - Violating nodes: Red
 */
export function generateUnifiedMermaid(
  arch: TargetArchitecture,
  componentGraph: DirectedGraph,
  violations: ViolationEvidence[]
): string {
  const lines: string[] = ['flowchart TD'];

  // Add layers and components
  const sortedLayers = [...arch.layers].sort((a, b) => a.order - b.order);
  const firstComps: string[] = [];
  const compToLayer = new Map<string, Layer>();

  for (const layer of sortedLayers) {
    lines.push(`    subgraph ${layer.id} ["Layer ${layer.order} • ${layer.name}"]`);
    const layerComps = arch.components.filter((c) => c.layerId === layer.id);
    if (layerComps.length > 0) {
      firstComps.push(layerComps[0].id);
    }
    for (const comp of layerComps) {
      compToLayer.set(comp.id, layer);
      lines.push(`        ${comp.id}["${comp.name}"]`);
    }
    lines.push('    end');
  }

  lines.push('');

  // Collect violating components and edges
  const violatingCompIds = new Set<string>();
  const violatingEdges = new Set<string>();
  const violatingLayerIds = new Set<string>();

  for (const v of violations) {
    if (v.sourceComponent) violatingCompIds.add(v.sourceComponent);
    if (v.targetComponent) violatingCompIds.add(v.targetComponent);
    if (v.sourceComponent && v.targetComponent) {
      violatingEdges.add(`${v.sourceComponent}->${v.targetComponent}`);
    }
  }

  for (const compId of violatingCompIds) {
    const layer = compToLayer.get(compId);
    if (layer) violatingLayerIds.add(layer.id);
  }

  // Set of actual edges
  const actualEdges = componentGraph.getEdges();
  const actualEdgeSet = new Set<string>();
  for (const e of actualEdges) {
    actualEdgeSet.add(`${e.from}->${e.to}`);
  }

  const linkStyles: string[] = [];
  let edgeIndex = 0;

  // 1. Output Actual Edges (Compliant = Green, Drift = Red)
  for (const edge of actualEdges) {
    const isViolating = violatingEdges.has(`${edge.from}->${edge.to}`);
    if (isViolating) {
      lines.push(`    ${edge.from} -.->|DRIFT!| ${edge.to}`);
      linkStyles.push(`    linkStyle ${edgeIndex} stroke:#E5484D,stroke-width:3.5px,color:#E5484D;`);
    } else {
      lines.push(`    ${edge.from} --> ${edge.to}`);
      const fromLayer = compToLayer.get(edge.from);
      const toLayer = compToLayer.get(edge.to);
      const isContracts =
        toLayer?.id === 'contracts' ||
        toLayer?.order === sortedLayers[sortedLayers.length - 1]?.order;

      if (isContracts) {
        linkStyles.push(`    linkStyle ${edgeIndex} stroke:#86EFAC,stroke-width:1.5px;`);
      } else if (fromLayer?.id !== toLayer?.id) {
        linkStyles.push(`    linkStyle ${edgeIndex} stroke:#16A34A,stroke-width:2.2px;`);
      } else {
        linkStyles.push(`    linkStyle ${edgeIndex} stroke:#22C55E,stroke-width:1.6px,stroke-dasharray: 3 3;`);
      }
    }
    edgeIndex++;
  }

  // 2. Output Planned but Unused Target Paths (Subtle grey dashed lines)
  for (const dep of arch.allowDependencies || []) {
    const key = `${dep.from}->${dep.to}`;
    if (!actualEdgeSet.has(key)) {
      const isCompFrom = arch.components.some((c) => c.id === dep.from);
      const isCompTo = arch.components.some((c) => c.id === dep.to);
      if (isCompFrom && isCompTo) {
        lines.push(`    ${dep.from} -.-|PLAN| ${dep.to}`);
        linkStyles.push(
          `    linkStyle ${edgeIndex} stroke:#CBD5E1,stroke-width:1.2px,stroke-dasharray: 4 4,color:#94A3B8;`
        );
        edgeIndex++;
      }
    }
  }

  // Add link styles
  for (const ls of linkStyles) {
    lines.push(ls);
  }

  // Style subgraphs as clean swimlanes
  for (const layer of sortedLayers) {
    if (violatingLayerIds.has(layer.id)) {
      lines.push(`    style ${layer.id} fill:#FFF5F5,stroke:#FCA5A5,stroke-width:2px,stroke-dasharray: 4 4;`);
    } else {
      lines.push(`    style ${layer.id} fill:#F4FAF6,stroke:#86EFAC,stroke-width:1.5px,stroke-dasharray: 4 4;`);
    }
  }

  // Class definitions for nodes (Red vs Green)
  lines.push('    classDef compliant fill:#FFFFFF,stroke:#16A34A,stroke-width:2px,color:#14532D;');
  lines.push('    classDef drift fill:#FEF2F2,stroke:#E5484D,stroke-width:3px,color:#991B1B,stroke-dasharray: 4 4;');

  const compliantComps = arch.components.filter((c) => !violatingCompIds.has(c.id)).map((c) => c.id);
  const driftComps = arch.components.filter((c) => violatingCompIds.has(c.id)).map((c) => c.id);

  if (compliantComps.length > 0) {
    lines.push(`    class ${compliantComps.join(',')} compliant;`);
  }
  if (driftComps.length > 0) {
    lines.push(`    class ${driftComps.join(',')} drift;`);
  }

  lines.push('');

  // INVISIBLE LAYOUT CONSTRAINTS (At the very end, so they NEVER interfere with linkStyle indices)
  for (const layer of sortedLayers) {
    const layerComps = arch.components.filter((c) => c.layerId === layer.id);
    const cols = layerComps.length >= 6 ? 3 : 2;
    for (let i = 0; i < layerComps.length - cols; i++) {
      lines.push(`    ${layerComps[i].id} ~~~ ${layerComps[i + cols].id}`);
    }
  }

  for (let i = 0; i < firstComps.length - 1; i++) {
    lines.push(`    ${firstComps[i]} ~~~ ${firstComps[i + 1]}`);
  }

  return lines.join('\n');
}
