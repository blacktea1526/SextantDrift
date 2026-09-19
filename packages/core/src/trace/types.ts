/**
 * SextantDrift Phase 5: Dynamic Trace Types
 * 运行时 Trace 录制器核心类型定义
 */

export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  caller: string;       // 调用方组件/模块/服务
  callee: string;       // 被调用方组件/模块/服务
  action: string;       // 动作/方法名
  startTime: number;    // 单调时间戳 (ms)
  endTime?: number;     // 结束单调时间戳 (ms)
  status: 'ok' | 'error';
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionTrace {
  version: '1.0.0';
  traceId: string;
  timestamp: string;
  spans: TraceSpan[];
}

export interface ActiveTraceContext {
  traceId: string;
  currentSpanId?: string;
  caller: string;
}
