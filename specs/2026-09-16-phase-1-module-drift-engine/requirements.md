# Feature Requirements: Phase 1 — Module Drift Engine (模块与分层漂移引擎)

> **特性代号**：`phase-1-module-drift-engine` (SP01)  
> **制定日期**：2026-09-16（重构升级：2026-10-04）  
> **所属分支**：`feat/phase-1-module-drift-engine`  
> **基准契约**：[`AGENTS.md`](file:///home/redtea/Mona_project/SextantDriftV03/AGENTS.md) | [`specs/mission.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/mission.md) | [`specs/tech-stack.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/tech-stack.md) | [`specs/roadmap.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/roadmap.md)  
> **状态**：已批准并重构就绪 (Approved & Refactored)

---

## 1. 目标与背景 (Objective & Context)

### 1.1 核心痛点与背景
在 2026 年 AI 编程普及的背景下，AI Agent 生成代码速度极高，但倾向于“单点局部跑通即完工”，极易破坏分层边界（如 Controller 直接操作数据库、底层模块反向导入上层模块、模块间循环调用、通过中间 Barrel 文件隐蔽跨层）。行级 `git diff` 支离破碎，开发者在审查数十个文件时难以发现架构腐化。

### 1.2 本次特性使命 (North Star)
打造 `@sextant/core` 纯无头核心引擎中**确定性级别为 8~10 的拓扑提取、Barrel 穿透与分层漂移比对能力**：
1. 确立 Monorepo 物理分包架构，保证 `@sextant/core` 具备 **0 DOM、0 CLI 依赖、纯函数暴露、毫秒级测试** 的纯粹性；
2. 依托官方 **TypeScript Compiler API** 与轻量 Python 语法解析器，从物理源文件中提取真实确定性的代码依赖关系图（Actual Dependency Graph）；
3. 解析架构设计规范（Target Architecture），支持双源输入（`sextant.json` 为首要单源事实，向下回退解析 Markdown/Mermaid）；
4. 运用图论算法（Tarjan SCC 与有向图遍历），精准捕获**跨层旁路 (Layer Bypass)**、**逆向依赖 (Layer Inversion)** 与**循环依赖 (Cycles)**，输出携带物理证据（文件路径、精确行号、列号、违规代码切片）的结构化 `DriftReport`；
5. **阶段化管道重构 (Pipeline Architecture)**：解耦主控函数为高内聚、易测试的五阶段流水线（Spec 解析 -> 源码扫描 -> 图构建与 Barrel 穿透 -> 模块漂移检测 -> 报告汇聚）。

---

## 2. 需求范围与系统边界 (Scope & Boundaries)

### 2.1 包含在内 (In Scope)

1. **工程基座 (Phase 0 Monorepo 基线)**：
   - 建立 `pnpm` 工作区多包管理：根工程 + `@sextant/core` + `@sextant/cli` + `@sextant/web-report` 物理目录分包契约；
   - 建立统一严格 TypeScript 编译流水线（`tsconfig.base.json`，`ES2022`/`NodeNext`，`strict: true`）与 `tsup` ESM 构建；
   - 建立毫秒级并发测试套件（Vitest）与内存源码虚拟编译测试辅助工具（`test-project.ts`）。

2. **架构意图规范解析器 (Spec Parser & Resolver)**：
   - 解析结构化 JSON 规范（`sextant.json` 或 `.sextant/architecture.json`），包含 `layers`、`components`、`allowDependencies`、`invariants`；
   - 向下兼容回退提取 `ARCHITECTURE.md` 或 `AGENTS.md` 中的 Mermaid `graph TD` / `flowchart TD` 与 YAML 约束块；
   - 将意图转换为内存只读拓扑模型 `TargetArchitecture`，并提供 `.toMermaid()` 纯函数。

3. **静态物理依赖提取与多语言解析器 (AST Analyzer & Polyglot Engine)**：
   - 基于 `ts.createSourceFile` 遍历项目源码中所有 `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`（严格排除 `node_modules`, `dist`, `.git`）；
   - 支持 Python `.py` 源码静态导入抽取（`extractPythonDependencies` 与 `resolvePythonModulePath`）；
   - 捕获静态 `import`、`import type`、穿透 `export ... from`、动态 `import()` 与 CommonJS `require()`；
   - **路径别名与继承解析 (Path & Project Resolver)**：解析 `tsconfig.json` 的 `baseUrl`、`paths` 以及跨文件 `extends` 配置；
   - **Barrel 文件多跳穿透追踪 (Barrel Tracer)**：追踪通过 `index.ts` 重导出的深层目标，穿透虚假中间层直接暴露底层真实组件依赖；
   - **C4 噪音过滤器 (Noise Filter)**：未归入任何组件的工具/横切逻辑（`utils/**`, `logger.ts`）自动判定为全局横切，不触发伪跨层报警。

4. **拓扑与图论算法库 (Graph & Comparator Engine)**：
   - 有向图邻接表数据结构 `DirectedGraph`；
   - 基于 Tarjan 算法的强连通分量成环检测，复杂度严格控制在 $O(V + E)$；
   - 分层漂移比对器：
     - **跨层旁路 (Layer Bypass - CRITICAL)**：如 Presentation 跳过 Domain 直接依赖 Infra；
     - **逆向依赖 (Layer Inversion - CRITICAL)**：如 Domain 反向依赖 Presentation；
     - **违规外联 (Forbidden Import - CRITICAL)**：如前端直接引用 `@prisma/client`；
     - **骨架空组件告警 (Empty Component - WARNING)**：规范中声明但物理代码中未实现的骨架组件防护。

5. **流水线调度与标准化报表 (Pipeline Architecture & DriftReport)**：
   - 阶段化分析管道 `executeModuleDriftPipeline()`，分离配置加载、文件抽取、图构建、违规比对与结果汇聚；
   - 纯函数顶层导出 `analyzeModuleDrift()`；
   - 双向成对用例守护（`clean-layered-app` 与 `drifted-bypass-app`）。

### 2.2 坚决不做与排除范围 (Anti-Goals / Out of Scope)
- ❌ **坚决不做微观代码风格与变量检查**：不抢 ESLint / Biome 职责；
- ❌ **坚决不推测异步时序与事件流**：静态分析不做 Promise.all、EventEmitter 猜测，杜绝假阳性；
- ❌ **坚决不在日常执行生成临时 HTML 文件**：零文件污染，不产出未请求的报告；
- ❌ **坚决不绑定重型外壳与私有云端**：0 DOM、0 UI 依赖、0 账号登录、0 数据上云；
- ❌ **坚决不采信 Agent 自证**：实际依赖拓扑 100% 由编译器 AST 客观提取。

---

## 3. 关键设计决策与 ADR 映射 (Decisions & ADR Context)

| 决策维度 | 选定方案 | 对应 ADR | 决策核心依据 |
| :--- | :--- | :--- | :--- |
| **工作区架构** | pnpm Workspaces | [`ADR-001`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-001-monorepo-package-manager.md) | 物理隔离子包，杜绝幽灵依赖，硬链接节省空间 |
| **AST 解析引擎** | TypeScript Compiler API 官方库 + Python 解析器 | [`ADR-002`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-002-ast-analysis-engine.md) | 原生对齐语法演进，精确还原 `paths`/`extends`，确定性为 10 |
| **架构单源格式** | `sextant.json` (首选) + Mermaid (向下兼容) | [`ADR-003`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-003-architecture-spec-format.md) | JSON Schema 供机器/AI 秒级无歧义读写；Mermaid 供人类可视化 |
| **静态分析边界** | 仅限确定性 DAG 与 AST 节点，严禁猜时序 | [`ADR-004`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-004-invariants-determinism-boundary.md) | 宁可少报，绝不误报（误报等于自杀） |
| **报表与呈现边界** | 核心包 0 DOM, 0 CLI；格式化剥离至外层 | [`ADR-005`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-005-cli-framework-and-terminal-output.md) | 保持核心极速轻巧，纯函数可复用于 CLI、CI、报告生成器 |
| **C4 模型多级分层** | Level 2 Container + Level 3 Component | [`ADR-007`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-007-c4-model-and-native-svg-visual-report.md) | 解决单大图过载，提供容器级宏观与组件级微观双重视图 |

---

## 4. 核心非功能性指标 (Litmus Test SLOs)

1. **五秒原则 (The 5s Rule)**：
   - 10 万行 TS 源码扫描与 AST 依赖提取端到端耗时 **≤ 1.5s**；
   - 内存依赖图 Tarjan 环检测与分层比对耗时 **≤ 10ms**；
   - 自举自测项目扫描与验证耗时 **≤ 1.5s**；
   - 峰值内存占用 **≤ 256MB**。
2. **零幻觉底线 (Zero False Positives)**：
   - `clean-layered-app` 测试夹具违规判定必须为 0；
   - 项目自身自举架构核验（Dogfooding）违规数必须为 0；
   - `drifted-bypass-app` 测试夹具每一处违规必须具备准确文件名、1-indexed 行号、列号与代码切片证据。
3. **测试套件运行速度**：
   - 整个单测套件（67 个测试文件、396 个用例）并发运行耗时 **≤ 15s**。
