import { describe, it, expect } from 'vitest';
import { DirectedGraph } from '../../src/graph/directed-graph.js';
import { findStronglyConnectedComponents, detectCycles } from '../../src/graph/tarjan.js';

describe('Tarjan SCC and Cycle Detection', () => {
  it('should find SCCs in a directed graph', () => {
    const graph = new DirectedGraph();
    // Cycle A -> B -> C -> A
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'A');
    // D is separate
    graph.addEdge('C', 'D');

    const sccs = findStronglyConnectedComponents(graph);
    const multiNodeScc = sccs.find((s) => s.length > 1);
    expect(multiNodeScc).toBeDefined();
    expect(multiNodeScc?.sort()).toEqual(['A', 'B', 'C']);
  });

  it('should detect cycles with exact formatted chain', () => {
    const graph = new DirectedGraph();
    graph.addEdge('ServiceA', 'ServiceB');
    graph.addEdge('ServiceB', 'ServiceA');

    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].chain).toContain('ServiceA');
    expect(cycles[0].chain).toContain('ServiceB');
  });

  it('should return empty cycles for DAG', () => {
    const graph = new DirectedGraph();
    graph.addEdge('Controller', 'Service');
    graph.addEdge('Service', 'Repo');

    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(0);
  });
});
