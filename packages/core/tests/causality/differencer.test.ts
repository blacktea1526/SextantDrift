import { describe, it, expect } from 'vitest';
import { parseSequenceDiagram } from '../../src/causality/sequence-parser.js';
import { diffCausality } from '../../src/causality/differencer.js';
import type { ExecutionTrace } from '../../src/trace/types.js';

describe('Dynamic Causality Differencer (Phase 5 Task 5)', () => {
  const mermaidDoc = `
sequenceDiagram
    Client->>OrderController: createOrder
    OrderController->>OrderService: processOrder
    OrderService->>OrderRepo: save
    OrderService->>PaymentGateway: charge
`;

  it('should pass cleanly when runtime trace matches expected sequence order', () => {
    const spec = parseSequenceDiagram(mermaidDoc, 'order.md');
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-clean',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 's1',
          traceId: 'trace-clean',
          caller: 'Client',
          callee: 'OrderController',
          action: 'createOrder',
          startTime: 10,
          endTime: 100,
          status: 'ok',
        },
        {
          spanId: 's2',
          traceId: 'trace-clean',
          parentSpanId: 's1',
          caller: 'OrderController',
          callee: 'OrderService',
          action: 'processOrder',
          startTime: 15,
          endTime: 90,
          status: 'ok',
        },
        {
          spanId: 's3',
          traceId: 'trace-clean',
          parentSpanId: 's2',
          caller: 'OrderService',
          callee: 'OrderRepo',
          action: 'save',
          startTime: 20,
          endTime: 40,
          status: 'ok',
        },
        {
          spanId: 's4',
          traceId: 'trace-clean',
          parentSpanId: 's2',
          caller: 'OrderService',
          callee: 'PaymentGateway',
          action: 'charge',
          startTime: 45,
          endTime: 80,
          status: 'ok',
        },
      ],
    };

    const drifts = diffCausality([spec], trace);
    expect(drifts).toHaveLength(0);
  });

  it('should detect DYNAMIC_OUT_OF_ORDER when charge is called before save completes', () => {
    const spec = parseSequenceDiagram(mermaidDoc, 'order.md');
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-out-of-order',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 's1',
          traceId: 'trace-out-of-order',
          caller: 'Client',
          callee: 'OrderController',
          action: 'createOrder',
          startTime: 10,
          endTime: 100,
          status: 'ok',
        },
        {
          spanId: 's2',
          traceId: 'trace-out-of-order',
          parentSpanId: 's1',
          caller: 'OrderController',
          callee: 'OrderService',
          action: 'processOrder',
          startTime: 15,
          endTime: 90,
          status: 'ok',
        },
        // Fault: PaymentGateway.charge called at 20ms BEFORE OrderRepo.save at 50ms
        {
          spanId: 's4',
          traceId: 'trace-out-of-order',
          parentSpanId: 's2',
          caller: 'OrderService',
          callee: 'PaymentGateway',
          action: 'charge',
          startTime: 20,
          endTime: 45,
          status: 'ok',
        },
        {
          spanId: 's3',
          traceId: 'trace-out-of-order',
          parentSpanId: 's2',
          caller: 'OrderService',
          callee: 'OrderRepo',
          action: 'save',
          startTime: 50,
          endTime: 70,
          status: 'ok',
        },
      ],
    };

    const drifts = diffCausality([spec], trace);
    expect(drifts.length).toBeGreaterThanOrEqual(1);

    const outOfOrder = drifts.find((d) => d.type === 'DYNAMIC_OUT_OF_ORDER');
    expect(outOfOrder).toBeDefined();
    expect(outOfOrder?.severity).toBe('critical');
    expect(outOfOrder?.message).toContain('OrderService');
    expect(outOfOrder?.message).toContain('PaymentGateway');
  });

  it('should detect DYNAMIC_MISSING_CALL when a required call in sequence is omitted', () => {
    const spec = parseSequenceDiagram(mermaidDoc, 'order.md');
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-missing',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 's1',
          traceId: 'trace-missing',
          caller: 'Client',
          callee: 'OrderController',
          action: 'createOrder',
          startTime: 10,
          endTime: 100,
          status: 'ok',
        },
        {
          spanId: 's2',
          traceId: 'trace-missing',
          parentSpanId: 's1',
          caller: 'OrderController',
          callee: 'OrderService',
          action: 'processOrder',
          startTime: 15,
          endTime: 90,
          status: 'ok',
        },
        // OrderRepo.save is MISSING entirely! Directly called PaymentGateway.charge
        {
          spanId: 's4',
          traceId: 'trace-missing',
          parentSpanId: 's2',
          caller: 'OrderService',
          callee: 'PaymentGateway',
          action: 'charge',
          startTime: 20,
          endTime: 60,
          status: 'ok',
        },
      ],
    };

    const drifts = diffCausality([spec], trace);
    const missing = drifts.find((d) => d.type === 'DYNAMIC_MISSING_CALL');
    expect(missing).toBeDefined();
    expect(missing?.severity).toBe('critical');
    expect(missing?.message).toContain('OrderRepo');
  });

  it('should detect DYNAMIC_UNEXPECTED_CALL when undeclared bypass call occurs between participants', () => {
    const spec = parseSequenceDiagram(mermaidDoc, 'order.md');
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-unexpected',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 's1',
          traceId: 'trace-unexpected',
          caller: 'Client',
          callee: 'OrderController',
          action: 'createOrder',
          startTime: 10,
          endTime: 100,
          status: 'ok',
        },
        // Unexpected bypass: OrderController directly calls PaymentGateway!
        {
          spanId: 's_bypass',
          traceId: 'trace-unexpected',
          parentSpanId: 's1',
          caller: 'OrderController',
          callee: 'PaymentGateway',
          action: 'chargeDirectly',
          startTime: 12,
          endTime: 30,
          status: 'ok',
        },
      ],
    };

    const drifts = diffCausality([spec], trace);
    const unexpected = drifts.find((d) => d.type === 'DYNAMIC_UNEXPECTED_CALL');
    expect(unexpected).toBeDefined();
    expect(unexpected?.message).toContain('OrderController');
    expect(unexpected?.message).toContain('PaymentGateway');
  });
});
