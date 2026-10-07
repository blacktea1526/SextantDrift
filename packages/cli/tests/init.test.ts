import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { analyzeModuleDrift, generateAiFixManifest } from '@sextant/core';
import { runInit } from '../src/commands/init.js';
import { EXIT_CODE_DRIFT_DETECTED, EXIT_CODE_SUCCESS } from '../src/utils/exit.js';

describe('CLI init Command (Task 4.3 Reverse X-Ray)', () => {
  let tmpAppDir: string;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    tmpAppDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-cli-init-'));
    // Setup sample directory structure
    fs.mkdirSync(path.join(tmpAppDir, 'src', 'controllers'), { recursive: true });
    fs.mkdirSync(path.join(tmpAppDir, 'src', 'services'), { recursive: true });
    fs.mkdirSync(path.join(tmpAppDir, 'src', 'repos'), { recursive: true });

    fs.writeFileSync(
      path.join(tmpAppDir, 'src', 'controllers', 'order.ts'),
      'export class OrderController {}'
    );
    fs.writeFileSync(
      path.join(tmpAppDir, 'src', 'services', 'order.ts'),
      'export class OrderService {}'
    );
    fs.writeFileSync(
      path.join(tmpAppDir, 'src', 'repos', 'order.ts'),
      'export class OrderRepo {}'
    );

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fs.rmSync(tmpAppDir, { recursive: true, force: true });
  });

  it('should reverse engineer directory structure and generate sextant.json and ARCHITECTURE.md', async () => {
    const code = await runInit(tmpAppDir);
    expect(code).toBe(EXIT_CODE_SUCCESS);

    const configPath = path.join(tmpAppDir, 'sextant.json');
    const archMdPath = path.join(tmpAppDir, 'ARCHITECTURE.md');

    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(archMdPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.layers).toHaveLength(3);
    expect(config.layers.map((l: any) => l.id)).toEqual(['presentation', 'domain', 'infrastructure']);
    expect(config.components).toHaveLength(3);
    expect(config.allowDependencies).toHaveLength(2);

    const archMd = fs.readFileSync(archMdPath, 'utf-8');
    expect(archMd).not.toContain('flowchart TD');
    expect(archMd).toContain('C4 Architecture Overview');
    expect(archMd).toContain('presentation');
    expect(archMd).toContain('domain');
    expect(archMd).toContain('infrastructure');
  });

  it('should not overwrite existing sextant.json without --force', async () => {
    // First init
    await runInit(tmpAppDir);
    const originalContent = fs.readFileSync(path.join(tmpAppDir, 'sextant.json'), 'utf-8');

    // Second init without force
    const code = await runInit(tmpAppDir);
    expect(code).toBe(EXIT_CODE_SUCCESS);

    const logged = consoleLogSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(logged).toContain('already exists');
  });

  it('without --scaffold-units does not write constraint unit files', async () => {
    await runInit(tmpAppDir);
    expect(fs.existsSync(path.join(tmpAppDir, '.sextant', 'units'))).toBe(false);
  });

  it('with --scaffold-units writes per-layer units and check exits 0', async () => {
    const code = await runInit(tmpAppDir, { scaffoldUnits: true });
    expect(code).toBe(EXIT_CODE_SUCCESS);

    const unitsDir = path.join(tmpAppDir, '.sextant', 'units');
    expect(fs.existsSync(path.join(unitsDir, 'presentation.ts'))).toBe(true);
    expect(fs.existsSync(path.join(unitsDir, 'domain.ts'))).toBe(true);
    expect(fs.existsSync(path.join(unitsDir, 'infrastructure.ts'))).toBe(true);

    const presentation = fs.readFileSync(path.join(unitsDir, 'presentation.ts'), 'utf-8');
    expect(presentation).toContain("from './domain.js'");
    expect(presentation).not.toContain("from './infrastructure");

    const config = JSON.parse(fs.readFileSync(path.join(tmpAppDir, 'sextant.json'), 'utf-8'));
    const unitCompIds = config.components.map((c: { id: string }) => c.id);
    expect(unitCompIds).toContain('UnitPresentation');
    expect(unitCompIds).toContain('UnitDomain');
    expect(unitCompIds).toContain('UnitInfrastructure');
    expect(config.invariants.some((r: { id: string }) => r.id === 'NO_DIRECT_INFRA_IN_UI')).toBe(true);
    expect(config.invariants[0].pattern.in_path).toContain('.sextant/units/presentation.ts');

    const report = await analyzeModuleDrift({ rootDir: tmpAppDir });
    expect(report.exitCode).toBe(EXIT_CODE_SUCCESS);
    expect(report.passed).toBe(true);
  });

  it('with --scaffold-units on cold empty tree writes default three-layer units and check exits 0', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-cli-init-empty-'));
    try {
      const code = await runInit(emptyDir, { scaffoldUnits: true });
      expect(code).toBe(EXIT_CODE_SUCCESS);
      expect(fs.existsSync(path.join(emptyDir, '.sextant', 'units', 'presentation.ts'))).toBe(true);
      expect(fs.existsSync(path.join(emptyDir, '.sextant', 'units', 'domain.ts'))).toBe(true);
      expect(fs.existsSync(path.join(emptyDir, '.sextant', 'units', 'infrastructure.ts'))).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(emptyDir, 'sextant.json'), 'utf-8'));
      // Cold scaffold must not leave an empty AppCore component
      expect(config.components.every((c: { id: string }) => c.id !== 'AppCore')).toBe(true);

      const report = await analyzeModuleDrift({ rootDir: emptyDir });
      expect(report.exitCode).toBe(EXIT_CODE_SUCCESS);
      expect(report.passed).toBe(true);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('illegal import in a unit makes check exit 1 with fix-manifest action', async () => {
    await runInit(tmpAppDir, { scaffoldUnits: true });
    const presentationPath = path.join(tmpAppDir, '.sextant', 'units', 'presentation.ts');
    // Forbidden by generated NO_DIRECT_INFRA_IN_UI invariant (in_path includes presentation unit)
    fs.writeFileSync(
      presentationPath,
      `/** mutated probe — forbidden infra import */
import { PrismaClient } from '@prisma/client';
import { probeDomain } from './domain.js';

export function probePresentation(): string {
  void PrismaClient;
  return probeDomain();
}
`,
      'utf-8'
    );

    const report = await analyzeModuleDrift({ rootDir: tmpAppDir });
    expect(report.exitCode).toBe(EXIT_CODE_DRIFT_DETECTED);
    expect(report.passed).toBe(false);
    expect(report.violations.some((v) => /prisma|forbid|NO_DIRECT/i.test(v.message + v.type))).toBe(
      true
    );

    const manifest = generateAiFixManifest(report.violations);
    expect(manifest).toMatch(/action:/i);
    expect(manifest.length).toBeGreaterThan(20);
  });

  it('force+scaffold recreates missing units but preserves edited bodies without overwrite', async () => {
    await runInit(tmpAppDir, { scaffoldUnits: true });
    const presentationPath = path.join(tmpAppDir, '.sextant', 'units', 'presentation.ts');
    const customBody = `/** user edited */
export function probePresentation(): string { return 'custom'; }
`;
    fs.writeFileSync(presentationPath, customBody, 'utf-8');
    fs.unlinkSync(path.join(tmpAppDir, '.sextant', 'units', 'domain.ts'));

    const code = await runInit(tmpAppDir, { force: true, scaffoldUnits: true });
    expect(code).toBe(EXIT_CODE_SUCCESS);
    expect(fs.readFileSync(presentationPath, 'utf-8')).toBe(customBody);
    expect(fs.existsSync(path.join(tmpAppDir, '.sextant', 'units', 'domain.ts'))).toBe(true);

    const logged = consoleLogSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(logged).toMatch(/skipped|already exists/i);
    expect(logged).toMatch(/written|constraint unit/i);
  });

  it('force+scaffold with overwrite replaces unit bodies', async () => {
    await runInit(tmpAppDir, { scaffoldUnits: true });
    const presentationPath = path.join(tmpAppDir, '.sextant', 'units', 'presentation.ts');
    fs.writeFileSync(presentationPath, 'export const x = 1;\n', 'utf-8');

    await runInit(tmpAppDir, {
      force: true,
      scaffoldUnits: true,
      scaffoldUnitsOverwrite: true,
    });
    const body = fs.readFileSync(presentationPath, 'utf-8');
    expect(body).toContain("from './domain.js'");
    expect(body).not.toBe('export const x = 1;\n');
  });

  it('Python-dominant tree scaffolds .py units and check exits 0', async () => {
    const pyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-cli-init-py-'));
    try {
      fs.mkdirSync(path.join(pyDir, 'src', 'controllers'), { recursive: true });
      fs.mkdirSync(path.join(pyDir, 'src', 'services'), { recursive: true });
      fs.mkdirSync(path.join(pyDir, 'src', 'repos'), { recursive: true });
      fs.writeFileSync(path.join(pyDir, 'src', 'controllers', 'order.py'), 'class OrderController:\n    pass\n');
      fs.writeFileSync(path.join(pyDir, 'src', 'services', 'order.py'), 'class OrderService:\n    pass\n');
      fs.writeFileSync(path.join(pyDir, 'src', 'repos', 'order.py'), 'class OrderRepo:\n    pass\n');
      // Make tree Python-dominant (no .ts)
      fs.writeFileSync(path.join(pyDir, 'pyproject.toml'), '[project]\nname = "demo"\n');

      const code = await runInit(pyDir, { scaffoldUnits: true });
      expect(code).toBe(EXIT_CODE_SUCCESS);
      expect(fs.existsSync(path.join(pyDir, '.sextant', 'units', 'presentation.py'))).toBe(true);
      expect(fs.existsSync(path.join(pyDir, '.sextant', 'units', 'domain.py'))).toBe(true);
      expect(fs.existsSync(path.join(pyDir, '.sextant', 'units', 'infrastructure.py'))).toBe(true);
      expect(fs.existsSync(path.join(pyDir, '.sextant', 'units', 'presentation.ts'))).toBe(false);

      const report = await analyzeModuleDrift({ rootDir: pyDir });
      expect(report.exitCode).toBe(EXIT_CODE_SUCCESS);
      expect(report.passed).toBe(true);
    } finally {
      fs.rmSync(pyDir, { recursive: true, force: true });
    }
  });
});
