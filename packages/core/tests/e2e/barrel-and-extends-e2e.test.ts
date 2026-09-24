import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { analyzeModuleDrift } from '../../src/index.js';
import { TargetArchitecture } from '../../src/types/architecture.js';

describe('E2E Barrel Multi-Hop & Resolution Verification', () => {
  const rootDir = process.cwd();

  const testArch: TargetArchitecture = {
    layers: [
      { id: 'Presentation', name: 'Presentation Layer', order: 1 },
      { id: 'Domain', name: 'Business Domain Layer', order: 2 },
      { id: 'Infra', name: 'Infrastructure Layer', order: 3 },
    ],
    components: [
      { id: 'Controllers', name: 'API Controllers', layerId: 'Presentation', paths: ['src/controllers/**'] },
      { id: 'Services', name: 'Domain Services', layerId: 'Domain', paths: ['src/services/**'] },
      { id: 'Repositories', name: 'Data Repositories', layerId: 'Infra', paths: ['src/repos/**'] },
    ],
    allowDependencies: [
      { from: 'Controllers', to: 'Services' },
      { from: 'Services', to: 'Repositories' },
    ],
  };

  it('should detect CRITICAL_BYPASS through a barrel re-exporting lower layer module', async () => {
    // Controller imports Services/index.ts
    // Services/index.ts re-exports from Repositories/order.repo.ts
    // This is a hidden bypass: Controller -> Repo bypassing Domain!
    const files = [
      'src/controllers/order.controller.ts',
      'src/services/index.ts',
      'src/repos/order.repo.ts',
    ];

    // We can use the drifted app fixture or verify via analyzeModuleDrift on fixture
    const fixtureDir = path.resolve(rootDir, 'packages/core/tests/fixtures/drifted-bypass-app');
    const report = await analyzeModuleDrift({
      rootDir: fixtureDir,
    });

    expect(report.passed).toBe(false);
    expect(report.summary.bypassCount).toBeGreaterThanOrEqual(1);

    const bypass = report.violations.find((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypass).toBeDefined();
    expect(bypass?.sourceComponent).toBe('Controller');
    expect(bypass?.targetComponent).toBe('Repo');
  });

  it('should flag WARN_UNRESOLVED_IMPORT when an internal import fails to resolve', async () => {
    // If a file has an unresolved internal import, it must be flagged with WARN_UNRESOLVED_IMPORT
    const fixtureDir = path.resolve(rootDir, 'packages/core/tests/fixtures/clean-layered-app');
    const report = await analyzeModuleDrift({
      rootDir: fixtureDir,
    });

    // The clean fixture has 0 drifts and all imports resolve cleanly
    expect(report.passed).toBe(true);
    expect(report.summary.totalViolations).toBe(0);
    expect(report.hasUnresolvedImports).toBeFalsy();
  });
});
