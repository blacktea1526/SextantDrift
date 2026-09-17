import { describe, it, expect } from 'vitest';
import { DirectedGraph } from '../../src/graph/directed-graph.js';

describe('Directed Graph', () => {
  it('should add nodes and edges and compute in/out degrees', () => {
    const graph = new DirectedGraph();
    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'C');

    expect(graph.getNodes().sort()).toEqual(['A', 'B', 'C']);
    expect(graph.getSuccessors('A').sort()).toEqual(['B', 'C']);
    expect(graph.getPredecessors('C').sort()).toEqual(['A', 'B']);
    expect(graph.getOutDegree('A')).toBe(2);
    expect(graph.getInDegree('C')).toBe(2);
    expect(graph.hasEdge('A', 'B')).toBe(true);
    expect(graph.hasEdge('B', 'A')).toBe(false);
  });
});
