import { StateMachineGraph, StateVerificationResult, StateViolation } from './types.js';
import {
  parseStateDiagram,
  extractStateDiagramsFromMarkdown,
  ParseStateDiagramOptions,
  ExtractedStateDiagram,
} from './parser.js';
import { detectDeadlockStates } from './deadlock-detector.js';
import { detectIslandStates } from './island-detector.js';
import { detectMissingFallbackStates } from './fallback-checker.js';

export * from './types.js';
export * from './parser.js';
export * from './graph-builder.js';
export * from './deadlock-detector.js';
export * from './island-detector.js';
export * from './fallback-checker.js';

/**
 * Runs all integrity verifiers on a parsed state machine graph
 */
export function verifyStateMachine(graph: StateMachineGraph): StateVerificationResult {
  const deadlockViolations = detectDeadlockStates(graph);
  const islandViolations = detectIslandStates(graph);
  const fallbackViolations = detectMissingFallbackStates(graph);

  const violations: StateViolation[] = [
    ...deadlockViolations,
    ...islandViolations,
    ...fallbackViolations,
  ];

  return {
    diagramId: graph.id,
    diagramTitle: graph.title,
    sourceFile: graph.sourceFile,
    violations,
    graph,
  };
}

/**
 * Verifies a single Mermaid stateDiagram-v2 string
 */
export function verifyStateDiagram(
  code: string,
  options: ParseStateDiagramOptions = {}
): StateVerificationResult {
  const graph = parseStateDiagram(code, options);
  return verifyStateMachine(graph);
}

/**
 * Extracts and verifies all state diagrams found in a markdown string
 */
export function extractAndVerifyStateDiagrams(
  markdownText: string,
  sourceFile = 'spec.md'
): StateVerificationResult[] {
  const extracted = extractStateDiagramsFromMarkdown(markdownText, sourceFile);
  return extracted.map((ext) =>
    verifyStateDiagram(ext.code, {
      sourceFile: ext.sourceFile,
      startLine: ext.startLine,
      title: ext.title,
    })
  );
}
