# Feature Requirements: Phase 4 — CLI 门禁与双图审查报告 (CLI & Visual Report)

> **特性代号**：`phase-4-cli-and-visual-report`  
> **制定日期**：2026-09-17  
> **所属分支**：`feat/phase-4-cli-and-visual-report`  
> **基准契约**：[`AGENTS.md`](file:///home/redtea/Mona_project/SextantDriftV03/AGENTS.md) | [`ROADMAP.md`](file:///home/redtea/Mona_project/SextantDriftV03/ROADMAP.md) | [`ADR-005`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-005-cli-framework-and-terminal-output.md) | [`ADR-006`](file:///home/redtea/Mona_project/SextantDriftV03/docs/decisions/ADR-006-brownfield-baseline-ast-fingerprinting.md)  
> **阶段定位**：Core MVP 闭环交付，打通从内核到真实工程自用守护

---

## 1. 核心目标与背景 (Objectives & Context)

### 1.1 背景与业务痛点
`@sextant/core` 已经具备了完整的 TypeScript AST 拓扑提取、模块分层差分（Bypass, Inversion, Cycle, Forbidden Import）与同步作用域语义不变量（Invariants Engine）检验能力。然而：
1. **缺少统一接入入口**：开发者与 AI Agent 无法通过一行命令执行门禁判定；
2. **存量项目历史债务阻碍**：老工程直接接入时存在历史违规，若必须一次性清空会导致无法落地，亟需“历史豁免、新增零容忍”的基线机制；
3. **缺少直观视觉审查交付物**：在 PR 人工核验时，需要无摩擦、零安装的双图红绿审查报告；
4. **Agent 上下文消耗敏感**：门禁输出若产生海量堆栈或废话，将极大消耗 LLM 上下文 Token，并干扰自动修复闭环。

### 1.2 核心需求与验收指标
1. **CLI 命令行极轻量 (`@sextant/cli`)**：
   - 采用 `cac` + `picocolors` 构建，冷启动时延 ≤ 10ms，打包体积 ≤ 50KB；
   - 提供 `check`, `init`, `baseline`, `report` 四大标准命令；
   - 提供全局参数 `--json`, `--strict`, `--filter`；
2. **确定性门禁命令 (`check`)**：
   - 标准 Unix 退出码：`0`（无偏航或历史债务全豁免）、`1`（存在新增偏航）、`2`（致命错误）；
   - ANSI 紧凑输出：单次检查消耗 **50 ~ 200 Tokens**；
   - 违规输出四要素：严重级别标签（`[CRITICAL BYPASS]`）、物理文件与 1-indexed 行号（`src/...:47`）、确凿导入/调用证据、违背规则与修复建议；
   - 零临时文件污染（默认执行不产生 HTML、图片或日志）；
3. **存量债务基线 (`baseline`)**：
   - 落地 ADR-006 双模 AST 语义指纹（SHA-256）算法；
   - 免疫空行增删、注释调整与代码格式化；
   - 存储于 `.sextant/baseline.json`，支持 Git 纳管；
4. **逆向推导初始化 (`init`)**：
   - 一键扫描现有工程结构，自动识别组件层级并生成 `sextant.json` 与 `ARCHITECTURE.md`（内嵌 Mermaid）；
5. **单文件自包含双图审查报告 (`web-report`)**：
   - 仅在追加 `--report` 时按需生成 `drift-report.html`；
   - 左屏 Target，右屏 Actual（标红偏航连线），提供可折叠的行级违规证据卡片；
   - 离线内联 CSS 与 Mermaid.js，断网正常渲染。

---

## 2. 详细功能规范 (Detailed Specifications)

### 2.1 退出码契约 (Exit Codes)
| 退出码 | 含义 | 触发场景 |
| :---: | :--- | :--- |
| `0` | **Passed / Exempted** | 源码完全合规，或者检测到的所有违规均在 `.sextant/baseline.json` 中已豁免 |
| `1` | **Drift Detected** | 检测到至少 1 处未在基线中豁免的新增架构偏航 (New Architectural Drift) |
| `2` | **Fatal Error** | 配置文件损坏、找不到目标目录、或 AST 解析发生不可恢复异常 |

### 2.2 AST 语义指纹契约 (ADR-006)
1. **模块与组件级违规**：
   $$\text{Fingerprint} = \text{SHA256}(\text{CallerComponent} + \text{"->"} + \text{CalleeComponent} + \text{":"} + \text{ImportedSymbol} + \text{":"} + \text{ViolationType})$$
2. **函数级语义不变量违规**：
   $$\text{Fingerprint} = \text{SHA256}(\text{NormalizedFilePath} + \text{":"} + \text{EnclosingFunction} + \text{":"} + \text{TargetCall} + \text{":"} + \text{RuleId})$$
3. **基线 JSON Schema (`.sextant/baseline.json`)**：
   ```json
   {
     "version": "1.0.0",
     "generatedAt": "2026-09-17T15:00:00.000Z",
     "totalExemptions": 3,
     "fingerprints": [
       {
         "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
         "type": "CRITICAL_BYPASS",
         "sourceComponent": "OrderController",
         "targetComponent": "OrderRepo",
         "description": "Bypass from presentation to infra"
       }
     ]
   }
   ```

---

## 3. 非功能性指标 (SLOs)
1. **五秒原则**：在包含 10 万行代码的项目中，执行 `check` 耗时 ≤ 3 秒；
2. **零假阳性**：基线对行号偏移保持 100% 免疫；
3. **Token 经济学**：每次报错严格控制在 50~200 Tokens，保证 AI Agent 单轮对话即刻读懂并自我修复；
4. **分包独立性**：`@sextant/cli` 体积严格 < 50KB，离线报告资源由 `@sextant/web-report` 独立承载。
