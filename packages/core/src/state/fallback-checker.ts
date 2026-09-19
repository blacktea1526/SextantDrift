import { StateMachineGraph, StateViolation } from './types.js';
import { buildStateGraphTopology } from './graph-builder.js';

export const ASYNC_WAITING_REGEX =
  /pending|processing|waiting|executing|submitting|loading|authorizing|syncing|calling|verifying/i;

export const FALLBACK_KEYWORD_REGEX =
  /fail|error|timeout|retry|abort|cancel|reject|exception|degrade/i;

/**
 * Checks that asynchronous waiting states include error/timeout/fallback degradation transitions
 */
export function detectMissingFallbackStates(graph: StateMachineGraph): StateViolation[] {
  const violations: StateViolation[] = [];
  const topology = buildStateGraphTopology(graph);

  for (const [nodeId, node] of graph.nodes.entries()) {
    if (nodeId === '[*]') {
      continue;
    }

    const isAsyncWaiting =
      ASYNC_WAITING_REGEX.test(nodeId) ||
      (node.description && ASYNC_WAITING_REGEX.test(node.description));

    if (!isAsyncWaiting) {
      continue;
    }

    const outTransitions = topology.outgoing.get(nodeId) || [];

    // If it's already a deadlock state (outDegree === 0), deadlock detector will flag it as critical,
    // but if it has exits that are purely happy-paths without fallback, flag it here.
    const hasFallback = outTransitions.some((trans) => {
      const eventMatch = trans.event && FALLBACK_KEYWORD_REGEX.test(trans.event);
      const condMatch = trans.condition && FALLBACK_KEYWORD_REGEX.test(trans.condition);
      const targetMatch = FALLBACK_KEYWORD_REGEX.test(trans.to);
      return eventMatch || condMatch || targetMatch;
    });

    if (!hasFallback) {
      const primaryOut = outTransitions[0];
      violations.push({
        id: `MISSING_FALLBACK_${nodeId}`,
        type: 'STATE_MISSING_FALLBACK',
        severity: 'warning',
        message: `Missing fallback/timeout degradation: Asynchronous waiting state "${nodeId}" has no failure, error, timeout, or retry transition branch.`,
        stateId: nodeId,
        diagramTitle: graph.title,
        sourceFile: graph.sourceFile || '',
        line: node.line || (primaryOut ? primaryOut.line : 1),
        column: 1,
        snippet: primaryOut ? primaryOut.raw : nodeId,
        suggestion: `Add a fallback transition (e.g. timeout, error, retry, fail, or cancel) from "${nodeId}" to handle unexpected failures.`,
      });
    }
  }

  return violations;
}
