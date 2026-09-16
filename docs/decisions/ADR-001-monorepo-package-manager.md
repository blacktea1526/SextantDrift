# ADR-001: 采用 pnpm Workspaces 管理 Monorepo 与防幽灵依赖

## Status
Accepted

## Date
2026-09-16

## Context
SextantDrift 2.0 重构项目采用了分包架构（Monorepo），包含三大核心子包：
- `@sextant/core`：纯无头核心分析引擎（零 DOM、零 CLI、零浏览器宿主、100% 规则测试）；
- `@sextant/cli`：命令行与 CI 门禁工具（`npx sextant-drift check`）；
- `@sextant/web-report`：自包含单文件静态 HTML 审查报告模板。

在项目宪章 [`AGENTS.md`](../../AGENTS.md) 的“戒律 6（严守工程分层边界）”中明确规定：**核心包与表现层必须物理隔离，`@sextant/core` 严禁引用任何 CLI 库（如 `cac`, `commander`, `chalk`）或 UI 库**。

传统包管理器（如 npm / Yarn v1）使用扁平化依赖提升（Flat Hoisting）机制将依赖包打平提升到根目录 `node_modules`。这会导致致命的**幽灵依赖（Phantom Dependencies）**问题：子包代码即使未在自身的 `package.json` 中声明某依赖，依然可以直接 `import` 根目录提升上来的三方库。若核心包在无意识中引用了 CLI 库，只有在外部独立项目安装时才会发生模块缺失崩溃，严重破坏工程分层不变量。

此外，门禁工具需要极致的冷启动与秒级 CI 流程，对依赖安装与构建缓存有极高的性能要求。

## Decision
我们决定采用 **`pnpm Workspaces` (pnpm >= 9.0.0)** 作为 SextantDrift 的官方包管理器与工作区基础设施。

具体实施规范：
1. 项目根目录设置 `pnpm-workspace.yaml`，统一纳管 `packages/*` 目录；
2. 利用 pnpm 基于符号链接（Symlinks）的隔离式 `node_modules` 结构，各子包只能访问其 `package.json` 显式声明的直接依赖；
3. 子包之间的内部调用统一采用 `workspace:*` 协议（例如 `packages/cli` 显式声明 `"@sextant/core": "workspace:*"`）。

## Alternatives Considered

### 1. npm Workspaces (Node.js 原生自带)
- **优点**：无需单独安装包管理工具，随 Node.js 原生预装，开箱即用门槛最低。
- **缺点**：采用扁平化提升结构，无法从物理层面阻止幽灵依赖穿透；CI 安装耗时较长，缺少高效的硬链接复用机制。
- **拒绝理由**：无法从物理文件系统层面保证 `@sextant/core` 与 `@sextant/cli` 的绝对依赖隔离，极易被 AI Agent 破坏戒律 6。

### 2. Bun Workspaces
- **优点**：原生集成 TypeScript 与打包器，执行与安装速度极快。
- **缺点**：强行要求所有开发人员与 CI 门禁环境（Linux / macOS / Windows）必须预装 Bun 运行时；在处理 Node.js 原生路径解析与部分复杂 TS Compiler API 边界时存在生态差异。
- **拒绝理由**：本项目以标准 Node.js LTS 作为通用交付与 CI 基线，过早绑定特定运行时会增加外部项目的接入阻力。

### 3. Turborepo / Lerna 等重型 Monorepo 编排框架
- **优点**：提供强大的任务调度、增量哈希计算与远程缓存能力。
- **缺点**：配置繁重，引入额外的外部抽象层；SextantDrift 仅包含 3 个高内聚轻量子包，全量构建耗时在 1 秒以内，任务编排收益微弱。
- **拒绝理由**：过度工程，违背项目“极简、Core-First、拒绝过度设计”的初心。

## Consequences

### 正向收益
- **硬隔离防护**：在编译器与文件系统层面杜绝幽灵依赖，确保核心引擎 `@sextant/core` 永远保持无头纯粹性；
- **存储与 CI 加速**：依托内容寻址存储（Content-Addressable Store）与硬链接，本地磁盘占用减少 60% 以上，CI 依赖缓存恢复缩短至秒级；
- **确定性版本绑定**：`pnpm-lock.yaml` 严格锁定所有传递依赖版本，消灭“在我机器上能跑”的环境差异。

### 妥协与代价
- 开发者或 CI 环境需配置 pnpm（可通过 `corepack enable pnpm` 或 `npm i -g pnpm` 快速就绪）；
- 不允许任何隐式依赖写法，未在 `package.json` 中声明的依赖导入会立即被构建工具拦截报错（此为预期内的良性约束）。
