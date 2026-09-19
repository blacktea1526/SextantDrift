import { TargetArchitecture } from './architecture.js';

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
    | 'DYNAMIC_MISSING_CALL';
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
}

export interface DriftReport {
  passed: boolean;
  exitCode: 0 | 1 | 2;
  summary: DriftSummary;
  violations: DriftViolation[];
  exemptions?: DriftViolation[];
  targetArchitecture: TargetArchitecture;
  actualMermaid: string;
  durationMs: number;
}

export interface AnalyzeOptions {
  rootDir: string;
  specPath?: string;
  tsconfigPath?: string;
  baselinePath?: string;
  tracePath?: string;
  trace?: any; // ExecutionTrace
  files?: string[];
}
