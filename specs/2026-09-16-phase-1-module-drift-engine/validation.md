# Feature Validation & Merge Criteria: Phase 1 — Module Drift Engine

> **特性代号**：`phase-1-module-drift-engine` (SP01)  
> **制定日期**：2026-09-16（重构升级：2026-10-04）  
> **所属分支**：`feat/phase-1-module-drift-engine`  
> **基准规范**：[`requirements.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-16-phase-1-module-drift-engine/requirements.md) | [`plan.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-16-phase-1-module-drift-engine/plan.md)  
> **目标**：明确本次特性与重构成功的判定标准（The Litmus Test）与允许合入主分支的硬性门禁。

---

## 1. 终极检验法则 (The Litmus Test)

本特性在允许合入 `main` 分支前，必须**无条件且全额**通过以下三大硬性检验：

### 1.1 零假阳性与零假阴性验证 (Zero False Positives & Negatives)
- **合规项目（Positive Test）**：
  - 在 `packages/core/tests/fixtures/clean-layered-app` 上运行 `analyzeModuleDrift()`；
  - **断言**：`report.passed === true`，`report.violations.length === 0`，`report.exitCode === 0`；
  - **容忍度**：**0 处误报**。任何将合规代码判定为漂移的行为即视为测试失败。
- **项目自举验证（Self-Dogfooding Test）**：
  - 在 SextantDrift 自身仓库根目录运行架构核验（`./start.sh --check`）；
  - **断言**：自身 239+ 个源文件、770+ 依赖条目判定为 **0 处漂移**，严格确保 pipeline 与 analyzer 之间无分层违规或逆向依赖。
- **违规项目（Negative Test）**：
  - 在 `packages/core/tests/fixtures/drifted-bypass-app` 上运行 `analyzeModuleDrift()`；
  - **断言**：预设的架构违规（Controller 跨层直连 Repo、Service 逆向导入 Controller、循环依赖 A->B->A、未授权导入 `@prisma/client`）必须 **100% 准确捕获**；
  - **行号精准度**：捕获的每一条违规必须精准匹配源文件代码行（1-indexed）与列号，代码片段（snippet）完全对齐实际源码；
  - **断言**：`report.passed === false`，`report.exitCode === 1`。

### 1.2 性能与时延基准 (The 5-Second Rule SLO)
- **全量测试套件执行时延**：
  - 运行 `./start.sh --test`，全量 67 个测试套件、396+ 单元测试并发运行耗时必须 **≤ 15s**。
- **AST 依赖抽取与比对吞吐**：
  - 单文件 AST 解析耗时 **≤ 0.5ms**；
  - 图论 Tarjan SCC 成环与分层比对算法在 5000 节点图上执行耗时 **≤ 5ms**；
  - 峰值内存占用 **≤ 256MB**。

### 1.3 物理分包隔离与零污染守则 (Boundary & Clean Footprint)
- **核心包隔离性**：
  - `@sextant/core` 严禁引入任何 CLI 库（`cac`, `picocolors`, `commander` 等）；
  - `@sextant/core` 严禁引入任何 DOM / 浏览器库（`react`, `vue`, `jsdom` 等）；
  - `@sextant/core` 仅导出纯函数，无全局可变状态残留。
- **阶段化流水线解耦**：
  - `packages/core/src/index.ts` 保持纯净门面，主执行逻辑委托至 `packages/core/src/pipeline/module-drift-pipeline.ts`；
  - 实际依赖图构建抽取至 `packages/core/src/pipeline/actual-graph-builder.ts`。
- **环境纯净度**：
  - 运行整个测试与比对流程后，工作区内 **0 临时 HTML 文件、0 临时 JSON 垃圾**。

---

## 2. 自动化验证命令全集 (Automated Verification Commands)

合入前需在根目录顺序执行以下命令并确保全部绿灯退出（Exit Code 0）：

```bash
# 1. 全量包严格 TypeScript 类型检查与构建
./start.sh --build

# 2. 运行全量 Vitest 单元测试 (67 个套件, 396+ 用例全部通过)
./start.sh --test

# 3. 运行端到端架构门禁实测 (包含项目自举与双向核验)
./start.sh --check
```

---

## 3. 合并门禁核查清单 (PR Merge Checklist)

- [x] **代码分包契约**：
  - [x] `packages/core` 生产依赖仅依赖 `typescript` 与 `yaml`；
  - [x] 导出产物为标准化 ESM 并带有完备的 `.d.ts` 类型声明文件。
- [x] **架构流水线重构**：
  - [x] 主分析函数解耦为 5 阶段流水线架构 (`executeModuleDriftPipeline`)；
  - [x] 实际图提取与 Barrel 穿透逻辑封装入 `buildActualDependencyGraph`；
  - [x] `sextant.json` 架构自举校验保持 0 处违规与偏航。
- [x] **多语言与高级特性**：
  - [x] 支持 Python `.py` 静态依赖解析与标准库过滤；
  - [x] 支持 Barrel 文件多跳穿透追踪；
  - [x] 支持骨架空组件告警与未映射文件覆盖率校验。
- [x] **测试覆盖与质量**：
  - [x] 67 个测试文件全部通过（396 Tests Passed）；
  - [x] 自举测试通过；
  - [x] 单测套件运行控制在秒级区间。
