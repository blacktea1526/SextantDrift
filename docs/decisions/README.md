# SextantDrift 架构决策记录索引 (ADR Index)

> 本目录遵循架构决策记录（Architecture Decision Records, ADR）规范，用于固化并归档 SextantDrift 2.0 研发过程中所有关键架构与技术选型的决策背景、权衡考量及演进后果。
> 
> **核心原则**：代码记录“是什么（What）”，ADR 记录“为什么这么做（Why）与拒绝了什么（Rejected Alternatives）”。所有已接受的决策均具备不可篡改的技术定力，任何推翻或演进必须通过提交新的 ADR 并废弃/取代旧记录。

---

## 1. 架构决策状态总览 (Decisions Register)

| 编号 | 决策标题 | 核心决策选型 | 当前状态 | 决策日期 |
| :--- | :--- | :--- | :--- | :--- |
| [ADR-001](./ADR-001-monorepo-package-manager.md) | Monorepo 管理与包边界隔离 | `pnpm workspaces` 隔离依赖与防幽灵依赖 | **Accepted** | 2026-09-16 |
| [ADR-002](./ADR-002-ast-analysis-engine.md) | 源码 AST 拓扑提取引擎 | 官方 `typescript` Compiler API | **Accepted** | 2026-09-16 |
| [ADR-003](./ADR-003-architecture-spec-format.md) | 架构规范事实单源载体 | 结构化 JSON (`sextant.json`) + JSON Schema | **Accepted** | 2026-09-16 |
| [ADR-004](./ADR-004-invariants-determinism-boundary.md) | 语义不变量分析深度与确定性边界 | 限定于同函数/块作用域语句序与文件级 Import | **Accepted** | 2026-09-16 |
| [ADR-005](./ADR-005-cli-framework-and-terminal-output.md) | CLI 门禁工具链与终端呈现 | `cac` + `picocolors` + Unix 退出码 (0/1/2) | **Accepted** | 2026-09-16 |
| [ADR-006](./ADR-006-brownfield-baseline-ast-fingerprinting.md) | 存量项目历史基线债务管理 | AST 语义指纹算法 + Git 版本纳管 | **Accepted** | 2026-09-16 |
| [ADR-007](./ADR-007-c4-model-and-native-svg-visual-report.md) | C4 多层级模型与原生零 CDN SVG 审查引擎 | C4 Model (L1~L3) + 零依赖原生 SVG 画布 + XSS 防御 | **Accepted** | 2026-09-20 |

---

## 2. ADR 生命周期与工作流 (Lifecycle)

每个 ADR 文档遵循以下状态流转：

```
[ PROPOSED ] ──► [ ACCEPTED ] ──► [ SUPERSEDED (被新 ADR 取代) ]
                      │
                      └──► [ DEPRECATED (已弃用) ]
```

- **严禁删除历史 ADR**：即使某项技术在未来被重构或替换，旧的 ADR 必须保留在仓库中以供追溯当时的历史约束；
- **取代旧决策**：当做出新决策时，新建 `ADR-00X`，在状态栏标注 `Supersedes ADR-YYY`，并在被取代的旧 ADR 中更新状态为 `Superseded by ADR-00X`。

---

## 3. ADR 编写标准模板 (Template Reference)

```markdown
# ADR-00X: [决策标题]

## Status
Accepted | Proposed | Superseded by ADR-XXX | Deprecated

## Date
YYYY-MM-DD

## Context (背景与约束)
阐述面临的真实业务痛点、核心技术约束、非功能性需求（如 5 秒原则、零误报要求等）。

## Decision (技术决策)
清晰陈述选定的技术栈、框架或设计方案，以及在系统中的应用范围。

## Alternatives Considered (被否决方案对比)
- 备选方案 A：优点 (Pros)、缺点 (Cons)、拒绝理由 (Rejected Rationale)
- 备选方案 B：优点 (Pros)、缺点 (Cons)、拒绝理由 (Rejected Rationale)

## Consequences (决策后果与收益/权衡)
- 正向收益 (Positive Impacts)
- 妥协与代价 (Trade-offs & Constraints)
- 风险缓解措施 (Mitigations)
```
