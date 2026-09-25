# SextantDrift (六分仪偏航检测罗盘)

> **面向 AI 编程与现代工程团队的「架构 X 光机与偏航检测罗盘（Architecture X-Ray & Drift Compass）」。**  
> 永远只看两张图的红绿差分，终结盲目肉眼代码审查，守住系统架构底线。

[ 简体中文 ](README.md) | [ English ](README_EN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-green.svg)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Self-Dogfooding](https://img.shields.io/badge/Self--Dogfooding-Passed%20(0%20Drifts)-success.svg)](sextant.json)

---

## 目录 (Table of Contents)

- [一、项目定位与核心作用 (Role & Purpose)](#一项目定位与核心作用-role--purpose)
  - [1.1 痛点与时代背景：人审不过来 AI 代码](#11-痛点与时代背景人审不过来-ai-代码)
  - [1.2 核心产品灵魂：Design by Diagram, Diff by Diagram](#12-核心产品灵魂design-by-diagram-diff-by-diagram)
  - [1.3 七维全景检测能力矩阵](#13-七维全景检测能力矩阵)
  - [1.4 适用人群与场景](#14-适用人群与场景)
- [二、核心优势 (Key Advantages)](#二核心优势-key-advantages)
  - [2.1 零误报与 AST 机器确定性](#21-零误报与-ast-机器确定性)
  - [2.2 极低 Token 消耗与 AI Agent 原生亲和](#22-极低-token-消耗与-ai-agent-原生亲和)
  - [2.3 100% 离线自包含原生 SVG 审查报告](#23-100-离线自包含原生-svg-审查报告)
  - [2.4 存量老项目无痛纳管 (Baseline: No New Drift)](#24-存量老项目无痛纳管-baseline-no-new-drift)
  - [2.5 Core-First 无头核心与秒级执行](#25-core-first-无头核心与秒级执行)
  - [2.6 零孤岛开放标准与双向推导](#26-零孤岛开放标准与双向推导)
  - [2.7 严苛的项目自举架构验证](#27-严苛的项目自举架构验证)
- [三、完整使用教程 (Step-by-Step Tutorial)](#三完整使用教程-step-by-step-tutorial)
  - [3.1 环境要求与安装](#31-环境要求与安装)
  - [3.2 核心工作流：五步掌握 SextantDrift](#32-核心工作流五步掌握-sextantdrift)
    - [步骤 1：一键逆向推导架构规范 (`init`)](#步骤-1一键逆向推导架构规范-init)
    - [步骤 2：定制与理解架构规范 (`sextant.json`)](#步骤-2定制与理解架构规范-sextantjson)
    - [步骤 3：本地与 CI 架构门禁检查 (`check`)](#步骤-3本地与-ci-架构门禁检查-check)
    - [步骤 4：存量项目历史债务隔离 (`baseline`)](#步骤-4存量项目历史债务隔离-baseline)
    - [步骤 5：交互式双图可视化审查报告 (`report`)](#步骤-5交互式双图可视化审查报告-report)
  - [3.3 语义不变量 (Semantic Invariants) DSL 实战教程](#33-语义不变量-semantic-invariants-dsl-实战教程)
  - [3.4 CI/CD 自动化门禁集成 (GitHub Actions)](#34-cicd-自动化门禁集成-github-actions)
  - [3.5 AI Agent 自动化结对与自愈指南](#35-ai-agent-自动化结对与自愈指南)
  - [3.6 统一工程开发控制脚本 (`./start.sh`)](#36-统一工程开发控制脚本-startsh)
- [四、架构规范与配置全景 (`sextant.json` 完整范式)](#四架构规范与配置全景-sextantjson-完整范式)
- [五、代码仓库结构 (Repository Layout)](#五代码仓库结构-repository-layout)
- [六、Agent 六大绝对戒律 (Immutable Invariants)](#六agent-六大绝对戒律-immutable-invariants)
- [七、开源协议 (License)](#七开源协议-license)

---

## 一、项目定位与核心作用 (Role & Purpose)

### 1.1 痛点与时代背景：人审不过来 AI 代码
2026 年是 AI 编程全面爆发的时代。随着 Claude Code、Cursor、Copilot、Antigravity 等智能化工具的普及，研发团队的代码产出速度获得了 5~10 倍的飞跃。然而，**PR 人工代码审查（Code Review）却成为了整个软件交付流水线上的致命瓶颈**：
- **行级 Diff 碎片化**：传统的 `git diff` 支离破碎，开发者被迫在成千上万行细节代码泥潭中肉眼寻找漏洞，“只见树木，不见森林”；
- **隐蔽架构腐化**：AI Agent 编写代码时往往追求“局部最优”，极易出现**跨层直连（Bypass）、逆向引用（Inversion）、循环调用死锁（Cycles）**，以及跳过业务关键校验；
- **设计与实现脱节**：Miro、Draw.io、文字 PRD 等传统设计图在开发初期画完即被抛弃，缺乏与真实代码之间的机器级动态约束；
- **审查成本成倍激增**：工程师每天花费数小时审阅 AI 生成的代码，仍然无法阻止系统陷入不可维护的架构破窗危机。

### 1.2 核心产品灵魂：Design by Diagram, Diff by Diagram
SextantDrift 的唯一视觉与审查心智是：**永远只看两张图的红绿差分！**

```
┌──────────────────────────────────────┐             ┌──────────────────────────────────────┐
│        左屏: 设计意图 (Target)        │             │        右屏: 真实代码 (Actual)        │
│    设计拓扑 · 分层规范 · 契约约束    │     VS      │   TypeScript AST 机器提取真实依赖拓扑  │
└──────────────────────────────────────┘    (Diff)   └──────────────────────────────────────┘
                   │                                                     │
                   └──────────────────────────┬──────────────────────────┘
                                              ▼
                        ┌──────────────────────────────────────────┐
                        │        标红区 (Drift Alert 审查台)       │
                        │   两图红线夹角 · 越界连线 · 破损不变量   │
                        │   循环依赖死锁 · 状态机黑洞 · 缺失降级   │
                        └──────────────────────────────────────────┘
```

- **80% 图（骨架与拓扑）**：使用标准的 Mermaid / C4 图形天然定义模块物理边界、依赖关系与状态流转；
- **20% 规则（灵魂与不变量）**：在拓扑图旁伴随硬性语义不变量（Semantic Invariants），固化“先校验后落库”、“落库先于不可靠网络调用”等核心架构底线。

### 1.3 七维全景检测能力矩阵
SextantDrift 构建了全方位的架构维度检测矩阵，全面拦截各类结构性偏航：

| 检测维度 | 典型违规场景 | 底层检测机制 | 默认严重级别 |
| :--- | :--- | :--- | :---: |
| **跨层旁路 (Layer Bypass)** | Controller 绕过 Service 层直接调用底层的 Repository 或数据库驱动 | 拓扑图 DFS 递增层级序数扫描 | `CRITICAL` |
| **逆向依赖 (Layer Inversion)** | 底层 Infra/Domain 模块反向引用上层的 Web/Presentation 控制器 | 拓扑反向有向边穿透检测 | `CRITICAL` |
| **循环依赖死锁 (Cycles)** | 跨组件网状依赖循环链（如 `Order -> Payment -> Notification -> Order`） | Tarjan 强连通分量 (SCC) 图算法 | `CRITICAL` |
| **违规外联 (Forbidden Imports)** | 前端或表现层组件直接 `import` 底层数据库 ORM 驱动（如 `@prisma/client`, `typeorm`） | TypeScript AST `ImportDeclaration` 精确模式过滤 | `CRITICAL` |
| **语义不变量 (Invariants)** | 颠倒业务关键次序（如“未校验直接写库”、“未落库直接调第三方外部网络 API”） | AST 函数作用域拓扑模式匹配 (`must_precede` / `require_config`) | `CRITICAL / WARNING` |
| **状态机死锁 (State Verifier)** | 业务状态机图存在孤岛状态、黑洞节点（无法转出）或缺少超时重试降级保护分支 | Mermaid `stateDiagram-v2` 静态图连通度与可达性算法 | `CRITICAL / WARNING` |
| **动态因果偏序 (Dynamic Trace)** | 复杂异步事件总线中真实因果拓扑脱节（杜绝静态猜测异步时序导致的虚假误报） | 运行时 Trace 录制器 + `sequenceDiagram` 因果偏序 DAG 差分 | `CRITICAL / WARNING` |

### 1.4 适用人群与场景
1. **技术主管 / 架构师**：用一张标准架构拓扑图（Mermaid / C4）定义系统规范，无需写冗长的约束文档，机器自动充当门禁法官；
2. **AI Coding 开发者（Cursor / Claude / Copilot 用户）**：在生成海量代码后，一键执行偏航检测，5 秒内确定是否有越界代码，安全提交 PR；
3. **企业工程效能与 CI/CD 团队**：在 GitHub Actions / GitLab CI 中设置架构红绿门禁，违背架构规范的代码一律不可合并。

### 1.5 多语言支持矩阵与能力边界 (Language & Ecosystem Matrix)
为确保极致的分析性能与零误报确定性，SextantDrift 采取明确的分层生态适配策略：

| 支持层级 | 覆盖生态与语言 | 支撑能力与技术实现 | 状态与适用场景 |
| :--- | :--- | :--- | :---: |
| **Tier 1: 原生编译级深度 (First-Class AST)** | **TypeScript, JavaScript, TSX/JSX**<br>(Node.js, Bun, Deno, Next.js, NestJS, Express) | 深度集成 TypeScript Compiler API：秒级构建全量模块物理依赖 DAG、C4 容器分层越界分析、Tarjan 循环检测、AST 语句级语义不变量拦截、REST/Nest 路由契约自动抽取。 | **生产就绪 (GA)**<br>当前工程全功能支持 |
| **Tier 2: 跨语言通用协议 (Polyglot Dynamic & Contract)** | **Go, Python, Rust, Java, C# 等任意语言** | **协议级解耦**：通过标准 JSON 运行时 Trace 协议（`.sextant/trace.json`）与 Markdown API 契约（`api-contract.md`），任何语言均可无缝享受因果时序差分（Dynamic Causality）与 API 契约对齐门禁。 | **生产就绪 (GA)**<br>无需改动语言编译器 |
| **Tier 3: 跨语言静态 AST 规划 (Multi-Language Roadmap)** | **Go, Python, Rust** | 规划引入基于 WebAssembly / Tree-sitter 的多语言通用 AST 解析适配器，提供对 Go Packages、Python Modules 及 Cargo Crates 的原生静态物理拓扑提取。 | **演进规划中 (Roadmap)**<br>v2.5+ 版本引入 |

---

## 二、核心优势 (Key Advantages)

为什么选择 SextantDrift 而不是传统 Linter 或 LLM 审代码？

### 2.1 零误报与 AST 机器确定性
- **误报等于自杀**：在开发者工具领域，哪怕一次虚假的违规报警，也会彻底摧毁工程师对工具的信任；
- **拒绝 LLM 自由心证**：市面上所谓的“AI 代码审查”往往充满随机幻觉，提不出确凿根据；
- **确定性判定**：SextantDrift 基于官方 TypeScript 编译器 AST 与严格图论算法（Tarjan SCC / DFS），给出的**每一条违规报警均附带确凿的文件名、绝对行号、列号与代码切片证据**。

### 2.2 极低 Token 消耗与 AI Agent 原生亲和
- **极度经济的 Token 占用**：终端诊断文本经过极致的信息熵压缩，单次偏航报错仅占用 **50 ~ 200 Tokens**，绝不撑爆 AI Agent 的上下文窗口；
- **标准化 AI Fix 提示词**：每个违规项自带一键复制的结构化提示词模板，AI Agent 收到后可直接定位并在单轮交互中精准完成自愈修复。

### 2.3 100% 离线自包含 HTML 审查报告
- **零外部 CDN 依赖**：生成的 `drift-report.html` 为完全自包含的单一 HTML 文件，**不发任何外部网络请求、不加载任何外部 JS/CSS/字体 CDN**；
- **工业级交互式 C4 架构双图内置**：`sextant-drift` 已将自研原生 SVG 矢量双图画布全量内联打包，无需安装任何额外依赖，直接开箱即用（支持容器与组件双层下钻、无限画布 Pan & Zoom、契约过滤与中英即时切换）。

### 2.4 存量老项目无痛纳管 (Baseline: No New Drift)
- **拒绝“首日就要改 500 个 Bug”**：接手历史遗留老项目时，架构违规往往数以百计；
- **SHA256 语义指纹快照**：运行 `npx sextant-drift baseline` 将存量债务全部冻结在 `.sextant/baseline.json` 中；
- **No New Drift 原则**：日常 CI 门禁对存量历史违规全量豁免，但**坚决阻断任何新增违规**，让老系统平滑、渐进式地回归架构健康。

### 2.5 Core-First 无头核心与秒级执行
- **纯无头架构设计**：`@sextant/core` 核心分析引擎为纯净的 TypeScript 模块，**零 DOM 依赖、零浏览器依赖、零 CLI 耦合**；
- **极致扫描性能**：在百级文件规模的工程中，全量 AST 构建与拓扑比对耗时通常在 **0.5 ~ 1.5 秒** 以内，完全满足 Git Pre-commit Hook 与 CI 快速反馈要求。

### 2.6 零孤岛开放标准与双向推导
- **绝不推销私有隔离格式**：以 Git 纳管的标准 JSON Schema `sextant.json` 为唯一单源事实，自动同步至直观的 Mermaid 与 Markdown 文档；
- **反向 X 光提取 (Reverse X-Ray)**：无需人类苦哈哈从零画大图，执行 `npx sextant-drift init` 即可从现有项目代码中一键逆向推导拓扑雏形。

### 2.7 严苛的项目自举架构验证
- **Self-Dogfooding 铁律**：SextantDrift Monorepo 自身全面遵循该规范约束，并在自身编译与测试流程中作为第一项验收标准；
- **覆盖率与完备性**：内置 49 个测试套件、250 个测试用例，涵盖各类边界情况与极端图拓扑，代码质量经久耐用。

---

## 三、完整使用教程 (Step-by-Step Tutorial)

### 3.1 环境要求与安装

- **Node.js**：`>= 18.0.0` (推荐 Node.js LTS 20+)
- **包管理器**：`pnpm` (推荐), `npm`, 或 `yarn`

可以选择免安装直接通过 `npx` 运行，也可以作为开发依赖安装到本地项目中：

```bash
# 推荐：作为开发依赖安装 CLI 工具到当前项目
pnpm add -D sextant-drift

# 或使用 npm
npm install --save-dev sextant-drift

# 或直接通过 npx 体验（零安装，无需预装）
npx sextant-drift --help

# 若需要在 Node.js / CI 脚本中编程式调用分析引擎：
pnpm add -D @sextant/core
```

---

### 3.2 核心工作流：五步掌握 SextantDrift

#### 步骤 1：一键逆向推导架构规范 (`init`)
面对已有代码库，你无需手动逐行编写规则文件。进入项目根目录运行逆向扫描命令：

```bash
# 扫描现有 src 源码目录，自动提取物理层级与组件拓扑
npx sextant-drift init

# 若你的源码在其他目录，可指定源码路径：
npx sextant-drift init --source-dir app
```

该命令将在项目根目录下自动创建两个关键文件：
1. **`sextant.json`**：具备完整 JSON Schema 校验支持的架构规范事实单源（支持 IDE 自动补全）；
2. **`ARCHITECTURE.md`**：内嵌 Mermaid 架构图的 Markdown 文档，可在 GitHub / GitLab Web 页面上直接渲染与人类审阅。

---

#### 步骤 2：定制与理解架构规范 (`sextant.json`)
打开生成的 `sextant.json`，根据你的团队架构设计确认或微调分层与组件边界。例如一个典型的分层架构：

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDriftV03/main/schemas/sextant.schema.json",
  "name": "E-Commerce System",
  "version": "1.0.0",
  "layers": [
    {
      "id": "presentation",
      "name": "Presentation Layer",
      "order": 1,
      "description": "API 路由与控制器"
    },
    {
      "id": "domain",
      "name": "Business Domain Layer",
      "order": 2,
      "description": "核心业务逻辑与状态机"
    },
    {
      "id": "infrastructure",
      "name": "Infrastructure Layer",
      "order": 3,
      "description": "持久化仓储与外部客户端"
    }
  ],
  "components": [
    {
      "id": "controllers",
      "name": "Controllers",
      "layerId": "presentation",
      "paths": ["src/controllers/**"],
      "forbiddenImports": ["@prisma/client", "typeorm"]
    },
    {
      "id": "services",
      "name": "Business Services",
      "layerId": "domain",
      "paths": ["src/services/**"]
    },
    {
      "id": "repositories",
      "name": "Data Repositories",
      "layerId": "infrastructure",
      "paths": ["src/repositories/**"]
    }
  ],
  "allowDependencies": [
    { "from": "controllers", "to": "services" },
    { "from": "services", "to": "repositories" }
  ]
}
```

> **核心原则**：未在 `allowDependencies` 中明确放行的跨层调用（例如 `controllers -> repositories`），将被系统严格判定为 `CRITICAL_BYPASS`（跨层旁路调用）。

---

#### 步骤 3：本地与 CI 架构门禁检查 (`check`)
在日常编码、提交 Git commit 前或在 CI 流水线中，运行架构核验命令：

```bash
# 执行架构核验
npx sextant-drift check

# 附带严格模式（将 Warning 级警告视为失败）
npx sextant-drift check --strict

# 输出机器可读的 JSON 格式
npx sextant-drift check --json
```

**终端输出样例（高信噪比 ANSI 彩色诊断）：**

```
✖ Architectural Drift Detected! (Found 2 violations)

[CRITICAL] Layer Bypass Violation:
  From: Controllers (src/controllers/order.controller.ts)
  To:   Data Repositories (src/repositories/order.repo.ts)
  Evidence: src/controllers/order.controller.ts:42:15
  Snippet:
    41 |   async createOrder(req: Request, res: Response) {
  > 42 |     const repo = new OrderRepository();
       |                      ^^^^^^^^^^^^^^^
    43 |     await repo.insert(req.body);
  Suggestion: Controllers must not bypass Services. Call OrderService instead.

[CRITICAL] Semantic Invariant Broken (PERSIST_BEFORE_EXTERNAL):
  Evidence: src/services/payment.service.ts:18:7
  Rule: 外部支付调用前必须先完成订单持久化落库
  Suggestion: Move orderRepo.save() before paymentGateway.charge()

Checked 86 files (142 dependencies) in 410ms. Exit code: 1
```

**退出码说明（Exit Codes）：**
- `0`：系统架构完全合规，零偏航，顺利通过门禁；
- `1`：检测到架构违规或破损不变量，阻断提交或构建；
- `2`：配置文件语法损坏或系统运行时异常。

---

#### 步骤 4：存量项目历史债务隔离 (`baseline`)
如果你在老项目上初次引入 SextantDrift，面对数十上百个历史遗留违规，无需气馁。执行债务快照命令：

```bash
# 捕获并冻结当前所有架构违规
npx sextant-drift baseline
```

- 该命令会自动生成 `.sextant/baseline.json`，其中为每一个现存违规计算 SHA256 语义指纹（包含违规类型、源文件、目标组件及所在函数名）；
- 将 `.sextant/baseline.json` 提交至 Git 仓库；
- 随后的 `npx sextant-drift check` 将**自动豁免所有存量指纹**，只在发现新引入的代码偏航时报警，真正实现 **“不增加新债务（No New Drift）”**。

---

#### 步骤 5：可视化审查报告 (`report`)
当需要直观审阅系统全局架构、或向团队成员汇报时，生成自包含的 HTML 审查报告：

```bash
# 生成自包含离线报告 (默认输出 drift-report.html)
npx sextant-drift report

# 自定义报告输出文件路径
npx sextant-drift report -o ./dist/architecture-report.html

# 在门禁核验的同时生成报告
npx sextant-drift check --report
```

- **开箱即用（全量内置交互式 C4 矢量拓扑双图）**：无需额外安装任何独立插件，执行 `npx sextant-drift report`，双击在任何浏览器打开 `drift-report.html` 即可享受：
  1. **纯原生 SVG 矢量拓扑**：零外部 CDN 加载，零外部网络请求，100% 离线自包含；
  2. **C4 双层级下钻**：顶层点击切换 **Level 2 容器全景 (Containers)** 与 **Level 3 组件拓扑 (Components)**；
  3. **红绿高亮差分**：合规连线显示为沉稳蓝绿线，偏航违规显示为刺目红虚线并闪烁警报；
  4. **探针与过滤器**：鼠标悬停查看组件依赖详情；点击一键过滤底层系统 Contracts 连线；
  5. **AI 自愈 Prompt 一键复制**：点击任意红标违规卡片上的“Copy AI Fix Prompt”按钮，直接将包含代码上下文与修复建议的 Prompt 粘贴给 Cursor / Claude Code 瞬间自愈。

---

### 3.3 语义不变量 (Semantic Invariants) DSL 实战教程

除了宏观的分层连线，许多架构致命伤发生在微观代码时序与安全调用上。在 `sextant.json` 的 `invariants` 数组中声明关键规则：

#### 模式 1：时序先验规则 (`must_precede`)
确保关键操作必须在某项副作用操作**之前**完成：
```json
{
  "id": "PERSIST_BEFORE_LLM",
  "severity": "critical",
  "desc": "用户输入与上下文在发起不可靠的外部 LLM 调用前必须先落库持久化",
  "pattern": {
    "must_precede": ["messageRepo.save", "db.messages.create"],
    "target": ["llmClient.generate", "openai.chat.completions.create"],
    "scope": "src/services/**"
  }
}
```

#### 模式 2：违禁导入隔离 (`forbid_import`)
杜绝某类特定模块渗入指定目录：
```json
{
  "id": "NO_NODE_BUILTINS_IN_CLIENT",
  "severity": "critical",
  "desc": "客户端组件中严禁直接导入 Node.js 原生底层模块",
  "pattern": {
    "forbid_import": ["fs", "node:fs", "child_process", "path"],
    "in_path": "src/client/**,src/views/**"
  }
}
```

#### 模式 3：健壮性配置强制 (`require_config`)
强制关键网络请求必须配置超时参数：
```json
{
  "id": "MANDATORY_TIMEOUT_IN_FETCH",
  "severity": "warning",
  "desc": "所有第三方 HTTP 外部客户端请求必须显式配置超时时长",
  "pattern": {
    "require_config": ["timeout"],
    "scope": "src/integrations/**"
  }
}
```

---

### 3.4 CI/CD 自动化门禁集成 (GitHub Actions)

在项目仓库创建 `.github/workflows/architecture-gate.yml`：

```yaml
name: Architecture Drift Gate

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  verify-architecture:
    name: Verify Architectural Integrity
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Packages
        run: pnpm -r run build

      # 执行架构核验，同时将红绿检查报告注入到 GitHub PR Step Summary
      - name: Run SextantDrift Check
        run: npx sextant-drift check --github-summary --report drift-report.html

      # 可选：将生成的 drift-report.html 上传为构建工件供团队下载审阅
      - name: Upload Drift Report Artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: architecture-drift-report
          path: drift-report.html
```

---

### 3.5 AI Agent 自动化结对与自愈指南

SextantDrift 为现代 AI Agent 深度定制了协作能力：

1. **配置 Agent Skill**：将 SextantDrift 技能模板放置于项目中的 `.agents/skills/sextant-drift/SKILL.md`；
2. **闭环自愈工作流**：
   - 开发者对 Cursor / Claude Code 发出需求：“实现订单退款接口”；
   - Agent 自动生成相关代码；
   - Agent 根据规则自主运行 `npx sextant-drift check`；
   - 若发现偏航（如直接在 Controller 中 `new RefundRepository()`），Agent 读取结构化错误信息并在内部单轮完成自愈改写（提取至 Service 层）；
   - 最终交付 100% 架构零偏航的代码，彻底杜绝架构破窗。

---

### 3.6 统一工程开发控制脚本 (`./start.sh`)

SextantDrift 源码仓库自带跨平台的统一开发调度中枢 `./start.sh`，可用于快速调试和自举检验：

```bash
./start.sh            # 启动本地可视化审查工作台 (Workbench Web Server @ 3000)
./start.sh --test     # 执行全套单元测试 (Vitest CLI, 49 个套件, 250 个用例全部通过)
./start.sh --ui       # 启动 Vitest UI 交互式测试仪表盘
./start.sh --check    # 执行三维架构门禁实测 (包含 SextantDrift 自身自举核验)
./start.sh --build    # 全量构建所有子包 (@sextant/core, sextant-drift)
./start.sh --release  # 自动化构建、测试并发布至 npm 镜像 (支持 npx 免安装运行)
./start.sh --bench    # 执行 AST 提取与 Tarjan 强连通分量算法性能压测
./start.sh --coverage # 统计 V8 代码测试覆盖率报告
```

---

## 四、架构规范与配置全景 (`sextant.json` 完整范式)

以下为支持 C4 模型和语义不变量的规范结构范例：

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDriftV03/main/schemas/sextant.schema.json",
  "name": "Enterprise Service Monorepo",
  "version": "2.0.0",
  "systemContext": {
    "systemName": "Payment Gateway System",
    "description": "Enterprise Core Payment and Clearing System",
    "actors": [
      { "id": "User", "name": "Customer", "role": "human" },
      { "id": "AIAgent", "name": "AI Coding Agent", "role": "agent" }
    ],
    "externalSystems": [
      { "id": "BankAPI", "name": "Central Bank Clearing Network" }
    ]
  },
  "containers": [
    { "id": "api", "name": "API Service", "order": 1, "type": "service" },
    { "id": "worker", "name": "Background Worker", "order": 2, "type": "service" },
    { "id": "db", "name": "Primary Database", "order": 3, "type": "database" }
  ],
  "layers": [
    { "id": "presentation", "name": "Presentation Tier", "order": 1 },
    { "id": "application", "name": "Application Logic Tier", "order": 2 },
    { "id": "domain", "name": "Core Domain Tier", "order": 3 },
    { "id": "infrastructure", "name": "Infrastructure Tier", "order": 4 }
  ],
  "components": [
    {
      "id": "order-controller",
      "name": "Order Controller",
      "layerId": "presentation",
      "containerId": "api",
      "paths": ["src/controllers/order/**"]
    },
    {
      "id": "order-service",
      "name": "Order Service",
      "layerId": "application",
      "containerId": "api",
      "paths": ["src/services/order/**"]
    },
    {
      "id": "order-repo",
      "name": "Order Repository",
      "layerId": "infrastructure",
      "containerId": "db",
      "paths": ["src/repositories/order/**"]
    }
  ],
  "allowDependencies": [
    { "from": "order-controller", "to": "order-service" },
    { "from": "order-service", "to": "order-repo" }
  ],
  "invariants": [
    {
      "id": "FORBID_RAW_SQL_IN_SERVICES",
      "severity": "critical",
      "desc": "业务服务层禁止直接引用原始 SQL 驱动",
      "pattern": {
        "forbid_import": ["mysql2", "pg", "sqlite3"],
        "in_path": "src/services/**"
      }
    }
  ]
}
```

---

## 五、代码仓库结构 (Repository Layout)

SextantDrift 采用高内聚、分层隔离的现代 pnpm Monorepo 物理结构：

```
SextantDrift/
├── packages/
│   ├── core/           # @sextant/core: 纯无头核心分析引擎 (TS AST 解析, Tarjan 图算法, 不变量匹配, 因果差分)
│   └── cli/            # sextant-drift: 极轻量命令行门禁工具 (基于 cac + picocolors, < 50KB, 零冗余依赖)
├── standalone/         # 独立生态工程 (可发布到独立 GitHub 仓库)
│   └── sextant-web-report/ # @sextant/web-report: 100% 离线自包含的原生 SVG 双图审查报告生成器 (独立扩展)
├── .agents/skills/     # 面向 AI Coding Agent 的架构审查与自愈技能规范
├── .github/workflows/  # CI/CD 自动化门禁流水线
├── schemas/            # 标准 JSON Schema 结构定义文件 (sextant.schema.json)
├── sextant.json        # 项目自身自举架构规范 (Self-Dogfooding Specification)
├── ARCHITECTURE.md     # 架构设计与意图的只读可视化文档 (Mermaid)
├── start.sh            # 统一开发、测试、构建与门禁调度中枢脚本
└── index.html          # 本地工程审阅工作台
```

---

## 六、Agent 六大绝对戒律 (Immutable Invariants)

所有参与本项目的 AI Agent 与人类工程师均必须严格恪守以下六大底线：

1. **戒律 1：严禁 Agent 自证（Forbid Self-Attestation）**：拒绝让 Agent 自写“实际时序图”或自我声称合规，真实拓扑必须且只能由编译器确定性提取；
2. **戒律 2：严禁静态猜时序，杜绝假阳性（Zero False Positives）**：误报等于自杀。静态分析仅处理确定性为 100% 的语法与拓扑，绝不靠脆弱正则猜测复杂的异步运行时序；
3. **戒律 3：Core-First 无头先行**：`@sextant/core` 必须为纯 TypeScript 模块，零 DOM 依赖、秒级执行，严禁过早捆绑桌面客户端或重型 UI；
4. **戒律 4：零侵入开放协议总线**：绝不搞私有孤岛格式，挂靠 Git 纳管的 `sextant.json`、Mermaid 与 Markdown 生态；
5. **戒律 5：逆向推导与低门槛优先**：优先支持 `init` 反向扫描生成初始架构拓扑，不强迫人类手工绘制海量大图；
6. **戒律 6：严守工程分层与每次改动必测（Mandatory Test-on-Change）**：核心模块严格单向依赖；任何代码改动必须同步更新测试并全量跑绿（Exit Code 0）。

---

## 七、开源协议 (License)

本项目采用 [MIT License](LICENSE) 许可证发布。
欢迎全球工程师与 AI Agent 共同维护与演进！
