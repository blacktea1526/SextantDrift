import fs from 'node:fs';
import { DriftReport } from '@sextant/core';

/**
 * Formats DriftReport into a Markdown report suitable for GitHub Actions $GITHUB_STEP_SUMMARY.
 */
export function formatGitHubSummary(report: DriftReport): string {
  const { summary, violations, exemptions } = report;
  const exemptedCount = exemptions?.length || summary.exemptedViolations || 0;

  const lines: string[] = [];
  lines.push('## 🧭 SextantDrift Architecture Gate');
  lines.push('');

  if (report.passed) {
    lines.push(
      `### :white_check_mark: Architecture Passed (0 New Drifts)`
    );
    if (exemptedCount > 0) {
      lines.push(`> :information_source: **${exemptedCount}** historical debt(s) exempted in baseline.`);
    }
  } else {
    lines.push(
      `### :x: Architectural Drift Detected (${violations.length} New Drifts)`
    );
  }

  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('| :--- | :--- |');
  lines.push(`| Total Files Scanned | ${summary.totalFiles} |`);
  lines.push(`| Dependencies Checked | ${summary.totalDependencies} |`);
  lines.push(`| Layer Bypasses | ${summary.bypassCount} |`);
  lines.push(`| Layer Inversions | ${summary.inversionCount} |`);
  lines.push(`| Dependency Cycles | ${summary.cycleCount} |`);
  lines.push(`| Forbidden Imports | ${summary.forbiddenImportCount} |`);
  lines.push(`| Invariant Violations | ${summary.invariantViolationCount} |`);
  lines.push(`| Historical Exemptions | ${exemptedCount} |`);
  lines.push(`| Execution Time | ${report.durationMs}ms |`);
  lines.push('');

  if (violations.length > 0) {
    lines.push('### 🚨 Detected Violations');
    lines.push('');
    lines.push('| Severity | Type | Location | Evidence / Message |');
    lines.push('| :--- | :--- | :--- | :--- |');

    for (const v of violations) {
      const loc = `${v.sourceFile}:${v.line}`;
      const msg = v.message.replace(/\|/g, '\\|');
      const snippet = v.snippet ? ` \`${v.snippet.replace(/\|/g, '\\|')}\`<br/>` : '';
      lines.push(`| **${v.severity.toUpperCase()}** | \`${v.type}\` | \`${loc}\` | ${snippet}${msg} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Writes markdown summary to process.env.GITHUB_STEP_SUMMARY if present.
 */
export function writeGitHubStepSummary(markdown: string): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      fs.appendFileSync(summaryPath, markdown + '\n', 'utf-8');
    } catch {
      // Non-blocking in local or restricted environments
    }
  }
}
