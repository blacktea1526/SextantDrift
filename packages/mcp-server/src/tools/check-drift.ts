import path from 'node:path';
import { analyzeModuleDrift } from '@sextant/core';

export interface CheckDriftArgs {
  rootDir?: string;
  specPath?: string;
  strict?: boolean;
}

export interface CheckDriftResult {
  status: 'clean' | 'drifted';
  driftCount: number;
  summary: {
    totalFiles: number;
    totalDependencies: number;
    bypasses: number;
    inversions: number;
    brokenInvariants: number;
    cycles: number;
    forbiddenImports: number;
  };
  violations: Array<{
    id: string;
    type: string;
    severity: string;
    ruleId?: string;
    message: string;
    sourceFile?: string;
    line?: number;
    column?: number;
    suggestion?: string;
  }>;
}

export async function runCheckDrift(args: CheckDriftArgs = {}): Promise<CheckDriftResult> {
  const rootDir = path.resolve(args.rootDir || process.cwd());

  const report = await analyzeModuleDrift({
    rootDir,
    specPath: args.specPath,
  });

  const violations = report.violations.map((v) => ({
    id: v.id,
    type: v.type,
    severity: v.severity,
    ruleId: (v as any).ruleId,
    message: v.message,
    sourceFile: v.sourceFile,
    line: v.line,
    column: v.column,
    suggestion: v.suggestion,
  }));

  const isClean = violations.length === 0;

  return {
    status: isClean ? 'clean' : 'drifted',
    driftCount: violations.length,
    summary: {
      totalFiles: report.summary.totalFiles,
      totalDependencies: report.summary.totalDependencies,
      bypasses: report.summary.bypassCount,
      inversions: report.summary.inversionCount,
      brokenInvariants: report.summary.invariantViolationCount,
      cycles: report.summary.cycleCount,
      forbiddenImports: report.summary.forbiddenImportCount,
    },
    violations,
  };
}
