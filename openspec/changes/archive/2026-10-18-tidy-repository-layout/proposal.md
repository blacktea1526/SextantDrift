# Proposal

## Why

仓库根目录同时堆着宪章、路线图、技术栈、中英 README、阶段规格和一份本地图纸工作台，Git 里还留着已从磁盘删掉的大小写重复文件。机器本地目录只写在个人 exclude 里，换一台机器又会冒出来。现在工作区还有一大批未提交的产品改动，和这些卫生问题混在同一棵树上，看不出哪份文档是正本、哪些文件不该进仓库。

## What Changes

- 收口已经开始的重复文件删除：根目录 `agents.md`、`roadmap.md`、`tech-stack.md`，以及不再被引用的 `evolution_history.jsonl`、`scripts/benchmark-runner.mjs`、`scripts/evolution-pipeline.mjs`。
- 保留 `specs/` 下指向根目录正本的符号链接（`agents.md`、`mission.md`、`roadmap.md`、`tech-stack.md`）。阶段规格仍通过这些链接引用正本。
- 在共享 `.gitignore` 中忽略机器本地目录：`.omx/`、`.aws/`、`.codex/`、`.pnpm-store/`。只改忽略规则，不删除这些目录里的内容。
- 在 README 增加一节短导航，标明每份根文档和 `docs/`、`specs/`、`openspec/` 各自负责什么。不合并、不重写现有宪章正文。
- 把 `.agents/skills/` 里未跟踪的技能包和 `.cursor/` 里的 OpenSpec 命令标成仓库内的 Agent 工具，不把它们当成垃圾删除，也不把 `.agents/`、`.cursor/` 整目录忽略。

不改产品行为，因此本变更设置 `skip_specs: true`，不新增能力规格。

## Capabilities

### New Capabilities

无。这是仓库卫生和文档导航，不改变 SextantDrift 的检测、报告或 CLI 行为。

### Modified Capabilities

无。`openspec/specs/` 目前为空。

## Impact

- 受影响路径：`.gitignore`、根目录 README 导航、已删除的重复/过期跟踪文件、`openspec/changes/tidy-repository-layout/`。
- 明确不动：`packages/**` 里未提交的产品代码与测试（acceptance、MCP、Go 分析、verify、web-report）、根目录 `index.html`（`./start.sh` 与 `scripts/dev-server.mjs` 把它当图纸工作台）、`AGENTS.md`、`ARCHITECTURE.md`、`MISSION.md`、`ROADMAP.md`、`TECH_STACK.md` 的正文、`docs/decisions/` 下的 ADR。
- 不改写 Git 历史，本变更的实施也不包含提交。

## Assumptions

- 「干净有条理」指一份正本、一条导航、共享忽略规则，不是把未提交的功能改动丢掉，也不是把包结构重切一遍。
- `specs/` 继续保存历史阶段规格；`openspec/` 只承接之后的新变更。这次不把两套规格迁到一起。
