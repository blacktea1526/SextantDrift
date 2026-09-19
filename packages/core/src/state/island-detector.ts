import { StateMachineGraph, StateViolation } from './types.js';
import { buildStateGraphTopology } from './graph-builder.js';

/**
 * Detects unreachable island states (cannot be reached from initial state [*])
 */
export function detectIslandStates(graph: StateMachineGraph): StateViolation[] {
  const violations: StateViolation[] = [];
  const topology = buildStateGraphTopology(graph);

  const visited = new Set<string>();
  const queue: string[] = [];

  // Seed with initial nodes
  if (graph.nodes.has('[*]')) {
    visited.add('[*]');
    queue.push('[*]');
  }

  for (const trans of graph.transitions) {
    if (trans.from === '[*]' && !visited.has(trans.to)) {
      visited.add(trans.to);
      queue.push(trans.to);
    }
  }

  // BFS traversal to discover all reachable states
  while (queue.length > 0) {
    const current = queue.shift()!;
    const outTransitions = topology.outgoing.get(current) || [];

    for (const trans of outTransitions) {
      if (!visited.has(trans.to)) {
        visited.add(trans.to);
        queue.push(trans.to);
      }
    }
  }

  // Check which business states were never visited
  for (const [nodeId, node] of graph.nodes.entries()) {
    if (nodeId === '[*]') {
      continue;
    }

    if (!visited.has(nodeId)) {
      violations.push({
        id: `ISLAND_${nodeId}`,
        type: 'STATE_UNREACHABLE',
        severity: 'warning',
        message: `Unreachable island state detected: "${nodeId}" cannot be reached from any initial state "[*]".`,
        stateId: nodeId,
        diagramTitle: graph.title,
        sourceFile: graph.sourceFile || '',
        line: node.line || 1,
        column: 1,
        snippet: node.description ? `${nodeId}: ${node.description}` : nodeId,
        suggestion: `Add an incoming transition from an active state or initial state "[*]" to make "${nodeId}" reachable.`,
      });
    }
  }

  return violations;
}
