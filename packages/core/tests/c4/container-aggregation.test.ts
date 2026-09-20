import { describe, it, expect } from 'vitest';
import { buildC4GraphData } from '../../src/c4/builder.js';
import { DirectedGraph } from '../../src/graph/directed-graph.js';
import type { TargetArchitecture } from '../../src/types/architecture.js';
import type { ViolationEvidence } from '../../src/types/report.js';

describe('C4 Multi-Level Container Aggregation (Level 2)', () => {
  const sampleArch: TargetArchitecture = {
    name: 'ECommerceSystem',
    systemContext: {
      systemName: 'ECommerceSystem',
      description: 'Online store core architecture',
      actors: [
        { id: 'Customer', name: 'Shopper', role: 'human', description: 'Places orders' },
        { id: 'Agent', name: 'OrderAI', role: 'agent', description: 'Assists checkout' },
      ],
      externalSystems: [
        { id: 'PaymentGateway', name: 'Stripe API', description: 'Processes credit cards' },
      ],
    },
    containers: [
      { id: 'ui', name: 'Frontend Tier', order: 1, technology: 'React / Vite', type: 'ui' },
      { id: 'api', name: 'API Tier', order: 2, technology: 'Node.js / Express', type: 'application' },
      { id: 'domain', name: 'Domain Tier', order: 3, technology: 'TypeScript Core', type: 'service' },
      { id: 'db', name: 'Database Tier', order: 4, technology: 'PostgreSQL', type: 'database' },
    ],
    layers: [
      { id: 'ui', name: 'Frontend', order: 1 },
      { id: 'api', name: 'API', order: 2 },
      { id: 'domain', name: 'Domain', order: 3 },
      { id: 'db', name: 'Database', order: 4 },
    ],
    components: [
      { id: 'WebUI', name: 'Web UI', layerId: 'ui', containerId: 'ui', paths: ['src/ui/**'] },
      { id: 'OrderRouter', name: 'Order Router', layerId: 'api', containerId: 'api', paths: ['src/api/**'] },
      { id: 'OrderService', name: 'Order Service', layerId: 'domain', containerId: 'domain', paths: ['src/domain/**'] },
      { id: 'OrderRepo', name: 'Order Repo', layerId: 'db', containerId: 'db', paths: ['src/db/**'] },
    ],
    allowDependencies: [
      { from: 'ui', to: 'api' },
      { from: 'api', to: 'domain' },
      { from: 'domain', to: 'db' },
    ],
  };

  it('should aggregate compliant component edges into clean container-level edges', () => {
    const graph = new DirectedGraph();
    graph.addNode('WebUI');
    graph.addNode('OrderRouter');
    graph.addNode('OrderService');
    graph.addNode('OrderRepo');

    // UI -> API -> Domain -> DB
    graph.addEdge('WebUI', 'OrderRouter');
    graph.addEdge('OrderRouter', 'OrderService');
    graph.addEdge('OrderService', 'OrderRepo');

    const c4 = buildC4GraphData(sampleArch, graph, []);

    expect(c4.containerEdges).toBeDefined();
    expect(c4.containerEdges).toHaveLength(3);

    const uiToApi = c4.containerEdges?.find((e) => e.from === 'ui' && e.to === 'api');
    expect(uiToApi).toBeDefined();
    expect(uiToApi?.status).toBe('compliant');

    const apiToDomain = c4.containerEdges?.find((e) => e.from === 'api' && e.to === 'domain');
    expect(apiToDomain).toBeDefined();
    expect(apiToDomain?.status).toBe('compliant');

    const domainToDb = c4.containerEdges?.find((e) => e.from === 'domain' && e.to === 'db');
    expect(domainToDb).toBeDefined();
    expect(domainToDb?.status).toBe('compliant');

    // System context should be preserved
    expect(c4.systemContext).toBeDefined();
    expect(c4.systemContext?.systemName).toBe('ECommerceSystem');
    expect(c4.systemContext?.actors).toHaveLength(2);
  });

  it('should flag container edge as drift when component violates layer boundary (Bypass)', () => {
    const graph = new DirectedGraph();
    graph.addNode('WebUI');
    graph.addNode('OrderRepo');

    // Critical Layer Bypass: UI directly calls DB!
    graph.addEdge('WebUI', 'OrderRepo');

    const violations: ViolationEvidence[] = [
      {
        id: 'BYPASS_UI_TO_DB',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'WebUI bypassed API and Domain tiers directly to OrderRepo',
        sourceFile: 'src/ui/OrderButton.tsx',
        line: 42,
        column: 1,
        snippet: 'import { OrderRepo } from "../db"',
        sourceComponent: 'WebUI',
        targetComponent: 'OrderRepo',
      },
    ];

    const c4 = buildC4GraphData(sampleArch, graph, violations);

    expect(c4.containerEdges).toBeDefined();
    const bypassEdge = c4.containerEdges?.find((e) => e.from === 'ui' && e.to === 'db');
    expect(bypassEdge).toBeDefined();
    expect(bypassEdge?.status).toBe('drift');
    expect(bypassEdge?.type).toBe('bypass');
    expect(bypassEdge?.violations).toContain('BYPASS_UI_TO_DB');

    // The ui and db containers should also reflect drift
    const uiContainer = c4.containers.find((c) => c.id === 'ui');
    const dbContainer = c4.containers.find((c) => c.id === 'db');
    expect(uiContainer?.status).toBe('drift');
    expect(dbContainer?.status).toBe('drift');
  });

  it('should mark planned container edges when allowed in spec but not present in actual code', () => {
    const graph = new DirectedGraph();
    graph.addNode('WebUI');
    graph.addNode('OrderRouter');
    // only UI -> API is exercised, API -> Domain and Domain -> DB are planned
    graph.addEdge('WebUI', 'OrderRouter');

    const c4 = buildC4GraphData(sampleArch, graph, []);

    const plannedEdges = c4.containerEdges?.filter((e) => e.status === 'planned');
    expect(plannedEdges).toBeDefined();
    expect(plannedEdges?.some((e) => e.from === 'api' && e.to === 'domain')).toBe(true);
    expect(plannedEdges?.some((e) => e.from === 'domain' && e.to === 'db')).toBe(true);
  });
});
