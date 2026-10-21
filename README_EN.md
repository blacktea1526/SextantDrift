# SextantDrift (Architecture X-Ray & Drift Compass)

<p align="center">
  <strong>The Architecture X-Ray and Drift Compass for Engineering Teams in the AI Coding Era.</strong><br>
  <em>Design by Diagram, Diff by Diagram · End blind manual code reviews with deterministic topology and dual-diagram red-green diffs.</em>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README_EN.md">English</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.6-blue.svg" alt="TypeScript"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg" alt="Node.js"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-Native%20Server-purple.svg" alt="MCP Server"></a>
  <a href="https://github.com/blacktea1526/SextantDrift"><img src="https://img.shields.io/badge/Polyglot-TS%20%7C%20Python%20%7C%20Go-orange.svg" alt="Polyglot"></a>
</p>

---

## 💡 Why SextantDrift?

The core contradiction in 2026 software engineering: **"Humans cannot review code as fast as AI writes it."**

AI coding assistants (Cursor, Claude Code, Copilot, Antigravity) produce enormous volumes of code. However:
- **Line-level `git diff` is fragmented**: Critical architecture violations hide inside hundreds of lines of diffs. Reviewers cannot easily catch presentation controllers bypassing services to directly query the database, nor can they spot indirect circular dependencies;
- **Diagrams decay instantly**: Miro, Draw.io, or prose PRDs are abandoned immediately after drawing, losing any linkage to actual code;
- **Agent self-attestation is an illusion**: Asking an AI agent to "self-audit whether its code complies with the architecture" is like asking a suspect to write their own verdict—it inevitably creates hallucination loops.

**SextantDrift's Answer**:
> Replace prose monuments and self-reporting illusions with a deterministic **Architecture X-Ray**.  
> **80% Diagram (Topology & Skeleton) + 20% Rules (Semantic Invariants)**. Always review architecture via the **red-green diff of two diagrams**.

---

## ⚡ Key Verification Capabilities

```
┌──────────────────────────────────────┐             ┌──────────────────────────────────────┐
│        Target Specification          │             │          Actual Source Code          │
│   C4 Layers · Allowed Dependencies   │     VS      │    Deterministic AST Dependency DAG   │
└──────────────────────────────────────┘    (Diff)   └──────────────────────────────────────┘
                   │                                                     │
                   └──────────────────────────┬──────────────────────────┘
                                              ▼
                         ┌──────────────────────────────────────────┐
                         │              Drift Findings              │
                         │    Layer Bypass · Inversion · Broken Rule│
                         │    Cycles · Deadlocks · Forbidden Imports│
                         └──────────────────────────────────────────┘
```

| Verification Dimension | Detection Item | Description |
| :--- | :--- | :--- |
| **Layer Protection** | **Layer Bypass** | Enforces single-direction flows; blocks upper tiers from skipping intermediate services (e.g., Controller bypassing Service to access Repository) |
| **Dependency Inversion** | **Layer Inversion** | Blocks lower layers from inversely importing higher-level modules (e.g., Infra referencing UI) |
| **Graph Topology** | **Circular Dependencies** | Uses [Tarjan SCC (Strongly Connected Components)](packages/core/src/graph/tarjan.ts) algorithm to detect cycles and print the exact file cycle |
| **Boundary Isolation** | **Forbidden Imports** | Isolates critical boundaries (e.g., UI components importing native Node modules, domain layer importing ORMs) |
| **Semantic Invariants** | **Execution Precedence** | AST pattern matching for ordering constraints (e.g., user input must be persisted before external LLM or payment calls) |
| **State Verifier** | **FSM Integrity** | Parses Mermaid state diagrams to find deadlocks (black holes without exit), unreachable islands, and missing fallback/timeout transitions |
| **Understand First** | **Requirement Neighbors** | [ADR-009](docs/decisions/ADR-009-report-understand-first.md) default Understand view; focuses on direct declared neighbors in a clean 4-column SVG layout |
| **AI Ecosystem** | **Native MCP Server** | Serves Model Context Protocol to Cursor/Claude with `check_file` real-time guardrails so AI self-heals immediately |

---

## 🌐 Polyglot Language Matrix

SextantDrift is a pure headless AST engine built for modern multi-language codebases:

- **Tier 1 (Native Deterministic AST Parsing)**:
  - **TypeScript / JavaScript** (Full TS Compiler API: TSX, JSX, ESM, CJS, path aliases, barrel re-exports)
  - **Python** (Native static AST parser: `import`, `from ... import`, package nesting, relative resolution)
  - **Go** (Native Go grammar and import parser: module dependencies and inter-package layer flows)
- **Tier 2 (AI Spec & Runtime Causality)**:
  - **OpenSpec & AGENTS.md** (Native compatibility with modern Spec-Driven workflows)
  - **Mermaid C4 & State Diagrams** (Target architecture and state machine verifications)
  - **Dynamic Runtime Trace** (Phase 5 experimental causality DAG diff: `--trace`)

---

## 🚀 Quick Start in 3 Minutes

No need to draw diagrams manually—use **Reverse X-Ray** on existing code:

```bash
# Step 1: Scan current codebase and reverse-engineer initial architecture specification
npx sextant-drift init

# Step 2: Run 5-second architectural drift check (prints terminal diagnostics with line numbers)
npx sextant-drift check

# Step 3: Generate offline, zero-dependency, native SVG visual inspection report
npx sextant-drift report
```

### Installation

```bash
# Using pnpm (recommended)
pnpm add -D sextant-drift

# Using npm
npm install --save-dev sextant-drift
```

---

## 🤖 AI Workflow: Native MCP Server (Cursor / Claude / Windsurf)

Keep AI coding agents architecturally compliant **at generation time**:

### 1. One-Click Install to Local IDE
```bash
npx sextant-drift mcp install
```
Automatically discovers and configures `.cursor/mcp.json` or Claude Desktop.

### 2. Manual Config (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "sextant-drift": {
      "command": "npx",
      "args": ["-y", "sextant-drift", "mcp", "run"]
    }
  }
}
```

### 3. Agent Tool Capabilities
- **`check_file`**: Real-time pre-commit check. AI validates the file before saving; if it breaches a layer, MCP returns actionable AST feedback for instant self-healing;
- **`check_drift`**: Full project architecture check returning deterministic violation evidence;
- **`explain_violation`**: Grounded root-cause explanation and refactoring advice based on AST nodes;
- **`init_target`**: Assists humans in reverse-engineering and establishing architecture baselines.

---

## 📖 Practical Guide

### 1. Single Source of Truth (`sextant.json`)

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json",
  "name": "MyProject",
  "layers": [
    { "id": "presentation", "name": "Presentation Layer", "order": 1 },
    { "id": "domain", "name": "Domain Layer", "order": 2 },
    { "id": "infrastructure", "name": "Infrastructure Layer", "order": 3 }
  ],
  "components": [
    {
      "id": "controllers",
      "name": "API Controllers",
      "layerId": "presentation",
      "paths": ["src/controllers/**"],
      "forbiddenImports": ["@prisma/client", "typeorm", "src/repositories/**"]
    },
    {
      "id": "services",
      "name": "Domain Services",
      "layerId": "domain",
      "paths": ["src/services/**"]
    },
    {
      "id": "repositories",
      "name": "Data Repositories",
      "layerId": "infrastructure",
      "paths": ["src/repositories/**"]
    }
  ],
  "allowDependencies": [
    { "from": "controllers", "to": "services" },
    { "from": "services", "to": "repositories" }
  ],
  "invariants": [
    {
      "id": "PERSIST_BEFORE_EXTERNAL",
      "severity": "critical",
      "desc": "Input data must be persisted before calling external LLM or payment APIs",
      "pattern": {
        "must_precede": ["orderRepo.save", "db.orders.create"],
        "target": ["llmClient.generate", "paymentGateway.charge"],
        "scope": "src/services/**"
      }
    }
  ]
}
```

### 2. Brownfield Adoption (`baseline`)

```bash
# Capture existing violations into snapshot (.sextant/baseline.json)
npx sextant-drift baseline
```
- Existing historical debts are grandfathered in;
- CI checks only fail on **newly introduced architecture drifts (No New Drift)**, allowing gradual and safe refactoring.

### 3. Native SVG Offline Report (`report`)

```bash
# Generate standalone HTML report (drift-report.html)
npx sextant-drift report

# Generate in English (default: zh)
npx sextant-drift report --lang en
```
- **100% Offline Native SVG**: Zero external CDN calls, zero 3rd-party scripts, air-gapped safe;
- **[ADR-009 Design](docs/decisions/ADR-009-report-understand-first.md)**: Opens in **Understand Mode** to read component relationships and responsibilities first; toggles into **Diff Mode** to inspect red violation angles.

---

## 🛠️ CLI Reference

```text
Usage:
  $ sextant-drift [command] [options]

Commands:
  check [dir]                    Verify codebase against architecture and invariants (default, exit 0/1/2)
  init [dir]                     Reverse X-Ray: scan directory to generate sextant.json & ARCHITECTURE.md
  baseline [dir]                 Snapshot current debts into .sextant/baseline.json (No New Drift)
  report [dir]                   Generate offline native SVG HTML inspection report
  verify [dir]                   Run content-bound acceptance tests (PASS/FAIL/UNVERIFIED/ERROR)
  requirements <entityId> [dir]  List declared review scope for a business requirement entity
  mcp [action]                   Manage AI Agent MCP protocol server (run | install)

Options:
  -c, --config <path>    Path to custom sextant.json
  -b, --baseline <path>  Path to custom baseline.json
  -t, --tsconfig <path>  Path to tsconfig.json
  --strict               Treat warnings as errors (Exit Code 1)
  --json                 Output machine-readable JSON
  --report [file]        Output standalone HTML report during check
  --github-summary       Output formatted markdown to GITHUB_STEP_SUMMARY
  --fix-manifest         Output compact YAML Fix Manifest for AI remediation
  --ai-prompt            Output ready-to-execute prompt for AI coding assistants
  --filter <package>     Filter target Monorepo package directory
```

---

## 🏛️ Project Architecture & Invariants

Monorepo package structure:
```text
packages/
├── core/         # @sextant/core: Pure TypeScript headless engine (0 DOM, 0 CLI, 100% tested)
├── cli/          # sextant-drift: CLI gate dispatcher, CAC routing, ANSI formatters
├── mcp-server/   # @sextant/mcp-server: Model Context Protocol server for AI Agents
└── web-report/   # @sextant/web-report: Air-gapped standalone native SVG dual-diagram engine
```

Six Immutable Invariants from [AGENTS.md](AGENTS.md):
1. **Forbid Agent Self-Attestation**: Actual topology must be extracted deterministically via machine AST;
2. **Zero False Positives in Static Analysis**: Avoid fragile guesses on runtime async events;
3. **Core-First Headless**: Zero DOM and zero CLI dependencies in `@sextant/core`;
4. **Zero-Intrusion Plaintext Protocol**: Standard JSON, Mermaid, and Markdown;
5. **Inference Over Friction**: Support reverse X-ray (`init`) rather than forcing upfront drawing;
6. **Mandatory Test-on-Change**: Strict package boundaries and mandatory test verification.

---

## 📄 License

[MIT License](LICENSE) © 2026 SextantDrift Contributors.
