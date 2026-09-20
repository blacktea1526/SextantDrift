# SextantDrift (六分仪偏航检测罗盘)

> **面向 AI 编程时代现代工程团队的「架构 X 光机与偏航检测罗盘（Architecture X-Ray & Drift Compass）」。**  
> 永远只看两张图的红绿差分，终结盲目肉眼代码审查。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-green.svg)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 1. 为什么需要 SextantDrift？

### 1.1 2026 年核心工程矛盾：人审不过来 AI 代码
随着 Claude Code、Cursor、Copilot、Antigravity 等 AI Coding 工具的普及，研发团队的代码产出速度提升了 5~10 倍。然而，**PR 人工审查（Code Review）的耗时反而成倍增加**：
- 数千行的行级 `git diff` 支离破碎，开发者“见木不见林”，在代码细节的泥潭中无法察觉隐蔽的**架构腐化、跨层旁路与违禁依赖**；
- 传统设计图（Miro / Draw.io / 文字 PRD）画完即弃，无法与真实代码建立确定性的动态约束；
- Agent 写代码容易“偷懒”直连底层、逆向引用或颠倒业务先验时序（如“未落库直接调用外部网络 API”）。

### 1.2 核心产品哲学：Design by Diagram, Diff by Diagram
SextantDrift 的唯一视觉与审查心智：**永远只看两张图的红绿差分！**

```
┌────────────────────────┐         ┌────────────────────────┐
│  左屏: 设计意图 Target   │   VS    │  右屏: 真实代码 Actual  │
│  (标准分层与组件设计图) │  Diff   │  (TS AST 机器确凿提取) │
└────────────────────────┘         └────────────────────────┘
                    ▼                          ▼
        ┌──────────────────────────────────────────────┐
        │       标红区 (Architectural Drift Alert)      │
        │  红线夹角 · 越界连线 · 循环依赖 · 破损不变量  │
        └──────────────────────────────────────────────┘
```

- **80% 图（骨架与拓扑）**：用标准的 Mermaid 图形天然定义模块边界、调用流向与状态机；
- **20% 规则（灵魂与不变量）**：图旁边伴随 3~5 条硬性约束（Semantic Invariants），定义关键调用次序与安全边界。

---

## 2. 核心检测能力矩阵

SextantDrift 采用 **Core-First（无头核心先行）** 架构，纯 TypeScript 官方 AST 解析，**零 DOM、零虚假推断、零假阳性**：

| 能力维度 | 解决痛点 | 检测机制 | 严重度 |
| :--- | :--- | :--- | :---: |
| **跨层旁路 (Layer Bypass)** | Controller 绕过 Service 直连 Repository / DB 驱动 | 拓扑图 DFS 分层序数递增比对 | `CRITICAL` |
| **逆向依赖 (Layer Inversion)** | 底层模块反向引用上层业务表现层模块 | 拓扑反向有向边扫描 | `CRITICAL` |
| **循环依赖死锁 (Cycles)** | 跨组件死锁调用链（如 `Order -> Pay -> Order`） | Tarjan 强连通分量 (SCC) 算法 | `CRITICAL` |
| **违禁外联 (Forbidden Imports)** | 前端或表现层直接导入 `@prisma/client`, `typeorm` 等驱动 | AST `ImportDeclaration` 精准过滤 | `CRITICAL` |
| **语义不变量 (Invariants)** | “写库必须在调网络前”等业务先验时序与超时配置要求 | 同步作用域 AST 语句拓扑模式匹配 (`must_precede` / `require_config`) | `CRITICAL / WARNING` |
| **状态机分析 (State Verifier)** | 业务状态机存在黑洞状态、不可达孤岛或缺少失败超时降级分支 | Mermaid `stateDiagram-v2` 静态转移图度数与遍历分析 | `CRITICAL / WARNING` |
| **动态因果差分 (Dynamic Trace)** | 复杂异步因果链偏序紊乱（解决纯静态正则猜时序导致的假阳性） | 运行时 Trace 录制器 + Mermaid `sequenceDiagram` 因果 DAG 比对 | `CRITICAL / WARNING` |
| **存量债务隔离 (Baseline)** | 老项目满地历史债务导致无法推行架构治理 | 基于 SHA256 语义指纹的债务快照机制（**No New Drift**） | `EXEMPTED` |

---

## 3. 六大绝对戒律 (Immutable Invariants)

在 SextantDrift 的设计与演进中，坚决执行六大绝对戒律：
1. **严禁 Agent 自证**：拒绝任何形式的 Agent 自写“实际时序”或自我汇报合规，真实拓扑必须且只能由编译器确定性提取；
2. **严禁静态猜时序**：绝不在静态阶段靠模糊正则猜测复杂的异步时序，**误报等于自杀**，动态时序交由真实 Trace 解决；
3. **Core-First 无头先行**：`@sextant/core` 核心无 DOM、无 CLI 依赖，可在任何 CI / Node.js 沙盒中毫秒级执行；
4. **零侵入开放协议**：不做私有孤岛格式，挂靠 Git 纳管的标准 `sextant.json` 与 Mermaid / Markdown 生态；
5. **逆向推导优先**：一键 `npx sextant-drift init` 自动反向提取项目拓扑，不需要开发者预先手工绘制海量大图；
6. **严守分层与每次改动必测**：核心分包物理隔离，任何改动必须执行全量测试套件并保证 100% 绿灯。

---

## 4. 极速开始指南 (Quickstart)

### 4.1 安装与环境要求
- **Node.js**: `>= 18.0.0`
- **包管理器**: `pnpm` (推荐), `npm`, 或 `yarn`

```bash
# 全局或直接使用 npx
npx sextant-drift --help
```

### 4.2 核心工作流

#### ① 逆向推导架构规范 (`init`)
针对现有代码仓库，一键反向扫描物理目录与引用关系，生成初始架构拓扑：
```bash
npx sextant-drift init
```
该命令会自动创建：
- `sextant.json`：机器强校验的单源事实配置文件（配置了完整 JSON Schema 自动补全）；
- `ARCHITECTURE.md`：内嵌 Mermaid 分层架构图的只读视图，供 GitHub 直接预览。

#### ② 本地与 CI 门禁检查 (`check`)
```bash
# 执行当前项目架构偏航核验
npx sextant-drift check

# 附带终端 ANSI 彩色高亮诊断（仅消耗 50~200 Tokens，极度节省 Agent 上下文）
# 退出码协议：0 = 正常通过；1 = 发现偏航；2 = 配置语法损坏
```

#### ③ 存量老项目债务隔离 (`baseline`)
接手存在历史违规的老项目？遵循 **“历史债务豁免，新增偏航零容忍（No New Drift）”** 原则：
```bash
# 捕获当前所有存量架构违规并生成 SHA256 语义指纹快照
npx sextant-drift baseline
```
生成的 `.sextant/baseline.json` 提交到 Git 仓库后，之后的 `check` 会自动豁免历史债务，仅在引入**全新违规**时阻断！

#### ④ 生成 100% 零 CDN 原生 SVG 审查报告 (`report` 或 `--report`)
```bash
# 导出 100% 离线自包含、零外部 CDN 依赖的 C4 交互式审查报告
npx sextant-drift report

# 支持指定中英双语输出 (默认 zh，支持 --lang en)
npx sextant-drift report --lang zh

# 或在 check 门禁核验时同步导出
npx sextant-drift check --report
```
双击在任意浏览器打开 `drift-report.html`：
- **100% 零外部请求**：断网与气隙环境毫秒级原生 SVG 渲染，杜绝任何外部 CDN 挂掉或渲染抖动；
- **C4 多层级下钻**：支持 **Level 2 容器层级概览** 与 **Level 3 组件拓扑明细** 一键切换；
- **高信噪比交互探针**：具备滚轮平移缩放 (Pan & Zoom)、一键过滤底层 Contracts 契约连线、组件聚焦探针与中英文一键切换；
- **AI 自愈提示词复制**：一键复制携带行号切片与确凿证据的标准化 AI Fix Prompt，赋能 Agent 单轮自愈。

---

## 5. 项目架构规范样例 (`sextant.json`)

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDriftV03/main/packages/core/schema/sextant.schema.json",
  "name": "My Enterprise Application",
  "layers": [
    {
      "name": "Presentation Layer",
      "order": 1,
      "components": ["Controllers"],
      "paths": ["src/controllers/**"],
      "allowDependencies": ["Business Domain Layer"]
    },
    {
      "name": "Business Domain Layer",
      "order": 2,
      "components": ["Services"],
      "paths": ["src/services/**"],
      "allowDependencies": ["Infrastructure Layer"]
    },
    {
      "name": "Infrastructure Layer",
      "order": 3,
      "components": ["Repositories"],
      "paths": ["src/repos/**"],
      "allowDependencies": []
    }
  ],
  "invariants": [
    {
      "id": "FORBID_DIRECT_DB_IN_UI",
      "severity": "critical",
      "desc": "表现层严禁直接导入底层数据库驱动",
      "pattern": {
        "forbid_import": ["@prisma/client", "typeorm"],
        "in_path": "src/controllers/**"
      }
    },
    {
      "id": "AUTH_BEFORE_DB_ACCESS",
      "severity": "critical",
      "desc": "在控制器方法中访问数据库前必须先校验权限",
      "pattern": {
        "must_precede": ["auth.verify"],
        "target": ["repo.findUser", "this.repo.findUser"],
        "scope": "src/controllers/**"
      }
    }
  ]
}
```

---

## 6. Monorepo 统一控制脚本 (`./start.sh`)

本项目自带统一开发调度中枢 `./start.sh`，方便快速调试与自举验证：

```bash
./start.sh            # 启动本地可视化审查工作台 (Workbench Web Server @ 3000)
./start.sh --test     # 执行全套单元测试 (Vitest CLI, 38 个套件, 202 个用例全部通过)
./start.sh --ui       # 启动 Vitest UI 交互式测试仪表盘
./start.sh --check    # 执行三维架构门禁实测 (包含 SextantDrift 项目自身自举核验)
./start.sh --build    # 全量构建所有子包 (@sextant/core, @sextant/cli, @sextant/web-report)
./start.sh --bench    # 执行 AST 提取与 Tarjan 图算法性能基准压测
./start.sh --coverage # 执行单测并统计 V8 代码覆盖率报告
```

---

## 7. CI/CD 集成 (GitHub Actions)

在你的仓库 `.github/workflows/architecture-gate.yml` 中添加门禁步骤：

```yaml
name: Architecture Drift Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm -r run build

      # 执行架构偏航核验，自动将诊断红绿表格输出到 PR Step Summary
      - name: Verify Architecture
        run: npx sextant-drift check --github-summary
```

---

## 8. AI Agent 赋能与自愈机制

SextantDrift 专为 AI Agent（Claude Code, Cursor, Antigravity, Copilot）原生优化：
- **Token 极度经济**：`check` 终端输出经过严苛的信噪比优化，单次报错仅占 **50 ~ 200 Tokens**，精准定位到违规文件与代码行号；
- **确定性修复指引**：每一处偏航明确指出所破坏的规则与建议修复连线；
- **Agent Skill 开箱即用**：提供 [`.agents/skills/sextant-drift`](.agents/skills/sextant-drift/SKILL.md)，Agent 可在编写或重构代码后自主运行 `npx sextant-drift check` 进行自我闭环校验与纠偏，杜绝架构破窗。

---

## 9. 仓库结构 (Repository Layout)

```
SextantDrift/
├── packages/
│   ├── core/           # @sextant/core: 纯无头核心分析引擎 (TS AST, Tarjan, Invariants, Trace)
│   ├── cli/            # @sextant/cli: 极轻量命令行门禁工具 (cac + picocolors, < 50KB)
│   └── web-report/     # @sextant/web-report: 单文件自包含双图审查报告模板
├── .agents/skills/     # 面向 AI Agent 的架构审查与自愈技能
├── .github/workflows/  # 自动化 CI/CD 门禁与 Step Summary
├── sextant.json        # 项目自身自举架构规范 (Self-Dogfooding)
├── start.sh            # 统一工程调度控制器
└── index.html          # 本地工程制图审阅工作台 (Engineering Drafting Bench)
```

---

## 10. 开源协议 (License)

本项目遵循 [MIT 许可证](LICENSE)。
