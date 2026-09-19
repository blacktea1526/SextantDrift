import pc from 'picocolors';
import { DriftReport, DriftViolation } from '@sextant/core';

export interface TerminalFormatOptions {
  strict?: boolean;
}

/**
 * Formats a single violation into a compact, high signal-to-noise ANSI string
 * conforming to the 50~200 Tokens constraint in ADR-005.
 */
export function formatViolation(violation: DriftViolation): string {
  const badgeColor =
    violation.severity === 'critical' ? pc.red : violation.severity === 'warning' ? pc.yellow : pc.blue;
  const badge = badgeColor(`[${violation.type}]`);
  const loc = pc.bold(`${violation.sourceFile}:${violation.line}:${violation.column}`);

  const lines: string[] = [`  ${badge} ${loc}`];

  if (violation.snippet) {
    lines.push(`    ${pc.dim('Snippet:')}  ${violation.snippet}`);
  }

  lines.push(`    ${pc.dim('Message:')}  ${violation.message}`);

  if (violation.suggestion) {
    lines.push(`    ${pc.dim('Hint:')}     ${violation.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Formats complete DriftReport into a high-density, agent-friendly ANSI terminal output.
 */
export function formatTerminalReport(
  report: DriftReport,
  _options: TerminalFormatOptions = {}
): string {
  const lines: string[] = [];
  const { summary, violations, exemptions } = report;

  const exemptedCount = exemptions?.length || summary.exemptedViolations || 0;
  const newDriftCount = violations.length;

  if (report.passed) {
    if (exemptedCount > 0) {
      lines.push(
        pc.green(
          `✔ Clean: 0 architectural drifts detected (${exemptedCount} historical debt${
            exemptedCount > 1 ? 's' : ''
          } exempted in baseline)`
        )
      );
    } else {
      lines.push(
        pc.green(
          `✔ Clean: 0 architectural drifts detected across ${summary.totalFiles} files (${summary.totalDependencies} dependencies verified)`
        )
      );
    }
    lines.push(pc.dim(`  Scanned in ${report.durationMs}ms`));
    return lines.join('\n');
  }

  // Drifts detected
  lines.push(
    pc.red(
      `✖ ${newDriftCount} architectural drift${
        newDriftCount > 1 ? 's' : ''
      } detected${exemptedCount > 0 ? ` (${exemptedCount} historical debt(s) exempted)` : ''}:`
    )
  );

  for (const v of violations) {
    lines.push(formatViolation(v));
  }

  const summaryTokens = [
    `${summary.bypassCount} bypass`,
    `${summary.inversionCount} inversion`,
    `${summary.cycleCount} cycle`,
    `${summary.forbiddenImportCount} forbidden`,
    `${summary.invariantViolationCount} invariant`,
  ];
  if (summary.stateViolationCount && summary.stateViolationCount > 0) {
    summaryTokens.push(`${summary.stateViolationCount} state`);
  }
  if (summary.dynamicViolationCount && summary.dynamicViolationCount > 0) {
    summaryTokens.push(`${summary.dynamicViolationCount} dynamic`);
  }

  lines.push('');
  lines.push(pc.dim(`  Summary: ${summaryTokens.join(', ')}`));
  lines.push(
    pc.dim(
      `  Scanned ${summary.totalFiles} files in ${report.durationMs}ms. Run "npx sextant-drift baseline" to snapshot historical debts.`
    )
  );

  return lines.join('\n');
}
