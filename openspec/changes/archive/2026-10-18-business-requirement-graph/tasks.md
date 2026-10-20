# Tasks

## 1. 可选图的解析与规范形式

- [x] 1.1 在 `schemas/sextant.schema.json` 和架构类型上增加可选 `businessRequirements`，并用现有 schema 契约测试确认旧配置仍通过、缺省时解析结果没有该字段
- [x] 1.2 实现实体与关系的规范化：按 `design.md` 的简写表展开关系，折叠同对同类型的重复边，并用兑换会员样例断言 BR-001 到 RULE-003 恰有一条 `constrains` 关系
- [x] 1.3 拒绝非法图：前缀与种类不符、悬空 id、同一对实体两种关系类型、简写里的裸名字，测试断言错误信息带上该 id，且不产生验收 FAIL

## 2. 人读投影与 AI 投影

- [x] 2.1 从规范形式生成稳定 JSON 和 `flowchart TD`，测试断言两种投影都含 BR-001、FLOW-001、RULE-003、EVENT-002、STATE-001、TC-003、CODE-004，且调换输入键序后两份输出逐字节相同
- [x] 2.2 把实体上的未关闭问题写入两种投影，测试断言 RULE-003 的问题文本在 JSON 和 Mermaid 里都出现

## 3. 直接邻居待检查清单

- [x] 3.1 实现只读查询：RULE-003 通过 `affects`、`implemented_by`、`verified_by` 连到 STATE-001、CODE-004、TC-003 时，结果恰好这三项且每项标为复核范围；BR-001 另含 FLOW-001 时结果不含 FLOW-001
- [x] 3.2 CODE-004 不写 `source` 时，结果仍列出它并标明锚点缺失，且不出现未声明的文件路径
- [x] 3.3 同一配置已有 `acceptance` 时，TC-003 指向未知 check id 使图加载失败；指向已知 check id 时清单不给出 PASS 或 FAIL。两种情况都用测试锁定

## 4. 门禁保持独立

- [x] 4.1 给一份已有架构夹具加上合法需求图后跑模块漂移分析，断言违规列表和 `passed` 与不加图时相同；查询函数不被该分析调用

## 5. 只读命令与报告

- [x] 5.1 增加只读 CLI 子命令，对兑换样例打印三条待检查 id 和复核范围文案；命令测试确认输出不声称已分析代码，且 `check` 的退出码测试仍按原断言通过
- [x] 5.2 报告载荷带上投影时渲染该节并含上述七个 id；载荷没有图时不渲染该节。用 web-report 测试锁定，且不改现有违规高亮断言

## Workflow follow-up

- 审查通过后再归档本变更。
- 归档时把 `business-requirement-graph` 的 delta 同步进 `openspec/specs/`。
