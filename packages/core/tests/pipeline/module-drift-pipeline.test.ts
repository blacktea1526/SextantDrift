import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { executeModuleDriftPipeline, clearAllAnalysisCaches } from '../../src/pipeline/module-drift-pipeline.js';

describe('ModuleDriftPipeline (模块漂移阶段管道)', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/clean-layered-app');

  it('should execute end-to-end analysis on clean-layered-app and return clean DriftReport', async () => {
    clearAllAnalysisCaches();
    const report = await executeModuleDriftPipeline({
      rootDir: fixtureDir,
      specPath: 'sextant.json',
    });

    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.summary.totalFiles).toBeGreaterThan(0);
    expect(report.violations.length).toBe(0);
    expect(report.durationMs).toBeGreaterThan(0);
    expect(report.graphData).toBeDefined();
    expect(report.actualMermaid).toContain('flowchart TD');
  });

  it('should clear caches without error', () => {
    expect(() => clearAllAnalysisCaches()).not.toThrow();
  });
});
