# ADR-008：设计意图验收的证据边界与兼容接入

## Status

Proposed — 验收集成的设计约束。R2 已锁定现有接口；R3 提供可选映射、内容版本绑定及纯函数证据判定；R4 接入独立 `verify` 命令和项目本地测试执行器。离线验收报告视图仍属后续阶段。本记录不表示订单候选要求已获人工确认，也不取代既有 ADR。

## Date

2026-10-07

## Context

R1 的订单样例包含一个正确实现、两个等价重构和八个故意错误实现。现有 AST 架构检查全部通过；固定行为测试能够拒绝八个错误实现。因此结构合规和行为满足要求必须分别记录，不能从前者推导后者。

另一个受控实验只选择该样例的架构测试：11 个架构测试通过、11 个行为测试跳过，Vitest 退出 0。这是普通测试运行器的正常过滤行为；它没有声明或检查本次设计验收的必需检查项是否齐全。完整性判断需要要求、检查项与本次证据之间的显式映射。

当前 `analyzeModuleDrift` 已委托 `executeModuleDriftPipeline`，调用方能得到 `DriftReport`。新验收路径可以组合该结果，暂无理由继续拆分生产流水线。现有 `check`、baseline 和实验性 Trace 行为必须保持兼容。

## Decision

### 1. 结构证据和行为证据分别判定

- AST 可证明模块导入、语法节点及匹配范围内的语句位置；不能证明一个 Promise 已成功完成或数据库事务已提交。
- ADR-004 的同函数/块级语句规则保留原有语法含义。语句文本先出现、调用先开始与操作成功完成是不同事实；后续能力不得用该规则推导异步完成顺序。
- 测试侧可通过公开端口真实调用、受控 Promise、返回值和最终存储状态观察样例行为。端口契约完成不等于真实数据库提交；后者需要集成证据。
- 运行异常、超时和观察预算耗尽不能充当业务反例；手写通过说明、手工事件及来源不明的旧 Trace 不能作为新验收的通过证据。

### 2. 保留旧入口，独立引入验收结果

- 现有 `analyzeModuleDrift`、`executeModuleDriftPipeline`、`DriftReport`、`check` 与 baseline 不改变公共语义；旧项目无需新增配置。
- R2 不提取未被新路径使用的函数。后续如需接缝，先证明实际调用需求并增加兼容回归，再做最小提取。
- 后续拟议 `VerificationReport` 组合结构结果与验收结果。`UNVERIFIED`、`ERROR` 或测试断言位置不伪装成必须带源码位置的 `ViolationEvidence`。
- 结构 baseline 仅豁免已知结构债务；不能使业务验收失败或证据缺失变为通过。

### 3. 判定与执行分开

- `core/acceptance` 如实施，只承担框架无关的映射校验、证据有效性与版本匹配、四状态纯函数聚合。生产 core 不依赖 Vitest、CLI 库或 DOM。
- 测试启动、受控项目环境、超时、worker 隔离与逐场景落盘属于 CLI/测试适配层。首期放在 CLI 包内，尚不成立独立包的需求。
- 旧 Trace reporter 的全局 recorder 仅是进程内状态，不承担跨 worker 传输。旧导出保持兼容；新路径必须有自己的 run/scenario/check 标识及汇聚协议。
- 不从跨进程时间戳直接推导因果，不把 span 的 `ok` 状态泛化成业务持久化成功。

### 4. 配置单源与确认边界

- 遵守 ADR-003：`sextant.json` 继续是机器配置单源。后续验收映射引用 Markdown 中的要求文本，不从文档执行 shell 指令，也不新建平行规则文件或通用行为 DSL。
- 设计、验收资产、配置和源码必须绑定内容版本；未提交变更不能仅以 Git commit 识别。内容散列用于识别陈旧证据，不冒充防篡改证明。
- AI 生成的要求和断言只能是候选资产。候选评估可以运行，但不能生成虚假的人工确认记录。

### 5. 结果呈现和迁移

- 遵守 ADR-007，保留离线双图、原生 SVG 和安全转义；R2 不切换当前报告主视图或修改产品宪章。
- 后续验收视图必须区分 PASS、FAIL、UNVERIFIED、ERROR，并显示范围和证据位置。当前 `check` 退出 0 仅表达该入口的检查结果，不声明完整业务验收。
- 后续 `verify` 使用独立入口；有必需行为检查未执行时不得通过。主线定位或报告主视图变更需要另行记录并审阅，不能借兼容测试默认完成。

## Alternatives Considered

- **给原流水线加入 Vitest 执行逻辑**：混淆执行、观察和判定，破坏 core 的宿主边界；不采用。
- **复用旧 Trace singleton 或手写 span 证明所有行为**：缺少 worker 隔离、版本绑定及业务完成契约；不采用。
- **将所有状态塞进结构违规类型**：会制造假的源码位置，并混淆业务偏差和执行异常；不采用。
- **整体拆分当前流水线或建立插件框架**：现有公共入口已能被组合，缺少实际复用需求；首期不采用。
- **直接修改旧 check 的退出码和 baseline 语义**：影响已有使用者；使用独立验收入口渐进接入。

## Consequences

R2 可以先交付兼容回归和边界记录，不必修改生产引擎。后续实现受最小配置与纯函数判定约束，旧消费者保持可用。

过滤实验只证明“正常测试退出不检查业务验收完整性”的工具差异，没有证明真实团队的时间收益。R3 原型仍需成本控制；Beta 继续受 roadmap R6 的真实任务对照门槛约束。

## Evidence

- [R0/R1 实施记录](../../.scratch/design-intent-verification/implementation-r0-r1.md)
- [R1 检测矩阵](../../.scratch/design-intent-verification/detection-matrix.md)
- [R2 接入评估](../../.scratch/design-intent-verification/r2-entry-assessment.md)
- [旧分析入口](../../packages/core/src/index.ts)
- [现有分析流水线](../../packages/core/src/pipeline/module-drift-pipeline.ts)
- [现有 Trace reporter](../../packages/core/src/trace/vitest-reporter.ts)

本地评估记录暂存于仓库约定的 `.scratch/`；它可能被 Git 忽略，分享决策时应同时保留对应运行证据。
