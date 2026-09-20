/**
 * SextantDrift Phase 5: Dynamic Causality Differencer
 * 比较 Mermaid 时序图规范 (Target) 与运行时 Trace 因果 DAG (Actual) 并捕获偏航
 */

import type { ExecutionTrace, TraceSpan } from '../trace/types.js';
import type { SequenceDiagramSpec, SequenceInteraction, DynamicCausalityDrift } from './types.js';

function isActionMatching(actualAction: string, expectedMessage: string): boolean {
  if (!actualAction || !expectedMessage) return false;
  const cleanMsg = expectedMessage.split('(')[0].trim().toLowerCase();
  const cleanActual = actualAction.split('(')[0].trim().toLowerCase();
  if (!cleanMsg || !cleanActual) return false;
  return cleanActual === cleanMsg || cleanMsg.includes(cleanActual) || cleanActual.includes(cleanMsg);
}


/**
 * Checks if span B is a child or descendant of span A.
 */
function isDescendant(spanA: TraceSpan, spanB: TraceSpan, spansMap: Map<string, TraceSpan>): boolean {
  let curr: TraceSpan | undefined = spanB;
  while (curr && curr.parentSpanId) {
    if (curr.parentSpanId === spanA.spanId) {
      return true;
    }
    curr = spansMap.get(curr.parentSpanId);
  }
  return false;
}

/**
 * Compares an array of SequenceDiagramSpecs against an actual ExecutionTrace.
 */
export function diffCausality(
  specs: SequenceDiagramSpec[],
  trace: ExecutionTrace
): DynamicCausalityDrift[] {
  const drifts: DynamicCausalityDrift[] = [];
  const spansMap = new Map<string, TraceSpan>(trace.spans.map((s) => [s.spanId, s]));

  for (const spec of specs) {
    const callInteractions = spec.interactions.filter((i) => i.type !== 'reply');
    if (callInteractions.length === 0) continue;

    // Check if this sequence was triggered in the trace
    const matchedMap = new Map<SequenceInteraction, TraceSpan[]>();
    let totalMatchedCount = 0;

    for (const inter of callInteractions) {
      const matchingSpans = trace.spans.filter((s) => {
        const callerMatch = s.caller === inter.source;
        const calleeMatch = s.callee === inter.target;
        const actionMatch = isActionMatching(s.action, inter.message);
        return callerMatch && calleeMatch && actionMatch;
      });

      matchedMap.set(inter, matchingSpans);
      if (matchingSpans.length > 0) {
        totalMatchedCount++;
      }
    }

    // If none of the interactions matched, this sequence was not exercised in this trace
    if (totalMatchedCount === 0) {
      continue;
    }

    // 1. Check DYNAMIC_MISSING_CALL
    for (const inter of callInteractions) {
      const spans = matchedMap.get(inter) || [];
      if (spans.length === 0) {
        drifts.push({
          id: `drift-missing-${inter.id}`,
          type: 'DYNAMIC_MISSING_CALL',
          severity: 'critical',
          message: `Expected call "${inter.source} -> ${inter.target}:${inter.message}" specified in ${spec.sourceDoc}:${inter.lineNumber} was missing in execution trace "${trace.traceId}".`,
          sourceDoc: spec.sourceDoc,
          line: inter.lineNumber,
          expectedOrder: `${inter.source} -> ${inter.target}:${inter.message}`,
          suggestion: `Ensure "${inter.source}" invokes "${inter.target}.${inter.message}" during the execution flow.`,
        });
      }
    }

    // 2. Check DYNAMIC_OUT_OF_ORDER
    // Two interactions (A, B) where A precedes B in the spec:
    // If they share the same source component (sibling calls from same caller) or if B is not a sub-call of A:
    for (let i = 0; i < callInteractions.length; i++) {
      const interA = callInteractions[i];
      const spansA = matchedMap.get(interA) || [];
      if (spansA.length === 0) continue;

      for (let j = i + 1; j < callInteractions.length; j++) {
        const interB = callInteractions[j];
        const spansB = matchedMap.get(interB) || [];
        if (spansB.length === 0) continue;

        // Check each pair of matched spans
        for (const spanA of spansA) {
          for (const spanB of spansB) {
            // If spanB is a nested sub-task inside spanA (e.g. A called B's caller),
            // then spanB starting before spanA finishes is normal nested behavior.
            if (isDescendant(spanA, spanB, spansMap)) {
              continue;
            }

            // If interA and interB share the same source component (e.g. OrderService calls Repo, then Gateway),
            // or if both spans share the same parent context:
            const isSiblingCall =
              interA.source === interB.source ||
              (spanA.parentSpanId && spanA.parentSpanId === spanB.parentSpanId);

            if (isSiblingCall) {
              const endA = spanA.endTime ?? spanA.startTime;
              if (spanB.startTime < endA) {
                drifts.push({
                  id: `drift-order-${interA.id}-${interB.id}`,
                  type: 'DYNAMIC_OUT_OF_ORDER',
                  severity: 'critical',
                  message: `Out-of-order dynamic execution: "${interB.source} -> ${interB.target}:${interB.message}" started at ${spanB.startTime.toFixed(2)}ms before preceding "${interA.source} -> ${interA.target}:${interA.message}" finished (completed at ${endA.toFixed(2)}ms). Expected sequence: "${interA.message}" -> "${interB.message}".`,
                  sourceDoc: spec.sourceDoc,
                  line: interB.lineNumber,
                  expectedOrder: `${interA.message} -> ${interB.message}`,
                  actualOrder: `${interB.message} (started ${spanB.startTime.toFixed(2)}ms) < ${interA.message} (ended ${endA.toFixed(2)}ms)`,
                  span: spanB,
                  suggestion: `Ensure "${interA.message}" completes before "${interB.message}" is initiated.`,
                });
              }
            }
          }
        }
      }
    }

    // 3. Check DYNAMIC_UNEXPECTED_CALL
    // Look for spans where both caller and callee are participants in this spec,
    // but no interaction in the spec allows this caller -> callee call.
    const participantSet = new Set(spec.participants);
    for (const span of trace.spans) {
      if (participantSet.has(span.caller) && participantSet.has(span.callee)) {
        const isAllowed = spec.interactions.some(
          (inter) => inter.source === span.caller && inter.target === span.callee
        );

        if (!isAllowed) {
          drifts.push({
            id: `drift-unexpected-${span.spanId}`,
            type: 'DYNAMIC_UNEXPECTED_CALL',
            severity: 'critical',
            message: `Unexpected dynamic call: "${span.caller}" directly invoked "${span.callee}.${span.action}" during trace "${trace.traceId}", which is not declared in sequence diagram ${spec.sourceDoc}.`,
            sourceDoc: spec.sourceDoc,
            line: 1,
            span,
            suggestion: `Remove or refactor direct call from "${span.caller}" to "${span.callee}", or update ${spec.sourceDoc} if this is intended architecture.`,
          });
        }
      }
    }
  }

  return drifts;
}
