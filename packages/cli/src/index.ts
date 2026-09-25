/**
 * @sextant/cli
 * Command line interface and CI quality gate for SextantDrift
 */

export * from './commands/check.js';
export * from './commands/baseline.js';
export * from './commands/init.js';
export * from './commands/report.js';
export * from './formatters/terminal.js';
export * from './formatters/json.js';
export * from './formatters/github.js';
export * from './utils/exit.js';
export { analyzeModuleDrift, generateActualMermaid } from '@sextant/core';
export type { DriftReport, DriftViolation, DriftSummary } from '@sextant/core';

declare const __CLI_VERSION__: string | undefined;
export const CLI_VERSION = typeof __CLI_VERSION__ !== 'undefined' ? __CLI_VERSION__ : '2.0.2';

