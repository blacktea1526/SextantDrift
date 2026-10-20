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

  it('should detect multiple independent elementary cycles in an overlapping SCC', () => {
    const graph = new DirectedGraph();
    // Cycle 1: A <-> B
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'A');

    // Cycle 2: B <-> C
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'B');

    // Cycle 3: B <-> D
    graph.addEdge('B', 'D');
    graph.addEdge('D', 'B');

    const cycles = detectCycles(graph);
    // Previously only 1 cycle was returned! Now all 3 elementary cycles must be detected.
    expect(cycles.length).toBeGreaterThanOrEqual(3);

    const chains = cycles.map((c) => c.chain);
    expect(chains.some((c) => c.includes('A') && c.includes('B'))).toBe(true);
    expect(chains.some((c) => c.includes('B') && c.includes('C'))).toBe(true);
    expect(chains.some((c) => c.includes('B') && c.includes('D'))).toBe(true);
  });

  it('should detect self loop as a cycle', () => {
    const graph = new DirectedGraph();
    graph.addEdge('SelfMod', 'SelfMod');

    const cycles = detectCycles(graph);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].chain).toBe('SelfMod -> SelfMod');
  });
});

