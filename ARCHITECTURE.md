# SextantDrift — 架构全景拓扑与规范文档 (Self-Architecture Specification)

> **版本**：v2.0 Reboot Edition (2026)  
> **单源事实**：[`sextant.json`](file:///home/redtea/Mona_project/SextantDriftV03/sextant.json)  
> **门禁核验**：执行 `npx sextant-drift check` 或 `./start.sh --self-check`

---

## 1. C4 软件架构全景模型 (C4 Architecture Model)

本工程采用标准 C4 架构模型定义系统边界、容器层级与组件映射，唯一单源事实为 [`sextant.json`](file:///home/redtea/Mona_project/SextantDriftV03/sextant.json)。
为了杜绝将所有组件平铺在一张视图内造成的认知疲劳，系统采用**渐进式展开（Progressive Disclosure）**分层设计：

### 1.1 Level 1: System Context (系统上下文视图 — 观全局)
彻底屏蔽内部实现细节，仅呈现系统与使用者（人类、AI Agent、CI）及外部生态的交互边界：

```mermaid
flowchart TD
    classDef person fill:#1A365D,stroke:#2B6CB0,stroke-width:2px,color:#FFFFFF;
    classDef system fill:#2B6CB0,stroke:#4299E1,stroke-width:2px,color:#FFFFFF;
    classDef external fill:#4A5568,stroke:#718096,stroke-width:2px,color:#FFFFFF;

    subgraph Users ["使用角色 (Actors)"]
        Architect["👤 人类架构师 / Tech Lead\n(制定架构意图，审阅偏航报告)"]:::person
        AIAgent["🤖 AI Coding Agent\n(编写代码，执行门禁自检与自省修复)"]:::person
        CIPipeline["⚙️ CI/CD 流水线 (GitHub Actions)\n(自动化门禁把关，阻断架构腐化合入)"]:::person
    end

    subgraph CoreSystem ["核心系统 (The System)"]
        SextantDrift["🧭 SextantDrift 架构 X 光机与偏航检测罗盘\n[Software System]\n提供确定性 AST 拓扑提取、C4 红绿差分、不变量规则校验"]:::system
    end

    subgraph External ["外部环境与载体 (External Context)"]
        Repo["📁 代码仓库与文件系统\n(Git Repo, 源码 AST, sextant.json, AGENTS.md)"]:::external
        HTMLViewer["🌐 离线报告承载端\n(无需网络或服务的静态浏览器审查台)"]:::external
    end

    Architect -->|"1. 声明架构意图与规范"| Repo
    AIAgent -->|"2. 编写业务代码"| Repo
    AIAgent -->|"3. 本地自检: npx sextant-drift check"| SextantDrift
    CIPipeline -->|"4. PR 门禁核验"| SextantDrift
    SextantDrift -->|"读取源码与规范"| Repo
    SextantDrift -->|"生成自包含离线差分报告 (drift-report.html)"| HTMLViewer
    Architect -->|"5. 审查直观红绿双图与偏航告警"| HTMLViewer
```

---

### 1.2 Level 2: Container Diagram (容器与分层拓扑视图 — 观分层)
将 15+ 具体组件聚合为 5 大顶层架构容器（Tiers），确立严格的单向防腐依赖流水：

```mermaid
flowchart TD
    classDef c1 fill:#2C5282,stroke:#4299E1,stroke-width:2px,color:#FFFFFF;
    classDef c2 fill:#2B6CB0,stroke:#63B3ED,stroke-width:2px,color:#FFFFFF;
    classDef c3 fill:#234E52,stroke:#38B2AC,stroke-width:2px,color:#FFFFFF;
    classDef c4 fill:#744210,stroke:#D69E2E,stroke-width:2px,color:#FFFFFF;
    classDef c5 fill:#4A5568,stroke:#A0AEC0,stroke-width:2px,color:#FFFFFF;

    subgraph MonorepoBoundary ["SextantDrift Monorepo 系统边界"]
        direction TB

        subgraph L1 ["Layer 1: CLI Presentation Tier [packages/cli]"]
            CLI["🖥️ CLI Gate\n[Container: Node.js / CAC / ANSI]\n命令行交互入口、退出码门禁与参数路由"]:::c1
        end

        subgraph L2 ["Layer 2: Visual Reporting Tier [packages/web-report]"]
            Reporting["📊 Visual Report Visualizer\n[Container: HTML5 / Native SVG]\n纯原生自包含离线双图差分报告生成器"]:::c2
        end

        subgraph L3 ["Layer 3: Core Engine Tier [packages/core - engine]"]
            Engine["⚙️ Core Headless Engine\n[Container: Pure TypeScript (Headless)]\n架构规范解析、C4 差分对比、语义不变量与状态机引擎\n(戒律 3: 0 DOM, 0 CLI)"]:::c3
        end

        subgraph L4 ["Layer 4: AST & Graph Infrastructure Tier [packages/core - infra]"]
            Infra["🧱 AST & Graph Infrastructure\n[Container: TypeScript Compiler API / Tarjan SCC]\n确凿 AST 语法提取、模块路径解析与图拓扑算法"]:::c4
        end

        subgraph L5 ["Layer 5: Types & Foundations Tier [packages/core - contracts]"]
            Contracts["📐 Core Contracts & Foundations\n[Container: TypeScript Domain Types]\n领域架构实体契约、C4 报告模型与配置错误定义"]:::c5
        end

        CLI ==>|"调用差分与门禁"| Engine
        CLI -.->|"触发报告生成"| Reporting
        Reporting ==>|"读取分析结果"| Engine
        Reporting -.->|"依赖基础契约"| Contracts
        Engine ==>|"委托语法分析与图算法"| Infra
        Engine ==>|"领域实体实现"| Contracts
        Infra ==>|"提供通用基础类型"| Contracts
    end
```

| 架构层级 (Tier / Container) | 序号 | 核心职责 | 技术栈 (Technology) |
| :--- | :--- | :--- | :--- |
| **`cli`** (Presentation Tier) | Layer 1 | 终端命令行交互、退出码门禁与参数解析 | Node.js / CAC / ANSI Terminal |
| **`reporting`** (Visual Reporting) | Layer 2 | 纯原生离线 C4 架构差分审查报告生成 | HTML5 / Native SVG Engine |
| **`engine`** (Core Engine) | Layer 3 | 确定性拓扑提取、C4 差分对比与不变量规则引擎 | Pure TypeScript (Headless, 0 DOM, 0 CLI) |
| **`infrastructure`** (Infrastructure) | Layer 4 | 源码 AST 解析、路径解析与 Tarjan 强连通图算法 | TypeScript Compiler API / Tarjan SCC |
| **`contracts`** (Foundations) | Layer 5 | 领域实体类型契约、C4 规范模型与配置错误定义 | Pure TypeScript Contract Types |

---

### 1.3 Level 3: Component Diagram (组件架构按域下钻 — 观局部)

#### 视点 A：核心引擎容器内部组件 (Core Engine Components)
```mermaid
flowchart TD
    classDef facade fill:#2B6CB0,stroke:#63B3ED,stroke-width:2px,color:#FFFFFF;
    classDef engine fill:#285E61,stroke:#4FD1C5,stroke-width:2px,color:#FFFFFF;

    Facade["🚪 CoreFacade (index.ts)\n统一门面 API"]:::facade
    SpecParser["📑 SpecParser\n规范解析器"]:::engine
    Comparator["⚖️ ComparatorEngine\nTarget vs Actual 差分"]:::engine
    Invariants["🛡️ InvariantsEngine\n语义不变量匹配器"]:::engine
    StateEngine["🔄 StateEngine\n状态机死锁检测"]:::engine
    C4Engine["🗺️ C4Engine\nC4 多层级图模型构建器"]:::engine
    Baseline["🔒 BaselineEngine\n历史债务指纹引擎"]:::engine
    DynamicTrace["⏱️ Trace & Causality\n运行时因果时序差分"]:::engine

    Facade --> SpecParser
    Facade --> Comparator
    Facade --> Invariants
    Facade --> StateEngine
    Facade --> Baseline
    Facade --> C4Engine
    Facade -.-> DynamicTrace
```

#### 视点 B：底层基础设施与契约组件 (Infrastructure & Contracts)
```mermaid
flowchart TD
    classDef infra fill:#744210,stroke:#D69E2E,stroke-width:2px,color:#FFFFFF;
    classDef contract fill:#4A5568,stroke:#A0AEC0,stroke-width:2px,color:#FFFFFF;

    AstAnalyzer["🔬 AstAnalyzer\nTS AST 语法提取"]:::infra
    GraphAlgo["📐 GraphAlgorithms\nDirectedGraph, Tarjan SCC"]:::infra
    CoreContracts["📜 CoreContracts\nTargetArchitecture, C4GraphData"]:::contract
    CoreErrors["⚠️ CoreErrors\nSextantConfigError, DriftError"]:::contract

    AstAnalyzer --> GraphAlgo
    AstAnalyzer --> CoreContracts
    GraphAlgo --> CoreContracts
    AstAnalyzer -.-> CoreErrors
```

### 1.4 核心组件拓扑与物理映射 (Components Mapping)
| 组件 ID | 所属容器 | 技术栈 | 源码映射路径 (Paths) |
| :--- | :--- | :--- | :--- |
| `CliGate` | `cli` | CAC / ANSI | `packages/cli/src/**` |
| `WebReport` | `reporting` | Native SVG | `packages/web-report/src/**` |
| `CoreFacade` | `engine` | TypeScript | `packages/core/src/index.ts` |
| `C4Engine` | `engine` | C4 Model | `packages/core/src/c4/**` |
| `SpecParser` | `engine` | JSON / YAML | `packages/core/src/parser/**` |
| `InvariantsEngine` | `engine` | AST Matcher | `packages/core/src/invariants/**` |
| `ComparatorEngine` | `engine` | Graph Diff | `packages/core/src/comparator/**` |
| `BaselineEngine` | `engine` | SHA-256 | `packages/core/src/baseline/**` |
| `StateEngine` | `engine` | FSM Verifier | `packages/core/src/state/**` |
| `TraceRecorder` | `engine` | Dynamic Trace | `packages/core/src/trace/**` |
| `CausalityEngine` | `engine` | Causality DAG | `packages/core/src/causality/**` |
| `AstAnalyzer` | `infrastructure`| TS AST | `packages/core/src/analyzer/**` |
| `GraphAlgorithms` | `infrastructure`| DirectedGraph | `packages/core/src/graph/**` |
| `CoreContracts` | `contracts` | Types | `packages/core/src/types/**` |
| `CoreErrors` | `contracts` | Errors | `packages/core/src/errors/**` |

### 1.5 合法依赖流向 (Allowed Dependency Flows)
- `cli` ➔ `reporting` (协议: `imports`)
- `cli` ➔ `engine` (协议: `imports`)
- `reporting` ➔ `engine` (协议: `imports`)
- `reporting` ➔ `contracts` (协议: `imports`)
- `engine` ➔ `infrastructure` (协议: `imports`)
- `engine` ➔ `contracts` (协议: `imports`)
- `infrastructure` ➔ `contracts` (协议: `imports`)

---

## 2. 核心门禁执行生命周期状态机 (Gate Execution Lifecycle FSM)

本项目自身门禁执行全流程通过有限状态机进行形式化定义：

```mermaid
stateDiagram-v2
    [*] --> SpecResolution
    SpecResolution --> FileScanning: spec_resolved
    SpecResolution --> FatalError: config_error

    FileScanning --> AstExtraction: files_found

    AstExtraction --> TopologyAnalysis: ast_extracted
    AstExtraction --> FatalError: parse_error

    TopologyAnalysis --> InvariantVerification: topology_built
    InvariantVerification --> StateMachineVerification: invariants_verified
    InvariantVerification --> FatalError: invariant_rule_error

    StateMachineVerification --> DynamicTraceVerification: states_verified
    StateMachineVerification --> FatalError: state_syntax_error

    DynamicTraceVerification --> BaselineComparison: trace_verified
    DynamicTraceVerification --> FatalError: trace_syntax_error

    BaselineComparison --> GatePassed: 0_new_drifts
    BaselineComparison --> DriftDetected: drifts_found

    GatePassed --> [*]
    DriftDetected --> [*]
    FatalError --> [*]
```


---

## 2. 核心架构不变量守则 (Architecture Invariants)

1. **戒律 3：Core-First 零外壳污染 (`CORE_ZERO_CLI_DOM`)**
   - `@sextant/core` 严禁引用任何终端 CLI 库（`cac`, `picocolors`, `commander`, `chalk`）或外部上层包（`@sextant/cli`, `@sextant/web-report`）；
   - 保证内核在任何纯 Node.js / CI / 隔离沙箱环境中零额外依赖秒级执行。

2. **视图与报告隔离 (`REPORT_ZERO_CLI`)**
   - `@sextant/web-report` 仅负责纯数据到静态 HTML 的单向无状态渲染，严禁引入 CLI 解析或终端交互逻辑。

3. **依赖单向流动与分层防御**
   - 上层（`cli`, `reporting`）单向调用下层（`engine`）；
   - 引擎层依赖底层 AST 语法分析与图算法基础设施（`infrastructure`）；
   - 所有通用数据结构与错误类收敛于基底层（`contracts`），杜绝循环引用与反向依赖。
