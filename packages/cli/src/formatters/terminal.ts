import pc from 'picocolors';
import { DriftReport, DriftViolation, C4GraphContainer } from '@sextant/core';

export interface TerminalFormatOptions {
  strict?: boolean;
}

/**
 * Formats Level 2 Container Tiers into a high-visibility, clean health matrix.
 */
export function formatContainerTierMatrix(containers: C4GraphContainer[]): string {
  const sorted = [...containers].sort((a, b) => a.order - b.order);
  const rows: string[] = [];
  rows.push(pc.cyan('  ── Architecture Container Tiers (Level 2) ──────────────────'));
  for (const c of sorted) {
    const isDrift = c.status === 'drift';
    const statusIcon = isDrift ? pc.red('✖ DRIFT') : pc.green('✔ OK');
    const layerTag = pc.bold(`L${c.order}: ${c.id.padEnd(14)}`);
    const compCount = `${c.componentIds.length} comp(s)`.padEnd(11);
    const tech = pc.dim(`[${c.technology || 'module'}]`);
    rows.push(`  ${layerTag} ${compCount} ${statusIcon.padEnd(10)} ${tech}`);
  }
  rows.push(pc.cyan('  ────────────────────────────────────────────────────────────'));
  return rows.join('\n');
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
  const criticals = violations.filter((v) => v.severity === 'critical');
  const warnings = violations.filter((v) => v.severity === 'warning');

  // If there are warnings/unresolved imports/partial barrels, NEVER print false Clean!
  if (criticals.length === 0 && (warnings.length > 0 || report.hasUnresolvedImports || report.hasPartialBarrels)) {
    lines.push(
      pc.yellow(
        `⚠ ${warnings.length} warning(s) / resolution issue(s) detected (0 critical drifts):`
      )
    );
    lines.push('');
    for (const v of warnings) {
      lines.push(formatViolation(v));
    }
    lines.push('');
    lines.push(
      pc.dim(`  Scanned in ${report.durationMs}ms. (Resolution warnings prevent a false Clean status)`)
    );
    return lines.join('\n');
  }

  if (report.passed && criticals.length === 0 && warnings.length === 0) {
    const contractSuffix =
      summary.contractEndpointCount && summary.contractEndpointCount > 0
        ? `, ${summary.contractEndpointCount} API contract endpoint${summary.contractEndpointCount > 1 ? 's' : ''} verified`
        : '';

    if (exemptedCount > 0) {
      lines.push(
        pc.green(
          `✔ Clean: 0 architectural drifts detected (${exemptedCount} historical debt${
            exemptedCount > 1 ? 's' : ''
          } exempted in baseline${contractSuffix})`
        )
      );
    } else {
      lines.push(
        pc.green(
          `✔ Clean: 0 architectural drifts detected across ${summary.totalFiles} files (${summary.totalDependencies} dependencies verified${contractSuffix})`
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

  if (report.graphData?.containers && report.graphData.containers.length > 0) {
    lines.push('');
    lines.push(formatContainerTierMatrix(report.graphData.containers));
    lines.push('');
  }

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
  if (summary.unresolvedImportCount && summary.unresolvedImportCount > 0) {
    summaryTokens.push(`${summary.unresolvedImportCount} unresolved`);
  }
  if (summary.partialBarrelCount && summary.partialBarrelCount > 0) {
    summaryTokens.push(`${summary.partialBarrelCount} partial barrel`);
  }
  if (summary.stateViolationCount && summary.stateViolationCount > 0) {
    summaryTokens.push(`${summary.stateViolationCount} state`);
  }
  if (summary.dynamicViolationCount && summary.dynamicViolationCount > 0) {
    summaryTokens.push(`${summary.dynamicViolationCount} dynamic`);
  }
  if (summary.contractViolationCount && summary.contractViolationCount > 0) {
    summaryTokens.push(`${summary.contractViolationCount} contract`);
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
