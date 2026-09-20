import { describe, it, expect } from 'vitest';
import { buildC4GraphData } from '../../src/c4/builder.js';
import { DirectedGraph } from '../../src/graph/directed-graph.js';
import type { TargetArchitecture } from '../../src/types/architecture.js';
import type { ViolationEvidence } from '../../src/types/report.js';

describe('C4 Graph Builder (buildC4GraphData)', () => {
  const sampleArch: TargetArchitecture = {
    name: 'OrderProcessingSystem',
    containers: [
      { id: 'webApp', name: 'Web Presentation App', order: 1, technology: 'React / Next.js', type: 'application' },
      { id: 'coreService', name: 'Core Domain Service', order: 2, technology: 'Node.js / Express', type: 'service' },
      { id: 'database', name: 'PostgreSQL Database', order: 3, technology: 'PostgreSQL 15', type: 'database' },
    ],
    layers: [
      { id: 'webApp', name: 'Presentation Tier', order: 1 },
      { id: 'coreService', name: 'Domain Tier', order: 2 },
      { id: 'database', name: 'Data Tier', order: 3 },
    ],
    components: [
      {
        id: 'OrderController',
        name: 'Order API Controller',
        layerId: 'webApp',
        containerId: 'webApp',
        technology: 'Express Router',
        description: 'Handles incoming HTTP order placement requests',
        paths: ['src/controllers/order/**'],
      },
      {
        id: 'OrderService',
        name: 'Order Business Service',
        layerId: 'coreService',
        containerId: 'coreService',
        technology: 'TypeScript Domain',
        description: 'Executes pricing, inventory checks, and business rules',
        paths: ['src/services/order/**'],
      },
      {
        id: 'OrderRepository',
        name: 'Order Data Repository',
        layerId: 'database',
        containerId: 'database',
        technology: 'Prisma Client',
        description: 'Persists order entities to PostgreSQL',
        paths: ['src/repos/order/**'],
      },
      {
        id: 'NotificationService',
        name: 'Notification Service',
        layerId: 'coreService',
        containerId: 'coreService',
        technology: 'SNS / Email',
        description: 'Sends email confirmations',
        paths: ['src/services/notification/**'],
      },
    ],
    allowDependencies: [
      {
        from: 'OrderController',
        to: 'OrderService',
        protocol: 'HTTP / In-process',
        description: 'Invokes order fulfillment',
      },
      {
        from: 'OrderService',
        to: 'OrderRepository',
        protocol: 'SQL / Prisma',
        description: 'Saves completed order record',
      },
      {
        from: 'OrderService',
        to: 'NotificationService',
        protocol: 'Event / Async',
        description: 'Dispatches order created notification',
      },
    ],
  };

  it('should build clean compliant C4 graph when code conforms to architecture', () => {
    const graph = new DirectedGraph();
    graph.addNode('OrderController');
    graph.addNode('OrderService');
    graph.addNode('OrderRepository');
    graph.addEdge('OrderController', 'OrderService');
    graph.addEdge('OrderService', 'OrderRepository');

    const fileCounts = new Map<string, number>([
      ['OrderController', 3],
      ['OrderService', 8],
      ['OrderRepository', 4],
      ['NotificationService', 2],
    ]);

    const c4 = buildC4GraphData(sampleArch, graph, [], { componentFileCounts: fileCounts });

    expect(c4.systemName).toBe('OrderProcessingSystem');
    expect(c4.containers).toHaveLength(3);
    expect(c4.nodes).toHaveLength(4);

    // Verify container details
    const webContainer = c4.containers.find((c) => c.id === 'webApp');
    expect(webContainer).toBeDefined();
    expect(webContainer?.status).toBe('compliant');
    expect(webContainer?.componentIds).toContain('OrderController');

    // Verify node details
    const controllerNode = c4.nodes.find((n) => n.id === 'OrderController');
    expect(controllerNode).toBeDefined();
    expect(controllerNode?.status).toBe('compliant');
    expect(controllerNode?.technology).toBe('Express Router');
    expect(controllerNode?.fileCount).toBe(3);
    expect(controllerNode?.violationCount).toBe(0);

    // Verify edges
    const compliantEdges = c4.actualEdges.filter((e) => e.status === 'compliant');
    expect(compliantEdges).toHaveLength(2);

    // Verify planned edge for NotificationService (defined in allowDependencies, not in actual graph)
    const plannedEdge = c4.edges.find((e) => e.from === 'OrderService' && e.to === 'NotificationService');
    expect(plannedEdge).toBeDefined();
    expect(plannedEdge?.status).toBe('planned');
    expect(plannedEdge?.type).toBe('planned');
  });

  it('should mark drift violations on nodes, edges, and containers when architectural violations exist', () => {
    // Controller bypasses Service and calls Repository directly
    const graph = new DirectedGraph();
    graph.addNode('OrderController');
    graph.addNode('OrderRepository');
    graph.addEdge('OrderController', 'OrderRepository');

    const violations: ViolationEvidence[] = [
      {
        id: 'BYPASS_001',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'Illegal layer bypass: OrderController directly accesses OrderRepository',
        sourceFile: 'src/controllers/order/order.controller.ts',
        line: 24,
        column: 1,
        snippet: "import { OrderRepository } from '../../repos/order';",
        sourceComponent: 'OrderController',
        targetComponent: 'OrderRepository',
      },
    ];

    const c4 = buildC4GraphData(sampleArch, graph, violations);

    // Edge check
    const driftEdge = c4.actualEdges.find((e) => e.from === 'OrderController' && e.to === 'OrderRepository');
    expect(driftEdge).toBeDefined();
    expect(driftEdge?.status).toBe('drift');
    expect(driftEdge?.type).toBe('bypass');
    expect(driftEdge?.violations).toContain('BYPASS_001');

    // Node check
    const controllerNode = c4.nodes.find((n) => n.id === 'OrderController');
    expect(controllerNode?.status).toBe('drift');
    expect(controllerNode?.violationCount).toBe(1);

    const repoNode = c4.nodes.find((n) => n.id === 'OrderRepository');
    expect(repoNode?.status).toBe('drift');

    // Container check
    const webContainer = c4.containers.find((c) => c.id === 'webApp');
    expect(webContainer?.status).toBe('drift');

    const dbContainer = c4.containers.find((c) => c.id === 'database');
    expect(dbContainer?.status).toBe('drift');
  });

  it('should fallback containers to layers when containers property is not provided', () => {
    const archWithoutContainers: TargetArchitecture = {
      layers: [
        { id: 'L1', name: 'Presentation', order: 1 },
        { id: 'L2', name: 'Domain', order: 2 },
      ],
      components: [
        { id: 'CompA', name: 'A Component', layerId: 'L1', paths: ['src/a/**'] },
        { id: 'CompB', name: 'B Component', layerId: 'L2', paths: ['src/b/**'] },
      ],
      allowDependencies: [{ from: 'L1', to: 'L2' }],
    };

    const graph = new DirectedGraph();
    graph.addNode('CompA');
    graph.addNode('CompB');
    graph.addEdge('CompA', 'CompB');

    const c4 = buildC4GraphData(archWithoutContainers, graph, []);
    expect(c4.containers).toHaveLength(2);
    expect(c4.containers[0].id).toBe('L1');
    expect(c4.containers[1].id).toBe('L2');

    // Verify layer-level allowDependency was expanded to component target edge
    expect(c4.targetEdges).toHaveLength(1);
    expect(c4.targetEdges[0].from).toBe('CompA');
    expect(c4.targetEdges[0].to).toBe('CompB');
  });

  it('should NOT generate phantom planned edges for uncalled component pairs in layer-level allowlists', () => {
    const multiCompArch: ArchitectureSpec = {
      name: 'LayerAllowTest',
      layers: [
        { id: 'L1', name: 'Presentation Layer', order: 1 },
        { id: 'L2', name: 'Business Domain Layer', order: 2 },
      ],
      components: [
        { id: 'CompA1', name: 'A1', layerId: 'L1', paths: ['src/a1/**'] },
        { id: 'CompA2', name: 'A2', layerId: 'L1', paths: ['src/a2/**'] },
        { id: 'CompB1', name: 'B1', layerId: 'L2', paths: ['src/b1/**'] },
        { id: 'CompB2', name: 'B2', layerId: 'L2', paths: ['src/b2/**'] },
      ],
      allowDependencies: [{ from: 'L1', to: 'L2' }],
    };

    const graph = new DirectedGraph();
    graph.addNode('CompA1');
    graph.addNode('CompA2');
    graph.addNode('CompB1');
    graph.addNode('CompB2');
    // Only CompA1 calls CompB1 in reality; CompA2 and CompB2 do NOT call each other
    graph.addEdge('CompA1', 'CompB1');

    const c4 = buildC4GraphData(multiCompArch, graph, []);
    // Real actual edge is compliant
    expect(c4.actualEdges).toHaveLength(1);
    expect(c4.actualEdges[0].from).toBe('CompA1');
    expect(c4.actualEdges[0].to).toBe('CompB1');

    // Target edge should only include the realized compliant edge, NOT 4 Cartesian permutations!
    expect(c4.targetEdges).toHaveLength(1);
    expect(c4.targetEdges[0].from).toBe('CompA1');
    expect(c4.targetEdges[0].to).toBe('CompB1');

    // Unified edges should have ZERO planned edges! (No phantom dashed arrows)
    const plannedEdges = c4.edges.filter((e) => e.status === 'planned');
    expect(plannedEdges).toHaveLength(0);
  });
});
