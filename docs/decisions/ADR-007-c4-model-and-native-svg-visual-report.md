# ADR-007: 采用 C4 多层级模型与零 CDN 原生 SVG 画布引擎实现架构可视化差分

## Status
Accepted

## Date
2026-09-20

## Context
随着 SextantDrift 演进至企业级大型系统（如数万至十万行代码、数十个微服务与模块组件），原有的平面化单一流程图（Flat Flowchart）面临严重的认知与工程瓶颈：

1. **认知过载与连线杂乱（Visual Spaghetti）**：
   在超过 20 个组件的工程中，所有组件与依赖线平铺在一张画布上，连线交错密集，管理者无法快速获得宏观分层全局观（Macro View），一线开发者难以定位单一微观组件边界。
2. **外部 CDN 与离线审查冲突（Zero-Network Invariant Violation）**：
   原有设计中，HTML 报告依赖远程 CDN 加载 `mermaid.min.js`。在企业内网、隔离编译机（Air-gapped Environments）、CI 离线构建沙盒中，外部网络被严格阻断，导致报告打开为空白或报错。
3. **渲染抖动与交互深度受限**：
   三方 Mermaid.js 属于黑盒渲染，存在异步重排与高度跳变（Layout Jitter）；且无法原生实现高级交互操作，如：平移缩放（Pan-Zoom）、Level 2 容器与 Level 3 组件平滑钻取、底层契约线（Contracts）按需折叠、以及行级违规高亮与组件聚焦探针。
4. **XSS 与代码片段注入风险**：
   当源码中包含特制字符（如 `</script>` 或特殊 HTML 实体）时，直接拼接注入 HTML 模板存在潜在安全漏洞。

## Decision
我们决定在 `@sextant/core` 引入 **C4 多层级架构图模型**，并在 `@sextant/web-report` 彻底弃用外部 Mermaid 运行时，自研 **100% 零依赖原生 SVG 矢量泳道画布引擎（Native SVG Canvas Engine）**。

具体实施规范：

### 1. C4 多层级模型拓扑抽象 (`@sextant/core`)
- **Level 1: System Context（系统上下文）**：描述系统边界、核心使用角色（人类架构师、AI Coding Agent、CI Pipeline）与外部系统（Git、浏览端）；
- **Level 2: Container Tiers（容器与分层拓扑）**：将组件按系统物理边界归入 Containers（如 CLI 接入层、Visual Reporting 报告层、Core Engine 核心引擎层、Infrastructure 底层设施、Contracts 基础契约）；
  - **状态聚合铁律**：容器内任何一个组件发生偏航，该容器在 Level 2 状态矩阵中自动标记为 `DRIFT` 并标红；
  - **依赖跨层推导**：由组件间物理导入边自动推导容器间数据流向。
- **Level 3: Component Diagram（组件拓扑与按域钻取）**：展现各容器内部物理组件的精确依赖网络与跨层旁路。

### 2. 100% 零 CDN 原生矢量 SVG 渲染 (`@sextant/web-report`)
- 报告模板体积严格受控，**0 外部网络请求，0 CDN 依赖**，彻底实现断网秒级渲染；
- 内置矩阵变换的 Pan & Zoom 交互引擎，支持滚轮无级平移缩放与双击复位；
- 具备 Level 2 容器概览视图与 Level 3 组件明细视图的一键无缝切换；
- 提供「过滤底层契约连线（Filter Contracts）」开关，一键隐藏横切公共依赖边，消除 80% 视觉杂讯；
- 提供「组件聚焦探针（Component Isolation）」，单选组件时高亮其所有上下游直接关联流向，其余节点淡化；
- 内置中英双语国际化支持（默认中文 `zh-CN`，一键切换 `en`）。

### 3. 企业级 XSS 安全加固
- 全局使用 `escapeHtml` 对代码片段、文件路径、规则描述等动态数据进行 HTML 实体转义；
- 状态注水使用 `safeJsonStringify`，转义 `\u003c/script\u003e`，杜绝任何模板逃逸可能。

## Alternatives Considered

### 1. 继续使用 Mermaid.js 并将 1.5MB 的 min.js 内联打包进 HTML
- **优点**：无需编写自研 SVG 渲染算法。
- **缺点**：单报告 HTML 文件体积暴增 1.5MB 以上；黑盒 DOM 无法实现深度的自定义交互探针与平移缩放；Mermaid 的自动布局引擎对环形和逆向边极为敏感，经常生成极难阅读的长折线。
- **拒绝理由**：违反 CLI 极致性能与轻量原则，无法满足高交互要求。

### 2. 引入 D3.js / Cytoscape.js 等重型前端图库
- **优点**：支持力导向图与复杂的图论布局。
- **缺点**：引入数十万行第三方客户端运行时；破坏 Core-First 与轻量自包含契约；依赖客户端 JavaScript 解析与重绘，低端机器打开大图卡顿。
- **拒绝理由**：过度工程，增加了维护负担与安全审计面。

### 3. 维持单一平铺 Flowchart
- **优点**：模型最简单。
- **缺点**：面对 50+ 组件的大型企业仓库时沦为“毛线团”，彻底丧失架构审查实用性。
- **拒绝理由**：无法满足企业级架构治理诉求。

## Consequences

### 正向收益 (Positive Impacts)
1. **极致离线安全与可靠性**：完全不发起任何网络请求，真正做到零安装、零 CDN、双击即开，满足军工/金融/企业内网最严苛的安全审计要求；
2. **多层级宏微并济**：架构师看 Level 2 容器层级定全局，一线开发者看 Level 3 组件定位具体代码行；
3. **极高信噪比交互**：一键过滤契约线与一键聚焦组件，审查效率提升 3 倍以上；
4. **双图与同图差分统一**：支持「规划与现实同图差分」以及「Target vs Actual 左右分屏」，红绿对比直观确凿。

### 妥协与代价 (Trade-offs & Constraints)
- 原生 SVG 布局需自行维护容器泳道与网格排布算法，新增图元类型时需同步更新渲染器。
