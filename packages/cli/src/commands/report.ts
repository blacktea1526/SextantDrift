import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { analyzeModuleDrift } from '@sextant/core';
import { generateHtmlReport } from '@sextant/web-report';
import { EXIT_CODE_FATAL_ERROR, EXIT_CODE_SUCCESS } from '../utils/exit.js';

export interface ReportOptions {
  config?: string;
  output?: string;
  tsconfig?: string;
  baseline?: string;
  json?: boolean;
  lang?: 'zh' | 'en';
}

/**
 * Generates an offline dual-diagram HTML inspection report.
 */
export async function runReport(
  dir: string = '.',
  options: ReportOptions = {}
): Promise<number> {
  try {
    const rootDir = path.resolve(process.cwd(), dir);
    const outputPath = options.output
      ? (path.isAbsolute(options.output) ? options.output : path.resolve(process.cwd(), options.output))
      : path.resolve(rootDir, 'drift-report.html');

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const report = await analyzeModuleDrift({
      rootDir,
      specPath: options.config,
      tsconfigPath: options.tsconfig,
      baselinePath: options.baseline,
    });

    const lang = options.lang === 'en' ? 'en' : 'zh';
    let html: string;
    let isFullVisual = false;

    try {
      html = generateHtmlReport(report, { lang });
      isFullVisual = true;
    } catch {
      const { formatLightweightHtmlReport } = await import('../formatters/html.js');
      html = formatLightweightHtmlReport(report, { lang });
    }

    fs.writeFileSync(outputPath, html, 'utf-8');

    if (options.json) {
      console.log(JSON.stringify({ reportPath: outputPath, violations: report.violations.length, fullVisual: isFullVisual }));
    } else {
      if (isFullVisual) {
        console.log(
          pc.green(
            `✔ Dual-diagram inspection report generated: ${path.relative(process.cwd(), outputPath)}`
          )
        );
      } else {
        console.log(
          pc.green(
            `✔ Architecture inspection report generated: ${path.relative(process.cwd(), outputPath)}`
          )
        );
        console.log(
          pc.dim(
            `  Note: Install optional @sextant/web-report extension for interactive C4 SVG visual diagrams.`
          )
        );
      }
      console.log(
        pc.dim(
          `  Open this file in any browser (100% offline, zero network requests required).`
        )
      );
    }

    return EXIT_CODE_SUCCESS;
  } catch (err: any) {
    if (options.json) {
      console.error(JSON.stringify({ error: err.message }));
    } else {
      console.error(pc.red(`\n✖ Fatal Error: ${err.message}`));
    }
    return EXIT_CODE_FATAL_ERROR;
  }
}
