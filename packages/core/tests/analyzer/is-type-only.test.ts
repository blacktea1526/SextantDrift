import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { analyzeModuleDrift } from '../../src/index.js';
import { ConfigValidationError } from '../../src/errors/config-error.js';

describe('Type-Only Import Drift Filtering (Zero False Positives)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-type-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function setupTestProject(controllerImportLine: string) {
    const spec = {
      $schema: 'https://sextant-drift.dev/schema/v2.json',
      name: 'type-test-project',
      layers: [
        { id: 'UI', name: 'Presentation Layer', order: 1 },
        { id: 'Domain', name: 'Domain Layer', order: 2 },
        { id: 'Infra', name: 'Infrastructure Layer', order: 3 },
      ],
      components: [
        { id: 'Controller', name: 'UI Controllers', layerId: 'UI', paths: ['src/controllers/**'] },
        { id: 'Service', name: 'Domain Services', layerId: 'Domain', paths: ['src/services/**'] },
        { id: 'Repo', name: 'Data Repos', layerId: 'Infra', paths: ['src/repositories/**'] },
      ],
      allowDependencies: [
        { from: 'Controller', to: 'Service' },
        { from: 'Service', to: 'Repo' },
      ],
    };

    fs.writeFileSync(path.join(tempDir, 'sextant.json'), JSON.stringify(spec, null, 2));

    fs.mkdirSync(path.join(tempDir, 'src/controllers'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src/services'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src/repositories'), { recursive: true });

    // Infra Repo
    fs.writeFileSync(
      path.join(tempDir, 'src/repositories/user.repository.ts'),
      'export interface UserRepository { findById(id: string): any; }\nexport class SqlUserRepo implements UserRepository { findById(id: string) { return null; } }'
    );

    // Domain Service
    fs.writeFileSync(
      path.join(tempDir, 'src/services/user.service.ts'),
      "import { UserRepository } from '../repositories/user.repository.js';\nexport class UserService { constructor(private repo: UserRepository) {} }"
    );

    // UI Controller with specified import
    fs.writeFileSync(
      path.join(tempDir, 'src/controllers/user.controller.ts'),
      `${controllerImportLine}\nimport { UserService } from '../services/user.service.js';\nexport class UserController { constructor(private svc: UserService) {} }`
    );
  }

  it('POSITIVE: should NOT trigger bypass when importing type-only interface (import type)', async () => {
    // Controller -> Repo is a bypass if runtime, but import type has zero runtime dependency!
    setupTestProject("import type { UserRepository } from '../repositories/user.repository.js';");

    const report = await analyzeModuleDrift({
      rootDir: tempDir,
    });

    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);
    const bypassViolations = report.violations.filter((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypassViolations).toHaveLength(0);
  });

  it('NEGATIVE: should trigger CRITICAL_BYPASS when importing concrete class at runtime', async () => {
    setupTestProject("import { SqlUserRepo } from '../repositories/user.repository.js';");

    const report = await analyzeModuleDrift({
      rootDir: tempDir,
    });

    expect(report.passed).toBe(false);
    expect(report.exitCode).toBe(1);
    const bypassViolations = report.violations.filter((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypassViolations.length).toBeGreaterThan(0);
    expect(bypassViolations[0].sourceComponent).toBe('Controller');
    expect(bypassViolations[0].targetComponent).toBe('Repo');
  });

  it('STRICT: should trigger bypass for type-only import when countTypeOnly is explicitly enabled', async () => {
    setupTestProject("import type { UserRepository } from '../repositories/user.repository.js';");

    const report = await analyzeModuleDrift({
      rootDir: tempDir,
      countTypeOnly: true,
    });

    expect(report.passed).toBe(false);
    expect(report.exitCode).toBe(1);
    const bypassViolations = report.violations.filter((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypassViolations.length).toBeGreaterThan(0);
  });

  it('COVERAGE: should throw ConfigValidationError when declared component matches 0 files', async () => {
    setupTestProject("import type { UserRepository } from '../repositories/user.repository.js';");

    // Add a ghost component with a path that matches nothing
    const spec = JSON.parse(fs.readFileSync(path.join(tempDir, 'sextant.json'), 'utf-8'));
    spec.components.push({
      id: 'GhostComponent',
      name: 'Ghost',
      layerId: 'Infra',
      paths: ['src/nonexistent/**'],
    });
    fs.writeFileSync(path.join(tempDir, 'sextant.json'), JSON.stringify(spec, null, 2));

    await expect(
      analyzeModuleDrift({
        rootDir: tempDir,
      })
    ).rejects.toThrow(ConfigValidationError);
  });
});
