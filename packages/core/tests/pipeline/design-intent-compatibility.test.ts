import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeModuleDrift,
  executeModuleDriftPipeline,
  clearAllAnalysisCaches,
  saveBaseline,
  loadBaseline,
  DEFAULT_BASELINE_FILENAME,
  ConfigValidationError,
  ConfigSyntaxError,
  TraceRecorder,
  withTraceSpan,
  getGlobalTraceRecorder,
  resetGlobalTraceRecorder,
  type DriftReport,
} from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('design intent R2 core compatibility seams', () => {
  const cleanFixture = path.resolve(__dirname, '../fixtures/clean-layered-app');
  const driftedFixture = path.resolve(__dirname, '../fixtures/drifted-bypass-app');

  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-r2-core-compat-'));
    clearAllAnalysisCaches();
  });

  afterEach(() => {
    clearAllAnalysisCaches();
    resetGlobalTraceRecorder();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function copyFixture(name: string, fixtureSource: string): string {
    const targetDir = path.join(tempDir, name);
    fs.cpSync(fixtureSource, targetDir, { recursive: true });
    return targetDir;
  }

  it('preserves clean DriftReport shape and literal counts on clean-layered-app', async () => {
    const report: DriftReport = await analyzeModuleDrift({
      rootDir: cleanFixture,
    });

    // 1. Top-level status & exit code
    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);

    // 2. Stable report fields existence
    expect(Object.keys(report)).toEqual(
      expect.arrayContaining([
        'actualMermaid',
        'durationMs',
        'exitCode',
        'exemptions',
        'graphData',
        'hasPartialBarrels',
        'hasUnresolvedImports',
        'passed',
        'summary',
        'targetArchitecture',
        'unifiedMermaid',
        'violations',
      ])
    );

    // 3. Literal summary counts for known clean-layered-app (4 source files, 3 dependencies)
    expect(report.summary).toEqual(
      expect.objectContaining({
        totalFiles: 4,
        totalDependencies: 3,
        totalViolations: 0,
        exemptedViolations: 0,
        newViolations: 0,
        bypassCount: 0,
        inversionCount: 0,
        cycleCount: 0,
        forbiddenImportCount: 0,
        invariantViolationCount: 0,
        unresolvedImportCount: 0,
        partialBarrelCount: 0,
        emptyComponentCount: 0,
      })
    );

    // 4. Violations and exemptions must be empty arrays
    expect(report.violations).toEqual([]);
    expect(report.exemptions).toEqual([]);

    // 5. Target architecture retains declared layers and components
    expect(report.targetArchitecture.name).toBe('clean-layered-app');
    expect(report.targetArchitecture.layers).toHaveLength(3);
    expect(report.targetArchitecture.components).toHaveLength(3);
    expect(report.targetArchitecture.invariants).toHaveLength(3);

    // 6. C4 graph data and Mermaid backward compatibility exports
    expect(report.graphData.nodes).toHaveLength(3);
    expect(report.graphData.edges).toHaveLength(2);
    expect(report.graphData.containers).toHaveLength(3);
    expect(report.actualMermaid).toContain('flowchart TD');
    expect(report.actualMermaid).not.toContain('DRIFT!');
    expect(report.unifiedMermaid).toContain('flowchart TD');
    expect(typeof report.durationMs).toBe('number');
  });

  it('detects all 5 violation types with source location and fingerprints on drifted-bypass-app', async () => {
    const report: DriftReport = await analyzeModuleDrift({
      rootDir: driftedFixture,
    });

    // 1. Negative status and exit code
    expect(report.passed).toBe(false);
    expect(report.exitCode).toBe(1);

    // 2. Summary exact counts
    expect(report.summary).toEqual(
      expect.objectContaining({
        totalFiles: 4,
        totalViolations: 5,
        newViolations: 5,
        exemptedViolations: 0,
        bypassCount: 1,
        inversionCount: 1,
        cycleCount: 1,
        forbiddenImportCount: 1,
        invariantViolationCount: 1,
      })
    );
    expect(report.violations).toHaveLength(5);

    // 3. CRITICAL_BYPASS
    const bypass = report.violations.find((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypass).toBeDefined();
    expect(bypass?.severity).toBe('critical');
    expect(bypass?.sourceComponent).toBe('Controller');
    expect(bypass?.targetComponent).toBe('Repo');
    expect(bypass?.sourceFile).toContain('src/controllers/user.controller.ts');
    expect(bypass?.line).toBe(2);
    expect(typeof bypass?.fingerprint).toBe('string');
    expect(bypass?.fingerprint?.length).toBeGreaterThan(0);

    // 4. CRITICAL_INVERSION
    const inversion = report.violations.find((v) => v.type === 'CRITICAL_INVERSION');
    expect(inversion).toBeDefined();
    expect(inversion?.severity).toBe('critical');
    expect(inversion?.sourceComponent).toBe('ServiceB');
    expect(inversion?.targetComponent).toBe('Controller');
    expect(inversion?.sourceFile).toContain('src/services/service-b/index.ts');
    expect(inversion?.line).toBe(2);
    expect(typeof inversion?.fingerprint).toBe('string');
    expect(inversion?.fingerprint?.length).toBeGreaterThan(0);

    // 5. CRITICAL_CYCLE
    const cycle = report.violations.find((v) => v.type === 'CRITICAL_CYCLE');
    expect(cycle).toBeDefined();
    expect(cycle?.severity).toBe('critical');
    expect(cycle?.cycle).toEqual(expect.arrayContaining(['ServiceA', 'ServiceB']));
    expect(cycle?.sourceFile).toContain('src/services/service-b/index.ts');
    expect(cycle?.line).toBe(1);
    expect(typeof cycle?.fingerprint).toBe('string');
    expect(cycle?.fingerprint?.length).toBeGreaterThan(0);

    // 6. CRITICAL_FORBIDDEN_IMPORT
    const forbidden = report.violations.find((v) => v.type === 'CRITICAL_FORBIDDEN_IMPORT');
    expect(forbidden).toBeDefined();
    expect(forbidden?.severity).toBe('critical');
    expect(forbidden?.sourceComponent).toBe('Controller');
    expect(forbidden?.sourceFile).toContain('src/controllers/user.controller.ts');
    expect(forbidden?.line).toBe(1);
    expect(forbidden?.snippet).toContain('@prisma/client');
    expect(typeof forbidden?.fingerprint).toBe('string');
    expect(forbidden?.fingerprint?.length).toBeGreaterThan(0);

    // 7. INVARIANT_BROKEN
    const invariant = report.violations.find((v) => v.type === 'INVARIANT_BROKEN');
    expect(invariant).toBeDefined();
    expect(invariant?.severity).toBe('critical');
    expect(invariant?.ruleId).toBe('AUTH_BEFORE_REPO_ACCESS');
    expect(invariant?.sourceFile).toContain('src/controllers/user.controller.ts');
    expect(invariant?.line).toBe(9);
    expect(invariant?.snippet).toContain('return this.repo.findUser();');
    expect(typeof invariant?.fingerprint).toBe('string');
    expect(invariant?.fingerprint?.length).toBeGreaterThan(0);
  });

  it('integrates baseline in an isolated temporary directory to exempt violations and yield exit 0', async () => {
    // 1. Copy fixture to isolated temp directory (never mutate shared fixtures)
    const projectDir = copyFixture('drifted-baseline-app', driftedFixture);

    // 2. Initial analysis detects all 5 structural drifts
    const initialReport = await analyzeModuleDrift({ rootDir: projectDir });
    expect(initialReport.passed).toBe(false);
    expect(initialReport.exitCode).toBe(1);
    expect(initialReport.violations).toHaveLength(5);

    // 3. Save baseline to standard default path (.sextant/baseline.json) using public saveBaseline
    const baselineFile = path.join(projectDir, DEFAULT_BASELINE_FILENAME);
    const savedBaseline = saveBaseline(baselineFile, initialReport.violations);
    expect(savedBaseline.totalExemptions).toBe(5);
    expect(savedBaseline.fingerprints).toHaveLength(5);
    expect(fs.existsSync(baselineFile)).toBe(true);

    // 4. Verify baseline file can be reloaded by loadBaseline
    const loadedBaseline = loadBaseline(baselineFile);
    expect(loadedBaseline).not.toBeNull();
    expect(loadedBaseline?.totalExemptions).toBe(5);

    // 5. Next analysis auto-discovers baseline and passes with exitCode 0
    const subsequentReport = await analyzeModuleDrift({ rootDir: projectDir });
    expect(subsequentReport.passed).toBe(true);
    expect(subsequentReport.exitCode).toBe(0);
    expect(subsequentReport.violations).toEqual([]);
    expect(subsequentReport.exemptions).toHaveLength(5);
    expect(subsequentReport.summary).toEqual(
      expect.objectContaining({
        totalFiles: 4,
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

    // 6. Each exemption retains legacy violation structure and fingerprints
    expect(subsequentReport.exemptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'CRITICAL_BYPASS' }),
        expect.objectContaining({ type: 'CRITICAL_INVERSION' }),
        expect.objectContaining({ type: 'CRITICAL_CYCLE' }),
        expect.objectContaining({ type: 'CRITICAL_FORBIDDEN_IMPORT' }),
        expect.objectContaining({ type: 'INVARIANT_BROKEN' }),
      ])
    );
  });

  it('enforces trace error handling: throws on explicit missing/corrupt trace, swallows corrupt default trace', async () => {
    const projectDir = copyFixture('clean-trace-tests', cleanFixture);

    // 1. Explicit tracePath that does not exist throws ConfigValidationError
    await expect(
      analyzeModuleDrift({
        rootDir: projectDir,
        tracePath: 'missing-trace.json',
      })
    ).rejects.toThrow(ConfigValidationError);

    await expect(
      analyzeModuleDrift({
        rootDir: projectDir,
        tracePath: 'missing-trace.json',
      })
    ).rejects.toThrow(/Runtime trace file not found at:/);

    // 2. Explicit tracePath with corrupt JSON throws ConfigSyntaxError
    const corruptExplicitTrace = path.join(tempDir, 'corrupt-trace.json');
    fs.writeFileSync(corruptExplicitTrace, '{ "traceId": "broken", incomplete ', 'utf-8');

    await expect(
      analyzeModuleDrift({
        rootDir: projectDir,
        tracePath: corruptExplicitTrace,
      })
    ).rejects.toThrow(ConfigSyntaxError);

    await expect(
      analyzeModuleDrift({
        rootDir: projectDir,
        tracePath: corruptExplicitTrace,
      })
    ).rejects.toThrow(/Malformed runtime trace file at/);

    // 3. Optional default .sextant/trace.json that is corrupt is safely ignored (legacy compatibility behavior)
    const defaultTraceDir = path.join(projectDir, '.sextant');
    fs.mkdirSync(defaultTraceDir, { recursive: true });
    const defaultTraceFile = path.join(defaultTraceDir, 'trace.json');
    fs.writeFileSync(defaultTraceFile, 'INVALID_NOT_JSON', 'utf-8');

    const defaultReport = await analyzeModuleDrift({
      rootDir: projectDir,
    });
    expect(defaultReport.passed).toBe(true);
    expect(defaultReport.exitCode).toBe(0);
    expect(defaultReport.violations).toHaveLength(0);
  });

  it('preserves public analysis entrypoints and legacy trace helper utilities', async () => {
    // 1. Both analyzeModuleDrift and executeModuleDriftPipeline are callable and return DriftReport
    expect(typeof analyzeModuleDrift).toBe('function');
    expect(typeof executeModuleDriftPipeline).toBe('function');

    const report = await executeModuleDriftPipeline({ rootDir: cleanFixture });
    expect(report.passed).toBe(true);
    expect(report.exitCode).toBe(0);

    // 2. clearAllAnalysisCaches executes cleanly
    expect(typeof clearAllAnalysisCaches).toBe('function');
    expect(() => clearAllAnalysisCaches()).not.toThrow();

    // 3. TraceRecorder lifecycle and export
    const customTrace = new TraceRecorder('compat-trace-id');
    expect(customTrace.traceId).toBe('compat-trace-id');

    const span = customTrace.startSpan('OrderService', 'placeOrder', { orderId: 'ord-101' });
    expect(span.caller).toBe('Entry');
    expect(span.callee).toBe('OrderService');
    expect(span.action).toBe('placeOrder');
    expect(span.status).toBe('ok');

    customTrace.endSpan(span.spanId, 'ok');
    const exported = customTrace.exportTrace();
    expect(exported.traceId).toBe('compat-trace-id');
    expect(exported.spans).toHaveLength(1);
    expect(exported.spans[0]?.spanId).toBe(span.spanId);

    customTrace.clear();
    expect(customTrace.spans).toHaveLength(0);

    // 4. Global recorder & withTraceSpan helper
    resetGlobalTraceRecorder('global-trace-compat');
    const globalRec = getGlobalTraceRecorder();
    expect(globalRec.traceId).toBe('global-trace-compat');

    const spanResult = await withTraceSpan('PaymentGateway', 'charge', async (activeSpan) => {
      expect(activeSpan.callee).toBe('PaymentGateway');
      expect(activeSpan.action).toBe('charge');
      return { success: true, txnId: 'tx-888' };
    });

    expect(spanResult).toEqual({ success: true, txnId: 'tx-888' });
    expect(globalRec.spans).toHaveLength(1);
    expect(globalRec.spans[0]?.callee).toBe('PaymentGateway');
    expect(globalRec.spans[0]?.action).toBe('charge');
    expect(globalRec.spans[0]?.status).toBe('ok');

    resetGlobalTraceRecorder();
  });
});
