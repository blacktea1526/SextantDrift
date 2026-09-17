import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runInit } from '../src/commands/init.js';
import { EXIT_CODE_SUCCESS } from '../src/utils/exit.js';

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
    expect(archMd).toContain('```mermaid');
    expect(archMd).toContain('flowchart TD');
    expect(archMd).toContain('subgraph presentation');
    expect(archMd).toContain('subgraph domain');
    expect(archMd).toContain('subgraph infrastructure');
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
});
