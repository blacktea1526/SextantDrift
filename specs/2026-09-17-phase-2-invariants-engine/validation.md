# Feature Validation & Merge Criteria: Phase 2 — Invariants Engine

> **特性代号**：`phase-2-invariants-engine`  
> **制定日期**：2026-09-17  
> **所属分支**：`feat/phase-2-invariants-engine`  
> **基准规范**：[`requirements.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-17-phase-2-invariants-engine/requirements.md) | [`plan.md`](file:///home/redtea/Mona_project/SextantDriftV03/specs/2026-09-17-phase-2-invariants-engine/plan.md)  
> **目标**：明确本次特性实现成功的判定标准（The Litmus Test）与允许合入主分支的硬性门禁。

---

## 1. 终极检验法则 (The Litmus Test)

### 1.1 零假阳性与零假阴性验证 (Zero False Positives & Negatives)
- **DSL 模式解析**：
  - 能够正确提取与校验 `must_precede`、`forbid_import`、`require_config` 规则；
  - 缺失关键字段或格式错误时，100% 抛出清晰的 `ConfigValidationError`。
- **时序先验匹配 (`must_precede`)**：
  - 仅在同函数/同步作用域（`ts.Block.statements`）中比对语句次序，严禁跨函数猜测；
  - 先落库后调网络：保持绿灯；未落库或时序颠倒：100% 捕获并精准给出源文件、行号与切片。
- **违禁导入拦截 (`forbid_import`)**：
  - 仅在 `in_path` 或 `scope` 目标路径拦截目标模块，不误伤其他路径。
- **函数入参配置审计 (`require_config`)**：
  - 带有必填配置（如 `timeout`）正常放行；未传参数或缺失必填配置 100% 捕获。
- **全量回归**：
  - Phase 1 的所有 38 项单测保持 100% 通过。

### 1.2 性能与时延基准 (The 5-Second Rule SLO)
- 全量单测运行时间保持在 1000ms 以内；
- 单文件 Invariants AST 规则匹配时延 ≤ 1ms。

### 1.3 物理分包隔离与纯无头守则
- `@sextant/core` 保持 0 CLI 依赖、0 DOM 依赖；
- 仅新增轻量级 `yaml` 纯解析库。

---

## 2. 自动化验证命令全集

```bash
pnpm install
pnpm -r run build
./start.sh --test
```
