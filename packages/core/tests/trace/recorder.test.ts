import { describe, it, expect } from 'vitest';
import { TraceRecorder } from '../../src/trace/recorder.js';

describe('TraceRecorder (Phase 5 Task 2.1)', () => {
  it('should initialize with a default or custom traceId', () => {
    const recorder = new TraceRecorder('custom-trace-123');
    expect(recorder.traceId).toBe('custom-trace-123');
    expect(recorder.spans).toHaveLength(0);

    const autoRecorder = new TraceRecorder();
    expect(autoRecorder.traceId).toBeDefined();
    expect(autoRecorder.traceId.length).toBeGreaterThan(0);
  });

  it('should record synchronous and asynchronous spans with parent-child links', async () => {
    const recorder = new TraceRecorder('trace-nested');

    await recorder.withSpan('OrderController', 'handleCreateOrder', async () => {
      // First child call
      await recorder.withSpan('OrderService', 'createOrder', async () => {
        // Grandchild call 1: save
        await recorder.withSpan('OrderRepo', 'save', async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });

        // Grandchild call 2: charge
        await recorder.withSpan('PaymentGateway', 'charge', async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      });
    });

    const spans = recorder.spans;
    expect(spans).toHaveLength(4);

    const rootSpan = spans.find((s) => s.callee === 'OrderController' && s.action === 'handleCreateOrder')!;
    expect(rootSpan).toBeDefined();
    expect(rootSpan.parentSpanId).toBeUndefined();
    expect(rootSpan.status).toBe('ok');
    expect(rootSpan.endTime).toBeGreaterThanOrEqual(rootSpan.startTime);

    const serviceSpan = spans.find((s) => s.callee === 'OrderService' && s.action === 'createOrder')!;
    expect(serviceSpan.parentSpanId).toBe(rootSpan.spanId);
    expect(serviceSpan.caller).toBe('OrderController');

    const repoSpan = spans.find((s) => s.callee === 'OrderRepo' && s.action === 'save')!;
    expect(repoSpan.parentSpanId).toBe(serviceSpan.spanId);
    expect(repoSpan.caller).toBe('OrderService');

    const paymentSpan = spans.find((s) => s.callee === 'PaymentGateway' && s.action === 'charge')!;
    expect(paymentSpan.parentSpanId).toBe(serviceSpan.spanId);
    expect(paymentSpan.caller).toBe('OrderService');

    // Temporal order: repo should finish before payment starts
    expect(repoSpan.endTime!).toBeLessThanOrEqual(paymentSpan.startTime);
  });

  it('should capture error status and message when an error is thrown in a span', async () => {
    const recorder = new TraceRecorder('trace-error');

    await expect(
      recorder.withSpan('PaymentGateway', 'charge', async () => {
        throw new Error('Payment timeout');
      })
    ).rejects.toThrow('Payment timeout');

    const spans = recorder.spans;
    expect(spans).toHaveLength(1);
    expect(spans[0].status).toBe('error');
    expect(spans[0].errorMessage).toBe('Payment timeout');
    expect(spans[0].endTime).toBeDefined();
  });

  it('should export valid ExecutionTrace conforming to schema', () => {
    const recorder = new TraceRecorder('trace-schema');
    recorder.startSpan('ServiceA', 'doWork');
    const span = recorder.spans[0];
    recorder.endSpan(span.spanId, 'ok');

    const exported = recorder.exportTrace();
    expect(exported.version).toBe('1.0.0');
    expect(exported.traceId).toBe('trace-schema');
    expect(exported.timestamp).toBeDefined();
    expect(exported.spans).toHaveLength(1);
    expect(exported.spans[0].callee).toBe('ServiceA');
  });
});
