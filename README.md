# SextantDrift (六分仪架构偏航检测罗盘)

<p align="center">
  <strong>面向 2026 AI Coding 与现代工程团队的「架构 X 光机与偏航检测罗盘」</strong><br>
  <em>Design by Diagram, Diff by Diagram · 用确定性拓扑与红绿差分终结盲目肉眼审查</em>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_EN.md">English</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6-blue.svg" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-Native%20Server-purple.svg" alt="MCP Server"></a>
  <a href="https://github.com/blacktea1526/SextantDrift"><img src="https://img.shields.io/badge/Polyglot-TS%20%7C%20Python%20%7C%20Go-orange.svg" alt="Polyglot"></a>
</p>

---

## 💡 为什么需要 SextantDrift？

2026 年软件工程的核心矛盾是：**“人审不过来 AI 写出的代码”**。

AI 辅助编程（Cursor、Claude Code、Copilot、Antigravity）使代码产出速度暴涨，但随之而来的是：
- **行级 `git diff` 支离破碎**：成百上千行改动掩盖了架构违规，开发者“见木不见林”，看不出 Controller 越过了 Service 直连数据库，更看不出模块间形成了隐蔽的循环依赖；
- **传统设计图画完即弃**：不管是 Miro、Draw.io 还是文字 PRD，画完便与代码脱节，管不住代码的腐化；
- **Agent 自证即幻觉**：让 AI “自我审查代码是否符合架构”，无异于让嫌疑人自写结案报告，必出幻觉套娃。

**SextantDrift 的回答**：
> 抛弃文字巨石与脆弱的 Agent 自述，打造确定性的**“架构 X 光机”**。  
> **80% 图（骨架与拓扑） + 20% 规则（灵魂与语义不变量）**，永远只看设计意图与源码实际拓扑的**两张图红绿差分**。

---

## ⚡ 核心能力全景 (Key Capabilities)

```
┌──────────────────────────────────────┐             ┌──────────────────────────────────────┐
│        设计意图 (Target Spec)         │             │        真实代码 (Actual Code)         │
│     C4 分层 · 允许连线 · 语义约束     │     VS      │    从源码 AST 确凿解析的物理调用图   │
└──────────────────────────────────────┘    (Diff)   └──────────────────────────────────────┘
                   │                                                     │
                   └──────────────────────────┬──────────────────────────┘
                                              ▼
                         ┌──────────────────────────────────────────┐
                         │        偏航告警区 (Drift Findings)       │
                         │    跨层越界 · 逆向依赖 · 语义规则破损    │
                         │    循环依赖 · 状态机死锁 · 违禁模块引入  │
                         └──────────────────────────────────────────┘
```

| 核心维度 | 检测能力 | 说明 |
| :--- | :--- | :--- |
| **层级防腐** | **跨层旁路 (Layer Bypass)** | 严格单向流动，阻断上层跳过中间层直连底层（如 Controller 直连 Repo） |
| **依赖拓扑** | **逆向依赖 (Layer Inversion)** | 底层模块反向导入上层业务模块时立即阻断（如 Infra 反向引用 UI） |
| **图环分析** | **循环依赖 (Circular Dependency)** | 基于 [Tarjan SCC 强连通分量算法](packages/core/src/graph/tarjan.ts) 毫秒级识别依赖闭环并定位成环文件 |
| **模块边界** | **违规导入 (Forbidden Imports)** | 隔离关键边界（如前端严禁导入 Node 原生模块，领域层严禁导入 ORM 驱动） |
| **时序语义** | **语义不变量 (Semantic Invariants)** | AST 模式匹配验证关键时序（如“落库持久化必须在外部不可靠调用之前发生”） |
| **状态机安全** | **状态机完整性 (State Verifier)** | 解析 Mermaid 状态图，检测黑洞状态（无出口）、孤岛节点与缺失超时/降级分支 |
| **设计可读** | **需求邻居图 (Understand First)** | [ADR-009](docs/decisions/ADR-009-report-understand-first.md) 默认 Understand 模式，按直接邻居投影四列排布，读懂设计后再看偏航 |
| **生态互通** | **原生 MCP 服务 (@sextant/mcp-server)** | 为 Cursor / Claude 提供 `check_file` 毫秒级前置守卫，AI 编码即刻自我纠正 |

---

## 🌐 多语言支持矩阵 (Polyglot Matrix)

SextantDrift 绝不仅限于 TypeScript，它构建了跨语言的纯无头静态 AST 分析底座：

- **Tier 1 (原生确凿 AST 分析)**：
  - **TypeScript / JavaScript**（TS Compiler API，完全解析 TSX / JSX / ESM / CJS / 别名 / Barrel 重导出）
  - **Python**（原生 AST 解析器，识别 `import`、`from ... import`、相对导入与包层级）
  - **Go**（Go 语法与模块导入解析器，识别 Go 包依赖拓扑与跨层调用）
- **Tier 2 (AI 规范与运行时因果)**：
  - **OpenSpec & AGENTS.md**（原生兼容主流 Spec-Driven 工作流）
  - **Mermaid C4 & StateDiagram**（架构意图只读投影与状态机校验）
  - **动态运行时 Trace**（Phase 5 实验性异步因果 DAG 差分：`--trace`）

---

## 🚀 三分钟快速上手 (Quick Start)

无需预先繁琐画图，支持**“逆向 X 光”推导现有代码**：

```bash
# 步骤 1：扫描现有项目源码（支持 TS/JS/Python/Go），自动反向推导架构规范
npx sextant-drift init

# 步骤 2：执行极速架构偏航检查（五秒原则，输出终端诊断与精确行号）
npx sextant-drift check

# 步骤 3：生成自包含、零安装、纯原生 SVG 离线审查报告
npx sextant-drift report
```

### 全局安装或作为开发依赖引入

```bash
# 使用 pnpm (推荐)
pnpm add -D sextant-drift

# 使用 npm
npm install --save-dev sextant-drift
```

---

## 🤖 AI 编程协同：MCP 原生集成 (Cursor / Claude / Windsurf)

这是让 AI Coding Agent 保持架构理智的**最有效姿态**：在 AI 生成代码的瞬间进行毫秒级拦截，避免把脏代码提交到仓库。

### 1. 一键为本地 IDE 安装 MCP 配置
```bash
npx sextant-drift mcp install
```
命令会自动探测并安全写入 `.cursor/mcp.json` 或 Claude 桌面端配置。

### 2. 手动配置 (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "sextant-drift": {
      "command": "npx",
      "args": ["-y", "sextant-drift", "mcp", "run"]
    }
  }
}
```

### 3. AI 获得的四大超能力工具
- **`check_file`**：单文件增量预检。AI 在保存/生成文件前调用，发现跨层即刻自行改对；
- **`check_drift`**：全量架构体检，输出确定性的违规证据清单；
- **`explain_violation`**：依据 AST 节点给出确定性的根因解释与重构代码示例；
- **`init_target`**：协助人类逆向推导与梳理架构规范。

---

## 📖 核心工作流实战指南

### 1. 架构规范单源配置 (`sextant.json`)
SextantDrift 遵循**“单源事实与开放媒介”**，以带有 JSON Schema 强校验的 `sextant.json` 为事实单源：

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json",
  "name": "MyProject",
  "layers": [
    { "id": "presentation", "name": "表现层", "order": 1 },
    { "id": "domain", "name": "业务领域层", "order": 2 },
    { "id": "infrastructure", "name": "基础设施层", "order": 3 }
  ],
  "components": [
    {
      "id": "controllers",
      "name": "API 控制器",
      "layerId": "presentation",
      "paths": ["src/controllers/**"],
      "forbiddenImports": ["@prisma/client", "typeorm", "src/repositories/**"]
    },
    {
      "id": "services",
      "name": "业务服务",
      "layerId": "domain",
      "paths": ["src/services/**"]
    },
    {
      "id": "repositories",
      "name": "数据仓储",
      "layerId": "infrastructure",
      "paths": ["src/repositories/**"]
    }
  ],
  "allowDependencies": [
    { "from": "controllers", "to": "services" },
    { "from": "services", "to": "repositories" }
  ],
  "invariants": [
    {
      "id": "PERSIST_BEFORE_EXTERNAL",
      "severity": "critical",
      "desc": "用户数据必须先持久化落库，方可发起外部 LLM 或支付调用",
      "pattern": {
        "must_precede": ["orderRepo.save", "db.orders.create"],
        "target": ["llmClient.generate", "paymentGateway.charge"],
        "scope": "src/services/**"
      }
    }
  ]
}
```

### 2. 存量老项目平滑纳管 (`baseline`)
新接入老项目时，无需被历史遗留问题吓退：

```bash
# 生成当前违规指纹快照 (.sextant/baseline.json)
npx sextant-drift baseline
```
- 后续在 CI 中执行 `npx sextant-drift check` 时，**已记录的历史违规将被豁免**；
- 门禁仅拦截**增量新引入的违规（No New Drift）**，保障架构不再恶化，逐步平滑重构。

### 3. 自包含原生 SVG 双图审查报告 (`report`)
```bash
# 生成自包含 HTML 报告 (默认: drift-report.html)
npx sextant-drift report

# 指定英文语言
npx sextant-drift report --lang en
```
- **纯原生 SVG 矢量双图**：完全基于自研布局引擎，**零外部 CDN、零第三方 JS 库、断网完全可用**；
- **[ADR-009 报告设计](docs/decisions/ADR-009-report-understand-first.md)**：默认进入 **Understand 模式**，帮助开发者与 AI 快速看懂局部设计与职责；一键叠加 **Diff 模式**，高亮红线夹角与越界连线。

---

## 🛠️ CLI 命令行完整参考

```text
用法:
  $ sextant-drift [command] [options]

核心命令:
  check [dir]                    执行架构偏航检查（默认命令，退出码 0/1/2）
  init [dir]                     逆向推导：扫描现有代码生成 sextant.json 与 ARCHITECTURE.md
  baseline [dir]                 基准线：将存量违规录入快照，实行增量门禁 (No New Drift)
  report [dir]                   生成零依赖单文件 HTML 原生 SVG 审查报告
  verify [dir]                   执行绑定内容版本的业务验收测试 (PASS/FAIL/UNVERIFIED/ERROR)
  requirements <entityId> [dir]  审查业务需求实体的直接邻居关系（四列排布）
  mcp [action]                   管理与启动 AI Agent MCP 协议服务 (run | install)

常用选项:
  -c, --config <path>    指定自定义 sextant.json 路径
  -b, --baseline <path>  指定自定义 baseline.json 路径
  -t, --tsconfig <path>  指定自定义 tsconfig.json 路径
  --strict               严格模式：将 Warning 级别警告同样判定为失败 (Exit Code 1)
  --json                 输出机器可解析的标准 JSON 诊断数据
  --report [file]        执行检查的同时输出离线 HTML 报告
  --github-summary       自动向 GitHub Actions GITHUB_STEP_SUMMARY 输出美化 Markdown 表格
  --fix-manifest         输出极度节约 Token 的 YAML 修复清单（供 AI 针对性修复）
  --ai-prompt            输出包含代码定位与修复建议的可直接执行 Prompt
  --filter <package>     Monorepo 场景下仅过滤并扫描特定子包
```

---

## 🔄 接入常规 AI 工作流 (以 OpenSpec 为例)

SextantDrift 不尝试包揽全生命周期的任务管理，而是与 **OpenSpec** 或 **GitHub Spec-Kit** 形成优雅互补：

```
[业务需求/Idea] ➔ [OpenSpec 提案 (proposal.md & tasks.md)] ➔ [AI 编码实现]
                                                                  │
                                                      💡 Sextant MCP (check_file)
                                                         实时把关，越界当场打回
                                                                  │
                                                                  ▼
                                                      [Sextant 5秒门禁 (check)]
                                                         退出码 0 准予合并归档
```

1. **OpenSpec 负责变更流**：在 `openspec/changes/` 中进行任务切片与需求演进；
2. **SextantDrift 负责物理防腐**：AI 编码过程中，MCP 实时拦截破坏分层的改动；CI 门禁 `npx sextant-drift check` 充当最后一道防腐红线。

---

## 🏛️ 项目工程结构与戒律

本项目自身严格按照 Monorepo 分包隔离，并在每次改动后全量执行测试自检：

```text
packages/
├── core/         # @sextant/core: 纯 TypeScript 无头核心 (0 DOM, 0 CLI, 100% 单测)
├── cli/          # sextant-drift: 终端交互、CAC 路由与 CI 门禁退出码控制
├── mcp-server/   # @sextant/mcp-server: 面向 AI Agent 的 MCP 标准协议服务
└── web-report/   # @sextant/web-report: 100% 离线自包含原生 SVG 矢量双图报告模板
```

本项目严格信守 [AGENTS.md](AGENTS.md) 中的**六大绝对戒律**：
- **戒律 1：严禁 Agent 自证自述**（实际拓扑必须由机器 AST 确凿解析，杜绝幻觉）；
- **戒律 2：严禁静态猜时序**（静态只做确定性级别为 8~10 的分析，误报等于自杀）；
- **戒律 3：Core-First 核心先行**（内核零 DOM/CLI 依赖，CI 环境秒级运行）；
- **戒律 4：零侵入纯文本协议总线**（兼容既有 Spec 与 Git 纳管纯文本）；
- **戒律 5：逆向推导优先**（提供 `init` 一键反向扫描，降低画图门槛）；
- **戒律 6：严守包边界与改动必测**（代码修改必须同步增加测试并保持全绿）。

---

## 📄 开源协议

本项目采用 [MIT 许可证](LICENSE) 开源。欢迎提交 Issue 或 Pull Request！
