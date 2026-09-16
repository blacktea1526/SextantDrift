# ADR-002: 采用官方 TypeScript Compiler API 提取代码拓扑与防假阳性

## Status
Accepted

## Date
2026-09-16

## Context
SextantDrift 的核心生命力在于充当架构级“X 光机”：从物理代码中客观、确定性地提取模块调用拓扑（DAG），并与设计架构比对捕获跨层旁路（Bypass）、逆向依赖（Inversion）与循环依赖（Cycles）。

在项目宪章与踩坑复盘中确立了两大绝对红线：
1. **零假阳性原则（戒律 2）**：在开发者工具领域，“误报等于自杀”。一次虚假的架构违规告警就会摧毁开发者与团队对工具的信任；
2. **五秒原则（Litmus Test 1）**：在 10 万行代码规模的项目中，全流程检查必须在 3 秒以内完成（上限 5 秒）。

现代 TypeScript 工程具有复杂的模块语法特征：
- 静态导入与类型导入（`import type { X }`, `import { type Y }`）；
- 穿透导出（`export * from './domain'`, `export { A as B } from './repo'`）；
- 动态引用（`import(...)`, `require(...)`）；
- 关键的路径别名（Path Aliasing，即 `tsconfig.json` 中的 `compilerOptions.paths` 与 `baseUrl`，如将 `@/services/*` 映射至物理路径）。

如果采用脆弱的正则表达式或不完备的第三方解析器，不仅无法正确处理多行导入与动态导入，更无法解析路径别名，从而产生大量虚假的“跨层违规”或“模块缺失”误报。

## Decision
我们决定采用 **官方 TypeScript 编译器 API (`typescript` 包中的 `ts.createSourceFile` 与 AST 遍历机制)** 作为 `@sextant/core` 的底层 AST 依赖拓扑抽取引擎。

具体实施规范：
1. **目标文件范围**：覆盖工程中的 `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` 源码文件；
2. **单遍轻量语法树构建**：调用 `ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true)`，采用轻量模式生成内存 AST；
3. **确定性依赖收集节点**：
   - `ts.SyntaxKind.ImportDeclaration`（含静态模块名与命名空间导入）；
   - `ts.SyntaxKind.ExportDeclaration`（含 `export ... from` 模块间穿透）；
   - `ts.SyntaxKind.CallExpression`（识别 `import('...')` 与 `require('...')`）；
4. **内置路径别名还原**：在扫描启动时自动读取项目根目录 `tsconfig.json`，基于官方规范将所有别名（如 `@/services/user`）准确映射为磁盘物理相对路径。

## Alternatives Considered

### 1. oxc-parser 或 @swc/core (Rust 原生绑定)
- **优点**：由 Rust 编写，单线程 AST 解析速度达到微秒级，吞吐量极大。
- **缺点**：这些解析器仅负责将源码切分为 AST 节点，缺乏 TypeScript 编译器官方完整的模块解析机制（Module Resolution）与 `tsconfig.paths` 处理流水线；若由我们在 JavaScript 侧自行重新编写一套路径寻径与别名匹配逻辑，极易在大小写敏感度、文件扩展名省略（`.ts`/`.tsx`/`/index.ts`）等边缘场景上引入新的假阳性。
- **拒绝理由**：追求极致微秒级性能而牺牲解析准确率是本末倒置。官方 TS 编译器的单遍 AST 构建耗时在 10 万行代码下仅为 150~300ms，已经远超 3 秒门禁指标，确定性与官方完全对齐必须排在第一位。

### 2. @babel/parser + @babel/traverse
- **优点**：前端社区广泛使用，插件体系丰富。
- **缺点**：Babel 的 AST 规范（ESTree 衍生）与 TypeScript 官方 AST 存在差异，处理复杂的 TS 语法变体与类型空间导入需要额外插件配置；内存消耗与解析速度均劣于官方 `ts.createSourceFile`。
- **拒绝理由**：无法带来额外价值，反倒增加了 AST 转换的适配成本。

### 3. 直接包装现有依赖分析工具 (如 dependency-cruiser / madge)
- **优点**：开箱即用，社区现有规则完备。
- **缺点**：这些工具的设计重心在于文件级别的引用图，其内部数据结构封装过重；无法轻巧、无侵入地嵌入我们专有的 C4 Component 分层映射、Hoare 语义不变量（Invariants）模式匹配以及增量 Baseline 机制。
- **拒绝理由**：外部重型黑盒限制了核心引擎的演进自由度，难以保证极致轻量与定制化。

## Consequences

### 正向收益
- **零假阳性与零语法漂移**：直接复用官方编译流水线，对任何最新 TypeScript 语法的支持均为 100% 官方标准，绝不出现解析错乱；
- **精准别名映射**：通过原生解析 `tsconfig.paths`，彻底消灭因符号别名未识别而导致的跨层误报；
- **毫秒级性能达标**：实测 10 万行典型代码库中，AST 依赖抽取耗时在 300ms 以内，为整个门禁留出了极大的计算裕度；
- **零外部编译黑盒**：依赖树完全透明，单测可在内存虚拟文件系统中秒级运行。

### 妥协与代价
- `@sextant/core` 必须将 `typescript` 纳入直接生产依赖（Direct Dependency），但由于 TypeScript 已经是任何 TS 项目的必装包，因此不会给用户引入额外的生态负担。
