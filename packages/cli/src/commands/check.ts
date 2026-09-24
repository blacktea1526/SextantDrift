import path from 'node:path';
import fs from 'node:fs';
import pc from 'picocolors';
import { analyzeModuleDrift, DriftReport } from '@sextant/core';
import { formatTerminalReport } from '../formatters/terminal.js';
import { formatJsonReport } from '../formatters/json.js';
import { formatGitHubSummary, writeGitHubStepSummary } from '../formatters/github.js';
import { EXIT_CODE_DRIFT_DETECTED, EXIT_CODE_FATAL_ERROR, EXIT_CODE_SUCCESS } from '../utils/exit.js';

export interface CheckOptions {
  config?: string;
  baseline?: string;
  tsconfig?: string;
  trace?: string;
  contract?: string;
  json?: boolean;
  strict?: boolean;
  report?: boolean | string;
  githubSummary?: boolean;
  filter?: string;
  lang?: 'zh' | 'en';
  fixManifest?: boolean;
  aiPrompt?: boolean;
  countTypeOnly?: boolean;
}

/**
 * Executes architecture drift verification and returns standard Unix exit code (0, 1, 2).
 */
export async function runCheck(dir: string = '.', options: CheckOptions = {}): Promise<number> {
  try {
    let rootDir = path.resolve(process.cwd(), dir);
    if (options.filter) {
      rootDir = path.resolve(rootDir, options.filter);
    }

    const report: DriftReport = await analyzeModuleDrift({
      rootDir,
      specPath: options.config,
      tsconfigPath: options.tsconfig,
      baselinePath: options.baseline,
      tracePath: options.trace,
      contractPath: options.contract,
      countTypeOnly: options.countTypeOnly,
    });

    if (options.strict && report.passed) {
      const hasWarning = report.violations.some((v) => v.severity === 'warning');
      if (hasWarning) {
        report.passed = false;
        report.exitCode = 1;
      }
    }

    if (options.fixManifest) {
      const { generateAiFixManifest } = await import('@sextant/core');
      console.log(generateAiFixManifest(report.violations));
      return report.passed ? EXIT_CODE_SUCCESS : EXIT_CODE_DRIFT_DETECTED;
    }

    if (options.aiPrompt) {
      const { generateAiFixPrompt } = await import('@sextant/core');
      console.log(generateAiFixPrompt(report.violations));
      return report.passed ? EXIT_CODE_SUCCESS : EXIT_CODE_DRIFT_DETECTED;
    }

    if (options.json) {
      console.log(formatJsonReport(report));
    } else {
      console.log(formatTerminalReport(report, { strict: options.strict }));
    }

    if (options.githubSummary) {
      const md = formatGitHubSummary(report);
      writeGitHubStepSummary(md);
    }

    // Lazy load web-report only if requested
    if (options.report) {
      const reportRelPath = typeof options.report === 'string' ? options.report : 'drift-report.html';
      const absReportPath = path.isAbsolute(reportRelPath)
        ? reportRelPath
        : path.resolve(rootDir, reportRelPath);

      const reportDir = path.dirname(absReportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      try {
        const lang = options.lang === 'en' ? 'en' : 'zh';
        let html: string;
        let isFullVisual = false;

        try {
          const { generateHtmlReport } = await import('@sextant/web-report');
          html = generateHtmlReport(report, { lang });
          isFullVisual = true;
        } catch {
          const { formatLightweightHtmlReport } = await import('../formatters/html.js');
          html = formatLightweightHtmlReport(report, { lang });
        }

        fs.writeFileSync(absReportPath, html, 'utf-8');

        if (!options.json) {
          if (isFullVisual) {
            console.log(pc.cyan(`\n  Dual-diagram visual report saved to: ${absReportPath}`));
          } else {
            console.log(pc.cyan(`\n  Architecture report saved to: ${absReportPath}`));
            console.log(pc.dim(`  (Install optional @sextant/web-report for interactive C4 SVG diagrams)`));
          }
        }
      } catch (err: any) {
        console.error(pc.yellow(`  Failed to generate HTML report: ${err.message}`));
      }
    }

    return report.exitCode;
  } catch (err: any) {
    if (options.json) {
      console.error(JSON.stringify({ error: err.message, stack: err.stack }));
    } else {
      console.error(pc.red(`\n✖ Fatal Error: ${err.message}`));
    }
    return EXIT_CODE_FATAL_ERROR;
  }
}
