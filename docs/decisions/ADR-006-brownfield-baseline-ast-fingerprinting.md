# ADR-006: 采用 AST 语义指纹算法实现存量项目 Baseline 债务管理

## Status
Accepted

## Date
2026-09-16

## Context
SextantDrift 的目标受众不仅包括从零开始的新项目（Greenfield），更包括拥有数万至数十万行存量代码的老工程（Brownfield）。

存量老项目往往已经遗留了若干历史跨层依赖或不规范调用（如 15 处 Controller 直连 Repo 的 bypass）。如果首次接入时强行要求一次性清空所有历史违规，会导致接入摩擦极大，团队根本无法采用。

因此，系统确立了 **“历史债务封存，新增偏航零容忍（No New Drift）”** 的核心接入哲学：
- 允许项目背负已知的历史债务前行；
- 在存量项目中一键运行 `npx sextant-drift baseline`，将当前所有已知违规快照固化到 `.sextant/baseline.json`；
- 日常开发与 PR 审查中，只要未引入**新增偏航**，门禁即可判定通过（Exit Code 0）。

**核心技术挑战**：如何精确、稳健地识别某处违规是否属于“历史债务”？
- 若按物理行号（如 `src/controllers/order.ts:47`）记录：任何开发者在第 47 行之前插入一个空行或添加一个 unrelated import，就会导致该违规下移到第 48 行，系统便会误判为“出现了 1 处新增违规并漏掉了 1 处旧违规”，导致 CI 发生虚假阻断；
- 若按代码片段或上下文哈希记录：Prettier / ESLint 自动格式化单行代码就会导致哈希失效。

## Decision
我们决定采用 **AST 语义指纹算法（AST Semantic Fingerprinting）** 识别历史债务，并将 `.sextant/baseline.json` **强制纳入 Git 版本纳管**。

具体实施规范：
1. **AST 语义指纹生成算法**：
   - 违规条目的指纹（Fingerprint）不依赖物理行号，而是由纯 AST 语法特征计算：
     $$\text{Fingerprint} = \text{SHA256}(\text{CallerComponent} + \text{CalleeComponent} + \text{ImportedSymbol} + \text{RuleId})$$
   - 例如：`OrderController` 组件导入 `OrderRepository` 的 `OrderRepo` 符号，无论其在文件中处于第 47 行还是第 89 行，只要 AST 结构特征未变，其语义指纹保持完全恒定。
2. **基线账本 Git 强纳管**：
   - `.sextant/baseline.json` **严禁**加入 `.gitignore`，必须作为代码仓库的一部分与架构规范一同提交；
   - 确保全团队所有开发者与 CI 门禁共享完全一致的架构债务账本。
3. **门禁差分比对流**：
   - 扫描当前物理代码得到当前违规集合 $V_{\text{current}}$；
   - 与基线指纹集合 $B_{\text{history}}$ 进行差分：
     $$V_{\text{new}} = \{ v \in V_{\text{current}} \mid \text{Fingerprint}(v) \notin B_{\text{history}} \}$$
   - 若 $|V_{\text{new}}| > 0$，打印新增偏航并返回 Exit Code 1；
   - 若历史债务被开发者顺手修复（$|V_{\text{current}}| < |B_{\text{history}}|$），在终端打印正向鼓励提示：`✓ 发现 2 处历史架构债务已被修复，请运行 baseline 更新账本`。

## Alternatives Considered

### 1. 物理文件与行号精准匹配 (File + Line Number)
- **优点**：实现极其简单。
- **缺点**：致命脆弱。文件顶部增删任意一行代码，即引发下游所有历史违规行号整体漂移，造成 CI 门禁大面积假阳性阻断。
- **拒绝理由**：直接摧毁“零误报”底线，给开发者带来无尽的维护噩梦。

### 2. 行内代码注解抑制 (如 `// sextant-ignore-bypass`)
- **优点**：跟随源码移动。
- **缺点**：侵入业务代码，将架构债务分散在全仓库成百上千个文件中；开发者极易顺手复制带有 ignore 注解的代码行，导致违规无声蔓延；无法在宏观架构层面统一审查历史债务总量。
- **拒绝理由**：违反“零侵入”哲学，无法作为架构师把控全局债务的账本。

### 3. 基于 Git Diff 分支比对（仅在 CI 检查变动行）
- **优点**：无需本地持久化基线文件。
- **缺点**：严重依赖 Git 历史树与 `merge-base` 查找，在本地开发或浅克隆（Shallow Clone）CI 环境中极不稳定；无法在本地离线秒级执行。
- **拒绝理由**：违反“Local-First”与环境纯粹原则。

## Consequences

### 正向收益
- **存量项目接入 30 秒原则**：老项目运行 `npx sextant-drift init && npx sextant-drift baseline` 即可立即享受架构守护，阻断后续腐化，无需停工重构；
- **重构与格式化免疫**：代码行号偏移、Prettier 换行调整不会破坏基线有效性，100% 消除基线假阳性；
- **透明的架构债务燃尽图**：基线文件是一个结构清晰的 JSON，架构师可以在周报或 PR 审查中直观追踪团队架构债务的消耗进度。

### 妥协与代价
- 同一个文件中若存在两个完全相同的违规符号导入（极端边缘情况），指纹会发生碰撞折叠。但由于实际代码中不会在同文件重复导入同一模块符号，因此在真实工程中无副作用。
