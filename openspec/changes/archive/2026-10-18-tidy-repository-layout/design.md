# Design

## Context

见 `proposal.md` 的 Why。实施前仓库的实际状态：

- 根目录正本仍在：`AGENTS.md`、`ARCHITECTURE.md`、`MISSION.md`、`README.md`、`README_EN.md`、`ROADMAP.md`、`TECH_STACK.md`。
- Git 仍跟踪、工作区已删除的重复或过期文件：`agents.md`、`roadmap.md`、`tech-stack.md`、`evolution_history.jsonl`、`scripts/benchmark-runner.mjs`、`scripts/evolution-pipeline.mjs`。全库已无对这些脚本和 `evolution_history` 的引用。
- `specs/agents.md`、`specs/mission.md`、`specs/roadmap.md`、`specs/tech-stack.md` 是指向根目录正本的符号链接。阶段规格用相对链接引用它们。
- `index.html` 由 `scripts/dev-server.mjs` 在请求 `/` 时直接提供，`./start.sh` 无参数时启动这台工作台。
- `.worktrees/`、`.scratch/`、`.local/` 已在 `.gitignore`。`.omx/` 只在本机 `.git/info/exclude`。`.aws/`、`.codex/`、`.pnpm-store/` 是空目录，且未忽略。
- `.agents/skills/` 里除已跟踪的 `sextant-drift` 外，还有未跟踪的 `ask-matt`、`code-review`、`implement-spec`、`setup-matt-pocock-skills`、`tdd`、`to-spec`、`to-tickets`、`writing-for-agents`。`.cursor/` 含 `mcp.json` 以及本次初始化的 OpenSpec 命令和技能。
- 工作区另有约一百条产品改动（acceptance、MCP、Go 分析、verify、报告测试等），与卫生问题混在同一棵树上。

## Goals / Non-Goals

**Goals:**

- 每个宪章主题只留一份 Git 正本，阶段规格继续通过现有符号链接读到它。
- 机器本地目录的忽略规则进共享 `.gitignore`，不依赖个人 exclude。
- 中英 README 各有一节同等的文档地图，读者不用打开六份长文才知道该看哪份。

**Non-Goals:**

- 不重写宪章正文，不把 `MISSION.md`、`ROADMAP.md`、`TECH_STACK.md` 折进 README。
- 不把 `specs/` 迁进 `openspec/`，也不把 `openspec/` 写回阶段规格。
- 不移动 `index.html`，不改 `packages/**`，不还原或提交未完成的产品改动。
- 不删除 `.omx/`、`.aws/`、`.codex/`、`.pnpm-store/`、`.worktrees/` 的本地内容。

## Decisions

### 1. 正本用大写文件名，删掉根目录小写副本

根目录保留 `AGENTS.md`、`ROADMAP.md`、`TECH_STACK.md`。Git 里同名小写文件是 Linux 上会撞车的第二份跟踪项，工作区已经把它们删掉。实施时只确认删除仍在索引里，并确认没有新引用指向根目录小写路径。

备选：把正本改成小写。否决。现有链接、`AGENTS.md` 戒律和阶段规格都指向大写文件名。

### 2. 保留 `specs/` 符号链接

`specs/roadmap.md` 这类路径出现在阶段规格的基准契约里。它们已经指向大写正本，不是第二份正文。删链接会把那些相对链接打断。

备选：把阶段规格里的链接改成 `../../ROADMAP.md` 再删符号链接。否决。那是大范围文档改写，超出这次卫生范围。

### 3. 过期演化产物保持删除

`evolution_history.jsonl`、`scripts/benchmark-runner.mjs`、`scripts/evolution-pipeline.mjs` 已从磁盘消失，且没有剩余引用。实施时核对这三处仍是索引删除，不把文件加回来。

备选：把演化流水线迁到 `scripts/` 下的新名字。没有调用方，不迁。

### 4. 共享忽略只覆盖机器本地目录

在 `.gitignore` 增加：

- `.omx/`
- `.aws/`
- `.codex/`
- `.pnpm-store/`

不忽略 `.agents/` 和 `.cursor/`。前者放本仓库的 Agent 技能，后者放 MCP 配置和 OpenSpec 命令。忽略它们会把刚初始化的工作流挡在仓库外面。

不跟踪的技能包留在 `.agents/skills/`，当作仓库工具，不在这次删除。是否提交由之后的提交决定，不在本变更里做。

备选：把未跟踪技能移出仓库或写入 gitignore。否决。`AGENTS.md` 已经有 Agent skills 节，这些目录是给本仓库用的，删掉或忽略会让导航和技能对不上。

### 5. 导航只加一节，中英各一份

在 `README.md` 与 `README_EN.md` 的目录后各加一节「仓库地图」。每行一个路径、一句话职责：

| 路径 | 职责 |
| --- | --- |
| `AGENTS.md` | Agent 戒律与必须遵守的工程约束 |
| `MISSION.md` | 为什么做、不做什么 |
| `ARCHITECTURE.md` | 本仓库自己的 C4 与依赖流向 |
| `TECH_STACK.md` | 技术选型与分包边界 |
| `ROADMAP.md` | 阶段进度与任务切片 |
| `docs/decisions/` | ADR |
| `docs/REQUIREMENTS.md` | 产品需求 |
| `specs/` | 已写完的阶段规格；其中四个 `*.md` 是指向根目录的符号链接 |
| `openspec/` | 之后新变更的提案与规格 |
| `index.html` | 本地图纸工作台，由 `./start.sh` 提供 |
| `packages/` | `core`、`cli`、`mcp-server`、`web-report` |

不改这两份 README 的其余章节。

备选：新建 `docs/MAP.md` 再从 README 链过去。否决。多一个入口，根目录仍然看不出该从哪读。

### 6. 实施时用路径清单保护产品改动

动手前列出本变更允许修改的路径，只碰 `.gitignore`、两份 README、以及上面列出的删除项。`git status` 里其余已修改和未跟踪路径保持原样。

## Risks / Trade-offs

- [大小写重复文件在大小写不敏感的检出里本来就是同一个路径] → 删除的是 Git 索引里的小写条目，保留磁盘上的大写正本；实施后用 `git ls-files` 确认只剩大写路径。
- [README 地图会过时] → 地图只列稳定入口，不列阶段任务或测试数量。
- [未跟踪技能和产品改动仍然使 `git status` 很长] → 这是预期。本变更只把卫生问题和产品改动分开，不负责把产品改动提交掉。
- [个人 exclude 里的 `.omx/` 与新 gitignore 重复] → 无行为差异，共享规则生效后个人 exclude 可以留着。

## Migration Plan

1. 确认允许修改的路径，其余工作区改动不动。
2. 确认三份过期文件和三份根目录小写副本仍是删除，且 `specs/` 符号链接仍指向大写正本。
3. 更新 `.gitignore`。
4. 给两份 README 加上同一张地图。
5. 核对：`git ls-files` 不再包含根目录小写副本和演化产物；`git check-ignore` 命中四个本地目录；两份 README 的地图行一致；`packages/**` 的 diff 与实施前相同。

回滚：还原 `.gitignore` 和两份 README。不要用 `git checkout` 把已删除的重复文件或演化产物加回来，除非核对发现仍有引用。

## Open Questions

无。范围已在上面收死。未跟踪技能和产品改动何时提交，留给单独的提交请求。
