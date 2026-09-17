# Feature Requirements: Phase 2 — Invariants Engine (语义不变量规则引擎)

> **特性代号**：`phase-2-invariants-engine`  
> **制定日期**：2026-09-17  
> **所属分支**：`feat/phase-2-invariants-engine`  
> **基准契约**：[`AGENTS.md`](file:///home/redtea/Mona_project/SextantDriftV03/AGENTS.md) | [`specs/roadmap.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/roadmap.md) | [`specs/tech-stack.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/tech-stack.md) | [`ADR-004`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-004-invariants-determinism-boundary.md)  
> **状态**：已批准 (Approved by User via AskUserQuestion)

---

## 1. 目标与背景 (Objective & Context)

### 1.1 核心痛点与背景
静态依赖图（DAG）能够精确捕获模块间的分层旁路、逆向引用与闭环依赖，但无法表达微观的**事务边界、时序先验次序与非功能性防护契约**。例如：
- 关键业务操作要求“用户输入必须先持久化落库，方可发起外部 LLM 调用或第三方支付”；
- 表现层与特定模块禁止直接导入敏感库（如特定前端路径直连 `@prisma/client` 或数据库驱动）；
- 外部集成网络请求（如 `fetch`, `axios`）必须显式配置超时（`timeout`）与降级保护。

在以往方案中，如果试图跨文件、跨异步事件总线静态推测运行态时序，必然引发假阳性（误报）噩梦。在工程门禁工具中，**误报等于自杀**。

### 1.2 本次特性使命 (North Star)
依托 TypeScript AST 与官方 Compiler API，在**同一同步作用域（函数体/代码块）**与**文件级导入**的严密确定性边界内，构建高信噪比、零假阳性的**语义不变量规则引擎（Invariants Engine）**：
1. **DSL 解析与 Schema 强校验**：支持从 `sextant.json` 的 `invariants` 字段及 Markdown（`AGENTS.md` / `ARCHITECTURE.md`）中的 ```yaml 块提取规则并做严格语法与字段检验；
2. **时序先验匹配器 (`must_precede`)**：严格限定在同函数/同步作用域（`ts.Block.statements`）中比对语句次序，拦截“未落库即外部调用”或“落库在外部调用之后”等致命缺陷；
3. **文件级违禁导入拦截器 (`forbid_import`)**：匹配作用域路径下的顶级 `ImportDeclaration` 与动态引入，高速拦截越界三方库；
4. **函数入参配置审计器 (`require_config`)**：审计指定网络与客户端调用（`target` 或典型外部请求特征），核验其入参对象字面量是否显式配置了必要参数（如 `timeout`）；
5. **统一调度与诊断报告集成**：将违规以 `type: 'INVARIANT_BROKEN'` 汇入 `DriftReport`，提供精确的物理定位（文件名、1-indexed 行号、列号、代码切片）。

---

## 2. 需求范围与系统边界 (Scope & Boundaries)

### 2.1 包含在内 (In Scope)

1. **依赖与配置升级**：
   - 在 `packages/core` 中引入轻量标准的 `yaml` 依赖包（monorepo `pnpm-lock.yaml` 已收录），负责解析 Markdown 内嵌的 Invariants YAML 代码块；
   - 保持 0 DOM、0 CLI 库依赖，保持纯 ESM 与严格 TypeScript 输出。

2. **Invariants 核心类型系统与 DSL 解析器 (`packages/core/src/invariants/parser.ts`)**：
   - 扩展 `InvariantPattern`，包含 `must_precede`、`target`、`scope`、`forbid_import`、`in_path`、`require_config`；
   - 检验规则完整性：规则 ID 唯一性、模式互斥或组合合法性，缺少必要字段时抛出携带行号/语义上下文的 `ConfigValidationError`；
   - 扩展 `spec-resolver.ts`，从 `AGENTS.md` / `ARCHITECTURE.md` 中提取 ```yaml invariants 块并合并入 `TargetArchitecture.invariants`。

3. **同步作用域 AST 时序先验匹配器 (`packages/core/src/invariants/sequence-matcher.ts`)**：
   - 匹配作用域内（`scope` glob 匹配文件）的函数声明（`FunctionDeclaration`）、方法声明（`MethodDeclaration`）、箭头函数（`ArrowFunction`）与函数表达式（`FunctionExpression`）；
   - 在函数体的块级语句序列中，识别 `target` 调用（如 `llmClient.chat`, `payment.charge`）与 `must_precede` 调用（如 `db.save`, `repository.create`）；
   - 若出现 `target` 但其前置语句未调用任何 `must_precede`，或 `must_precede` 出现在 `target` 之后，生成精准违规证据。

4. **违禁导入拦截器 (`packages/core/src/invariants/import-matcher.ts`)**：
   - 针对 `in_path`（或 `scope`）指定的文件路径集合，检查静态 `import`、穿透 `export ... from` 与动态 `import()`/`require()`；
   - 支持精确模块名和通配符匹配（如 `@prisma/client`, `typeorm`, `src/repositories/**`）。

5. **函数入参配置审计器 (`packages/core/src/invariants/config-matcher.ts`)**：
   - 检查目标函数调用（显式配置 `target`；若未配置 `target`，则针对带有对象实参且函数名符合网络请求特征的调用，如 `fetch|request|get|post|client|call` 等）；
   - 断言其入参对象（`ObjectLiteralExpression`）包含指定的必要配置键（如 `timeout`）。

6. **Invariants 统一执行引擎与顶层整合 (`packages/core/src/invariants/engine.ts`)**：
   - 接收项目源码 AST 字典与 `InvariantRule[]`，并发/流式执行三大匹配器；
   - 深度集成到 `analyzeModuleDrift()`，更新 `DriftReport` 与 `DriftSummary`（新增 `invariantViolationCount` 统计项）。

### 2.2 坚决不做与排除范围 (Anti-Goals / Out of Scope)
- ❌ **坚决不做跨函数/跨模块过程间数据流分析 (Inter-procedural Taint Analysis)**：严禁猜测多文件间的异步调用时序；
- ❌ **坚决不用脆弱的纯正则表达式猜测时序**：必须依托官方 TS AST 节点树；
- ❌ **坚决不引入 CLI 或浏览器库**：核心引擎保持 100% 无头与可测试；
- ❌ **坚决不破坏 Phase 1 已跑通的 38 项单测基线**。

---

## 3. ADR 决议与设计决策映射

| 决策点 | 选定方案 | 决策依据与 ADR |
| :--- | :--- | :--- |
| **匹配深度限制** | 严格限定在同一函数体/代码块 (`ts.Block.statements`) | [`ADR-004`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-004-invariants-determinism-boundary.md)：杜绝假阳性，误报等于自杀 |
| **require_config 匹配策略** | 推荐显式 target；未配 target 时按启发式网络请求特征匹配 | 用户 AskQuestion 确认：杜绝全量函数调用的假阳性 |
| **YAML 解析依赖** | 引入 `yaml` npm 官方库（lockfile 已具备） | 用户 AskQuestion 确认：工业级标准，稳定解析复杂 YAML |
| **报表与模型组织** | 扩展统一 `DriftViolation`，新增 `type: 'INVARIANT_BROKEN'` | 用户 AskQuestion 确认：平滑兼容 CLI 与未来双图报表 |

---

## 4. 核心非功能性指标 (Litmus Test SLOs)

1. **时延与性能指标**：
   - 包含 Invariants 规则检测在内，全套单测执行耗时 **≤ 1000ms**；
   - 单个文件 AST Invariant 规则遍历匹配耗时 **≤ 1ms**。
2. **零误报与零漏报指标**：
   - Positive Case（合规时序、合法导入、配置齐全）：0 违规，保持绿灯；
   - Negative Case（缺失前置、时序颠倒、违禁导入、缺失配置）：100% 捕获，且精确定位到 1-indexed 行号、列号与代码切片。
3. **回归守则**：
   - Phase 1 建立的 16 个测试文件、38 项现有测试用例保持 100% 绿灯。
