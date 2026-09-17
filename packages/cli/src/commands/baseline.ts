import path from 'node:path';
import pc from 'picocolors';
import {
  analyzeModuleDrift,
  saveBaseline,
  DEFAULT_BASELINE_FILENAME,
} from '@sextant/core';
import { EXIT_CODE_FATAL_ERROR, EXIT_CODE_SUCCESS } from '../utils/exit.js';

export interface BaselineOptions {
  config?: string;
  output?: string;
  tsconfig?: string;
  json?: boolean;
}

/**
 * Scans current project violations and snapshots them into baseline.json
 * according to ADR-006.
 */
export async function runBaseline(
  dir: string = '.',
  options: BaselineOptions = {}
): Promise<number> {
  try {
    const rootDir = path.resolve(process.cwd(), dir);
    const baselinePath = options.output
      ? path.resolve(rootDir, options.output)
      : path.resolve(rootDir, DEFAULT_BASELINE_FILENAME);

    // Analyze all raw violations without baseline filtering
    const report = await analyzeModuleDrift({
      rootDir,
      specPath: options.config,
      tsconfigPath: options.tsconfig,
      baselinePath: '/dev/null/non-existent', // ignore existing baseline
    });

    const baselineData = saveBaseline(baselinePath, report.violations);

    if (options.json) {
      console.log(JSON.stringify(baselineData, null, 2));
    } else {
      console.log(
        pc.green(
          `✔ Baseline updated: ${baselineData.totalExemptions} historical debt(s) snapshot saved to ${path.relative(
            process.cwd(),
            baselinePath
          )}`
        )
      );
      console.log(
        pc.dim(
          '  Future checks will exempt these historical violations ("No New Drift" policy).'
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
