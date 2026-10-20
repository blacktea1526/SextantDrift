# @sextant/mcp-server

> Model Context Protocol (MCP) Server for SextantDrift — Real-Time Architectural Guardrail for AI Coding Agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Protocol](https://img.shields.io/badge/MCP-2024--11--05-green.svg)](https://modelcontextprotocol.io/)

---

## 概述 (Overview)

`@sextant/mcp-server` 将 SextantDrift 的 AST 架构门禁能力以标准 [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 形式暴露给 AI Coding Agents（如 Cursor、Claude Code、Windsurf 等）。

### 核心能力 (Core Tools)

1. **`check_file` (实时增量门禁)**
   - 在 Agent 写文件或保存的瞬间，极速 (<20ms) 校验单文件 AST 依赖；
   - 立即拦截跨层旁路 (`CRITICAL_BYPASS`)、逆向依赖 (`CRITICAL_INVERSION`)、违规导入 (`FORBIDDEN_IMPORT`) 与语义不变量违规；
   - 输出结构化判定 (`valid: boolean`) 与引导建议 (`steeringAdvice`)。

2. **`check_drift` (全仓批量门禁)**
   - 针对当前代码仓执行全量确定性 AST 架构核验；
   - 输出红绿判定、漂移计数、各层级与组件的具体违规切片。

3. **`init_target` (逆向 X 光推导)**
   - 自动静态扫描源码拓扑，反向生成候选架构目标规范 (`sextant.json`)。

4. **`explain_violation` (零幻觉自愈引导)**
   - 针对架构违规类型输出确定性的修复指引与代码重构示例，杜绝 LLM 幻觉。

---

## 安装与配置 (Configuration)

### 在 Cursor / Claude Code 中配置

在你的 MCP 配置文件（如 `~/.cursor/mcp.json` 或 Claude Desktop 对应配置）中添加：

```json
{
  "mcpServers": {
    "sextant-drift": {
      "command": "npx",
      "args": ["-y", "sextant-drift", "mcp"]
    }
  }
}
```

或者使用独立包启动：

```json
{
  "mcpServers": {
    "sextant-drift": {
      "command": "npx",
      "args": ["-y", "@sextant/mcp-server"]
    }
  }
}
```

---

## 开源协议 (License)

[MIT License](LICENSE) © 2026 SextantDrift Contributors
