# ADR-005: 采用 cac 与 picocolors 构建轻量 CLI 门禁与纯终端退出码契约

## Status
Accepted

## Date
2026-09-16

## Context
SextantDrift 的第一核心交付形态是命令行门禁工具（`packages/cli`，即 `npx sextant-drift check`）。该工具不仅面向人类工程师在本地终端和 CI 流水线中使用，更是 AI Agent（Claude Code, Cursor, Codex 等）编码循环中的实时守卫。

在 [`MISSION.md`](../../MISSION.md) 与 [`docs/REQUIREMENTS.md`](../REQUIREMENTS.md) 中，对 CLI 提出了极其严苛的非功能性指标：
1. **极致冷启动与五秒原则**：CLI 自身的模块加载与命令行解析耗时必须控制在 **10~20ms** 以内，为底层 AST 解析与拓扑比对留足裕度；
2. **Token 经济学（Token Economics）**：AI Agent 读取终端报错时，输出信息必须高信噪比，总 Token 消耗严格限制在 **50 ~ 200 tokens** 以内，坚决杜绝海量无用堆栈污染 Agent 上下文窗口；
3. **工作区零污染（Zero Footprint）**：默认执行 `check` 检查时，**严禁在工作区生成临时 HTML、图片或日志文件**，避免污染 Git 追踪状态；
4. **Unix 标准退出码契约**：必须以清晰的 Exit Code（0, 1, 2）驱动自动化脚本与 CI 阻断。

## Decision
我们决定采用 **`cac` + `picocolors`** 作为 `@sextant/cli` 的核心工具链，并确立纯终端高信噪比输出与标准退出码协议。

具体实施规范：
1. **轻量命令行解析器 (`cac`)**：
   - 打包体积 < 30KB，零外部依赖，冷启动耗时 < 5ms；
   - 声明三大标准命令：`check`（架构体检）、`init`（逆向工程）、`baseline`（历史债务固化）；
   - 支持 Monorepo 子包过滤：`check --filter <package-name>`。
2. **终端着色库 (`picocolors`)**：
   - 体积仅为 `chalk` 的 1/14，执行速度快 10 倍以上，零传递依赖；
   - 输出紧凑 ANSI 格式化文本：明确指示违规类型（`[CRITICAL BYPASS]`）、物理文件行号、事实依据与修复指引。
3. **严格退出码协议**：
   - **`Exit Code 0`（Pass）**：架构完全合规，或历史违规全部在基线（`baseline.json`）中豁免；
   - **`Exit Code 1`（Drift Detected）**：检测到新增架构偏航，阻断提交；
   - **`Exit Code 2`（Fatal Error）**：配置错误（如 `sextant.json` 损坏或未找到）。
4. **按需输出产物与分包解耦**：
   - `@sextant/cli` 自身编译产物体积严格维持 **< 50KB**，仅负责命令行解析与门禁判定，坚决不内置大型离线渲染库；
   - 离线报告模板与 Mermaid.js 资源由独立子包 `@sextant/web-report` 管理；仅在显式传入 `--report` 参数或执行 `report` 命令时，才按需加载渲染并输出独立自包含审查报告 `drift-report.html`；
   - 支持 `--github-summary`：在 CI 中将红绿诊断表格直接输出至 `$GITHUB_STEP_SUMMARY`，零额外权限与 API Token 开销。

## Alternatives Considered

### 1. commander + chalk (行业传统组合)
- **优点**：成熟度极高，社区文档丰富。
- **缺点**：`commander` 与 `chalk` 包含较多历史兼容逻辑与传递依赖，打包体积相比 `cac + picocolors` 大出 10 倍，冷启动有微小但可感知的延迟。
- **拒绝理由**：在频繁触发的高频门禁与毫秒级要求面前，`cac + picocolors` 能够提供更纯粹轻量的工程表现。

### 2. ink (基于 React 的终端富文本交互 UI)
- **优点**：可以构建精美的终端仪表盘、动画和进度条。
- **缺点**：引入了 React 运行时与整个虚拟 DOM 体系，依赖体积超 15MB，冷启动耗时达 200~300ms；其通过 ANSI 控制符实时擦除和重绘终端的机制，会在 CI 日志中产生海量乱码，并严重浪费 AI Agent 读取终端输出时的 Token 额度。
- **拒绝理由**：严重违反“Token 经济学”与“戒律 3（无头先行、拒绝浮夸赛博外壳）”。

## Consequences

### 正向收益
- **毫秒级冷启动**：命令行自身开销近乎为 0，真正做到“回车立见分晓”；
- **Agent 友好度极高**：报错格式精炼紧凑，单次检查仅消耗约 100 tokens，Agent 读完即能立刻定位行号进行自我重构（自省闭环）；
- **CI 原生无摩擦**：无需申请 GitHub Token 或配置复杂 Actions，依托标准退出码与 Step Summary 即可实现现代化 PR 门禁。

### 妥协与代价
- `cac` 功能相较于 `commander` 略显精简（如缺少深度的交互式询问提示符插件），但对于确定性极强的架构门禁工具而言完全够用。
