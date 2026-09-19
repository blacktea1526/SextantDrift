#!/usr/bin/env node

import { cac } from 'cac';
import { runCheck } from '../commands/check.js';
import { runInit } from '../commands/init.js';
import { runBaseline } from '../commands/baseline.js';
import { runReport } from '../commands/report.js';
import { exitWithCode } from '../utils/exit.js';

const cli = cac('sextant-drift');

cli
  .command('[dir]', 'Run architectural drift gate (default command)')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-b, --baseline <path>', 'Path to custom baseline.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--trace <path>', 'Path to runtime trace JSON file (.sextant/trace.json)')
  .option('--json', 'Output machine-readable JSON')
  .option('--strict', 'Treat warnings as errors')
  .option('--report [output]', 'Generate standalone dual-diagram HTML inspection report')
  .option('--github-summary', 'Output markdown report to GITHUB_STEP_SUMMARY')
  .option('--filter <package>', 'Filter target Monorepo package directory')
  .action(async (dir, options) => {
    const code = await runCheck(dir, options);
    exitWithCode(code);
  });

cli
  .command('check [dir]', 'Verify codebase against target architecture and invariants')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-b, --baseline <path>', 'Path to custom baseline.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--trace <path>', 'Path to runtime trace JSON file (.sextant/trace.json)')
  .option('--json', 'Output machine-readable JSON')
  .option('--strict', 'Treat warnings as errors')
  .option('--report [output]', 'Generate standalone dual-diagram HTML inspection report')
  .option('--github-summary', 'Output markdown report to GITHUB_STEP_SUMMARY')
  .option('--filter <package>', 'Filter target Monorepo package directory')
  .action(async (dir, options) => {
    const code = await runCheck(dir, options);
    exitWithCode(code);
  });

cli
  .command('init [dir]', 'Reverse X-Ray: scan directory and generate sextant.json & ARCHITECTURE.md')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-s, --source-dir <dir>', 'Source directory to scan (default: src)')
  .option('--json', 'Output JSON status')
  .action(async (dir, options) => {
    const code = await runInit(dir, options);
    exitWithCode(code);
  });

cli
  .command('baseline [dir]', 'Snapshot current debts into .sextant/baseline.json (No New Drift)')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-o, --output <path>', 'Custom baseline output file path')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--json', 'Output JSON')
  .action(async (dir, options) => {
    const code = await runBaseline(dir, options);
    exitWithCode(code);
  });

cli
  .command('report [dir]', 'Generate offline dual-diagram HTML inspection report')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-o, --output <path>', 'Custom output HTML file path (default: drift-report.html)')
  .option('-b, --baseline <path>', 'Path to custom baseline.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--json', 'Output JSON')
  .action(async (dir, options) => {
    const code = await runReport(dir, options);
    exitWithCode(code);
  });

cli.help();
cli.version('0.1.0');

cli.parse();
