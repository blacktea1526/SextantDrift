/**
 * SextantDrift Phase 5: Dynamic Causality Engine Types
 * 因果分析与差分引擎核心类型契约
 */

import type { TraceSpan } from '../trace/types.js';

export type SequenceArrowType = 'sync' | 'async' | 'reply';

export interface SequenceInteraction {
  id: string;
  source: string;       // 参与者 A
  target: string;       // 参与者 B
  message: string;      // 调用签名或动作
  type: SequenceArrowType;
  lineNumber: number;
}

export interface SequenceDiagramSpec {
  title?: string;
  participants: string[];
  interactions: SequenceInteraction[];
  sourceDoc: string;
}

export interface CausalityNode {
  id: string;           // spanId
  span: TraceSpan;
  depth: number;
  children: string[];
  parent?: string;
}

export interface CausalityEdge {
  from: string;         // spanId
  to: string;           // spanId
  type: 'causal' | 'happened_before';
  delayMs: number;
}

export interface CausalityGraph {
  traceId: string;
  nodes: Map<string, CausalityNode>;
  edges: CausalityEdge[];
  rootSpans: string[];
}

export interface DynamicCausalityDrift {
  id: string;
  type: 'DYNAMIC_OUT_OF_ORDER' | 'DYNAMIC_UNEXPECTED_CALL' | 'DYNAMIC_MISSING_CALL';
  severity: 'critical' | 'warning';
  message: string;
  sourceDoc: string;
  line: number;
  expectedOrder?: string;
  actualOrder?: string;
  span?: TraceSpan;
  suggestion?: string;
}
