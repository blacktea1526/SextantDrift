# Feature Validation & Merge Criteria: Phase 1 — Module Drift Engine

> **特性代号**：`phase-1-module-drift-engine`  
> **制定日期**：2026-09-16  
> **所属分支**：`feat/phase-1-module-drift-engine`  
> **基准规范**：[`requirements.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-16-phase-1-module-drift-engine/requirements.md) | [`plan.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-16-phase-1-module-drift-engine/plan.md)  
> **目标**：明确本次特性实现成功的判定标准（The Litmus Test）与允许合入主分支的硬性门禁。

---

## 1. 终极检验法则 (The Litmus Test)

本特性在允许合入 `main` 分支前，必须**无条件且全额**通过以下三大硬性检验：

### 1.1 零假阳性与零假阴性验证 (Zero False Positives & Negatives)
- **合规项目（Positive Test）**：
  - 在 `packages/core/tests/fixtures/clean-layered-app` 上运行 `analyzeModuleDrift()`；
  - **断言**：`report.passed === true`，`report.violations.length === 0`，`report.exitCode === 0`；
  - **容忍度**：**0 处误报**。任何将合规代码判定为漂移的行为即视为测试失败。
- **违规项目（Negative Test）**：
  - 在 `packages/core/tests/fixtures/drifted-bypass-app` 上运行 `analyzeModuleDrift()`；
  - **断言**：预设的 4 处架构违规（Controller 跨层直连 Repo、Service 逆向导入 Controller、循环依赖 A->B->A、未授权导入 `@prisma/client`）必须 **100% 准确捕获**；
  - **行号精准度**：捕获的每一条违规必须精准匹配源文件代码行（1-indexed）与列号，代码片段（snippet）完全对齐实际源码；
  - **断言**：`report.passed === false`，`report.exitCode === 1`。

### 1.2 性能与时延基准 (The 5-Second Rule SLO)
- **单测执行时延**：
  - 运行 `pnpm --filter @sextant/core test`，整个单元测试套件并发运行耗时必须 **≤ 1000ms**。
- **AST 依赖抽取与比对吞吐**：
  - 在规模化测试夹具上，单文件 AST 解析耗时 **≤ 0.5ms**；
  - 图论 Tarjan SCC 成环与分层比对算法在 5000 节点图上执行耗时 **≤ 5ms**；
  - 峰值内存占用 **≤ 256MB**。

### 1.3 物理分包隔离与零污染守则 (Boundary & Clean Footprint)
- **核心包隔离性**：
  - `@sextant/core` 严禁引入任何 CLI 库（`cac`, `picocolors`, `commander` 等）；
  - `@sextant/core` 严禁引入任何 DOM / 浏览器库（`react`, `vue`, `jsdom` 等）；
  - `@sextant/core` 仅导出纯函数，无全局可变状态残留。
- **环境纯净度**：
  - 运行整个测试与比对流程后，工作区内 **0 临时 HTML 文件、0 临时 JSON 垃圾**，`git status --porcelain` 保持干净。

---

## 2. 自动化验证命令全集 (Automated Verification Commands)

合入前需在根目录顺序执行以下命令并确保全部绿灯退出（Exit Code 0）：

```bash
# 1. 依赖完整性与多包链接检查 (无幽灵依赖、无报错)
pnpm install

# 2. 全量包严格 TypeScript 类型检查与 ESM 构建 (≤ 1.5s)
pnpm -r build

# 3. 运行全量 Vitest 单元测试与端到端夹具测试 (≤ 1000ms)
pnpm test

# 4. 代码覆盖率检查 (要求核心分支与语句覆盖率 ≥ 90%)
pnpm --filter @sextant/core test:coverage

# 5. 基准性能压测 (验证 SLO 达成)
pnpm --filter @sextant/core bench
```

---

## 3. 合并门禁核查清单 (PR Merge Checklist)

在发起 PR 合入 `main` 前，请逐项核对并确认：

- [ ] **代码分包契约**：
  - [ ] `packages/core` 依赖表纯净，仅依赖 `typescript`；
  - [ ] `pnpm-workspace.yaml` 与子包拓扑结构完整；
  - [ ] 导出产物为标准化 ESM 并带有完备的 `.d.ts` 类型声明文件。
- [ ] **功能完整度**：
  - [ ] `sextant.json` 结构化规范能被正确校验与解析；
  - [ ] Markdown / Mermaid 中的图与约束能被正常降级解析；
  - [ ] TypeScript AST 能完整捕获 4 类导入/导出形态；
  - [ ] `tsconfig.json` 中的 `paths` 别名还原准确无误；
  - [ ] Tarjan 算法能准确输出有向图成环闭合路径；
  - [ ] 分层比对器能区分 Bypass、Inversion 与 Forbidden Import；
  - [ ] 输出统一且序列化友好的 `DriftReport` 结构体。
- [ ] **测试覆盖与质量**：
  - [ ] 包含 Pairwise 正反测试夹具（`clean-layered-app` 与 `drifted-bypass-app`）；
  - [ ] 单测执行时间控制在 1 秒以内；
  - [ ] 核心模块覆盖率达标（≥ 90%）；
  - [ ] 所有代码注释符合规范，未引入未经确认的临时依赖。
