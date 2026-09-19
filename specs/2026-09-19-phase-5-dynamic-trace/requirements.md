# Feature Requirements: Phase 5 — Dynamic Trace & Causality Engine (运行时 Trace 因果差分引擎)

> **特性代号**：`phase-5-dynamic-trace`  
> **制定日期**：2026-09-19  
> **所属分支**：`feat/phase-5-dynamic-trace`  
> **基准契约**：[`AGENTS.md`](../../AGENTS.md) | [`ROADMAP.md`](../../ROADMAP.md) | [`TECH_STACK.md`](../../TECH_STACK.md)  
> **阶段定位**：攻克时序差分核心难题，依托真实运行时 Trace 与因果 DAG，终结静态推测假阳性。

---

## 1. 核心目标与背景 (Objectives & Context)

### 1.1 背景与历史教训 (Why Dynamic Trace?)
在第一版产品研发中，直接采用纯静态 AST/正则匹配去猜测异步时序（如 `Promise.all`、事件驱动、中间件与回调），导致了灾难性的假阳性（误报率高达 60%+），彻底摧毁了门禁信誉。
为此，SextantDrift 在 v2.0 宪章中立下两大约束：
1. **戒律 1 (严禁 Agent 自证)**：严禁由 Agent 自行编写或汇报“实际执行时序”；
2. **戒律 2 (严禁静态猜时序)**：静态分析只做结构拓扑与作用域内判定；跨函数、异步与分布式真实因果时序，**必须且只能依托真实的运行时执行 Trace** 客观采集与差分。

### 1.2 核心目标
1. **轻量非侵入式 Trace 录制器 (`@sextant/core/trace`)**：
   - 基于 Node.js 标准 `AsyncLocalStorage` 构建，零第三方生产依赖；
   - 支持多层异步上下文透传、毫秒/微秒级高精度逻辑时钟与父子 Span 因果树关联；
   - 导出机器确定性、标准化 Trace 数据集 (`.sextant/trace.json`)。
2. **Mermaid `sequenceDiagram` 意图解析器 (`@sextant/core/causality`)**：
   - 解析 Markdown / 架构设计文档中的 Mermaid 时序图，提取参与者（Participants）、调用跃迁（Messages）、调用次序与因果前置约束。
3. **因果有向无环图 (Causality DAG) 重组**：
   - 将运行时捕获的平铺/树状 Spans，重构成包含因果依赖（Causal Dependency）与时间偏序（Happened-Before Relation）的因果图。
4. **确定性时序差分算法 (Causality Differencer)**：
   - 比较 Target 时序拓扑与 Actual 因果 DAG；
   - 准确捕获三大偏航违规：
     - `DYNAMIC_OUT_OF_ORDER`：执行次序颠倒（如设计要求“先持久化再调用外部支付”，但 Trace 显示外部调用在持久化完成前触发）；
     - `DYNAMIC_UNEXPECTED_CALL`：设计图明确未允许或违禁的运行时跨组件调用；
     - `DYNAMIC_MISSING_CALL`：设计图中关键事务链路在执行 Trace 中被违规跳过。
5. **门禁与审查交付物整合**：
   - CLI `check --trace <path>` 支持接收运行时 Trace 文件并输出清晰的终端差分定位与时序违例信息；
   - 扩展基线语义指纹与统一诊断报表。

---

## 2. 核心功能与契约规范 (Detailed Specifications)

### 2.1 运行时 Trace 数据结构契约

```typescript
export interface TraceSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  caller: string;       // 调用方组件/模块，如 "OrderController"
  callee: string;       // 被调用方组件/模块，如 "PaymentService"
  action: string;       // 方法/操作名，如 "charge"
  startTime: number;    // 单调时间戳 (ms)
  endTime?: number;     // 结束时间戳 (ms)
  status: 'ok' | 'error';
  metadata?: Record<string, unknown>;
}

export interface ExecutionTrace {
  version: '1.0.0';
  traceId: string;
  timestamp: string;
  spans: TraceSpan[];
}
```

### 2.2 时序图语法解析契约
支持解析 Mermaid `sequenceDiagram`：
- `participant A [as Alias]`
- `A->>B: message` (同步调用)
- `A-->>B: message` (返回)
- `A-)B: message` (异步单向调用)
- 提取确定性的期望消息偏序列表与因果依赖链。

### 2.3 违规类型与严重级别 (Drift Violations)
- `DYNAMIC_OUT_OF_ORDER` (critical): 违反 Lamport Happened-Before 时序先验关系；
- `DYNAMIC_UNEXPECTED_CALL` (warning/critical): 出现未声明或越权的动态跨组件调用；
- `DYNAMIC_MISSING_CALL` (critical): 设计时序图中的必经关键调用未被执行。

### 2.4 SLO 与性能指标
- **差分耗时**：10,000 个 Trace Spans 差分计算耗时 ≤ 50ms；
- **零外部运行时依赖**：生产依赖继续保持为 0（仅依赖 Node.js 内置模块）；
- **单测覆盖率**：100% 单测，覆盖正向合规时序、逆序调用、异步并发交错等极端场景。
