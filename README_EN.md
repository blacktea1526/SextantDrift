# SextantDrift (Architecture X-Ray & Drift Compass)

> **The Architecture X-Ray and Drift Compass for Modern Engineering Teams in the AI Coding Era.**  
> Always review code by the red-green diff of two diagrams. End blind manual code reviews and enforce architectural invariants with mathematical determinism.

[ 简体中文 ](README.md) | [ English ](README_EN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-2.1-green.svg)](https://vitest.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Self-Dogfooding](https://img.shields.io/badge/Self--Dogfooding-Passed%20(0%20Drifts)-success.svg)](sextant.json)

---

## Table of Contents

- [1. Role & Purpose](#1-role--purpose)
  - [1.1 The 2026 Core Dilemma: Humans Cannot Keep Up with AI Code](#11-the-2026-core-dilemma-humans-cannot-keep-up-with-ai-code)
  - [1.2 Core Product Philosophy: Design by Diagram, Diff by Diagram](#12-core-product-philosophy-design-by-diagram-diff-by-diagram)
  - [1.3 Seven-Dimensional Architecture Verification Matrix](#13-seven-dimensional-architecture-verification-matrix)
  - [1.4 Target Audience & Use Cases](#14-target-audience--use-cases)
- [2. Key Advantages](#2-key-advantages)
  - [2.1 Zero False Positives & AST Determinism](#21-zero-false-positives--ast-determinism)
  - [2.2 Token-Efficient & Native AI Agent Alignment](#22-token-efficient--native-ai-agent-alignment)
  - [2.3 100% Offline & Air-Gapped Native SVG Visualizer](#23-100-offline--air-gapped-native-svg-visualizer)
  - [2.4 Brownfield Graceful Onboarding (Baseline: No New Drift)](#24-brownfield-graceful-onboarding-baseline-no-new-drift)
  - [2.5 Core-First Headless Architecture & Sub-Second Execution](#25-core-first-headless-architecture--sub-second-execution)
  - [2.6 Zero-Lockin Open Protocols & Bidirectional Inversion](#26-zero-lockin-open-protocols--bidirectional-inversion)
  - [2.7 Rigorous Self-Dogfooding Verification](#27-rigorous-self-dogfooding-verification)
- [3. Step-by-Step Tutorial](#3-step-by-step-tutorial)
  - [3.1 Prerequisites & Installation](#31-prerequisites--installation)
  - [3.2 The Core 5-Step Workflow](#32-the-core-5-step-workflow)
    - [Step 1: Reverse X-Ray Topology Inference (`init`)](#step-1-reverse-x-ray-topology-inference-init)
    - [Step 2: Understanding & Customizing Specification (`sextant.json`)](#step-2-understanding--customizing-specification-sextantjson)
    - [Step 3: Running Architecture Drift Gate (`check`)](#step-3-running-architecture-drift-gate-check)
    - [Step 4: Isolating Legacy Technical Debts (`baseline`)](#step-4-isolating-legacy-technical-debts-baseline)
    - [Step 5: Interactive Dual-Diagram Visual Report (`report`)](#step-5-interactive-dual-diagram-visual-report-report)
  - [3.3 Semantic Invariants DSL Tutorial](#33-semantic-invariants-dsl-tutorial)
  - [3.4 CI/CD Quality Gate Integration (GitHub Actions)](#34-cicd-quality-gate-integration-github-actions)
  - [3.5 AI Agent Closed-Loop Pairing & Self-Healing](#35-ai-agent-closed-loop-pairing--self-healing)
  - [3.6 Unified Engineering Controller Script (`./start.sh`)](#36-unified-engineering-controller-script-startsh)
- [4. Full Architecture Specification Schema (`sextant.json`)](#4-full-architecture-specification-schema-sextantjson)
- [5. Repository Layout](#5-repository-layout)
- [6. Six Immutable Invariants for Agents](#6-six-immutable-invariants-for-agents)
- [7. License](#7-license)

---

## 1. Role & Purpose

### 1.1 The 2026 Core Dilemma: Humans Cannot Keep Up with AI Code
As of 2026, the software engineering industry has entered the AI Coding era. Powered by tools such as Claude Code, Cursor, Copilot, and Antigravity, developers produce code 5 to 10 times faster than ever before. However, **Pull Request (PR) human code review has become the fatal bottleneck across software engineering**:
- **Fragmented Line Diffs**: Line-by-line `git diff` is fundamentally scattered. Reviewers drown in hundreds of thousands of lines of syntax details, missing the forest for the trees.
- **Stealth Architectural Erosion**: AI Agents prioritize immediate local tasks, frequently creating **layer bypasses (e.g. Controllers directly calling DB drivers), layer inversions, and circular dependency deadlocks**.
- **Wasted Design Diagrams**: Miro boards, Draw.io sketches, and textual PRDs are drawn once and abandoned immediately. There is zero automated linkage between design intent and production code.
- **Exponential Review Overhead**: Senior engineers spend endless hours reviewing AI-generated PRs, yet still cannot prevent the codebase from deteriorating into architectural chaos.

### 1.2 Core Product Philosophy: Design by Diagram, Diff by Diagram
SextantDrift establishes a singular review mental model: **Always review code by the red-green diff of two diagrams!**

```
┌──────────────────────────────────────┐             ┌──────────────────────────────────────┐
│       Left Screen: Target Intent      │             │       Right Screen: Actual Code      │
│  Target Topology & Layering Bounds   │     VS      │  Machine-Extracted TypeScript AST    │
└──────────────────────────────────────┘   (Diff)    └──────────────────────────────────────┘
                   │                                                     │
                   └──────────────────────────┬──────────────────────────┘
                                              ▼
                        ┌──────────────────────────────────────────┐
                        │        Drift Alert Inspection Deck       │
                        │    Red Line Angular Drifts · Bypasses    │
                        │    Inversions · Cycles · Broken Rules    │
                        └──────────────────────────────────────────┘
```

- **80% Diagram (Borders & Topology)**: Uses standardized Mermaid / C4 diagrams to define component boundaries, allowed dependency flows, and state machines.
- **20% Rules (Soul & Invariants)**: Complemented by crisp Semantic Invariants (e.g. "Persist to DB before invoking unreliable external LLM/Payment APIs", "Controllers must never import ORM drivers directly").

### 1.3 Seven-Dimensional Architecture Verification Matrix
SextantDrift continuously enforces seven critical dimensions of architectural hygiene:

| Dimension | Violation Scenario | Verification Mechanism | Severity |
| :--- | :--- | :--- | :---: |
| **Layer Bypass** | A Controller bypasses Service logic to directly invoke Repository / DB drivers | DFS topological order sequence monotonicity check | `CRITICAL` |
| **Layer Inversion** | Low-level Infrastructure/Domain modules import higher-level Presentation Controllers | Reverse directed edge detection in component graph | `CRITICAL` |
| **Circular Cycles** | Entangled mutual dependencies across components (`A -> B -> C -> A`) | Tarjan's Strongly Connected Components (SCC) algorithm | `CRITICAL` |
| **Forbidden Imports** | Presentation modules importing DB drivers (e.g. `@prisma/client`, `typeorm`) | TypeScript AST `ImportDeclaration` pattern matching | `CRITICAL` |
| **Semantic Invariants** | Inverted business preconditions (e.g. missing auth before DB access, calling network before persisting) | AST AST-statement sequence matching (`must_precede` / `require_config`) | `CRITICAL / WARNING` |
| **State Machine Verifier**| State machines with deadlock sinkholes, unreachable islands, or missing timeout fallbacks | Mermaid `stateDiagram-v2` static graph reachability & degree analysis | `CRITICAL / WARNING` |
| **Dynamic Causality** | Inverted execution sequences across async event buses | Runtime Trace recorder + `sequenceDiagram` partial-order DAG differencing | `CRITICAL / WARNING` |

### 1.4 Target Audience & Use Cases
1. **Tech Leads & Architects**: Define architectural boundaries once using declarative Mermaid / C4 JSON schemas. Let machines act as the objective, infallible gatekeeper.
2. **AI Coding Practitioners (Cursor / Claude / Copilot Users)**: After generating large blocks of code, run a 5-second check to confirm architectural integrity before opening a PR.
3. **DevOps & Platform Engineering**: Embed architectural gatekeeping into GitHub Actions or GitLab CI. Never merge a PR that violates the target architecture.

### 1.5 Language & Ecosystem Support Matrix
To guarantee extreme verification speed (≤ 3s) and zero-false-positive determinism, SextantDrift adopts a tiered ecosystem strategy:

| Support Tier | Target Languages & Ecosystems | Capabilities & Implementation | Status |
| :--- | :--- | :--- | :---: |
| **Tier 1: First-Class Native AST** | **TypeScript, JavaScript, TSX/JSX**<br>(Node.js, Bun, Deno, Next.js, NestJS, Express) | Deep integration with TypeScript Compiler API: full physical module DAG, C4 cross-layer bypasses, Tarjan cycle detection, statement-level semantic invariants, and auto-route contract extraction. | **Production GA**<br>Full feature set |
| **Tier 2: Polyglot Dynamic & Contract Protocols** | **Go, Python, Rust, Java, C#, etc.** | **Protocol-level integration**: via standardized JSON trace format (`.sextant/trace.json`) and Markdown API contracts (`api-contract.md`), any language can utilize runtime causality differencing and contract alignment gates. | **Production GA**<br>Language-agnostic |
| **Tier 3: Polyglot Static AST Roadmap** | **Go, Python, Rust** | Planned Tree-sitter / WASM AST parser adapters to extract static package/module dependency DAGs across Go, Python, and Rust natively. | **On Roadmap**<br>Targeted for v2.5+ |

---

## 2. Key Advantages

Why choose SextantDrift over standard Linters or LLM-based code reviewers?

### 2.1 Zero False Positives & AST Determinism
- **False Positives Kill Developer Trust**: In developer tooling, even a single spurious warning erodes credibility immediately.
- **No LLM Hallucinations**: Unlike "AI Code Reviewers" that guess based on fuzzy probabilities and provide vague suggestions, SextantDrift relies on the official TypeScript compiler AST and rigorous graph theory (Tarjan SCC, DFS).
- **Infallible Evidence**: Every violation includes the exact file path, absolute line number, column number, and formatted code snippet.

### 2.2 Token-Efficient & Native AI Agent Alignment
- **Ultra-Low Token Overhead**: Terminal diagnostic outputs are compressed for maximum signal-to-noise ratio. A single drift diagnostic consumes only **50 to 200 Tokens**, preventing AI Agent context window exhaustion.
- **Actionable AI Fix Prompts**: Each violation comes with an instant "Copy AI Fix Prompt" payload, empowering Claude Code or Cursor to resolve the architectural drift in a single autonomous turn.

### 2.3 100% Offline & Air-Gapped HTML Review Report
- **Zero External Network Requests**: The generated `drift-report.html` is an entirely self-contained single file with **zero external CDN scripts, stylesheets, or web fonts**.
- **Built-in Industrial C4 Dual-Diagram Canvas**: `sextant-drift` now fully bundles the native SVG dual-diagram visual canvas engine out of the box with zero extra dependencies (supporting Container & Component drill-down, infinite Pan & Zoom, Contracts filtering, and instant English/Chinese switching).

### 2.4 Brownfield Graceful Onboarding (Baseline: No New Drift)
- **Stop Refactoring Dread**: Legacy projects often start with hundreds of preexisting architectural violations.
- **SHA-256 Semantic Fingerprints**: Run `npx sextant-drift baseline` to snapshot all existing violations into `.sextant/baseline.json`.
- **No New Drift Principle**: Preexisting technical debt is permanently grandfathered in, while **new violations are strictly blocked in CI**, enabling gradual, painless architectural improvement.

### 2.5 Core-First Headless Architecture & Sub-Second Execution
- **Pure Headless Engine**: `@sextant/core` is an unadulterated TypeScript engine with **0 DOM dependencies, 0 browser shims, and 0 CLI coupling**.
- **Extreme Speed**: Scans hundreds of files and hundreds of dependencies in **under 1 second**, easily fitting into pre-commit hooks and CI gate checks.

### 2.6 Zero-Lockin Open Protocols & Bidirectional Inversion
- **No Proprietary Formats**: Uses standard, Git-versioned `sextant.json` (backed by JSON Schema) and compatible Mermaid / Markdown documents.
- **Reverse X-Ray (`init`)**: Never force developers to manually diagram systems from scratch; automatically scans existing source trees to generate the initial architectural skeleton.

### 2.7 Rigorous Self-Dogfooding Verification
- **Verified on Itself**: SextantDrift enforces its own architectural boundaries across its monorepo on every build and test cycle.
- **Comprehensive Test Suite**: Ships with 55 test suites and 292 tests, guaranteeing rock-solid stability and zero regressions.

---

## 3. Step-by-Step Tutorial

### 3.1 Prerequisites & Installation

- **Node.js**: `>= 18.0.0` (LTS 20+ recommended)
- **Package Manager**: `pnpm` (recommended), `npm`, or `yarn`

You can run SextantDrift on-demand via `npx`, or install it as a project devDependency:

```bash
# Recommended: Install CLI tool as devDependency in your project
pnpm add -D sextant-drift

# Or using npm
npm install --save-dev sextant-drift

# Or run instantly without installation via npx
npx sextant-drift --help

# To import and invoke the core engine programmatically in Node.js / CI:
pnpm add -D @sextant/core
```

---

### 3.2 The Core 5-Step Workflow

#### Step 1: Reverse X-Ray Topology Inference (`init`)
When introducing SextantDrift into an existing codebase, run the reverse scanner from your project root:

```bash
# Automatically inspect the src/ directory and infer target topology
npx sextant-drift init

# If your source files live in a custom folder:
npx sextant-drift init --source-dir app
```

This generates two key files in your workspace:
1. **`sextant.json`**: The single source of truth for your architecture, backed by a JSON Schema for auto-completion in VS Code / WebStorm.
2. **`ARCHITECTURE.md`**: A human-readable Markdown specification featuring embedded Mermaid diagrams for instant preview on GitHub / GitLab.

---

#### Step 2: Understanding & Customizing Specification (`sextant.json`)
Open `sextant.json` to review or refine your architecture layers and component boundaries. For example:

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json",
  "name": "E-Commerce Microservice",
  "version": "1.0.0",
  "layers": [
    {
      "id": "presentation",
      "name": "Presentation Layer",
      "order": 1,
      "description": "API routes and controllers"
    },
    {
      "id": "domain",
      "name": "Business Domain Layer",
      "order": 2,
      "description": "Core business logic and workflows"
    },
    {
      "id": "infrastructure",
      "name": "Infrastructure Layer",
      "order": 3,
      "description": "Data repositories and external clients"
    }
  ],
  "components": [
    {
      "id": "controllers",
      "name": "Controllers",
      "layerId": "presentation",
      "paths": ["src/controllers/**"],
      "forbiddenImports": ["@prisma/client", "typeorm"]
    },
    {
      "id": "services",
      "name": "Business Services",
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
  ]
}
```

> **Core Invariant**: Any cross-layer invocation not explicitly declared in `allowDependencies` (such as `controllers -> repositories`) will be flagged as a `CRITICAL_BYPASS`.

---

#### Step 3: Running Architecture Drift Gate (`check`)
Run the drift gate locally before committing code or inside CI pipelines:

```bash
# Run architecture verification
npx sextant-drift check

# Strict mode: Treat warnings as errors
npx sextant-drift check --strict

# Output machine-readable JSON
npx sextant-drift check --json
```

**Terminal Diagnostic Sample (High SNR ANSI Output):**

```
✖ Architectural Drift Detected! (Found 2 violations)

[CRITICAL] Layer Bypass Violation:
  From: Controllers (src/controllers/order.controller.ts)
  To:   Data Repositories (src/repositories/order.repo.ts)
  Evidence: src/controllers/order.controller.ts:42:15
  Snippet:
    41 |   async createOrder(req: Request, res: Response) {
  > 42 |     const repo = new OrderRepository();
       |                      ^^^^^^^^^^^^^^^
    43 |     await repo.insert(req.body);
  Suggestion: Controllers must not bypass Services. Call OrderService instead.

[CRITICAL] Semantic Invariant Broken (PERSIST_BEFORE_EXTERNAL):
  Evidence: src/services/payment.service.ts:18:7
  Rule: Orders must be persisted before calling external payment gateways
  Suggestion: Move orderRepo.save() before paymentGateway.charge()

Checked 86 files (142 dependencies) in 410ms. Exit code: 1
```

**CLI Exit Codes:**
- `0`: Architecture fully compliant. Zero drift. Gate passed.
- `1`: Architectural drifts or broken invariants detected.
- `2`: Configuration syntax error or runtime fatal failure.

---

#### Step 4: Isolating Legacy Technical Debts (`baseline`)
When introducing SextantDrift into an established codebase with existing violations, generate a baseline snapshot:

```bash
# Capture and isolate all current architectural debts
npx sextant-drift baseline
```

- This produces `.sextant/baseline.json`, hashing every existing violation into an immutable SHA-256 semantic fingerprint (factoring in violation type, source file, target component, and enclosing function).
- Commit `.sextant/baseline.json` into Git.
- Subsequent `npx sextant-drift check` runs will **automatically exempt all existing debt**, strictly failing only when **new architectural drifts** are introduced.

---

#### Step 5: Visual Architecture Report (`report`)
Generate an offline HTML report to inspect system topology and drift diagnostics:

```bash
# Generate standalone offline report (outputs drift-report.html)
npx sextant-drift report

# Specify custom report output path
npx sextant-drift report -o ./dist/architecture-report.html

# Generate report simultaneously during check
npx sextant-drift check --report
```

- **Out-of-the-Box (Built-in Industrial C4 SVG Dual-Diagram Canvas)**: No extra packages required. Run `npx sextant-drift report` and open `drift-report.html` in any browser to experience:
  1. **Pure Native SVG Rendering**: Zero external network downloads, 100% offline self-contained, rendering instantly.
  2. **C4 Multi-Level Drill-Down**: Switch seamlessly between **Level 2 Containers** and **Level 3 Components**.
  3. **Red/Green Diff Highlighting**: Compliant calls appear in steady teal/blue, while drift violations blink in high-contrast red dashed arrows.
  4. **Interactive Filters**: Hover to inspect component dependencies; click to toggle low-level contract lines.
  5. **One-Click AI Fix Prompt**: Click "Copy AI Fix Prompt" on any violation card to copy structured context ready for Cursor or Claude Code.

---

### 3.3 Semantic Invariants DSL Tutorial

While structural graphs govern modules, critical bugs occur within method execution order. Configure the `invariants` array in `sextant.json`:

#### Pattern 1: Execution Precedence (`must_precede`)
Guarantee that critical state operations occur **before** secondary side-effects:
```json
{
  "id": "PERSIST_BEFORE_LLM",
  "severity": "critical",
  "desc": "User prompt and state must be persisted before invoking unreliable LLM APIs",
  "pattern": {
    "must_precede": ["messageRepo.save", "db.messages.create"],
    "target": ["llmClient.generate", "openai.chat.completions.create"],
    "scope": "src/services/**"
  }
}
```

#### Pattern 2: Forbidden Import Quarantine (`forbid_import`)
Prevent specific low-level libraries from leaking into target folders:
```json
{
  "id": "NO_NODE_BUILTINS_IN_CLIENT",
  "severity": "critical",
  "desc": "Client components must not import Node.js built-in modules",
  "pattern": {
    "forbid_import": ["fs", "node:fs", "child_process", "path"],
    "in_path": "src/client/**,src/views/**"
  }
}
```

#### Pattern 3: Mandatory Configuration Guard (`require_config`)
Ensure network calls always configure timeouts:
```json
{
  "id": "MANDATORY_TIMEOUT_IN_FETCH",
  "severity": "warning",
  "desc": "All third-party HTTP requests must explicitly configure a timeout",
  "pattern": {
    "require_config": ["timeout"],
    "scope": "src/integrations/**"
  }
}
```

---

### 3.4 CI/CD Quality Gate Integration (GitHub Actions)

Add `.github/workflows/architecture-gate.yml` to your repository:

```yaml
name: Architecture Drift Gate

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  verify-architecture:
    name: Verify Architectural Integrity
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Build Packages
        run: pnpm -r run build

      # Run drift gate and output visual diff table into GitHub PR Step Summary
      - name: Run SextantDrift Check
        run: npx sextant-drift check --github-summary --report drift-report.html

      # Optional: Upload drift-report.html as a downloadable CI artifact
      - name: Upload Drift Report Artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: architecture-drift-report
          path: drift-report.html
```

---

### 3.5 AI Agent Closed-Loop Pairing & Self-Healing

SextantDrift is designed specifically for autonomous AI agents:

1. **Install Agent Skill**: Place the skill descriptor at `.agents/skills/sextant-drift/SKILL.md`.
2. **Autonomous Feedback Loop**:
   - Instruct Cursor or Claude Code: *"Implement order refund logic"*.
   - The Agent writes the implementation.
   - The Agent automatically runs `npx sextant-drift check`.
   - If a drift is identified (e.g. instantiating `RefundRepository` directly in the Controller), the Agent ingests the line-level diagnostic and refactors the dependency into `RefundService`.
   - The Agent delivers 100% verified code, preventing architectural drift before human review.

---

### 3.6 Unified Engineering Controller Script (`./start.sh`)

SextantDrift includes a unified developer task runner `./start.sh`:

```bash
./start.sh            # Launch local Visual Workbench (@ port 3000)
./start.sh --test     # Run full Vitest test suite (55 suites, 292 tests passing)
./start.sh --ui       # Open Vitest interactive UI dashboard
./start.sh --check    # Run architectural drift verification (including self-dogfooding)
./start.sh --build    # Build all packages (@sextant/core, sextant-drift, @sextant/web-report)
./start.sh --release  # Build, test, and publish packages to npm registry
./start.sh --bench    # Run AST extraction & Tarjan SCC performance benchmarks
./start.sh --coverage # Run tests and generate V8 code coverage report
```

---

## 4. Full Architecture Specification Schema (`sextant.json`)

Below is a complete specification incorporating C4 modeling and semantic invariants:

```json
{
  "$schema": "https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json",
  "name": "Enterprise Payment Platform",
  "version": "2.0.0",
  "systemContext": {
    "systemName": "Payment Gateway System",
    "description": "Core payment processing and reconciliation service",
    "actors": [
      { "id": "User", "name": "End Customer", "role": "human" },
      { "id": "AIAgent", "name": "AI Coding Agent", "role": "agent" }
    ],
    "externalSystems": [
      { "id": "BankNetwork", "name": "Central Bank Clearing System" }
    ]
  },
  "containers": [
    { "id": "api", "name": "API Service", "order": 1, "type": "service" },
    { "id": "worker", "name": "Background Worker", "order": 2, "type": "service" },
    { "id": "db", "name": "Primary Database", "order": 3, "type": "database" }
  ],
  "layers": [
    { "id": "presentation", "name": "Presentation Tier", "order": 1 },
    { "id": "application", "name": "Application Tier", "order": 2 },
    { "id": "domain", "name": "Domain Tier", "order": 3 },
    { "id": "infrastructure", "name": "Infrastructure Tier", "order": 4 }
  ],
  "components": [
    {
      "id": "order-controller",
      "name": "Order Controller",
      "layerId": "presentation",
      "containerId": "api",
      "paths": ["src/controllers/order/**"]
    },
    {
      "id": "order-service",
      "name": "Order Service",
      "layerId": "application",
      "containerId": "api",
      "paths": ["src/services/order/**"]
    },
    {
      "id": "order-repo",
      "name": "Order Repository",
      "layerId": "infrastructure",
      "containerId": "db",
      "paths": ["src/repositories/order/**"]
    }
  ],
  "allowDependencies": [
    { "from": "order-controller", "to": "order-service" },
    { "from": "order-service", "to": "order-repo" }
  ],
  "invariants": [
    {
      "id": "FORBID_RAW_SQL_IN_SERVICES",
      "severity": "critical",
      "desc": "Services must not import raw SQL drivers directly",
      "pattern": {
        "forbid_import": ["mysql2", "pg", "sqlite3"],
        "in_path": "src/services/**"
      }
    }
  ]
}
```

---

## 5. Repository Layout

SextantDrift is structured as a clean, decoupled pnpm Monorepo:

```
SextantDrift/
├── packages/
│   ├── core/           # @sextant/core: Pure headless engine (TS AST, Tarjan SCC, Invariants, Trace)
│   ├── cli/            # sextant-drift: Ultra-lightweight CLI gate (< 50KB, cac + picocolors)
│   └── web-report/     # @sextant/web-report: Standalone 100% offline native SVG report generator
├── .agents/skills/     # Standardized AI Agent architecture review skill
├── .github/workflows/  # Continuous integration and PR verification pipelines
├── schemas/            # JSON Schema definitions (sextant.schema.json)
├── sextant.json        # Self-dogfooding architectural specification
├── ARCHITECTURE.md     # Auto-generated Mermaid architecture documentation
├── start.sh            # Unified controller script
└── index.html          # Local interactive architecture drafting workbench
```

---

## 6. Six Immutable Invariants for Agents

All AI Agents and human engineers contributing to this repository must respect the six absolute laws:

1. **Law 1: Forbid Self-Attestation**: Never permit an Agent to write its own "actual sequence" or assert compliance without compiler verification. Actual topology must be deterministically extracted from the AST.
2. **Law 2: Zero False Positives in Static Analysis**: False alarms destroy trust. Never guess asynchronous event timings using regex. Dynamic sequences must be verified via actual Traces.
3. **Law 3: Core-First Headless Architecture**: `@sextant/core` must maintain zero DOM dependencies and run within milliseconds in any sandbox. Never couple the core engine to heavy desktop UI shells.
4. **Law 4: Zero-Lockin Open Protocols**: Rely exclusively on standard Git-tracked `sextant.json`, Mermaid, and Markdown. Never introduce closed proprietary formats.
5. **Law 5: Inference Over Friction**: Support reverse engineering (`init`) so developers and teams never have to manually draw large diagrams before adopting the tool.
6. **Law 6: Mandatory Test-on-Change**: Code changes must include test updates and pass the entire test suite (`./start.sh --test`) with 100% green exit codes before committing.

---

## 7. License

Distributed under the [MIT License](LICENSE).  
Engineered with precision for human engineers and autonomous AI agents worldwide.
