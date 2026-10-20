# ADR-009：HTML 报告默认 Understand（读懂设计）与 Diff 叠加

## Status

Accepted — 固化报告呈现心智与受众优先级。本记录扩展 [ADR-007](./ADR-007-c4-model-and-native-svg-visual-report.md) 的呈现意图，不取代其 C4 / 原生 SVG / 零 CDN 技术选型；业务验收证据边界仍以 [ADR-008](./ADR-008-design-intent-evidence-boundary.md) 为准。实现可分阶段交付，但后续报告改动不得回退为本 ADR 否决的「仅偏航仪表盘」默认形态。

## Date

2026-10-16

## Context

### 产品宪章与现实受众缺口

SextantDrift 的视觉心智是「Design by Diagram, Diff by Diagram」：左屏设计意图、右屏实际拓扑、红线标偏航。现有 `drift-report.html`（ADR-007）已能做 C4 分层、Target/Actual/Unified 切换与违规高亮，但**默认叙事是偏航仪表盘**：首屏强调 PASS/FAIL 与红绿计数，模块职责、功能/约束、业务需求挂钩较弱。

在现代 AI 辅助开发工作流中：

1. **顶层设计者**需要确认「规划是否清晰、模块作用与联系是否可读」；
2. **迭代开发者与 AI 协作者**常跳过局部设计细节，改功能时难以理解「这块本该做什么、连谁、受什么约束、对应哪条业务」；
3. 若报告只回答「有没有偏航」，人和 Agent 仍要在多张图/文档之间自行拼接理解——**维护多套互不关联的图**，违背「一眼看懂」的持续价值。

门禁（`check` / `verify`）继续负责防偏航；报告还必须补齐**局部设计可读性**，否则绿灯项目仍可能在无知中被改坏。

### 与借鉴研究的边界

可借鉴统一语义模型、主图 + 关联面板、布局与语义分离、需求/约束可追踪等原则。明确不建设全生命周期设计 IDE、不引入 BPMN/DMN 编辑器、不以 AI 推断作为事实源。报告仍是 `@sextant/core` 输出的**只读、自包含投影**。

## Decision

### 1. 默认模式：Understand（读懂设计）

报告打开后默认进入 **Understand**：

- **主图**呈现设计规划（Target 语义拓扑，默认 C4 Level 2 容器视图）；
- 节点与边优先表达**模块作用与联系**，而非先堆违规样式；
- 角标可提示是否存在偏航/未验证验收，但不把整页做成「仅红绿结果页」。

**Diff（偏航审查）是叠加模式 / 滤镜**，一键开启：在同一主图上标红违规边与受影响节点，并保留已展示的职责与约束信息。Target vs Actual 左右分屏降为 Diff 下的可选布局，**不当默认首屏**。

### 2. 一份模型，关联面板继承「其他图的共同作用」

禁止用互不联动的多张独立图强迫用户脑内合并。采用：

```text
主语义图（设计规划） + 选中对象的关联面板
```

关联面板对同一 Stable ID 展示互补侧面（与 coordinated views 同构，但是报告内只读）：

| 侧面 | 内容（来自现有/规划中的单源数据） |
| :--- | :--- |
| 职责 | 组件/容器名称、描述或规范中的职责摘要 |
| 联系 | 上下游直接依赖（聚焦探针已有能力可复用） |
| 功能 / 约束 | 关联 `invariants`（`constrained_by`） |
| 业务 / 需求 | `acceptance.requirements` 锚点与验收意图摘要 |
| 验证 | `verified_by` → checks；状态遵循 ADR-008（PASS / FAIL / UNVERIFIED / ERROR） |
| 偏航（Diff 开） | 该对象相关的 `ViolationEvidence` 与行级定位 |

布局坐标变化不构成语义变更；语义真相仍是 `sextant.json`（ADR-003），图只是投影。

### 3. 业务层：需求与设计的清晰投影，而非第二套文档

业务/需求在报告中以**同一模型的投影**出现：

```text
requirement id → 验收意图 → constrained_by (invariants)
                           → realized_by (模块/容器)
                           → verified_by (checks / 证据状态)
```

- Markdown 需求正文可被 `designRef` 引用，报告摘要其意图，**不执行文档内命令**（ADR-008）；
- 结构合规不能推导行为满足；缺证据显示 UNVERIFIED，不得伪装为 PASS；
- AI 生成的需求/影响仅为候选，不得写入「已确认」元数据。

### 4. 受众优先级

1. **首要**：顶层设计者 + AI 协作者 / 迭代开发者（需快速读懂局部设计）；
2. **其次**：架构门禁审查者（Diff 叠加后钻取行级证据）。

CLI 五秒原则与终端红绿输出不变；HTML 报告的「一眼看懂」扩展为：先看懂设计规划，再看懂偏航夹角。

### 5. 技术与包边界（不变）

- 继续 ADR-007：零 CDN、原生 SVG、XSS 转义、C4 L2/L3 钻取；
- `@sextant/core` 仍 0 DOM；呈现逻辑仅在 `@sextant/web-report`；
- 不新增重型图编辑运行时；Understand 是**读模型**，不是在线改模型。

## Alternatives Considered

### A. 保持 Diff 默认，仅加强语义标注（方案 B）

- **优点**：更贴近当前「五秒看偏航」习惯；改动面小。
- **缺点**：AI 工作流下主要痛点是「不懂局部设计」，不是「找不到红线」；首屏仍像审计告警页。
- **拒绝理由**：已选定 Understand 默认（方案 A）。

### B. 做成完整需求/业务编排工作台（主图 + 可编辑子图）

- **优点**：覆盖全生命周期设计编辑。
- **缺点**：违反 Core-First 与戒律 3；报告变为第二产品。
- **拒绝理由**：报告只读投影；编辑仍通过 `sextant.json` / 规范与人工确认。

### C. 维持 Target / Actual / Unified 多图为理解主路径

- **优点**：实现已存在。
- **缺点**：强迫用户维护多套视图心智，不利于「一页读懂软件」。
- **拒绝理由**：多图保留为 Diff/钻取选项；默认单一主语义图 + 关联面板。

## Consequences

### 正向收益

1. 报告成为**可读设计说明书 + 可叠加偏航层**，服务 AI 时代「先理解再改」；
2. 模块作用、联系、功能/约束、业务挂钩与偏航状态共享 Stable ID，降低多图维护成本；
3. 与门禁分层一致：结构（`check`）、规则（`invariants`）、行为（`verify`）在同一读图体验中可见而不混判。

### 妥协与代价

1. 首版需补充职责/需求摘要等展示字段或从现有配置派生；缺失时显式「未声明」而非臆造；
2. Understand 默认会使「打开即看红绿」略多一步（需开 Diff）；用角标与一键 Diff 缓解；
3. 业务投影依赖 `acceptance` 等可选配置；未配置时业务面板可为空态，不得阻塞架构 Understand。

### 风险缓解

- 实现前可用本 ADR 约束 PR：任何把默认首屏改回「仅违规列表 + 多图切换」的改动需新 ADR；
- 验收状态展示必须遵守 ADR-008，禁止把 UNVERIFIED 画成通过。

## Evidence / Follow-ups

- 宪章：`AGENTS.md`（Design by Diagram, Diff by Diagram；AI 时代审查痛点）
- 呈现引擎：[ADR-007](./ADR-007-c4-model-and-native-svg-visual-report.md)
- 验收边界：[ADR-008](./ADR-008-design-intent-evidence-boundary.md)
- 后续实现项（非本 ADR 范围）：模块语义面板、业务/需求投影、Understand/Diff 模式切换、需求变更与偏航判定协议 ADR
