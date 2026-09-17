import { TargetArchitecture } from './architecture.js';

export interface ViolationEvidence {
  id: string;
  type:
    | 'CRITICAL_BYPASS'
    | 'CRITICAL_INVERSION'
    | 'CRITICAL_CYCLE'
    | 'CRITICAL_FORBIDDEN_IMPORT'
    | 'INVARIANT_BROKEN';
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
}

export type DriftViolation = ViolationEvidence;

export interface DriftSummary {
  totalFiles: number;
  totalDependencies: number;
  totalViolations: number;
  bypassCount: number;
  inversionCount: number;
  cycleCount: number;
  forbiddenImportCount: number;
  invariantViolationCount: number;
}

export interface DriftReport {
  passed: boolean;
  exitCode: 0 | 1 | 2;
  summary: DriftSummary;
  violations: DriftViolation[];
  targetArchitecture: TargetArchitecture;
  actualMermaid: string;
  durationMs: number;
}

export interface AnalyzeOptions {
  rootDir: string;
  specPath?: string;
  tsconfigPath?: string;
  files?: string[];
}
