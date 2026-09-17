import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeModuleDrift } from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('E2E: Clean Layered App Fixture (Positive Test)', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/clean-layered-app');

  it('should pass cleanly with 0 violations and exitCode 0 (Zero False Positives)', async () => {
    const report = await analyzeModuleDrift({
      rootDir: fixtureDir,
    });

    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.violations).toHaveLength(0);
    expect(report.summary.totalViolations).toBe(0);
    expect(report.summary.bypassCount).toBe(0);
    expect(report.summary.inversionCount).toBe(0);
    expect(report.summary.cycleCount).toBe(0);
    expect(report.summary.forbiddenImportCount).toBe(0);

    // Actual Mermaid should have no DRIFT! annotations
    expect(report.actualMermaid).not.toContain('DRIFT!');
  });
});
