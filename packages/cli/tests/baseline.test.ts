import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runBaseline } from '../src/commands/baseline.js';
import { runCheck } from '../src/commands/check.js';
import { EXIT_CODE_SUCCESS } from '../src/utils/exit.js';

describe('CLI baseline Command & Exemption Flow (Task 4.4)', () => {
  const driftedAppPath = path.resolve(__dirname, '../../core/tests/fixtures/drifted-bypass-app');
  let tmpBaselineDir: string;
  let tmpBaselineFile: string;

  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    tmpBaselineDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-cli-baseline-'));
    tmpBaselineFile = path.join(tmpBaselineDir, 'baseline.json');
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fs.rmSync(tmpBaselineDir, { recursive: true, force: true });
  });

  it('should snapshot violations into baseline and then pass check command with Exit Code 0', async () => {
    // 1. Run baseline on drifted app
    const baselineCode = await runBaseline(driftedAppPath, { output: tmpBaselineFile });
    expect(baselineCode).toBe(EXIT_CODE_SUCCESS);
    expect(fs.existsSync(tmpBaselineFile)).toBe(true);

    const baselineContent = JSON.parse(fs.readFileSync(tmpBaselineFile, 'utf-8'));
    expect(baselineContent.totalExemptions).toBeGreaterThanOrEqual(1);

    // 2. Run check referencing this baseline
    const checkCode = await runCheck(driftedAppPath, { baseline: tmpBaselineFile });
    expect(checkCode).toBe(EXIT_CODE_SUCCESS);

    const logged = consoleLogSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
    expect(logged).toContain('✔ Clean: 0 architectural drifts detected');
    expect(logged).toContain('historical debt');
  });
});
