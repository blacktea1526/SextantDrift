# ADR-003: 采用结构化 JSON (sextant.json) 与 JSON Schema 作为架构事实单源

## Status
Accepted

## Date
2026-09-16

## Context
在 SextantDrift 早期设计中，架构意图契约曾被设想为散装的 Markdown 文档（`ARCHITECTURE.md`），内部混合了人类自然语言、Mermaid 流程图代码块以及 YAML 不变量声明。

然而在实际工程检验与真实 AI 协同场景中，混合式 Markdown 暴露出了严重的可靠性缺陷：
1. **AI Agent 生成格式极易破损**：Agent 在修改或回写 Markdown 时，极易产生缩进错误、反引号缺失或代码块标签混乱，导致解析器崩溃（Exit Code 2）；
2. **多阶段脆弱正则解析**：从非结构化 Markdown 中提取规范，必须先正则匹配代码块，再解析 Mermaid 语法（提取箭头 `-->`），最后再解析 YAML。多重字符串解析链条脆弱、性能低下且极易产生歧义；
3. **缺少机器强校验机制**：散装 Markdown 无法在 IDE（VSCode / Cursor）中提供字段级的智能补全、类型提示与实时 Schema 错误拦截。

用户在深入审阅中明确指出：**“不需要架构.md，所有信息按照 JSON 等更合适的文件格式存储与处理”**。
架构的分层边界（Layers）、组件物理路径（Paths）、允许调用流（AllowDependencies）与语义规则（Invariants）本质上是严密的结构化数据，应与表现层的人类视觉图谱彻底解耦。

## Decision
我们决定采用 **结构化 JSON 文件 (`sextant.json`，或 `.sextant/architecture.json`)** 作为系统全局唯一的架构事实单源（Single Source of Truth），并配套发布标准 **JSON Schema**。

具体实施规范：
1. **单源事实存储**：项目根目录下默认存放 `sextant.json`，声明系统分层、组件映射与语义不变量；
2. **官方 JSON Schema 约束**：规范文件头部声明 `"$schema": "https://sextant-drift.dev/schema/v2.json"`，实现 IDE 内原生字段级智能补全与语法校验；
3. **微秒级解析契约**：核心引擎 `@sextant/core` 直接使用 V8 引擎原生的 `JSON.parse` 加载规范，执行时间 < 1ms，零外部复杂词法解析依赖；
4. **图与数据的投影解耦 (Data-to-Diagram Projection)**：Mermaid 图不再作为存储介质，而是作为数据的一种可视化投影（View）。核心引擎提供纯函数接口，能将 `sextant.json` 毫秒级动态编译为标准 Mermaid `flowchart` 供终端展示或 HTML 报告渲染。

## Alternatives Considered

### 1. 散装 Markdown 文件 (ARCHITECTURE.md 内嵌 Mermaid + YAML)
- **优点**：在 GitHub 网页上直接可读，人类阅读友好。
- **缺点**：机器与 AI Agent 读写可靠性差，多阶段文本切分容易因细微格式变动引发假性解析失败，缺乏形式化模式校验。
- **拒绝理由**：偏离“确定性与零幻觉”底线。对于机器门禁而言，严谨可靠的数据结构远胜易碎的人类散文。

### 2. 单一 YAML 规范文件 (sextant.yaml)
- **优点**：支持注释，比 JSON 更具人类可读性。
- **缺点**：解析需要引入外部 `yaml` 解析库（增加包体积）；解析速度比 V8 内置原生 `JSON.parse` 慢 10~30 倍；在不同编辑器的 Schema 提示兼容性上略逊于原生 JSON。
- **拒绝理由**：JSON 是 Web/Node 生态中最通用、执行最快、零依赖的标准数据交换媒介。

### 3. 碎片化配置文件级联 (.sextantrc.yaml + 目录层级映射表)
- **优点**：拆分细致，不同微服务可局部覆盖。
- **缺点**：配置散落在多个文件，形成配置蔓延（Config Sprawl），破坏全项目架构单源事实的集中可视性。
- **拒绝理由**：增加认知摩擦，违反“零侵入、极简约定”原则。

## Consequences

### 正向收益
- **AI Agent 读写零歧义**：Agent 操作 JSON 的准确率达到 100%，杜绝 Markdown 语法破损引发的无效门禁熔断；
- **极致冷启动与解析性能**：`JSON.parse` 瞬时完成，为 CLI 门禁的“5 秒原则”提供坚实基础；
- **现代 IDE 开发体验**：依托 `$schema`，开发者在 VSCode/Cursor 中编辑 `sextant.json` 即可享受字段自动提示、必填项校验与内联文档说明；
- **表现层灵活性**：数据与表现完全解耦，未来无论是生成 Mermaid 文本、SVG 矢量图还是 Web 交互画布，均可直接基于标准化 JSON 驱动。

### 妥协与代价
- JSON 原生不支持单行注释（`//`），但可通过字段内的 `"desc"` / `"description"` 属性承载人类架构师的意图说明。
