# Feature Requirements: Phase 3 — State Verifier (状态机完整性静态分析引擎)

> **特性代号**：`phase-3-state-verifier`  
> **制定日期**：2026-09-17  
> **基准契约**：[`AGENTS.md`](file:///home/redtea/Mona_project/SextantDriftV03/AGENTS.md) | [`ROADMAP.md`](file:///home/redtea/Mona_project/SextantDriftV03/ROADMAP.md) | [`TECH_STACK.md`](file:///home/redtea/Mona_project/SextantDriftV03/TECH_STACK.md)  
> **状态**：执行中 (In Progress)

---

## 1. 目标与背景 (Objective & Context)

系统核心业务流转（订单处理、支付生命周期、认证授权、AI Agent 执行流程、异步任务调度）通常建模为有限状态机（Finite State Machine, FSM）。在架构文档与工程规范中，团队倾向于使用标准的 Mermaid `stateDiagram-v2` 进行可视化声明。

在静态架构审查中，缺乏对状态图的机器核验会导致以下严重陷阱：
1. **黑洞状态 (Deadlock / Black Hole)**：非终止态节点只进不出（入度 $\ge 1$ 且出度 $= 0$），流程卡死无法结束；
2. **不可达孤岛 (Unreachable Island)**：状态节点从起始态 `[*]` 出发在有向图中不可达，成为废弃或悬空分支；
3. **异步中间态缺失降级/超时 (Missing Fallback & Timeout)**：等待/处理中状态（`Pending`, `Processing`, `Waiting` 等）只画了理想分支，未规划 `timeout`, `fail`, `retry` 容灾路径。

本阶段使命：在 `@sextant/core` 构建纯净、无 DOM 的状态机拓扑分析引擎，并在 CLI 与门禁中提供确定性诊断。

---

## 2. 详细功能规范 (Functional Specifications)

### 2.1 状态图解析器 (`packages/core/src/state/parser.ts`)
- 支持解析 Markdown 代码块（````mermaid \n stateDiagram-v2 ... ````）及纯 Mermaid 状态图文本；
- 识别初始状态 `[*]` 与终结状态 `[*]`；
- 识别普通状态节点、状态别名与描述（`StateId: Description`）；
- 识别跃迁箭头 `-->` 及事件与守卫条件（`StateA --> StateB: event [condition]`）；
- 忽略注释行（`%%`）与便签（`note ...`）。

### 2.2 状态拓扑图构建 (`packages/core/src/state/graph-builder.ts`)
- 构造有向状态图 `StateMachineGraph`，记录节点入度（`inDegree`）、出度（`outDegree`）；
- 维护节点的邻接转移列表。

### 2.3 黑洞死锁检测 (`packages/core/src/state/deadlock-detector.ts`)
- 判定规则：节点 $inDegree \ge 1$ 且 $outDegree = 0$，且该节点不是显式终止态 `[*]`；
- 严重度：`critical`；
- 错误分类：`STATE_DEADLOCK`。

### 2.4 孤岛不可达检测 (`packages/core/src/state/island-detector.ts`)
- 判定规则：以所有初始态 `[*]` 为源节点执行 DFS/BFS 遍历，标记所有可达节点。未被访问且非独立说明的节点即为孤岛；
- 严重度：`warning`；
- 错误分类：`STATE_UNREACHABLE`。

### 2.5 缺失降级与超时检测 (`packages/core/src/state/fallback-checker.ts`)
- 异步等待状态判定：节点名称或描述匹配 `/pending|processing|waiting|executing|submitting|loading|authorizing|syncing|calling/i`；
- 降级跃迁判定：该节点所有出度转移的事件描述、守卫条件或目标状态名称包含 `/fail|error|timeout|retry|abort|cancel|reject|exception|degrade/i`；
- 若无任何一条跃迁满足降级条件，判定为缺失降级分支；
- 严重度：`warning`；
- 错误分类：`STATE_MISSING_FALLBACK`。

---

## 3. 非功能性指标 (SLO & Quality Gates)
1. **五秒原则**：单张百节点状态图解析与检测耗时 $\le 5\text{ms}$；
2. **零假阳性**：合规标准流程（含超时与终止态）测试 0 误报；
3. **Core 纯粹性**：零 CLI、零 DOM 库依赖；
4. **全量跑绿**：所有单测与回归测试 100% 通过。
