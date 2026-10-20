import path from 'node:path';
import { analyzeModuleDrift, evaluateAcceptance } from '@sextant/core';
import type { AcceptanceStatus, DriftReport, VerificationReport, VersionBinding, RunEvidence } from '@sextant/core';
import { snapshotVerification } from '../verification/snapshot.js';
import { executeAcceptanceTests } from '../verification/vitest-executor.js';

export interface VerifyOptions {
  config?: string;
  json?: boolean;
  /** Whole test-process deadline, in milliseconds. */
  timeout?: number | string;
}

export interface VerifyCommandReport {
  status: AcceptanceStatus;
  exitCode: number;
  structural?: DriftReport;
  acceptance?: VerificationReport;
  versions?: VersionBinding;
  run?: { runId: string; runDir: string; complete: boolean; durationMs: number };
  evidence?: RunEvidence;
  issues: string[];
}

const codes: Record<AcceptanceStatus, number> = { PASS: 0, FAIL: 1, ERROR: 2, UNVERIFIED: 3 };
const priority: Record<AcceptanceStatus, number> = { PASS: 0, UNVERIFIED: 1, FAIL: 2, ERROR: 3 };
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);

function output(report: VerifyCommandReport, json?: boolean): number {
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Verification: ${report.status} (exit ${report.exitCode})`);
    for (const requirement of report.acceptance?.requirements ?? []) {
      console.log(`  ${requirement.requirementId}: ${requirement.status}`);
      for (const check of requirement.checks) {
        if (check.status !== 'PASS') console.log(`    ${check.checkId}: ${check.status}${check.evidence?.message ? ` — ${check.evidence.message}` : ''}`);
      }
    }
    for (const issue of report.issues) console.log(`  ${issue}`);
    if (report.run) console.log(`  Evidence: ${report.run.runDir}`);
  }
  return report.exitCode;
}

/** Runs a fresh structural gate and project-local acceptance tests. Never confirms candidate assets. */
export async function runVerify(dir: string = '.', options: VerifyOptions = {}): Promise<number> {
  const report: VerifyCommandReport = { status: 'ERROR', exitCode: 2, issues: [] };
  try {
    const timeoutMs = options.timeout === undefined ? 10000 : Number(options.timeout);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) {
      throw new Error('--timeout must be an integer from 1 to 300000 milliseconds');
    }
    const root = path.resolve(dir);
    const before = snapshotVerification(root, options.config);
    report.structural = await analyzeModuleDrift({ rootDir: root, specPath: options.config });
    if (!before.architecture.acceptance || !before.versions) {
      report.acceptance = {
        status: 'UNVERIFIED', requirements: [], issues: ['No acceptance mapping is configured'],
      };
    } else {
      report.versions = before.versions;
      const execution = await executeAcceptanceTests(root, before.architecture.acceptance, { timeoutMs });
      const { runId, runDir, complete, durationMs } = execution;
      report.run = { runId, runDir, complete, durationMs };
      // A failed post-run snapshot cannot certify the inputs observed by the child.
      try {
        const after = snapshotVerification(root, options.config);
        if (!after.versions) throw new Error('Acceptance mapping was removed during execution');
        report.evidence = {
          runId, versionsBefore: before.versions, versionsAfter: after.versions,
          complete, checks: execution.checks,
        };
        report.acceptance = evaluateAcceptance(before.architecture.acceptance,
          { runId, versions: before.versions }, report.evidence);
      } catch (error) {
        report.acceptance = {
          status: 'UNVERIFIED', requirements: [],
          issues: [`Inputs could not be verified after execution: ${message(error)}`],
        };
      }
      if (execution.errors.length) {
        report.acceptance.status = 'ERROR';
        report.acceptance.issues.push(...execution.errors);
      }
    }
    const structuralStatus: AcceptanceStatus = report.structural.passed ? 'PASS' : 'FAIL';
    report.status = priority[structuralStatus] > priority[report.acceptance.status]
      ? structuralStatus : report.acceptance.status;
    report.issues = [...report.acceptance.issues];
    if (!report.structural.passed) report.issues.push('Structural drift detected; see structural.violations');
    report.exitCode = codes[report.status];
  } catch (error) {
    report.status = 'ERROR';
    report.exitCode = 2;
    report.issues.push(message(error));
  }
  return output(report, options.json);
}
