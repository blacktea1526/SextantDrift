# Design

## Context

见 `proposal.md` 的 Why，行为以 `specs/business-requirement-graph/spec.md` 为准。

现状里和这张图相邻的只有三块，而且互不替代：

- `sextant.json` 是唯一可写规范（ADR-003）。Mermaid 已有从架构数据生成的投影，存在 `packages/core/src/parser/mermaid-generator.ts`，那是组件依赖图，不是业务需求图。
- `acceptance` 把需求 id 映射到测试 check，并给出 PASS / FAIL / UNVERIFIED / ERROR。它不保存流程、规则、事件、状态和代码锚点之间的关系。
- HTML 报告默认是 Understand（ADR-009）：主图加关联面板，业务侧面目前只挂验收锚点。报告只读，不建成设计 IDE。

## Goals / Non-Goals

**Goals:**

- 可选图放在同一份 `sextant.json` 里，解析后得到实体加关系的规范形式。
- 人读投影是从规范形式生成的 Mermaid；AI 读的是同一规范形式的稳定 JSON。
- 待检查清单只走直接边，并带上锚点是否声明。

**Non-Goals:**

- 不把清单并进 `DriftReport.passed` 或验收状态。
- 不根据路径、标识符或测试覆盖去发现未声明的代码关联。
- 不实现图上编辑，也不实现两份模型之间的 Git diff。

## Decisions

### 1. 可选块 `businessRequirements`，没有则整条路径不存在

字段挂在现有架构对象上。缺省时解析结果不带这块，`check`、baseline、`verify` 的判定函数不读取它。

备选：单独的 `requirements.json`。否决。那会变成第二份可写规范，和 ADR-003 冲突。

### 2. 规范形式只有实体和关系

作者可以在需求实体上写简写列表，解析时展开成关系，规范形式里不再保留简写：

| 简写字段 | 关系类型 | 方向 |
| --- | --- | --- |
| `flows` | `includes` | 需求 → 流程 |
| `trigger` | `triggers` | 需求 → 事件 |
| `preconditions` | `constrains` | 前提实体 → 需求 |
| `rules` | `constrains` | 规则 → 需求 |
| `effects` | `produces` | 需求 → 效果实体 |
| `acceptance` | `verified_by` | 需求 → 测试 |

简写里的值必须是实体 id。`redeem_code_submitted` 这种裸名字不是 id，校验失败。

规则到状态、代码、测试的边不从需求简写推断。它们写成显式关系，类型只允许 `affects`、`implemented_by`、`verified_by`。同一对实体出现两种类型则失败。同一对、同一类型重复出现时折叠成一条。

备选：让简写和显式关系两套并存。否决。投影会随写法变化，破坏确定性。

### 3. 标识前缀和种类绑定

| 种类 | 前缀 |
| --- | --- |
| requirement | `BR-` |
| flow | `FLOW-` |
| rule | `RULE-` |
| event | `EVENT-` |
| state | `STATE-` |
| test | `TC-` |
| code | `CODE-` |

代码实体的源码位置是可选的已声明路径，解析时不检查文件是否存在。测试实体的 `checkId` 只在同一份配置已经有 `acceptance` 时核对；未知 id 是配置错误。没有 `acceptance` 时，写了 `checkId` 就算锚点已声明。

### 4. 两种投影都从规范形式生成

AI 投影把实体按 id 的 UTF-8 字节序排列，关系按 `from`、`to`、`type` 排列，对象键排序后序列化。人读投影是 `flowchart TD`：一个实体一个节点，标签是 id 和标题，边标签是关系类型，未关闭的问题文本写在节点标签里。不复用组件依赖的 Mermaid 生成器。

### 5. 待检查查询不进入门禁结论

查询函数接收规范图和实体 id，收集 `from` 或 `to` 等于该 id 的边。每条结果固定为复核范围。代码实体没有 `source`，或测试实体没有 `checkId` 时，锚点记为缺失。函数不读文件系统，不调用验收求值。

`check` 即使解析到这张图，也不把查询结果写入 `passed` 或退出码。CLI 增加只读子命令打印清单，文案标明待检查，不写「已分析代码」。报告在已有 JSON 上多带投影和实体列表；没有图时不渲染这一节。报告不提供写回。

备选：把待检查项变成新的 `DriftViolation`。否决。那会把未证明的关联显示成带源码位置的架构违规。

## Risks / Trade-offs

- [直接邻居漏掉间接影响] → 规格要求不沿多跳扩大。后续 diff 再决定要不要单独的传递查询。
- [声明了错误路径也不会被发现] → 本次不核对路径是否存在，避免把「文件不在」说成「关联不存在」。
- [非法图让整份 `sextant.json` 解析失败] → 失败是配置错误，不是验收 FAIL。旧文件不加该字段则不受影响。
- [报告多一节后首屏变长] → 只在图存在时渲染，不改 Understand 主图的默认 C4 视图。

## Migration Plan

1. Schema 和 core 先接受缺省。现有夹具不加字段，回归保持通过。
2. 用兑换会员样例覆盖解析、投影和 `RULE-003` 的三邻居查询。
3. CLI 和报告只消费 core 的结果。
4. 回滚时去掉可选字段和只读展示。不迁移已有 `acceptance.requirements`。

## Open Questions

无。关系类型和「只走直接边」已经定死，任务按此实现。
