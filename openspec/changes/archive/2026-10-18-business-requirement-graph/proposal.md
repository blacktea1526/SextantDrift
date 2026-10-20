# Proposal

## Why

业务需求今天散在 PRD、流程图和 `acceptance.requirements` 的测试锚点里，人和 AI 各读一份，改一条规则时看不出还要复核哪些流程、状态、实现和验收。架构门禁能证明导入关系，不能代替这张需求关系图。

## What Changes

- 在 `sextant.json` 增加可选的业务需求图。需求、流程、规则、事件、状态、测试和代码锚点是同一份实体，关系是显式边。人读的图和 AI 读的结构都从这份数据投影出来。
- 提供按实体查询的变更待检查清单。清单只包含已经声明的直接关联，并标明这是复核范围，不是代码影响证明。
- 没有建立关联的代码或测试记为缺口，不靠名称、静态扫描或测试覆盖去补。
- 缺省不写这块配置时，现有 `check`、baseline、`verify` 和验收判定保持原语义。

不在本次交付需求级 Git diff，也不做可回写的图形编辑器。模型使用稳定 ID 和确定的字段顺序，留给后续 diff。

## Capabilities

### New Capabilities

- `business-requirement-graph`: 一份可校验的业务需求图，同时投影成人读的图和 AI 读的结构，并按已声明关系给出待检查清单。

### Modified Capabilities

无。`openspec/specs/` 目前为空。现有验收映射继续只判定测试证据，不并入这张图的关系查询。

## Impact

- `@sextant/core`：解析、校验、Mermaid 投影、关系查询。不执行测试，不扫描源码来发明关联。
- `schemas/sextant.schema.json`：可选块。旧配置不加字段仍然有效。
- `@sextant/cli` 与 `@sextant/web-report`：只读展示投影和待检查清单。`check` 的退出码不因这块配置而改变。
- 不改 `acceptance` 的 PASS / FAIL / UNVERIFIED / ERROR 规则。测试实体可以指向已有 check id，指向未知 id 时是配置错误，不是验收失败。

## Assumptions

- 请求里的 YAML 是语义示例。可写的正本仍是 `sextant.json` 里的 JSON，图不是第二份存储。
- 「修改图中的规则就是修改规则实体」由单源保证：图只是投影。本次不实现在图上直接编辑。
- 待检查范围是被改实体的直接邻居。不沿多跳关系扩大范围。
- 「可以进一步发展为需求级 Git diff」留到后续变更。本次只保证同一份模型可以被稳定比较。
