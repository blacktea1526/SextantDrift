import { DirectedGraph } from './directed-graph.js';

export interface DetectedCycle {
  nodes: string[];
  chain: string;
}

/**
 * High-performance Tarjan's Strongly Connected Components (SCC) algorithm
 * using typed arrays and integer indexing for sub-millisecond execution.
 * Time complexity: O(V + E), memory: O(V)
 */
export function findStronglyConnectedComponents<TNode, TEdge>(
  graph: DirectedGraph<TNode, TEdge>
): string[][] {
  const nodeNames = graph.getNodes();
  const n = nodeNames.length;
  if (n === 0) return [];

  // Integer indexing for nodes
  const nodeToId = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    nodeToId.set(nodeNames[i], i);
  }

  // Pre-map adjacency list to integer arrays
  const adj: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const succs = graph.getSuccessors(nodeNames[i]);
    const succIds: number[] = new Array(succs.length);
    for (let j = 0; j < succs.length; j++) {
      succIds[j] = nodeToId.get(succs[j])!;
    }
    adj[i] = succIds;
  }

  let index = 0;
  const indices = new Int32Array(n).fill(-1);
  const lowlinks = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack = new Int32Array(n);
  let stackPtr = 0;

  // DFS Call stack using flat arrays to avoid object allocation
  const csNode = new Int32Array(n);
  const csNeighborIdx = new Int32Array(n);
  let csPtr = 0;

  const sccs: string[][] = [];

  for (let start = 0; start < n; start++) {
    if (indices[start] !== -1) continue;

    indices[start] = index;
    lowlinks[start] = index;
    index++;
    stack[stackPtr++] = start;
    onStack[start] = 1;

    csNode[0] = start;
    csNeighborIdx[0] = 0;
    csPtr = 1;

    while (csPtr > 0) {
      const topIdx = csPtr - 1;
      const u = csNode[topIdx];
      const neighbors = adj[u];
      const nLen = neighbors.length;

      if (csNeighborIdx[topIdx] < nLen) {
        const v = neighbors[csNeighborIdx[topIdx]++];

        if (indices[v] === -1) {
          // Tree edge
          indices[v] = index;
          lowlinks[v] = index;
          index++;
          stack[stackPtr++] = v;
          onStack[v] = 1;

          csNode[csPtr] = v;
          csNeighborIdx[csPtr] = 0;
          csPtr++;
        } else if (onStack[v] === 1) {
          // Back edge
          if (indices[v] < lowlinks[u]) {
            lowlinks[u] = indices[v];
          }
        }
      } else {
        // Return from u
        csPtr--;

        if (csPtr > 0) {
          const p = csNode[csPtr - 1];
          if (lowlinks[u] < lowlinks[p]) {
            lowlinks[p] = lowlinks[u];
          }
        }

        // Root of SCC
        if (lowlinks[u] === indices[u]) {
          const scc: string[] = [];
          let w: number;
          do {
            w = stack[--stackPtr];
            onStack[w] = 0;
            scc.push(nodeNames[w]);
          } while (w !== u);
          sccs.push(scc);
        }
      }
    }
  }

  return sccs;
}

/**
 * Detects all cyclic dependency paths in the graph.
 * Returns formatted cycles such as "A -> B -> C -> A".
 */
export function detectCycles<TNode, TEdge>(
  graph: DirectedGraph<TNode, TEdge>
): DetectedCycle[] {
  const sccs = findStronglyConnectedComponents(graph);
  const detectedCycles: DetectedCycle[] = [];

  for (const scc of sccs) {
    // Case 1: Self loop
    if (scc.length === 1) {
      const node = scc[0];
      if (graph.hasEdge(node, node)) {
        detectedCycles.push({
          nodes: [node, node],
          chain: `${node} -> ${node}`,
        });
      }
      continue;
    }

    // Case 2: Multi-node SCC (cycle with >= 2 nodes)
    const sccSet = new Set(scc);
    const startNode = scc[0];

    // Find cycle path starting and ending at startNode within sccSet using DFS
    const path: string[] = [startNode];
    const visitedInPath = new Set<string>([startNode]);

    function findCycleDfs(current: string): boolean {
      for (const next of graph.getSuccessors(current)) {
        if (!sccSet.has(next)) continue;
        if (next === startNode && path.length > 1) {
          path.push(next);
          return true;
        }
        if (!visitedInPath.has(next)) {
          visitedInPath.add(next);
          path.push(next);
          if (findCycleDfs(next)) return true;
          path.pop();
          visitedInPath.delete(next);
        }
      }
      return false;
    }

    if (findCycleDfs(startNode)) {
      detectedCycles.push({
        nodes: [...path],
        chain: path.join(' -> '),
      });
    } else {
      // Fallback: full SCC nodes closed
      const closed = [...scc, scc[0]];
      detectedCycles.push({
        nodes: closed,
        chain: closed.join(' -> '),
      });
    }
  }

  return detectedCycles;
}
