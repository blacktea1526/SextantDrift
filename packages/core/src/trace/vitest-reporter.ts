/**
 * SextantDrift Phase 5: Automated Dynamic Trace Test Reporter & Setup Hook
 * 零第三方依赖、基于鸭子类型的 Vitest / Jest 即插即用测试时序录制器
 */

import fs from 'node:fs';
import path from 'node:path';
import { TraceRecorder } from './recorder.js';
import type { TraceSpan, ExecutionTrace } from './types.js';

export interface TraceReporterOptions {
  /**
   * Destination path for exported trace JSON.
   * Default: '.sextant/trace.json'
   */
  outputPath?: string;
  /**
   * Optional custom trace ID.
   */
  traceId?: string;
  /**
   * Suppress console notices.
   */
  silent?: boolean;
  /**
   * Whether to automatically flush trace upon test suite completion.
   * Default: true
   */
  autoFlush?: boolean;
}

let globalRecorder: TraceRecorder | null = null;

/**
 * Retrieves the global TraceRecorder singleton for test instrumentation.
 */
export function getGlobalTraceRecorder(traceId?: string): TraceRecorder {
  if (!globalRecorder) {
    globalRecorder = new TraceRecorder(traceId);
  }
  return globalRecorder;
}

/**
 * Resets or replaces the global TraceRecorder singleton.
 */
export function resetGlobalTraceRecorder(traceId?: string): TraceRecorder {
  globalRecorder = new TraceRecorder(traceId);
  return globalRecorder;
}

/**
 * Convenient wrapper to record an execution span using the global recorder.
 */
export async function withTraceSpan<T>(
  callee: string,
  action: string,
  fn: (span: TraceSpan) => Promise<T> | T,
  metadata?: Record<string, unknown>
): Promise<T> {
  const recorder = getGlobalTraceRecorder();
  return recorder.withSpan(callee, action, fn, metadata);
}

/**
 * Quick manual invocation event logger for synchronous or point-in-time calls.
 */
export function recordTraceCall(
  caller: string,
  callee: string,
  action: string,
  durationMs = 1,
  status: 'ok' | 'error' = 'ok',
  errorMessage?: string,
  metadata?: Record<string, unknown>
): TraceSpan {
  const recorder = getGlobalTraceRecorder();
  const startTime = performance.now();
  const span = recorder.startSpan(callee, action, metadata);
  span.caller = caller;
  span.startTime = startTime;
  span.endTime = startTime + durationMs;
  recorder.endSpan(span.spanId, status, errorMessage);
  return span;
}

/**
 * Flushes recorded spans to a JSON trace file.
 */
export function flushTraceToFile(
  outputPath = '.sextant/trace.json',
  recorder?: TraceRecorder
): string {
  const targetRecorder = recorder || getGlobalTraceRecorder();
  const trace = targetRecorder.exportTrace();
  const resolvedPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.resolve(process.cwd(), outputPath);

  const parentDir = path.dirname(resolvedPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(resolvedPath, JSON.stringify(trace, null, 2), 'utf-8');
  return resolvedPath;
}

/**
 * Vitest / Jest Compatible Test Reporter.
 * Hooks into test runner lifecycle to seamlessly serialize runtime traces.
 */
export class SextantVitestReporter {
  private readonly options: Required<TraceReporterOptions>;

  constructor(options: TraceReporterOptions = {}) {
    this.options = {
      outputPath: options.outputPath || '.sextant/trace.json',
      traceId: options.traceId || `test-run-${Date.now()}`,
      silent: options.silent ?? false,
      autoFlush: options.autoFlush ?? true,
    };
  }

  /**
   * Vitest hook invoked on runner initialization.
   */
  onInit(): void {
    resetGlobalTraceRecorder(this.options.traceId);
  }

  /**
   * Vitest hook invoked when all test suites finish.
   */
  onFinished(): void {
    if (!this.options.autoFlush) return;

    const recorder = getGlobalTraceRecorder();
    if (recorder.spans.length === 0) {
      return;
    }

    try {
      const savedPath = flushTraceToFile(this.options.outputPath, recorder);
      if (!this.options.silent) {
        console.log(
          `[SextantDrift] Captured ${recorder.spans.length} dynamic execution span(s) -> ${savedPath}`
        );
      }
    } catch (err) {
      if (!this.options.silent) {
        console.error(`[SextantDrift] Failed to flush test trace:`, err);
      }
    }
  }
}
