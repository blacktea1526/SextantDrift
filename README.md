# SextantDrift (六分仪架构偏航检测罗盘)

> **面向现代工程与 AI 编程的架构偏航检测工具**  
> 通过对比架构设计规范与源码实际拓扑，快速捕获跨层调用、循环依赖与语义规则违规。

[ 简体中文 ](README.md) | [ English ](README_EN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-green.svg)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 目录

- [一、项目简介](#一项目简介)
  - [1.1 解决的问题](#11-解决的问题)
  - [1.2 双图差分模式](#12-双图差分模式)
  - [1.3 核心检测能力](#13-核心检测能力)
- [二、快速上手 (Quick Start)](#二快速上手-quick-start)
- [三、安装指南](#三安装指南)
- [四、详细使用教程](#四详细使用教程)
  - [4.1 步骤 1：一键初始化架构规范 (init)](#41-步骤-1一键初始化架构规范-init)
  - [4.2 步骤 2：配置与定制架构规范 (sextant.json)](#42-步骤-2配置与定制架构规范-sextantjson)
  - [4.3 步骤 3：执行架构偏航检查 (check)](#43-步骤-3执行架构偏航检查-check)
  - [4.4 步骤 4：存量项目平滑纳管 (baseline)](#44-步骤-4存量项目平滑纳管-baseline)
  - [4.5 步骤 5：生成可视化审查报告 (report)](#45-步骤-5生成可视化审查报告-report)
  - [4.6 语义不变量 (Semantic Invariants) 配置实战](#46-语义不变量-semantic-invariants-配置实战)
- [五、工程实践与 CI/CD 集成](#五工程实践与-cicd-集成)
  - [5.1 Git Pre-commit Hook 集成](#51-git-pre-commit-hook-集成)
  - [5.2 GitHub Actions 自动化门禁](#52-github-actions-自动化门禁)
  - [5.3 与 AI 编程助手协同修复](#53-与-ai-编程助手协同修复)
- [六、CLI 命令行参数完整参考](#六cli-命令行参数完整参考)
- [七、项目自测与开发管理](#七项目自测与开发管理)
- [八、开源协议](#八开源协议)

---

## 一、项目简介

### 1.1 解决的问题

在日常开发以及使用 AI 编码助手（如 Cursor、Claude Code、Copilot 等）的过程中，代码产出速度大幅提升，但架构结构往往容易在局部调整中逐渐偏航：
- **跨层直接调用**：表现层控制器绕过业务服务层，直接调用数据库仓储或 ORM 实例；
- **逆向与循环依赖**：底层模块反向引用上层组件，或多个服务间形成循环调用网；
- **时序与规范破损**：颠倒关键操作次序（如未持久化落库即发起外部不可靠网络请求），或在客户端模块中引入服务端私有模块。

SextantDrift 通过对源码进行 AST 依赖解析，将代码实际拓扑与既定架构设计规范进行比对，精确定位违规位置并提供修改建议，作为本地开发与 CI 流水线的架构质量门禁。

---

### 1.2 双图差分模式

SextantDrift 采用清晰的“设计意图 vs 代码实现”差分机制：

```
┌──────────────────────────────────────┐             ┌──────────────────────────────────────┐
│        设计意图 (Target Spec)         │             │        真实代码 (Actual Code)         │
│     分层定义 · 允许连线 · 语义约束    │     VS      │    从源码 AST 精确提取的实际物理拓扑  │
└──────────────────────────────────────┘    (Diff)   └──────────────────────────────────────┘
                   │                                                     │
                   └──────────────────────────┬──────────────────────────┘
                                              ▼
                        ┌──────────────────────────────────────────┐
                        │        偏航告警区 (Drift Findings)       │
                        │    跨层越界 · 逆向依赖 · 破损语义规则    │
                        │    循环依赖 · 状态机孤岛 · 违禁模块引入  │
                        └──────────────────────────────────────────┘
```

- **拓扑边界**：通过声明分层（Layers）与组件（Components），确立模块间允许的单向调用流；
- **语义约束**：配合 3~5 条硬性规则（Semantic Invariants），约束调用先后顺序与模块导入边界。

---

### 1.3 核心检测能力

| 检测项 | 说明 | 常见场景 | 默认严重度 |
| :--- | :--- | :--- | :---: |
| **跨层旁路 (Layer Bypass)** | 上层模块跳过中间层直接调用底层组件 | Controller 直接依赖 Repository 或 ORM 驱动 | `CRITICAL` |
| **逆向依赖 (Layer Inversion)** | 底层模块反向导入上层业务模块 | Domain / Infra 层引用 Presentation 控制器 | `CRITICAL` |
| **循环依赖 (Circular Dependencies)** | 组件之间存在互相依赖或间接成环 | `ComponentA -> ComponentB -> ComponentA` | `CRITICAL` |
| **违规导入 (Forbidden Imports)** | 模块导入了被禁止的第三方包或系统内置库 | 前端组件中引入 Node.js 原生模块 (`fs`, `child_process`) | `CRITICAL` |
| **语义不变量 (Semantic Invariants)** | 代码执行次序或调用配置违背约定 | 未落库前调用外部网络 API、外部请求缺少超时配置 | `CRITICAL / WARNING` |
| **状态机校验 (State Verifier)** | Mermaid 状态机图存在死锁节点或缺失降级路径 | 流程存在孤岛状态、无转出分支的黑洞状态 | `CRITICAL / WARNING` |

---

## 二、快速上手 (Quick Start)

无需复杂配置，只需 3 步即可在现有项目中运行架构检查：

```bash
# 步骤 1：扫描现有项目源码（默认扫描 src 目录），自动生成架构规范
npx sextant-drift init

# 步骤 2：执行架构偏航检查，输出终端诊断
npx sextant-drift check

# 步骤 3：生成单文件自包含的可视化差分报告
npx sextant-drift report
```

---

## 三、安装指南

### 环境要求
- **Node.js**：`>= 18.0.0` (推荐 LTS 20+)
- **包管理器**：`pnpm` / `npm` / `yarn`

### 作为开发依赖安装

```bash
# 使用 pnpm (推荐)
pnpm add -D sextant-drift

# 使用 npm
npm install --save-dev sextant-drift

# 使用 yarn
yarn add -D sextant-drift
```

安装后即可直接使用 `npx sextant-drift` 或在 `package.json` 的 scripts 中配置快捷脚本。

---

## 四、详细使用教程

### 4.1 步骤 1：一键初始化架构规范 (`init`)

在已有项目中，你无需从头手写规范。运行 `init` 命令，SextantDrift 会扫描源码结构并推导初始分层与依赖：

```bash
# 扫描当前项目的 src 目录
npx sextant-drift init

# 若源码位于其他目录，可通过 -s 或 --source-dir 指定
npx sextant-drift init --source-dir app

# 若当前目录已存在配置，使用 -f 或 --force 强制覆盖
npx sextant-drift init --force
```

运行完成后，会在项目根目录下生成两个文件：
1. **`sextant.json`**：架构规范的配置单源，包含完整 JSON Schema 支持，在 VSCode 等编辑器中自带类型校验与自动补全；
2. **`ARCHITECTURE.md`**：内嵌 Mermaid 拓扑图的说明文档，可在代码仓库页面直接预览。

---

### 4.2 步骤 2：配置与定制架构规范 (`sextant.json`)

打开生成的 `sextant.json`，根据项目的实际架构分层进行微调。以下为一个典型的三层架构示例：

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json",
  "name": "MyProject",
  "version": "1.0.0",
  "layers": [
    {
      "id": "presentation",
      "name": "表现层 (Presentation)",
      "order": 1,
      "description": "API 控制器与路由入口"
    },
    {
      "id": "domain",
      "name": "业务层 (Domain)",
      "order": 2,
      "description": "业务服务与核心领域逻辑"
    },
    {
      "id": "infrastructure",
      "name": "基础设施层 (Infrastructure)",
      "order": 3,
      "description": "数据持久化、仓储与第三方集成"
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
      "name": "Services",
      "layerId": "domain",
      "paths": ["src/services/**"]
    },
    {
      "id": "repositories",
      "name": "Repositories",
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

#### 配置字段解析：
- **`layers`**：定义层级列表。`order` 越小代表层级越靠上（上层可依赖下层，下层不可反向依赖上层）；
- **`components`**：定义逻辑组件。通过 `paths` glob 模式匹配物理文件目录；
- **`forbiddenImports`**：针对特定组件设置禁止引入的库或路径；
- **`allowDependencies`**：显式声明允许的组件间调用关系。未声明的调用或跨层调用将被检测为违规。

---

### 4.3 步骤 3：执行架构偏航检查 (`check`)

在代码开发中或提交代码前，运行 `check` 命令检查是否发生架构违规：

```bash
# 基础检查
npx sextant-drift check

# 严格模式：将 Warning 级别警告视为失败
npx sextant-drift check --strict

# 输出机器可读的 JSON 格式
npx sextant-drift check --json

# 指定特定的 Monorepo 子包目录
npx sextant-drift check --filter packages/core

# 检查中包含纯类型导入（默认仅检查运行时实际导入）
npx sextant-drift check --count-type-only

# 检查同时输出可视化 HTML 报告
npx sextant-drift check --report
```

#### 终端诊断输出示例：

```text
✖ Architectural Drift Detected! (Found 2 violations)

[CRITICAL] Layer Bypass Violation:
  From: Controllers (src/controllers/order.controller.ts)
  To:   Repositories (src/repositories/order.repo.ts)
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

Checked 86 files (142 dependencies) in 380ms. Exit code: 1
```

#### 退出码说明 (Exit Codes)：
- **`0`**：架构合规，未发现偏航，门禁通过；
- **`1`**：存在架构偏航或不变量破损，门禁阻断；
- **`2`**：参数有误或配置文件解析异常。

---

### 4.4 步骤 4：存量项目平滑纳管 (`baseline`)

对于既有的老项目，首次接入可能存在较多历史遗留违规。SextantDrift 支持基准线机制，隔离既有债务，确保**不引入新违规 (No New Drift)**：

```bash
# 步骤 1：记录当前所有既有违规并生成快照
npx sextant-drift baseline
```

- 该命令会在 `.sextant/baseline.json` 中保存当前所有违规的语义指纹；
- 将 `.sextant/baseline.json` 提交到版本库后，后续执行 `npx sextant-drift check` 时，**存量违规将被自动豁免，只有新引入的代码偏航才会触发告警**；
- 团队可在后续重构中逐步消化历史债务，平滑推进架构治理。

---

### 4.5 步骤 5：生成可视化审查报告 (`report`)

如果需要向团队展示全局架构健康度，或在浏览器中直观审查调用拓扑，可以生成离线 HTML 报告：

```bash
# 生成默认报告文件 (drift-report.html)
npx sextant-drift report

# 自定义报告输出路径
npx sextant-drift report -o ./dist/architecture-report.html

# 指定报告语言为英文 (默认: zh)
npx sextant-drift report --lang en
```

#### 报告特色：
1. **完全自包含**：单一 HTML 文件，无外部网络请求与 CDN 依赖，断网环境下可正常打开与分享；
2. **矢量双图交互**：左屏目标规范图对比右屏代码拓扑图，支持放大、拖拽与高亮连线；
3. **违规卡片下钻**：点击红线可展开代码片段、调用上下游以及修复指引；
4. **一键复制 AI 提示词**：违规项支持一键复制包含定位与建议的 Prompt，方便直接交由 AI 助手修复。

---

### 4.6 语义不变量 (Semantic Invariants) 配置实战

在 `sextant.json` 的 `invariants` 字段中，可以配置微观层面的调用规则：

#### 场景 1：调用次序先验约束 (`must_precede`)
要求关键状态持久化必须发生在外部网络请求之前：

```json
{
  "id": "PERSIST_BEFORE_LLM",
  "severity": "critical",
  "desc": "用户输入数据在调用外部模型前必须先落库持久化",
  "pattern": {
    "must_precede": ["messageRepo.save", "db.messages.create"],
    "target": ["openai.chat.completions.create", "llmClient.generate"],
    "scope": "src/services/**"
  }
}
```

#### 场景 2：违禁模块导入隔离 (`forbid_import`)
防止在前端或表现层组件中导入系统级模块：

```json
{
  "id": "FORBID_NODE_MODULES_IN_VIEW",
  "severity": "critical",
  "desc": "视图层组件中禁止直接导入 Node.js 原生模块",
  "pattern": {
    "forbid_import": ["fs", "node:fs", "child_process", "path"],
    "in_path": "src/views/**,src/components/**"
  }
}
```

#### 场景 3：外部调用必配参数约束 (`require_config`)
要求调用公共网络请求库时必须显式配置超时时长：

```json
{
  "id": "MANDATORY_TIMEOUT",
  "severity": "warning",
  "desc": "外部 API 请求必须配置 timeout 超时参数",
  "pattern": {
    "target": ["axios.*", "fetchClient.*"],
    "require_config": ["timeout"],
    "scope": "src/integrations/**"
  }
}
```

---

## 五、工程实践与 CI/CD 集成

### 5.1 Git Pre-commit Hook 集成

配合 `husky` 与 `lint-staged`，可以在开发者执行 `git commit` 时自动进行架构门禁拦截：

```json
// package.json
{
  "scripts": {
    "prepare": "husky install"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "sextant-drift check"
    ]
  }
}
```

---

### 5.2 GitHub Actions 自动化门禁

在仓库的 `.github/workflows/architecture-gate.yml` 中添加门禁流水线：

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

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      # 执行架构检查，并通过 --github-summary 自动将报告输出至 GitHub PR 摘要
      - name: Run Architecture Drift Check
        run: npx sextant-drift check --github-summary --report drift-report.html

      # 上传 HTML 报告工件供团队审阅
      - name: Upload Drift Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: architecture-drift-report
          path: drift-report.html
```

---

### 5.3 与 AI 编程助手协同修复

当使用 Cursor、Claude Code 或 GitHub Copilot 时，SextantDrift 提供了针对 AI 优化的输出模式：

```bash
# 输出精简的 YAML 修复清单（节约 Token 消耗）
npx sextant-drift check --fix-manifest

# 输出可直接粘贴给 AI 的引导 Prompt
npx sextant-drift check --ai-prompt
```

#### 常见工作流：
1. AI 生成新功能代码后，在终端运行 `npx sextant-drift check`；
2. 若捕获到跨层调用（例如 Controller 中直接构造了 Repository），复制报错建议或通过 `--ai-prompt` 生成提示；
3. 将提示直接发送给 AI 助手，引导其将仓储调用移至 Service 层完成自愈修复。

---

## 六、CLI 命令行参数完整参考

### 全局常用命令

| 命令 | 描述 |
| :--- | :--- |
| `sextant-drift init [dir]` | 扫描源码目录并初始化生成 `sextant.json` 与 `ARCHITECTURE.md` |
| `sextant-drift check [dir]` | 核验代码依赖拓扑与语义不变量规范（默认命令） |
| `sextant-drift baseline [dir]` | 将当前存量违规冻结快照至 `.sextant/baseline.json` |
| `sextant-drift report [dir]` | 生成离线 HTML 架构双图审查报告 |

---

### `check` 命令参数

| 参数 | 缩写 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `--config <path>` | `-c` | `sextant.json` | 指定自定义规范文件路径 |
| `--baseline <path>` | `-b` | `.sextant/baseline.json` | 指定自定义基准线快照文件路径 |
| `--tsconfig <path>` | `-t` | 自动查找 | 指定自定义 `tsconfig.json` 路径 |
| `--strict` | - | `false` | 严格模式：将 Warning 级别告警同样视为检查失败 |
| `--count-type-only` | - | `false` | 将 TypeScript 纯类型导入 (`import type`) 纳入拓扑检查 |
| `--report [output]` | - | - | 检查的同时输出 HTML 报告（可指定输出文件名） |
| `--github-summary` | - | `false` | 将检查结果写入 GitHub Actions `GITHUB_STEP_SUMMARY` |
| `--filter <package>` | - | - | 在 Monorepo 项目中过滤指定子包目录 |
| `--lang <lang>` | - | `zh` | 报告展示语言（可选 `zh` 或 `en`） |
| `--json` | - | `false` | 以机器可读的 JSON 格式输出结果 |
| `--fix-manifest` | - | `false` | 输出适合 AI 处理的紧凑 YAML 修复清单 |
| `--ai-prompt` | - | `false` | 输出针对 AI 助手的可直接执行修复 Prompt |

---

### `init` 命令参数

| 参数 | 缩写 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `--source-dir <dir>` | `-s` | `src` | 指定扫描推导的源码目录 |
| `--force` | `-f` | `false` | 若目标文件已存在，强制覆盖现有配置 |
| `--json` | - | `false` | 以 JSON 格式输出初始化结果状态 |

---

### `report` 命令参数

| 参数 | 缩写 | 默认值 | 说明 |
| :--- | :---: | :---: | :--- |
| `--output <path>` | `-o` | `drift-report.html` | 指定生成的 HTML 报告路径 |
| `--lang <lang>` | - | `zh` | 报告语言（`zh` 为中文，`en` 为英文） |
| `--config <path>` | `-c` | `sextant.json` | 指定规范文件路径 |
| `--baseline <path>` | `-b` | `.sextant/baseline.json` | 指定基准线文件路径 |

---

## 七、项目自测与开发管理

本项目自身全面遵循分层规范管理，并内置了统一的管理脚本 `./start.sh`：

```bash
# 启动本地可视化审查工作台 (Workbench Web Server @ 3000)
./start.sh

# 运行单元测试套件 (Vitest)
./start.sh --test

# 启动交互式测试仪表盘
./start.sh --ui

# 运行项目自身的架构门禁自举检查
./start.sh --check

# 全量构建所有子包
./start.sh --build

# 查看测试覆盖率报告
./start.sh --coverage
```

---

## 八、开源协议

本项目基于 [MIT License](LICENSE) 开源。欢迎提交 Issue 与 Pull Request 共同改进！
