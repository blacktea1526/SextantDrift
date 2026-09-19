import { StateMachineGraph, StateTransition } from './types.js';

export interface StateGraphTopology {
  graph: StateMachineGraph;
  outgoing: Map<string, StateTransition[]>;
  incoming: Map<string, StateTransition[]>;
}

/**
 * Builds adjacency map for outgoing and incoming transitions
 */
export function buildStateGraphTopology(graph: StateMachineGraph): StateGraphTopology {
  const outgoing = new Map<string, StateTransition[]>();
  const incoming = new Map<string, StateTransition[]>();

  // Initialize for all nodes
  for (const nodeId of graph.nodes.keys()) {
    outgoing.set(nodeId, []);
    incoming.set(nodeId, []);
  }

  for (const trans of graph.transitions) {
    if (!outgoing.has(trans.from)) {
      outgoing.set(trans.from, []);
    }
    outgoing.get(trans.from)!.push(trans);

    if (!incoming.has(trans.to)) {
      incoming.set(trans.to, []);
    }
    incoming.get(trans.to)!.push(trans);
  }

  return {
    graph,
    outgoing,
    incoming,
  };
}
