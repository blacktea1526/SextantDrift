import { describe, it, expect } from 'vitest';
import { generateActualMermaid, generateUnifiedMermaid } from '../../src/parser/mermaid-generator.js';
import { DirectedGraph } from '../../src/graph/directed-graph.js';
import type { TargetArchitecture, ViolationEvidence } from '../../src/types/architecture.js';

describe('Mermaid Generator Module (mermaid-generator.ts)', () => {
  const sampleArch: TargetArchitecture = {
    layers: [
      { id: 'UI', name: 'Presentation Layer', order: 1 },
      { id: 'Domain', name: 'Domain Layer', order: 2 },
      { id: 'Infra', name: 'Infrastructure Layer', order: 3 },
      { id: 'contracts', name: 'Contracts Layer', order: 4 },
    ],
    components: [
      { id: 'Controller', name: 'API Controllers', layerId: 'UI', paths: ['src/ui/**'] },
      { id: 'Service', name: 'Domain Services', layerId: 'Domain', paths: ['src/domain/**'] },
      { id: 'Repo', name: 'Repositories', layerId: 'Infra', paths: ['src/infra/**'] },
      { id: 'Contract', name: 'Data Contracts', layerId: 'contracts', paths: ['src/contracts/**'] },
    ],
    allowDependencies: [
      { from: 'Controller', to: 'Service' },
      { from: 'Service', to: 'Repo' },
      { from: 'Service', to: 'Contract' },
    ],
  };

  it('generateActualMermaid should generate actual graph with contracts and drift styles', () => {
    const graph = new DirectedGraph();
    graph.addNode('Controller');
    graph.addNode('Service');
    graph.addNode('Repo');
    graph.addNode('Contract');
    graph.addEdge('Controller', 'Service');
    graph.addEdge('Controller', 'Repo');
    graph.addEdge('Service', 'Contract');

    const violations: ViolationEvidence[] = [
      {
        ruleId: 'LAYER_BYPASS',
        severity: 'critical',
        sourceFile: 'src/ui/user.ts',
        sourceComponent: 'Controller',
        targetComponent: 'Repo',
        message: 'Illegal layer bypass',
      },
    ];

    const mermaid = generateActualMermaid(sampleArch, graph, violations);

    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('Controller -.->|DRIFT!| Repo');
    expect(mermaid).toContain('Controller --> Service');
    expect(mermaid).toContain('Service --> Contract');
    // Contract link style
    expect(mermaid).toContain('stroke:#86EFAC');
    // Drift link style
    expect(mermaid).toContain('stroke:#E5484D');
    // Swimlane styling
    expect(mermaid).toContain('style UI fill:#FFF5F5');
    expect(mermaid).toContain('style contracts fill:#F4FAF6');
  });

  it('generateUnifiedMermaid should generate plan edges for unexercised dependencies', () => {
    const graph = new DirectedGraph();
    graph.addNode('Controller');
    graph.addNode('Service');
    graph.addEdge('Controller', 'Service');

    const mermaid = generateUnifiedMermaid(sampleArch, graph, []);

    expect(mermaid).toContain('Controller --> Service');
    expect(mermaid).toContain('Service -.-|PLAN| Repo');
    expect(mermaid).toContain('Service -.-|PLAN| Contract');
  });
});
