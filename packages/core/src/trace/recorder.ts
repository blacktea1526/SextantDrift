/**
 * SextantDrift Phase 5: Dynamic Trace Recorder
 * 基于 Node.js AsyncLocalStorage 的非侵入式运行时 Trace 录制器
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { TraceSpan, ExecutionTrace, ActiveTraceContext } from './types.js';

export class TraceRecorder {
  private readonly _traceId: string;
  private readonly _spans: TraceSpan[] = [];
  private readonly _storage = new AsyncLocalStorage<ActiveTraceContext>();

  constructor(traceId?: string) {
    this._traceId = traceId || `trace-${randomUUID()}`;
  }

  get traceId(): string {
    return this._traceId;
  }

  get spans(): TraceSpan[] {
    return [...this._spans];
  }

  /**
   * Starts a new span under the currently active trace context (if any).
   */
  startSpan(callee: string, action: string, metadata?: Record<string, unknown>): TraceSpan {
    const parentContext = this._storage.getStore();
    const spanId = `span-${randomUUID().slice(0, 8)}`;
    const caller = parentContext ? parentContext.caller : 'Entry';
    const parentSpanId = parentContext ? parentContext.currentSpanId : undefined;

    const span: TraceSpan = {
      spanId,
      traceId: this._traceId,
      parentSpanId,
      caller,
      callee,
      action,
      startTime: performance.now(),
      status: 'ok',
      metadata,
    };

    this._spans.push(span);
    return span;
  }

  /**
   * Ends an active span by spanId.
   */
  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', errorMessage?: string): void {
    const span = this._spans.find((s) => s.spanId === spanId);
    if (span) {
      span.endTime = performance.now();
      span.status = status;
      if (errorMessage) {
        span.errorMessage = errorMessage;
      }
    }
  }

  /**
   * Executes an async or sync function within the context of a new child span.
   */
  async withSpan<T>(
    callee: string,
    action: string,
    fn: (span: TraceSpan) => Promise<T> | T,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const span = this.startSpan(callee, action, metadata);

    const childContext: ActiveTraceContext = {
      traceId: this._traceId,
      currentSpanId: span.spanId,
      caller: callee,
    };

    try {
      const result = await this._storage.run(childContext, () => fn(span));
      this.endSpan(span.spanId, 'ok');
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.endSpan(span.spanId, 'error', message);
      throw err;
    }
  }

  /**
   * Exports recorded spans into standard ExecutionTrace format.
   */
  exportTrace(): ExecutionTrace {
    return {
      version: '1.0.0',
      traceId: this._traceId,
      timestamp: new Date().toISOString(),
      spans: this.spans,
    };
  }

  /**
   * Clears all recorded spans.
   */
  clear(): void {
    this._spans.length = 0;
  }
}

/**
 * Creates a new TraceRecorder instance.
 */
export function createTraceRecorder(traceId?: string): TraceRecorder {
  return new TraceRecorder(traceId);
}
