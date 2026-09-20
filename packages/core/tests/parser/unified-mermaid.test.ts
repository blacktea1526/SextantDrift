import { describe, it, expect } from 'vitest';
import { generateUnifiedMermaid } from '../../src/index.js';
import { DirectedGraph } from '../../src/graph/directed-graph.js';
import type { TargetArchitecture, ViolationEvidence } from '../../src/types/architecture.js';

describe('Unified Mermaid Generator', () => {
  const sampleArch: TargetArchitecture = {
    layers: [
      { id: 'UI', name: 'Presentation Layer', order: 1 },
      { id: 'Domain', name: 'Domain Layer', order: 2 },
      { id: 'Infra', name: 'Infrastructure Layer', order: 3 },
    ],
    components: [
      { id: 'Controller', name: 'API Controllers', layerId: 'UI', paths: ['src/ui/**'] },
      { id: 'Service', name: 'Domain Services', layerId: 'Domain', paths: ['src/domain/**'] },
      { id: 'Repo', name: 'Repositories', layerId: 'Infra', paths: ['src/infra/**'] },
      { id: 'Helper', name: 'Helper Utility', layerId: 'Domain', paths: ['src/domain/helper/**'] },
    ],
    allowDependencies: [
      { from: 'Controller', to: 'Service' },
      { from: 'Service', to: 'Repo' },
      { from: 'Service', to: 'Helper' }, // Planned dependency that will not be used in graph
    ],
  };

  it('should generate unified overlay diff with green compliant edges, red drift edges, and grey plan edges', () => {
    // Actual code graph:
    // Controller -> Service (Compliant cross-layer)
    // Controller -> Repo (Drift! Cross-layer bypass)
    const graph = new DirectedGraph();
    graph.addNode('Controller');
    graph.addNode('Service');
    graph.addNode('Repo');
    graph.addEdge('Controller', 'Service');
    graph.addEdge('Controller', 'Repo');

    const violations: ViolationEvidence[] = [
      {
        ruleId: 'LAYER_BYPASS',
        severity: 'critical',
        sourceFile: 'src/ui/user.ts',
        sourceComponent: 'Controller',
        targetComponent: 'Repo',
        message: 'Illegal layer bypass: Controller directly accesses Repo',
      },
    ];

    const mermaid = generateUnifiedMermaid(sampleArch, graph, violations);

    // 1. Check flowchart TD and subgraphs
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('subgraph UI ["Layer 1 • Presentation Layer"]');
    expect(mermaid).toContain('subgraph Domain ["Layer 2 • Domain Layer"]');
    expect(mermaid).toContain('subgraph Infra ["Layer 3 • Infrastructure Layer"]');

    // 2. Check actual compliant edge (Controller -> Service)
    expect(mermaid).toContain('Controller --> Service');
    expect(mermaid).toMatch(/linkStyle \d+ stroke:#16A34A/);

    // 3. Check actual drift edge (Controller -.->|DRIFT!| Repo)
    expect(mermaid).toContain('Controller -.->|DRIFT!| Repo');
    expect(mermaid).toMatch(/linkStyle \d+ stroke:#E5484D/);

    // 4. Check planned but unused target edge (Service -.-|PLAN| Helper)
    expect(mermaid).toContain('Service -.-|PLAN| Helper');
    expect(mermaid).toMatch(/linkStyle \d+ stroke:#CBD5E1/);

    // 5. Check node class assignments
    // Controller and Repo are involved in violation
    expect(mermaid).toContain('classDef compliant');
    expect(mermaid).toContain('classDef drift');
    expect(mermaid).toMatch(/class [^\n]*Controller[^\n]* drift/);
    expect(mermaid).toMatch(/class [^\n]*Repo[^\n]* drift/);
    expect(mermaid).toMatch(/class [^\n]*Service[^\n]* compliant/);

    // 6. Check layer styles (UI and Infra have drift, Domain is compliant)
    expect(mermaid).toMatch(/style UI fill:#FFF5F5/);
    expect(mermaid).toMatch(/style Infra fill:#FFF5F5/);
    expect(mermaid).toMatch(/style Domain fill:#F4FAF6/);

    // 7. Check layout hints placed at end
    expect(mermaid).toContain('~~~');
  });

  it('should render all nodes as compliant when there are no violations', () => {
    const graph = new DirectedGraph();
    graph.addNode('Controller');
    graph.addNode('Service');
    graph.addEdge('Controller', 'Service');

    const mermaid = generateUnifiedMermaid(sampleArch, graph, []);

    expect(mermaid).not.toContain('|DRIFT!|');
    expect(mermaid).not.toContain('class Controller drift');
    expect(mermaid).toMatch(/class [^\n]*Controller[^\n]* compliant/);
    expect(mermaid).toMatch(/style UI fill:#F4FAF6/);
  });
});
