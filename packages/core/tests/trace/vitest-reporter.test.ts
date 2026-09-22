import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  SextantVitestReporter,
  getGlobalTraceRecorder,
  resetGlobalTraceRecorder,
  withTraceSpan,
  recordTraceCall,
  flushTraceToFile,
} from '../../src/trace/index.js';
import { parseSequenceDiagram } from '../../src/causality/sequence-parser.js';
import { diffCausality } from '../../src/causality/differencer.js';
import type { ExecutionTrace } from '../../src/trace/types.js';

describe('SextantVitestReporter & Dynamic Trace Automation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-trace-test-'));
    resetGlobalTraceRecorder('test-run-suite');
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should maintain global singleton recorder across invocations', async () => {
    const r1 = getGlobalTraceRecorder();
    expect(r1.traceId).toBe('test-run-suite');

    await withTraceSpan('OrderService', 'placeOrder', async () => {
      recordTraceCall('OrderService', 'PaymentGateway', 'charge', 5);
    });

    const spans = r1.spans;
    expect(spans).toHaveLength(2);
    expect(spans[0].callee).toBe('OrderService');
    expect(spans[1].callee).toBe('PaymentGateway');
    expect(spans[1].caller).toBe('OrderService');
  });

  it('should reset global recorder when requested', () => {
    recordTraceCall('Client', 'ApiGateway', 'route');
    expect(getGlobalTraceRecorder().spans).toHaveLength(1);

    const r2 = resetGlobalTraceRecorder('fresh-trace-id');
    expect(r2.traceId).toBe('fresh-trace-id');
    expect(r2.spans).toHaveLength(0);
  });

  it('should flush recorded trace to file and create missing parent directories', () => {
    recordTraceCall('Controller', 'Service', 'process');
    const targetFile = path.join(tmpDir, 'nested', 'subdir', 'trace.json');

    const writtenPath = flushTraceToFile(targetFile);
    expect(writtenPath).toBe(targetFile);
    expect(fs.existsSync(targetFile)).toBe(true);

    const content = JSON.parse(fs.readFileSync(targetFile, 'utf-8')) as ExecutionTrace;
    expect(content.version).toBe('1.0.0');
    expect(content.traceId).toBe('test-run-suite');
    expect(content.spans).toHaveLength(1);
    expect(content.spans[0].callee).toBe('Service');
  });

  it('should execute full SextantVitestReporter lifecycle and capture test trace', () => {
    const targetFile = path.join(tmpDir, '.sextant', 'trace.json');
    const reporter = new SextantVitestReporter({
      outputPath: targetFile,
      traceId: 'reporter-lifecycle-trace',
      silent: true,
      autoFlush: true,
    });

    reporter.onInit();
    expect(getGlobalTraceRecorder().traceId).toBe('reporter-lifecycle-trace');

    // Simulate test execution recording
    recordTraceCall('UserApi', 'AuthService', 'verifyToken');
    recordTraceCall('AuthService', 'UserRepo', 'findById');

    reporter.onFinished();

    expect(fs.existsSync(targetFile)).toBe(true);
    const trace = JSON.parse(fs.readFileSync(targetFile, 'utf-8')) as ExecutionTrace;
    expect(trace.spans).toHaveLength(2);
    expect(trace.spans[0].callee).toBe('AuthService');
    expect(trace.spans[1].callee).toBe('UserRepo');
  });

  it('should seamlessly feed into causality differencer for architectural gate', () => {
    const targetFile = path.join(tmpDir, 'trace.json');
    const reporter = new SextantVitestReporter({
      outputPath: targetFile,
      traceId: 'trace-verified',
      silent: true,
    });

    reporter.onInit();

    // Order: Controller -> Service -> Repo
    recordTraceCall('OrderController', 'OrderService', 'createOrder', 2);
    recordTraceCall('OrderService', 'OrderRepo', 'save', 2);

    reporter.onFinished();

    const traceData = JSON.parse(fs.readFileSync(targetFile, 'utf-8')) as ExecutionTrace;
    const mermaid = `
sequenceDiagram
    OrderController->>OrderService: createOrder
    OrderService->>OrderRepo: save
`;
    const spec = parseSequenceDiagram(mermaid, 'architecture.md');
    const drifts = diffCausality([spec], traceData);

    // Should have 0 architectural causality drifts
    expect(drifts).toHaveLength(0);
  });
});
