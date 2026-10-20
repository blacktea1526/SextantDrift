# Tasks

## 1. 收口已删除的重复文件和过期产物

- [x] 1.1 确认 Git 索引仍把根目录 `agents.md`、`roadmap.md`、`tech-stack.md` 标为删除，磁盘上对应的大写正本还在，并用 `git ls-files` 核对实施后不再跟踪这三个小写路径
- [x] 1.2 确认 `specs/agents.md`、`specs/mission.md`、`specs/roadmap.md`、`specs/tech-stack.md` 仍是指向 `../AGENTS.md`、`../MISSION.md`、`../ROADMAP.md`、`../TECH_STACK.md` 的符号链接，且 `readlink` 的目标文件存在
- [x] 1.3 确认 `evolution_history.jsonl`、`scripts/benchmark-runner.mjs`、`scripts/evolution-pipeline.mjs` 仍是索引删除，全库搜索无剩余引用，且不把这三个路径加回工作区

## 2. 共享忽略规则

- [x] 2.1 在 `.gitignore` 加入 `.omx/`、`.aws/`、`.codex/`、`.pnpm-store/`，并用 `git check-ignore -v` 确认四条都由 `.gitignore` 命中
- [x] 2.2 确认 `.agents/` 与 `.cursor/` 未被忽略：`git check-ignore` 对 `.agents/skills` 和 `.cursor/commands` 无输出

## 3. 中英仓库地图

- [x] 3.1 在 `README.md` 目录之后加入「仓库地图」，覆盖 `design.md` 决策 5 的每一行，并核对每一条路径在仓库里存在
- [x] 3.2 在 `README_EN.md` 对应位置加入同一张地图的英文版，行集与中文版一致，且两份 README 的其余章节不被改写

## 4. 实施后的范围核对

- [x] 4.1 对比实施前后的 `git status --short`，确认除 `.gitignore`、`README.md`、`README_EN.md` 和本变更已列出的删除项外，`packages/**` 及其他产品改动的状态不变

## Workflow follow-up

- 审查通过后再归档本变更。
- 归档时确认 `openspec/specs/` 仍为空，因为本变更设置了 `skip_specs: true`。
