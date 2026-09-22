import { TargetArchitecture, C4SystemContext } from './architecture.js';

export interface ViolationEvidence {
  id: string;
  type:
    | 'CRITICAL_BYPASS'
    | 'CRITICAL_INVERSION'
    | 'CRITICAL_CYCLE'
    | 'CRITICAL_FORBIDDEN_IMPORT'
    | 'INVARIANT_BROKEN'
    | 'STATE_DEADLOCK'
    | 'STATE_UNREACHABLE'
    | 'STATE_MISSING_FALLBACK'
    | 'DYNAMIC_OUT_OF_ORDER'
    | 'DYNAMIC_UNEXPECTED_CALL'
    | 'DYNAMIC_MISSING_CALL'
    | 'CONTRACT_MISSING_ENDPOINT'
    | 'CONTRACT_SHADOW_ENDPOINT'
    | 'CONTRACT_MISSING_PARAM'
    | 'CONTRACT_UNHANDLED_STATUS'
    | 'CONTRACT_LINT_ERROR';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  sourceFile: string;
  line: number;
  column: number;
  snippet: string;
  sourceComponent?: string;
  targetComponent?: string;
  cycle?: string[];
  ruleId?: string;
  ruleDesc?: string;
  enclosingFunction?: string;
  targetCall?: string;
  stateId?: string;
  diagramTitle?: string;
  traceId?: string;
  spanId?: string;
  suggestion?: string;
  fingerprint?: string;
}

export type DriftViolation = ViolationEvidence;

export interface BaselineFingerprint {
  hash: string;
  type: string;
  sourceComponent?: string;
  targetComponent?: string;
  sourceFile?: string;
  enclosingFunction?: string;
  targetCall?: string;
  ruleId?: string;
  stateId?: string;
  diagramTitle?: string;
  traceId?: string;
  action?: string;
  description?: string;
}

export interface BaselineData {
  version: string;
  generatedAt: string;
  totalExemptions: number;
  fingerprints: BaselineFingerprint[];
}

export interface DriftSummary {
  totalFiles: number;
  totalDependencies: number;
  totalViolations: number;
  exemptedViolations?: number;
  newViolations?: number;
  bypassCount: number;
  inversionCount: number;
  cycleCount: number;
  forbiddenImportCount: number;
  invariantViolationCount: number;
  stateViolationCount?: number;
  dynamicViolationCount?: number;
  contractViolationCount?: number;
}

export type C4NodeStatus = 'compliant' | 'drift';
export type C4EdgeStatus = 'compliant' | 'drift' | 'planned';
export type C4EdgeViolationType =
  | 'bypass'
  | 'inversion'
  | 'cycle'
  | 'forbidden_import'
  | 'invariant_broken'
  | 'dynamic'
  | 'state'
  | 'allowed'
  | 'planned';

export interface C4GraphNode {
  id: string;
  name: string;
  layerId: string;
  layerName?: string;
  containerId?: string;
  containerName?: string;
  technology?: string;
  description?: string;
  paths: string[];
  fileCount: number;
  status: C4NodeStatus;
  violationCount: number;
}

export interface C4GraphEdge {
  id: string;
  from: string;
  to: string;
  status: C4EdgeStatus;
  type?: C4EdgeViolationType;
  violations?: string[];
  violationSummaries?: string[];
  description?: string;
  technology?: string;
  protocol?: string;
}

export interface C4GraphContainer {
  id: string;
  name: string;
  order: number;
  description?: string;
  technology?: string;
  type?: string;
  status: 'compliant' | 'drift';
  componentIds: string[];
}

export interface C4GraphData {
  systemName?: string;
  systemContext?: C4SystemContext;
  containers: C4GraphContainer[];
  nodes: C4GraphNode[];
  edges: C4GraphEdge[];
  targetEdges: C4GraphEdge[];
  actualEdges: C4GraphEdge[];
  containerEdges?: C4GraphEdge[];
  targetContainerEdges?: C4GraphEdge[];
  actualContainerEdges?: C4GraphEdge[];
}

export interface DriftReport {
  passed: boolean;
  exitCode: 0 | 1 | 2;
  summary: DriftSummary;
  violations: DriftViolation[];
  exemptions?: DriftViolation[];
  targetArchitecture: TargetArchitecture;
  graphData: C4GraphData;
  /** @deprecated Kept for backward compatibility */
  actualMermaid?: string;
  /** @deprecated Kept for backward compatibility */
  unifiedMermaid?: string;
  durationMs: number;
}

export interface AnalyzeOptions {
  rootDir: string;
  specPath?: string;
  tsconfigPath?: string;
  baselinePath?: string;
  tracePath?: string;
  trace?: any; // ExecutionTrace
  contractPath?: string;
  contractContent?: string;
  files?: string[];
}
