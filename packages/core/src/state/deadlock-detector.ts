import { StateMachineGraph, StateViolation } from './types.js';
import { buildStateGraphTopology } from './graph-builder.js';

const SEMANTIC_TERMINAL_PATTERN =
  /^(completed|cancelled|canceled|finished|success|succeeded|failed|failure|rejected|closed|done|end|terminated|exit)$/i;

/**
 * Detects black hole / deadlock states (in-degree >= 1 and out-degree == 0, excluding [*] and semantic terminal states)
 */
export function detectDeadlockStates(graph: StateMachineGraph): StateViolation[] {
  const violations: StateViolation[] = [];
  const topology = buildStateGraphTopology(graph);

  for (const [nodeId, node] of graph.nodes.entries()) {
    // [*] represents the initial / terminal anchor in Mermaid, not a business state
    if (nodeId === '[*]') {
      continue;
    }

    // Semantic terminal states (e.g. Completed, Failed) are valid workflow termination sinks
    if (SEMANTIC_TERMINAL_PATTERN.test(nodeId)) {
      continue;
    }

    const inTransitions = topology.incoming.get(nodeId) || [];
    const outTransitions = topology.outgoing.get(nodeId) || [];

    // Black hole condition: inDegree >= 1 and outDegree === 0
    if (inTransitions.length >= 1 && outTransitions.length === 0) {
      const primaryIncoming = inTransitions[0];
      violations.push({
        id: `DEADLOCK_${nodeId}`,
        type: 'STATE_DEADLOCK',
        severity: 'critical',
        message: `Black hole / deadlock state detected: "${nodeId}" has ${inTransitions.length} incoming transition(s) but 0 exit transitions to continue or terminate the workflow.`,
        stateId: nodeId,
        diagramTitle: graph.title,
        sourceFile: graph.sourceFile || '',
        line: node.line || (primaryIncoming ? primaryIncoming.line : 1),
        column: 1,
        snippet: primaryIncoming ? primaryIncoming.raw : nodeId,
        suggestion: `Add an exit transition or route it to terminal state "[*]" to avoid workflow hang.`,
      });
    }
  }

  return violations;
}
