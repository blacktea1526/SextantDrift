import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runReport } from '../src/commands/report.js';
import { runCheck } from '../src/commands/check.js';
import { EXIT_CODE_SUCCESS, EXIT_CODE_DRIFT_DETECTED } from '../src/utils/exit.js';

describe('CLI report Command & --report Flag (Task 4.5)', () => {
  const cleanAppPath = path.resolve(__dirname, '../../core/tests/fixtures/clean-layered-app');
  let tmpReportDir: string;
  let tmpReportFile: string;

  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    tmpReportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-cli-report-'));
    tmpReportFile = path.join(tmpReportDir, 'custom-report.html');
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fs.rmSync(tmpReportDir, { recursive: true, force: true });
  });

  it('should generate standalone HTML report using runReport command (defaulting to Chinese)', async () => {
    const code = await runReport(cleanAppPath, { output: tmpReportFile });
    expect(code).toBe(EXIT_CODE_SUCCESS);
    expect(fs.existsSync(tmpReportFile)).toBe(true);

    const html = fs.readFileSync(tmpReportFile, 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('SextantDrift');
    expect(html).toContain('架构差分审查报告');
  });

  it('should support explicit English language in runReport', async () => {
    const code = await runReport(cleanAppPath, { output: tmpReportFile, lang: 'en' });
    expect(code).toBe(EXIT_CODE_SUCCESS);
    const html = fs.readFileSync(tmpReportFile, 'utf-8');
    expect(html).toContain('Architecture Drift Report');
    expect(html).toContain('ARCHITECTURE VERIFIED');
  });

  it('should generate report on-demand when --report is passed to check command', async () => {
    const code = await runCheck(cleanAppPath, { report: tmpReportFile });
    expect(code).toBe(EXIT_CODE_SUCCESS);
    expect(fs.existsSync(tmpReportFile)).toBe(true);
  });
});
