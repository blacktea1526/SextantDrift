import { describe, it, expect } from 'vitest';
import {
  buildCausalityGraph,
  happenedBefore,
  areConcurrent,
} from '../../src/causality/causality-graph.js';
import type { ExecutionTrace } from '../../src/trace/types.js';

describe('CausalityGraph & Happened-Before Analyzer (Phase 5 Task 4)', () => {
  it('should build a causality graph with parent-child tree hierarchy', () => {
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-1',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 'root',
          traceId: 'trace-1',
          caller: 'Client',
          callee: 'OrderController',
          action: 'createOrder',
          startTime: 100,
          endTime: 200,
          status: 'ok',
        },
        {
          spanId: 'child-1',
          traceId: 'trace-1',
          parentSpanId: 'root',
          caller: 'OrderController',
          callee: 'OrderRepo',
          action: 'save',
          startTime: 110,
          endTime: 140,
          status: 'ok',
        },
        {
          spanId: 'child-2',
          traceId: 'trace-1',
          parentSpanId: 'root',
          caller: 'OrderController',
          callee: 'PaymentGateway',
          action: 'charge',
          startTime: 150,
          endTime: 190,
          status: 'ok',
        },
      ],
    };

    const graph = buildCausalityGraph(trace);
    expect(graph.rootSpans).toEqual(['root']);
    expect(graph.nodes.size).toBe(3);

    const rootNode = graph.nodes.get('root')!;
    expect(rootNode.children).toEqual(['child-1', 'child-2']);
    expect(rootNode.depth).toBe(0);

    const child1Node = graph.nodes.get('child-1')!;
    expect(child1Node.parent).toBe('root');
    expect(child1Node.depth).toBe(1);

    // Edges should include causal parent->child and happened_before child-1 -> child-2
    const happenedBeforeEdge = graph.edges.find(
      (e) => e.from === 'child-1' && e.to === 'child-2' && e.type === 'happened_before'
    );
    expect(happenedBeforeEdge).toBeDefined();
    expect(happenedBeforeEdge?.delayMs).toBe(10); // 150 - 140 = 10ms
  });

  it('should correctly evaluate happenedBefore relation', () => {
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-2',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 's1',
          traceId: 'trace-2',
          caller: 'A',
          callee: 'B',
          action: 'op1',
          startTime: 10,
          endTime: 20,
          status: 'ok',
        },
        {
          spanId: 's2',
          traceId: 'trace-2',
          caller: 'A',
          callee: 'C',
          action: 'op2',
          startTime: 25,
          endTime: 35,
          status: 'ok',
        },
      ],
    };

    const graph = buildCausalityGraph(trace);
    expect(happenedBefore(graph, 's1', 's2')).toBe(true);
    expect(happenedBefore(graph, 's2', 's1')).toBe(false);
  });

  it('should detect concurrent spans when execution windows overlap without causality', () => {
    const trace: ExecutionTrace = {
      version: '1.0.0',
      traceId: 'trace-3',
      timestamp: new Date().toISOString(),
      spans: [
        {
          spanId: 'async-1',
          traceId: 'trace-3',
          caller: 'Worker',
          callee: 'ServiceA',
          action: 'fetchA',
          startTime: 100,
          endTime: 160,
          status: 'ok',
        },
        {
          spanId: 'async-2',
          traceId: 'trace-3',
          caller: 'Worker',
          callee: 'ServiceB',
          action: 'fetchB',
          startTime: 120,
          endTime: 180,
          status: 'ok',
        },
      ],
    };

    const graph = buildCausalityGraph(trace);
    expect(areConcurrent(graph, 'async-1', 'async-2')).toBe(true);
    expect(happenedBefore(graph, 'async-1', 'async-2')).toBe(false);
    expect(happenedBefore(graph, 'async-2', 'async-1')).toBe(false);
  });
});
