/**
 * SextantDrift Phase 5: Causality Graph Builder
 * 重组运行时 Trace Spans 为因果有向无环图 (Causality DAG) 并推导偏序关系
 */

import type { ExecutionTrace, TraceSpan } from '../trace/types.js';
import type { CausalityGraph, CausalityNode, CausalityEdge } from './types.js';

/**
 * Builds a CausalityGraph from an ExecutionTrace.
 */
export function buildCausalityGraph(trace: ExecutionTrace): CausalityGraph {
  const nodes = new Map<string, CausalityNode>();
  const edges: CausalityEdge[] = [];
  const rootSpans: string[] = [];

  // 1. Initialize nodes
  for (const span of trace.spans) {
    nodes.set(span.spanId, {
      id: span.spanId,
      span,
      depth: 0,
      children: [],
      parent: span.parentSpanId,
    });
  }

  // 2. Link parent-child hierarchy
  for (const span of trace.spans) {
    if (span.parentSpanId && nodes.has(span.parentSpanId)) {
      const parentNode = nodes.get(span.parentSpanId)!;
      parentNode.children.push(span.spanId);

      const delayMs = Math.max(0, Math.round((span.startTime - parentNode.span.startTime) * 100) / 100);
      edges.push({
        from: span.parentSpanId,
        to: span.spanId,
        type: 'causal',
        delayMs,
      });
    } else {
      rootSpans.push(span.spanId);
    }
  }

  // 3. Compute depths recursively
  function assignDepth(nodeId: string, currentDepth: number) {
    const node = nodes.get(nodeId);
    if (!node) return;
    node.depth = currentDepth;
    for (const childId of node.children) {
      assignDepth(childId, currentDepth + 1);
    }
  }

  for (const rootId of rootSpans) {
    assignDepth(rootId, 0);
  }

  // 4. Compute Happened-Before relations among sibling groups
  const siblingGroups: string[][] = [rootSpans];
  for (const node of nodes.values()) {
    if (node.children.length > 1) {
      siblingGroups.push(node.children);
    }
  }

  for (const group of siblingGroups) {
    const sortedGroup = [...group].sort((a, b) => {
      const spanA = nodes.get(a)!.span;
      const spanB = nodes.get(b)!.span;
      return spanA.startTime - spanB.startTime;
    });

    for (let i = 0; i < sortedGroup.length; i++) {
      const prevId = sortedGroup[i];
      const prevSpan = nodes.get(prevId)!.span;
      const prevEnd = prevSpan.endTime ?? prevSpan.startTime;

      for (let j = i + 1; j < sortedGroup.length; j++) {
        const nextId = sortedGroup[j];
        const nextSpan = nodes.get(nextId)!.span;

        if (prevEnd <= nextSpan.startTime) {
          const delayMs = Math.round((nextSpan.startTime - prevEnd) * 100) / 100;
          edges.push({
            from: prevId,
            to: nextId,
            type: 'happened_before',
            delayMs,
          });
        }
      }
    }
  }

  return {
    traceId: trace.traceId,
    nodes,
    edges,
    rootSpans,
  };
}

/**
 * Checks if span A is an ancestor of span B in the causality tree.
 */
export function isAncestor(graph: CausalityGraph, spanAId: string, spanBId: string): boolean {
  let curr = graph.nodes.get(spanBId);
  while (curr && curr.parent) {
    if (curr.parent === spanAId) {
      return true;
    }
    curr = graph.nodes.get(curr.parent);
  }
  return false;
}

/**
 * Evaluates whether span A strictly happened before span B (Lamport Happened-Before relation).
 */
export function happenedBefore(graph: CausalityGraph, spanAId: string, spanBId: string): boolean {
  if (spanAId === spanBId) return false;

  const nodeA = graph.nodes.get(spanAId);
  const nodeB = graph.nodes.get(spanBId);
  if (!nodeA || !nodeB) return false;

  // 1. Causality ancestor relationship: parent started before child
  if (isAncestor(graph, spanAId, spanBId)) {
    return true;
  }

  // 2. Physical temporal order: span A completely finished before span B started
  const endA = nodeA.span.endTime ?? nodeA.span.startTime;
  if (endA <= nodeB.span.startTime) {
    return true;
  }

  return false;
}

/**
 * Checks if two spans executed concurrently (overlapping time without ancestor relationship).
 */
export function areConcurrent(graph: CausalityGraph, spanAId: string, spanBId: string): boolean {
  if (spanAId === spanBId) return false;

  const nodeA = graph.nodes.get(spanAId);
  const nodeB = graph.nodes.get(spanBId);
  if (!nodeA || !nodeB) return false;

  // Ancestor / descendant relations are causal, not concurrent
  if (isAncestor(graph, spanAId, spanBId) || isAncestor(graph, spanBId, spanAId)) {
    return false;
  }

  const startA = nodeA.span.startTime;
  const endA = nodeA.span.endTime ?? startA;
  const startB = nodeB.span.startTime;
  const endB = nodeB.span.endTime ?? startB;

  // Check interval overlap: max(startA, startB) < min(endA, endB)
  return Math.max(startA, startB) < Math.min(endA, endB);
}
