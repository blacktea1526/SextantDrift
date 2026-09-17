import { TargetArchitecture } from './architecture.js';
import { ViolationEvidence } from '../comparator/bypass-detector.js';

export type DriftViolation = ViolationEvidence;

export interface DriftSummary {
  totalFiles: number;
  totalDependencies: number;
  totalViolations: number;
  bypassCount: number;
  inversionCount: number;
  cycleCount: number;
  forbiddenImportCount: number;
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
