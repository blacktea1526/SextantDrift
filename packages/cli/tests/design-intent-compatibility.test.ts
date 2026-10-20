import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as cli from '../src/index.js';
import { formatJsonReport } from '../src/formatters/json.js';
import { runCheck } from '../src/commands/check.js';
import {
  EXIT_CODE_DRIFT_DETECTED,
  EXIT_CODE_FATAL_ERROR,
  EXIT_CODE_SUCCESS,
} from '../src/utils/exit.js';
import type { DriftReport } from '@sextant/core';

describe('design intent R2 CLI compatibility seams', () => {
  const cleanFixture = path.resolve(__dirname, '../../core/tests/fixtures/clean-layered-app');
  const driftedFixture = path.resolve(__dirname, '../../core/tests/fixtures/drifted-bypass-app');

  let tempDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-r2-cli-compat-'));
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function copyFixture(name: string, fixturePath: string): string {
    const target = path.join(tempDir, name);
    fs.cpSync(fixturePath, target, { recursive: true });
    return target;
  }

  function readJsonLog(): any {
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    return JSON.parse(String(consoleLogSpy.mock.calls[0][0]));
  }

  function readJsonError(): any {
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    return JSON.parse(String(consoleErrorSpy.mock.calls[0][0]));
  }

  it('keeps the R2 public CLI seams exported', () => {
    expect(cli.runCheck).toBe(runCheck);
    expect(cli.formatJsonReport).toBe(formatJsonReport);
    expect(cli.EXIT_CODE_SUCCESS).toBe(EXIT_CODE_SUCCESS);
    expect(cli.EXIT_CODE_DRIFT_DETECTED).toBe(EXIT_CODE_DRIFT_DETECTED);
    expect(cli.EXIT_CODE_FATAL_ERROR).toBe(EXIT_CODE_FATAL_ERROR);
    expect(cli.CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('keeps clean check JSON shape and success exit code stable', async () => {
    const projectDir = copyFixture('clean-layered-app', cleanFixture);

    const exitCode = await runCheck(projectDir, { json: true });

    expect(exitCode).toBe(EXIT_CODE_SUCCESS);
    const report = readJsonLog();
    expect(Object.keys(report)).toEqual(expect.arrayContaining([
      'passed',
      'exitCode',
      'summary',
      'violations',
      'exemptions',
      'targetArchitecture',
      'graphData',
      'hasUnresolvedImports',
      'hasPartialBarrels',
      'actualMermaid',
      'unifiedMermaid',
      'durationMs',
    ]));
    for (const requiredField of [
      'passed',
      'exitCode',
      'summary',
      'violations',
      'exemptions',
      'targetArchitecture',
      'graphData',
      'durationMs',
    ]) {
      expect(report).toHaveProperty(requiredField);
    }
    expect(report).toEqual(
      expect.objectContaining({
        passed: true,
        exitCode: 0,
        violations: [],
        exemptions: [],
      })
    );
    expect(report.summary).toEqual(
      expect.objectContaining({
        totalFiles: 4,
        totalViolations: 0,
        exemptedViolations: 0,
        newViolations: 0,
        bypassCount: 0,
        inversionCount: 0,
        cycleCount: 0,
        forbiddenImportCount: 0,
        invariantViolationCount: 0,
      })
    );
    expect(typeof report.durationMs).toBe('number');
  });

  it('keeps architecture drift JSON shape and drift exit code stable', async () => {
    const projectDir = copyFixture('drifted-bypass-app', driftedFixture);

    const exitCode = await runCheck(projectDir, { json: true });

    expect(exitCode).toBe(EXIT_CODE_DRIFT_DETECTED);
    const report = readJsonLog();
    expect(report.passed).toBe(false);
    expect(report.exitCode).toBe(1);
    expect(report.summary).toEqual(
      expect.objectContaining({
        totalFiles: 4,
        totalViolations: 5,
        exemptedViolations: 0,
        newViolations: 5,
        bypassCount: 1,
        inversionCount: 1,
        cycleCount: 1,
        forbiddenImportCount: 1,
        invariantViolationCount: 1,
      })
    );
    expect(report.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CRITICAL_BYPASS',
          severity: 'critical',
          sourceComponent: 'Controller',
          targetComponent: 'Repo',
          sourceFile: 'src/controllers/user.controller.ts',
        }),
        expect.objectContaining({
          type: 'CRITICAL_FORBIDDEN_IMPORT',
          severity: 'critical',
          sourceFile: 'src/controllers/user.controller.ts',
        }),
        expect.objectContaining({
          type: 'INVARIANT_BROKEN',
          severity: 'critical',
          ruleId: 'AUTH_BEFORE_REPO_ACCESS',
          sourceFile: 'src/controllers/user.controller.ts',
        }),
      ])
    );
    expect(report.violations.every((v: any) => typeof v.fingerprint === 'string')).toBe(true);
  });

  it('keeps baseline exemptions as success while preserving JSON exemption fields', async () => {
    const projectDir = copyFixture('drifted-with-baseline', driftedFixture);
    const firstExitCode = await runCheck(projectDir, { json: true });
    expect(firstExitCode).toBe(EXIT_CODE_DRIFT_DETECTED);
    const initialReport = readJsonLog();
    const baselinePath = path.join(tempDir, 'baseline.json');

    fs.writeFileSync(
      baselinePath,
      JSON.stringify(
        {
          version: '1.0.0',
          generatedAt: '2026-10-07T00:00:00.000Z',
          totalExemptions: initialReport.violations.length,
          fingerprints: initialReport.violations.map((violation: any) => ({
            hash: violation.fingerprint,
            type: violation.type,
            sourceComponent: violation.sourceComponent,
            targetComponent: violation.targetComponent,
            sourceFile: violation.sourceFile,
            ruleId: violation.ruleId,
            description: violation.message,
          })),
        },
        null,
        2
      ),
      'utf-8'
    );

    consoleLogSpy.mockClear();
    const exitCode = await runCheck(projectDir, { baseline: baselinePath, json: true });

    expect(exitCode).toBe(EXIT_CODE_SUCCESS);
    const report = readJsonLog();
    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);
    expect(report.violations).toEqual([]);
    expect(report.exemptions).toHaveLength(5);
    expect(report.summary).toEqual(
      expect.objectContaining({
        totalViolations: 5,
        exemptedViolations: 5,
        newViolations: 0,
        bypassCount: 1,
        inversionCount: 1,
        cycleCount: 1,
        forbiddenImportCount: 1,
        invariantViolationCount: 1,
      })
    );
    expect(report.exemptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'CRITICAL_BYPASS' }),
        expect.objectContaining({ type: 'CRITICAL_FORBIDDEN_IMPORT' }),
        expect.objectContaining({ type: 'INVARIANT_BROKEN' }),
      ])
    );
  });

  it('keeps explicit missing config and explicit trace failures mapped to fatal exit code 2', async () => {
    const projectDir = copyFixture('clean-for-errors', cleanFixture);

    const missingConfigCode = await runCheck(projectDir, {
      config: 'missing-sextant.json',
      json: true,
    });
    expect(missingConfigCode).toBe(EXIT_CODE_FATAL_ERROR);
    expect(readJsonError().error).toContain('Custom architecture spec not found');

    consoleErrorSpy.mockClear();
    const missingTraceCode = await runCheck(projectDir, {
      trace: 'missing-trace.json',
      json: true,
    });
    expect(missingTraceCode).toBe(EXIT_CODE_FATAL_ERROR);
    expect(readJsonError().error).toContain('Runtime trace file not found');

    consoleErrorSpy.mockClear();
    const malformedTracePath = path.join(tempDir, 'bad-trace.json');
    fs.writeFileSync(malformedTracePath, '{ "traceId": ', 'utf-8');
    const malformedTraceCode = await runCheck(projectDir, {
      trace: malformedTracePath,
      json: true,
    });
    expect(malformedTraceCode).toBe(EXIT_CODE_FATAL_ERROR);
    expect(readJsonError().error).toContain('Malformed runtime trace file');
  });

  it('keeps formatJsonReport as a direct DriftReport JSON serializer', () => {
    const report: DriftReport = {
      passed: true,
      exitCode: 0,
      summary: {
        totalFiles: 1,
        totalDependencies: 0,
        totalViolations: 0,
        exemptedViolations: 0,
        newViolations: 0,
        bypassCount: 0,
        inversionCount: 0,
        cycleCount: 0,
        forbiddenImportCount: 0,
        invariantViolationCount: 0,
      },
      violations: [],
      exemptions: [],
      targetArchitecture: {
        name: 'compat-report',
        layers: [{ id: 'Core', name: 'Core', order: 1 }],
        components: [{ id: 'Engine', name: 'Engine', layerId: 'Core', paths: ['src/**'] }],
        allowDependencies: [],
      },
      graphData: {
        containers: [],
        nodes: [],
        edges: [],
        targetEdges: [],
        actualEdges: [],
      },
      durationMs: 12.34,
    };

    expect(JSON.parse(formatJsonReport(report))).toEqual(report);
  });
});
