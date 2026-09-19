export interface StateNode {
  id: string;
  name: string;
  isInitial: boolean;
  isTerminal: boolean;
  isChoice?: boolean;
  inDegree: number;
  outDegree: number;
  description?: string;
  line?: number;
}

export interface StateTransition {
  from: string;
  to: string;
  event?: string;
  condition?: string;
  line: number;
  raw: string;
}

export interface StateMachineGraph {
  id: string;
  title?: string;
  nodes: Map<string, StateNode>;
  transitions: StateTransition[];
  sourceFile?: string;
  startLine?: number;
}

export type StateViolationType =
  | 'STATE_DEADLOCK'
  | 'STATE_UNREACHABLE'
  | 'STATE_MISSING_FALLBACK';

export interface StateViolation {
  id: string;
  type: StateViolationType;
  severity: 'critical' | 'warning';
  message: string;
  stateId: string;
  diagramTitle?: string;
  sourceFile: string;
  line: number;
  column: number;
  snippet: string;
  suggestion: string;
  fingerprint?: string;
}

export interface StateVerificationResult {
  diagramId: string;
  diagramTitle?: string;
  sourceFile?: string;
  violations: StateViolation[];
  graph: StateMachineGraph;
}
