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
 * Detects all cyclic dependency paths in the graph using elementary circuit enumeration.
 * Returns formatted cycles such as "A -> B -> C -> A".
 */
export function detectCycles<TNode, TEdge>(
  graph: DirectedGraph<TNode, TEdge>
): DetectedCycle[] {
  const sccs = findStronglyConnectedComponents(graph);
  const detectedCycles: DetectedCycle[] = [];
  const MAX_CYCLES_PER_SCC = 25;

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
    // Enumerate elementary circuits to avoid missing nested cycles in overlapping SCCs
    const nodeOrderMap = new Map<string, number>();
    scc.forEach((name, idx) => nodeOrderMap.set(name, idx));

    const sccCycles: DetectedCycle[] = [];
    const seenCycleKeys = new Set<string>();

    function getCanonicalCycleKey(cycleNodes: string[]): string {
      const core = cycleNodes.slice(0, -1);
      if (core.length === 0) return '';
      let minIdx = 0;
      for (let i = 1; i < core.length; i++) {
        if (core[i] < core[minIdx]) {
          minIdx = i;
        }
      }
      const rotated = [...core.slice(minIdx), ...core.slice(0, minIdx)];
      return rotated.join(' -> ');
    }

    for (let i = 0; i < scc.length; i++) {
      if (sccCycles.length >= MAX_CYCLES_PER_SCC) break;

      const startNode = scc[i];
      const path: string[] = [startNode];
      const visited = new Set<string>([startNode]);

      function dfs(curr: string) {
        if (sccCycles.length >= MAX_CYCLES_PER_SCC) return;

        for (const next of graph.getSuccessors(curr)) {
          const nextOrder = nodeOrderMap.get(next);
          if (nextOrder === undefined || nextOrder < i) {
            // Outside SCC or already processed in an earlier starting node phase
            continue;
          }

          if (next === startNode && path.length > 1) {
            const fullCycle = [...path, startNode];
            const key = getCanonicalCycleKey(fullCycle);
            if (!seenCycleKeys.has(key)) {
              seenCycleKeys.add(key);
              sccCycles.push({
                nodes: fullCycle,
                chain: fullCycle.join(' -> '),
              });
            }
            continue;
          }

          if (!visited.has(next)) {
            visited.add(next);
            path.push(next);
            dfs(next);
            path.pop();
            visited.delete(next);
          }
        }
      }

      dfs(startNode);
    }

    if (sccCycles.length > 0) {
      detectedCycles.push(...sccCycles);
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
