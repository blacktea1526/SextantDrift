# Feature Validation: Phase 4 — CLI 门禁与双图审查报告 (CLI & Visual Report)

> **特性代号**：`phase-4-cli-and-visual-report`  
> **制定日期**：2026-09-17  
> **所属分支**：`feat/phase-4-cli-and-visual-report`  
> **基准规范**：[`requirements.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-17-phase-4-cli-and-visual-report/requirements.md) | [`plan.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-17-phase-4-cli-and-visual-report/plan.md)  
> **目标**：明确 Phase 4 验收标准与合入门禁 (The Litmus Test)

---

## 1. 终极检验准则 (The Litmus Test)

### 1.1 零假阳性与基线抗噪验证
1. **老项目债务隔离**：
   - 在含违规工程（如 `drifted-bypass-app`）执行 `baseline` 生成基线文件后，立即执行 `check` 必须返回 **Exit Code 0**；
   - 终端清晰输出已豁免的债务总数（例如 `ℹ 1 处历史债务已在基线中豁免`）；
2. **代码编辑与格式化免疫**：
   - 在历史违规所在函数内插入任意空行、注释或调整大括号换行格式，再次执行 `check` 必须保持 **Exit Code 0**，绝不误报为新增违规；
3. **新增违规拦截**：
   - 在基线生效状态下，人为引入 1 处新违规，执行 `check` 必须精准捕获且仅报告该处违规，并返回 **Exit Code 1**。

### 1.2 性能与资源指标 (The 5s Rule & Footprint)
1. **冷启动耗时**：
   - 执行 `npx sextant-drift --help` 命令行冷启动耗时 ≤ 10ms；
2. **Token 经济学**：
   - 单次违规 ANSI 终端报错字符量折合 Token 消耗处于 **50 ~ 200 Tokens** 区间；
3. **纯净零污染**：
   - 默认执行 `check` 判定后，`git status --porcelain` 验证无任何临时 HTML、截图或日志生成；
4. **离线双图报告**：
   - 显式传参 `--report` 时生成自包含 `drift-report.html`，可在断网状态下完整渲染 Target 与 Actual 架构图。

---

## 2. 自动化验证全流程命令

```bash
# 1. 依赖与编译
./start.sh --build

# 2. 全量单元测试 (Core + CLI + WebReport)
./start.sh --test

# 3. CLI 端到端门禁验证
# A. 合规工程检查
node packages/cli/dist/bin/sextant-drift.js check packages/core/tests/fixtures/clean-layered-app
# Exit Code 必须为 0

# B. 违规工程检查
node packages/cli/dist/bin/sextant-drift.js check packages/core/tests/fixtures/drifted-bypass-app
# Exit Code 必须为 1
```
