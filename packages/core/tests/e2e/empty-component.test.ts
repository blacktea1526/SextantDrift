import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { analyzeModuleDrift } from '../../src/index.js';
import { ConfigValidationError } from '../../src/errors/config-error.js';

describe('Empty Component Handling (--allow-empty & WARN_EMPTY_COMPONENT)', () => {
  const tmpDir = path.join(os.tmpdir(), `sextant-empty-comp-${Date.now()}`);
  const specPath = path.join(tmpDir, 'sextant.json');

  beforeAll(() => {
    fs.mkdirSync(path.join(tmpDir, 'src/controllers'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'src/services'), { recursive: true });
    // Write valid minimal files
    fs.writeFileSync(
      path.join(tmpDir, 'src/controllers/user.controller.ts'),
      "import { UserService } from '../services/user.service.js';\nexport class UserController {}\n",
      'utf-8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src/services/user.service.ts'),
      'export class UserService {}\n',
      'utf-8'
    );

    // Architecture spec with an empty component 'PendingStateEngine' matching 'src/state/**' (which doesn't exist)
    const spec = {
      name: 'EmptyCompTest',
      layers: [
        { id: 'presentation', name: 'Presentation Layer', order: 1 },
        { id: 'domain', name: 'Domain Layer', order: 2 },
      ],
      components: [
        {
          id: 'Controllers',
          name: 'Controllers',
          layerId: 'presentation',
          paths: ['src/controllers/**'],
        },
        {
          id: 'Services',
          name: 'Services',
          layerId: 'domain',
          paths: ['src/services/**'],
        },
        {
          id: 'PendingStateEngine',
          name: 'State Engine Pending Implementation',
          layerId: 'domain',
          paths: ['src/state/**'],
        },
      ],
      allowDependencies: [
        { from: 'Controllers', to: 'Services' },
        { from: 'Services', to: 'PendingStateEngine' },
      ],
    };
    fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf-8');
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('should emit WARN_EMPTY_COMPONENT and pass with exitCode 0 by default (allowEmptyComponents: true)', async () => {
    const report = await analyzeModuleDrift({
      rootDir: tmpDir,
      specPath,
    });

    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);

    const emptyViolation = report.violations.find((v) => v.type === 'WARN_EMPTY_COMPONENT');
    expect(emptyViolation).toBeDefined();
    expect(emptyViolation?.severity).toBe('warning');
    expect(emptyViolation?.sourceComponent).toBe('PendingStateEngine');
    expect(emptyViolation?.message).toContain('PendingStateEngine');
    expect(report.summary.emptyComponentCount).toBe(1);
  });

  it('should fail with exitCode 1 in strict mode due to warning', async () => {
    const report = await analyzeModuleDrift({
      rootDir: tmpDir,
      specPath,
      strict: true,
    });

    expect(report.passed).toBe(false);
    expect(report.exitCode).toBe(1);
    expect(report.violations.some((v) => v.type === 'WARN_EMPTY_COMPONENT')).toBe(true);
  });

  it('should throw ConfigValidationError if allowEmptyComponents is explicitly false', async () => {
    await expect(
      analyzeModuleDrift({
        rootDir: tmpDir,
        specPath,
        allowEmptyComponents: false,
      })
    ).rejects.toThrow(ConfigValidationError);
  });
});
