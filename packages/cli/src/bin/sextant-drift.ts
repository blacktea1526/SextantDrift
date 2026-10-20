#!/usr/bin/env node

import { cac } from 'cac';
import { runCheck } from '../commands/check.js';
import { runInit } from '../commands/init.js';
import { runBaseline } from '../commands/baseline.js';
import { runReport } from '../commands/report.js';
import { runMcp } from '../commands/mcp.js';
import { runVerify } from '../commands/verify.js';
import { runRequirements } from '../commands/requirements.js';
import { exitWithCode } from '../utils/exit.js';

const cli = cac('sextant-drift');

cli
  .command('[dir]', 'Run architectural drift gate (default command)')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-b, --baseline <path>', 'Path to custom baseline.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--trace <path>', 'Path to runtime trace JSON (experimental Phase 5 dynamic causality)')
  .option('--contract <path>', 'Path to API contract specification (e.g. api-contract.md)')
  .option('--json', 'Output machine-readable JSON')
  .option('--strict', 'Treat warnings as errors')
  .option('--report [output]', 'Generate standalone HTML inspection report')
  .option('--github-summary', 'Output markdown report to GITHUB_STEP_SUMMARY')
  .option('--filter <package>', 'Filter target Monorepo package directory')
  .option('--lang <lang>', 'Report display language (zh or en, default: zh)')
  .option('--fix-manifest', 'Output compact YAML Fix Manifest for AI remediation (token-optimized)')
  .option('--ai-prompt', 'Output ready-to-execute prompt for AI coding assistants')
  .option('--count-type-only', 'Include type-only imports in architectural drift detection (default: false)')
  .option('--allow-empty', 'Allow declared skeleton components matching 0 files (default: true)')
  .option('--forbid-empty', 'Treat components matching 0 files as fatal configuration errors')
  .action(async (dir, options) => {
    const code = await runCheck(dir, options);
    exitWithCode(code);
  });

cli
  .command('check [dir]', 'Verify codebase against target architecture and invariants')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-b, --baseline <path>', 'Path to custom baseline.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--trace <path>', 'Path to runtime trace JSON (experimental Phase 5 dynamic causality)')
  .option('--contract <path>', 'Path to API contract specification (e.g. api-contract.md)')
  .option('--json', 'Output machine-readable JSON')
  .option('--strict', 'Treat warnings as errors')
  .option('--report [output]', 'Generate standalone HTML inspection report')
  .option('--github-summary', 'Output markdown report to GITHUB_STEP_SUMMARY')
  .option('--filter <package>', 'Filter target Monorepo package directory')
  .option('--lang <lang>', 'Report display language (zh or en, default: zh)')
  .option('--fix-manifest', 'Output compact YAML Fix Manifest for AI remediation (token-optimized)')
  .option('--ai-prompt', 'Output ready-to-execute prompt for AI coding assistants')
  .option('--count-type-only', 'Include type-only imports in architectural drift detection (default: false)')
  .option('--allow-empty', 'Allow declared skeleton components matching 0 files (default: true)')
  .option('--forbid-empty', 'Treat components matching 0 files as fatal configuration errors')
  .action(async (dir, options) => {
    const code = await runCheck(dir, options);
    exitWithCode(code);
  });

cli
  .command('verify [dir]', 'Run structural gate and version-bound acceptance tests (Vitest 2.1.x)')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('--json', 'Output machine-readable verification result')
  .option('--timeout <ms>', 'Whole test-process deadline in milliseconds (default: 10000)')
  .action(async (dir, options) => {
    exitWithCode(await runVerify(dir, options));
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
  .command('report [dir]', 'Generate offline HTML inspection report')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .option('-o, --output <path>', 'Custom output HTML file path (default: drift-report.html)')
  .option('-b, --baseline <path>', 'Path to custom baseline.json')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json')
  .option('--lang <lang>', 'Report display language (zh or en, default: zh)')
  .option('--json', 'Output JSON')
  .action(async (dir, options) => {
    const code = await runReport(dir, options);
    exitWithCode(code);
  });

cli
  .command('requirements <entityId> [dir]', 'List declared review scope for one business requirement entity')
  .option('-c, --config <path>', 'Path to custom sextant specification')
  .action(async (entityId: string, dir: string | undefined, options: { config?: string }) => {
    const code = await runRequirements(entityId, dir, options);
    exitWithCode(code);
  });

cli
  .command('mcp [action]', 'Model Context Protocol (MCP) server for Cursor, Claude Code, and Windsurf (action: run | install)')
  .option('-g, --global', 'Install globally into ~/.cursor/mcp.json instead of project workspace')
  .action(async (action, options) => {
    const code = await runMcp(action, options);
    exitWithCode(code);
  });


cli.help((sections) => {
  sections.push({
    title: 'Language & Ecosystem Matrix',
    body: [
      '  Tier 1 (Native AST): TypeScript, JavaScript, TSX/JSX, Python, Go, Node.js, Bun, Next.js, NestJS',
      '  Tier 2 (Polyglot Dynamic / experimental --trace): Any language via .sextant/trace.json & api-contract.md',
      '  Tier 3 (Roadmap): Rust via Tree-sitter AST engine',
    ].join('\n'),
  });
});

declare const __CLI_VERSION__: string | undefined;

cli.version(typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '2.0.3');

cli.parse();
