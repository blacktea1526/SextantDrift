# REQUIREMENTS.md — SextantDrift 产品需求规格说明书 (PRD)

> **版本**：v1.0 (2026 正式版)  
> **文档性质**：SextantDrift 的完整功能与非功能性需求规范。定义“系统必须做到什么”以及“验收标准”，与具体代码实现解耦。  
> **基准参考**：[`MISSION.md`](file:///home/redtea/Mona_project/SextantDriftV03/MISSION.md)

---

## 1. 痛点定位与用户角色 (User Personas & Problems)

### 1.1 目标用户画像
- **核心角色：AI-Native 个人全栈与独立开发者（Primary ICP / Dogfooder）**
  - **特征**：单人或小团队主导中大型复杂项目，重度依赖 Claude Code、Cursor、Codex 等 Agent 编写业务代码；
  - **日常困境**：每天由 Agent 生成数百乃至上千行代码，行级 `git diff` 极其零碎，肉眼无法察觉 Agent 是否偷偷写了跨层直连、破坏了模块封装；
  - **核心诉求**：无需手写繁琐配置，能秒级确认 AI 写出的代码是否偏离了自己心中的架构设计，一旦偏航能给出确凿证据让 AI 自己修复。
- **扩展角色：研发团队 Tech Lead / 核心 Maintainer（Secondary ICP）**
  - **日常困境**：审查由 Junior 工程师与 AI 混合编写的 PR，人工 review 耗时翻倍，架构腐化在不知不觉中发生；
  - **核心诉求**：无缝接入 CI 门禁，对任何违背架构约定的 PR 进行自动拦截。

---

## 2. 核心用户旅程与操作场景 (User Journeys)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            核心开发工作流与闭环旅程                         │
│                                                                             │
│  [1. 设计/逆向]               [2. 编码与约束]            [3. 门禁与自省]      │
│  人类勾勒 C4 图               Agent 注入 AGENTS.md        Agent 触发 check   │
│  或 npx init 逆向    ───────►   开始编码施工       ───────►  无情拦截并反馈    │
│        ▲                                                        │           │
│        │                                                        ▼           │
│  [5. 演进吸收]                                           [4. 熔断与决策]      │
│  更新 ARCHITECTURE.md ◄────── 若遇合理需求修改 ◄───────  ≤3 轮自省修复      │
│  或记录 Baseline                人类介入终极裁定           超出则求助人类    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 场景 1：全新项目从 0 到 1 的“设计 -> 施工 -> 核验”闭环
1. 开发者在根目录创建 `ARCHITECTURE.md`（或由 AI 协助生成），以标准 Mermaid 声明 C4 Component 拓扑，并声明 2~3 条关键隔离规则；
2. 开发者将架构文件作为上下文交给 Agent；
3. Agent 按照任务提示词编写代码；
4. 任务完成前，Agent 执行 `npx sextant-drift check`；
5. CLI 判定通过（Exit Code: 0），终端输出绿色无偏航，Agent 提交代码交付。

### 场景 2：偏航拦截与 Agent 自动化自省闭环
1. Agent 在编写业务时，为了图省事在 `Controller` 里直接 `import` 了 `Repository`（跨层旁路 Bypass）；
2. Agent 执行 `npx sextant-drift check`；
3. CLI 探测到违规（Exit Code: 1），终端打印确凿的违规行号、文件路径与被破坏的规则；
4. Agent 读取终端报错，意识到架构违规，在内部重构引入 `Service` 作为中间层；
5. Agent 再次执行 check，通过，交付完成。

### 场景 3：复杂冲突与 3 轮重试熔断机制
1. Agent 连续修改了 2 轮，依然因为某种需求死锁无法通过架构检查；
2. 达到第 3 轮上限，Agent 触发**熔断机制**，主动停止盲目修改；
3. Agent 组织语言向开发者汇报：“在实现需求 X 时，按当前设计图无法避免跨层调用，请裁决是调整架构图，还是修改实现策略”；
4. 开发者介入并做出架构级裁决。

### 场景 4：存量老项目接入（Brownfield Adoption）
1. 开发者在一个已有 5 万行代码的老项目中首次引入 SextantDrift；
2. 运行 `npx sextant-drift init`，自动逆向扫描当前目录结构，生成初始 `ARCHITECTURE.md`；
3. 运行 `npx sextant-drift baseline`，将当前遗留的 15 处历史跨层依赖固化到 `.sextant/baseline.json`；
4. 之后日常开发中，只要没有**新增违规（No New Drift）**，check 即可判定通过。

---

## 3. 功能性需求 (Functional Requirements)

### FR-1：架构声明与规范解析 (Architecture Spec Parsing)
- **FR-1.1 (双模单源事实读取)**：
  - 首选读取：系统默认优先读取具备严格 JSON Schema 校验的结构化规范文件 `sextant.json`（或 `.sextant/architecture.json`），实现微秒级极速解析与零歧义强类型校验；
  - 无缝回退：若未找到 JSON 文件，无缝自动回退读取根目录下的 `ARCHITECTURE.md` 或 `AGENTS.md`（及 `.github/spec-kit`）中内嵌的 Mermaid 架构拓扑与 YAML 不变量块；
  - 双向互转：支持将结构化规范按需一键导出为标准 Mermaid 拓扑图供可视化审阅。
- **FR-1.2 (C4 拓扑识别)**：支持解析标准 Mermaid `flowchart TB / graph TD` 中的 `subgraph` 容器/组件分层，以及节点间的有向箭头 `-->`（代表依赖/调用方向）。
- **FR-1.3 (语义规则提取)**：支持解析伴随架构图的 YAML 格式 Invariants 规则块，支持提取：
  - `forbidden_bypass`：禁止跨层跳跃；
  - `forbidden_import`：禁止特定路径/三方包的导入；
  - `allow_only`：严格受限依赖声明。

### FR-2：源码拓扑提取 (Source Topology Extraction)
- **FR-2.1 (约定优于配置映射)**：
  - 自动将源码顶层目录（如 `src/controllers`, `src/services`, `src/repositories`）模糊匹配至 Mermaid 图中的组件名（`Controllers`, `Services`, `Repositories`）；
  - 支持节点标签中显式声明路径（例如：`AuthService["src/modules/auth/**"]`）作为强行覆盖。
- **FR-2.2 (依赖关系抽取)**：借助成熟的依赖分析引擎，准确提取源文件中所有 `import`、`export ... from` 以及动态引入关系，建立源码实际依赖图（Directed Acyclic Graph / DAG）。
- **FR-2.3 (天然排除工具类噪音)**：依据 C4 理念，对未在架构图中声明为独立 Component 的通用工具（如 `utils/**`, `logger`, `lodash` 等横切代码），默认不作为独立组件参与跨层违规判定。

### FR-3：确定性偏航对比引擎 (Drift Detection Engine)
系统比对“设计拓扑（Target）”与“实际拓扑（Actual）”，捕获以下确定性违规：
- **FR-3.1 (跨层旁路 - Bypass)**：A 层到 C 层的调用若未经过架构图中规定的中间层 B，判定为 Critical 级违规。
- **FR-3.2 (逆向依赖 - Inversion)**：底层模块（如 Domain / Infrastructure）反向依赖了高层模块（如 Presentation / Controller），判定为 Critical 级违规。
- **FR-3.3 (循环依赖 - Cycles)**：不同模块组件之间形成了相互引用的死闭环，判定为 Critical 级致命违规（退出码 1，破坏高内聚低耦合的架构硬伤）。
- **FR-3.4 (违规外联 - Forbidden Import)**：特定模块引入了明确被禁止的底层驱动或三方库（如 UI 组件直连 `@prisma/client`）。

### FR-4：CLI 交互与命令集 (CLI Commands)
- **FR-4.1 (`check` 命令)**：
  - 用法：`npx sextant-drift check`
  - 功能：扫描全项目代码与架构规范，执行比对。
  - 退出码标准：
    - `0`：架构合规（或所有违规均在 baseline 豁免清单中）；
    - `1`：检测到新增偏航（New Drift Detected）；
    - `2`：配置或解析致命错误（如找不到架构文件、Mermaid 语法损坏）。
- **FR-4.2 (`init` 命令)**：
  - 用法：`npx sextant-drift init`
  - 功能：反向扫描现有源码的目录与依赖拓扑，在根目录生成 `sextant.json`（单源事实，支持 `$schema` 智能校验）并自动同步导出只读预览文档 `ARCHITECTURE.md`（内嵌标准 Mermaid 架构图供 GitHub 预览）。
- **FR-4.3 (`baseline` 命令)**：
  - 用法：`npx sextant-drift baseline`
  - 功能：将当前代码中存在的所有模块跨层违规及函数级语义不变量违规导出为 `.sextant/baseline.json`（基于 AST 双模语义指纹，不依赖脆弱物理行号），完成历史债务封存。

### FR-5：高信噪比输出规范 (High Signal Output Standard)
- **FR-5.1 (纯文本终端设计)**：
  - 默认状态下**严禁在工作区生成临时 HTML 或图片文件**；
  - 终端输出必须彩色（ANSI）、紧凑、高信噪比，严格包含四大要素：
    1. **违规类型与严重级别**（如 `[CRITICAL BYPASS]` 或 `[INVARIANT BROKEN]`）；
    2. **物理文件与行号精准定位**（如 `src/controllers/OrderController.ts:24`）；
    3. **确凿事实证据**（如 `直接 import 了 src/repositories/OrderRepo.ts` 或 `调外部 payment.charge() 前未调用 db.save()`）；
    4. **违反的架构规则条款**（如 `违反 sextant.json 规则: Controllers 不能直连 Repositories`）。
- **FR-5.2 (机器可读输出)**：支持 `--json` 参数，将完整的检测结果以结构化 JSON 输出到 stdout，供外部脚本或 CI 消费。

---

## 4. 非功能性需求 (Non-Functional Requirements)

### NFR-1：性能与响应极限 (Performance & The 5-Second Rule)
- **扫描与比对耗时**：针对 10 万行以内代码库，在标准开发机上执行 `npx sextant-drift check`，**端到端时间必须 ≤ 3 秒**（严格小于 5 秒原则上限）。
- **内存占用**：执行期间峰值内存占用不得超过 256MB。

### NFR-2：准确度与零幻觉底线 (Zero False Positives)
- **假阳性（误报）率必须为 0%**：任何给出的违规警告，必须对应源码中确凿存在的实际 AST 语句与规则矛盾。严禁出现猜疑式、概率式报错。

### NFR-3：Token 经济学与环境纯净 (Token Economics & Zero Footprint)
- **单次检查 Token 占用控制**：CLI 终端输出的总 Token 数量控制在 **50 ~ 200 tokens** 以内，确保 Agent 读取错误信息时消耗极低；
- **环境零污染**：除用户显式执行 `baseline` 生成 `.sextant/baseline.json` 之外，日常执行 `check` 严禁产生任何残留垃圾文件或修改工作区 Git 状态。

### NFR-4：运行环境与 Local-First 原则
- **100% 离线可用**：核心引擎绝不发起任何网络外联请求，无需登录认证，无需配置任何 API Token；
- **环境兼容性**：支持 Node.js (>= 18) 与现代操作系统（macOS, Linux, Windows WSL）。

---

## 5. 异常处理与边界契约 (Edge Cases & Fault Tolerance)

| 异常边界场景 | 系统行为与期望响应 |
| :--- | :--- |
| **未找到架构文件** | 输出友好指引：`未在根目录找到架构规范文件（sextant.json 或 ARCHITECTURE.md），请运行 npx sextant-drift init 快速生成。`（Exit Code 2） |
| **Mermaid 图存在语法错误** | 输出错误所在的行号与语法解析失败信息，不崩溃、不报未捕获异常。（Exit Code 2） |
| **目录无法自动匹配组件** | 视为未分组代码或通用工具代码，在终端打印轻量 Info 提示，不阻断正常组件间的比对。 |
| **存在历史 Baseline 但发生新偏航** | 仅输出属于“新增”的违规条目，并显示 `15 处历史基线违规已忽略，发现 1 处新增偏航`。（Exit Code 1） |
| **循环依赖检测** | 准确打印闭环链条：`A.ts -> B.ts -> C.ts -> A.ts`，精确定位成环节点。 |

---

## 6. 验收基准 (Definition of Done / DoD)

对于 MVP（Phase 1 + Phase 2 + Phase 4 核心自用闭环交付），必须满足以下全部条件方可视为合格：
1. [x] **规范解析**：能够微秒级解析 `sextant.json` 并自动回退解析 `ARCHITECTURE.md` 内嵌的 Mermaid 与 YAML 规则；
2. [x] **拓扑偏航检测**：在真实 TypeScript 项目中以 100% 确定性拦截跨层旁路（Bypass）、逆向依赖（Inversion）与循环闭环（Cycles），准确定位代码行；
3. [ ] **语义不变量拦截**：能够在同一同步作用域内基于 AST 精确拦截时序先验违规（`must_precede`）、违禁导入（`forbid_import`）与参数配置缺陷（`require_config`）；
4. [ ] **紧凑终端门禁**：`npx sextant-drift check` ANSI 彩色输出紧凑（50~200 tokens），遵循 0/1/2 标准 Unix 退出码，默认 0 垃圾文件；
5. [ ] **逆向 X 光**：`npx sextant-drift init` 能一键扫描目录拓扑并生成规范 `sextant.json` 与 `ARCHITECTURE.md` 预览视图；
6. [ ] **双模基线豁免**：`npx sextant-drift baseline` 基于 AST 语义指纹固化债务，无论空行增删或格式化，旧债务均准确豁免，新增违规 100% 阻断；
7. [ ] **按需独立审查报告**：显式传参 `--report` 时由 `@sextant/web-report` 渲染并导出单文件自包含双图红绿审查报告 `drift-report.html`；
8. [x] **极限性能指标**：全套单测在毫秒级内跑绿，端到端分析扫描满足 5 秒原则。
