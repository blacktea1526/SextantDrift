---
name: sextant-drift
description: Architecture X-Ray & Drift Compass for detecting architectural erosion, layer bypasses, circular dependencies, semantic invariant violations, state machine deadlocks, API contract mismatches, and runtime causality drifts using SextantDrift. Use when verifying architecture compliance, checking PRs for layer boundary breaches, auditing dependency graphs, reverse-engineering target architectures, generating offline C4 SVG visual dual-diagram reports, or autonomously self-healing architectural drifts with AI coding agents.
---

# SextantDrift — Architecture X-Ray & Drift Compass

## Overview

**SextantDrift** is an architecture-level X-ray machine and drift compass built for engineering teams and AI coding agents (Claude Code, Cursor, Copilot, Codex, Antigravity). It terminates blind, fragmented line-by-line PR reviews by comparing the **Target Architecture (Design Intent)** against the **Actual Code AST, API Contracts & Dynamic Traces (Real Topology)**.

```
  ┌─────────────────────────────────────────────────────────────┐
  │                    Design by Diagram, Diff by Diagram       │
  ├──────────────────────────────┬──────────────────────────────┤
  │ Target Intent (Design)       │ Actual Code Topology (AST)   │
  │ • Defined in Mermaid / JSON  │ • Machine-extracted from AST │
  │ • 3~5 Invariant Rules        │ • Dynamic runtime traces     │
  └──────────────┬───────────────┴──────────────┬───────────────┘
                 │                              │
                 └──────────────► ◄─────────────┘
                                 │
                     ┌───────────▼───────────┐
                     │   Drift Alert Angle   │
                     │  Exact Red-Line Diff  │
                     └───────────────────────┘
```

### Core Guarantees (The Litmus Test)
1. **The 5-Second Rule**: Scans 100,000 lines of code in **≤ 3s** (typically < 700ms).
2. **Zero False Positives**: 100% deterministic AST & trace evidence. No regex guessing, zero LLM hallucinations.
3. **AI-Native Token Economy**: ANSI terminal diagnostics consume only **50 ~ 200 tokens**. Compact YAML `--fix-manifest` delivers high-density signal at **< 15% raw tokens**.
4. **Built-in 100% Offline C4 SVG Canvas**: Generates self-contained interactive dual-diagram reports with infinite pan/zoom, component hover probes, and one-click AI Fix Prompt copy.

---

## When to Use This Skill

Activate this skill when:
- **Pre-PR / Pre-Flight Architecture Verification**: Verifying code changes before commit or merge to prevent architectural erosion.
- **AI Coding Agent Self-Healing**: Resolving architectural violations returned by `sextant-drift check` using `--fix-manifest` or `--ai-prompt`.
- **Refactoring & Modularity Auditing**: Detecting layer bypasses, reverse dependencies, circular dependencies, or illegal cross-boundary imports.
- **Cold Start on Brownfield / Legacy Projects**: Running "Reverse X-Ray" (`init`) to automatically deduce architecture topology and invariants.
- **Graceful Adoption with Baseline**: Grandfathering legacy debts via `baseline` to enforce the **"No New Drift"** rule.
- **API Contract Verification**: Auditing REST/RPC route controllers against `api-contract.md` (`--contract`).
- **Visual Architecture Review**: Generating standalone offline interactive C4 SVG visual dual-diagram reports (`report`).

**When NOT to use:**
- Pure typo fixes or cosmetic text modifications that do not alter any imports, module boundaries, or function call sequences.
- Projects without modular architectures or single-file scripts.

---

## Quick Command Reference

All commands run via `npx sextant-drift` (or `node ./packages/cli/dist/bin/sextant-drift.js` inside this repository):

| Command | Purpose | When to Use |
| :--- | :--- | :--- |
| `npx sextant-drift check [dir]` | Run deterministic architectural drift gate | CI pipelines, pre-commit, agent verification |
| `npx sextant-drift report [dir]` | Generate offline interactive C4 SVG dual-diagram report | PR reviews, visual audits, architecture documentation |
| `npx sextant-drift init [dir]` | Reverse X-Ray: auto-generate `sextant.json` & Mermaid diagram | Cold start on new or existing repositories |
| `npx sextant-drift baseline [dir]` | Snapshot existing debts into `.sextant/baseline.json` | Brownfield projects adopting "No New Drift" |

### Complete CLI Flag Matrix

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--fix-manifest` | Output compact YAML Fix Manifest optimized for AI context windows | `false` |
| `--ai-prompt` | Output ready-to-execute prompt for AI coding assistants | `false` |
| `--report [path]` | Generate standalone offline HTML inspection report (e.g. `drift-report.html`) | `false` |
| `--contract <path>` | Path to API contract Markdown specification (e.g. `api-contract.md`) | Auto-detect |
| `--trace <path>` | Path to runtime execution trace JSON (`.sextant/trace.json`) | None |
| `--strict` | Treat warnings (e.g. state machine missing fallbacks) as fatal (Exit Code 1) | `false` |
| `--count-type-only` | Include TypeScript type-only imports (`import type`) in drift detection | `false` |
| `--filter <package>` | Filter target Monorepo package directory (e.g. `--filter packages/core`) | All |
| `--json` | Output machine-readable JSON report | `false` |
| `--github-summary` | Output formatted markdown report directly to `$GITHUB_STEP_SUMMARY` | `false` |
| `--lang <zh\|en>` | Output language for terminal diagnostics and HTML report | `zh` |
| `-c, --config <path>`| Path to custom specification (`sextant.json` or `ARCHITECTURE.md`) | `sextant.json` |
| `-b, --baseline <path>`| Path to custom baseline file | `.sextant/baseline.json` |
| `-t, --tsconfig <path>`| Path to custom `tsconfig.json` | `tsconfig.json` |

---

## Standard Agent Workflows

### Workflow 1: Gated Pre-Flight Check (The Agent Quality Gate)

Whenever you make changes to files involving imports, exports, or module boundaries, run the check gate:

```bash
npx sextant-drift check .
```

#### Interpreting Exit Codes
- **`0` (Clean / Passed)**: No architectural drifts detected, or all existing issues are grandfathered in baseline.
- **`1` (Drift Detected)**: Architectural violations detected. **You must immediately apply Workflow 2 to self-heal.**
- **`2` (Fatal Configuration Error)**: Syntax error in `sextant.json`, unparseable file, or missing paths.

---

### Workflow 2: Autonomous AI Self-Healing (`--fix-manifest`)

When `npx sextant-drift check` exits with `1`, do not guess or write speculative code. Extract the compact YAML Fix Manifest:

```bash
npx sextant-drift check . --fix-manifest
```

Example output:
```yaml
# SextantDrift AI Fix Manifest
# Total drifts: 2 | High-density signal format (<15% raw tokens)
fixes:
  - type: CRITICAL_BYPASS
    file: src/controllers/user.controller.ts:2
    action: REMOVE_BYPASS
    target: Repositories
    fix: Route call through intermediate layer "Business Domain Layer"
  - type: CRITICAL_FORBIDDEN_IMPORT
    file: src/controllers/user.controller.ts:1
    action: REMOVE_IMPORT
    target: @prisma/client
    fix: Remove import "@prisma/client" from "Controllers"
```

#### Deterministic Action Mapping Table
| Action | Meaning | Remediation Technique |
| :--- | :--- | :--- |
| `REMOVE_BYPASS` | Direct cross-layer jump skipping intermediate layer | Delegate to intermediate Domain Service; call Service instead of Repository |
| `INVERT_DEP` | Lower layer reverse-imports upper layer | Extract shared interface/DTO into `contracts` or lower types module (DIP) |
| `BREAK_CYCLE` | Circular dependency between components (`A ↔ B`) | Extract shared types/utils into a leaf module or decouple via Event / DI |
| `REMOVE_IMPORT` | Forbidden third-party package or driver imported | Encapsulate access in designated infrastructure adapter; export domain model |
| `FIX_INVARIANT` | Required preceding operation omitted | Ensure `must_precede` method is called before target operation in same scope |
| `REMOVE_ROUTE` | Undeclared shadow endpoint found in code | Delete unauthorized route handler or add it to `api-contract.md` if intentional |
| `IMPLEMENT_ROUTE` | Contract-specified endpoint missing from code | Implement route controller handler matching path, method, and parameters |
| `FIX_STATE_DEADLOCK`| Terminal-less state machine black hole | Add transition to `[*]` or error fallback state |
| `ADD_TIMEOUT_FALLBACK`| Pending state lacks timeout/error branch | Add `--> Failed: timeout / error` transition |
| `REORDER_CALLS` | Dynamic trace shows out-of-order execution | Await preceding asynchronous operation before triggering side effects |

Once the fix is applied, rerun `npx sextant-drift check .` to confirm exit code 0.

---

### Workflow 3: Cold Start Reverse X-Ray (`init`)

When onboarded to a codebase that does not yet have architecture specifications:

```bash
npx sextant-drift init .
```

1. **Automatic Analysis**: Scans source directories (`src/`, `packages/`, `lib/`), detects layers based on folder conventions (`controllers`, `services`, `repos`, `models`, `contracts`), and builds dependency DAG.
2. **Generates Artifacts**:
   - `sextant.json`: Machine-readable architecture specification with layers, component path mappings, and candidate invariants.
   - `ARCHITECTURE.md`: Human-readable documentation embedding Mermaid flowchart architecture diagram.
3. **Verify**: Run `npx sextant-drift check .` immediately to establish the baseline.

---

### Workflow 4: Brownfield Adoption with Baseline (`baseline`)

When introducing SextantDrift to an existing project with dozens or hundreds of legacy violations, do not attempt to refactor all debt on day one:

```bash
# 1. Snapshot all existing violations into SHA256 fingerprints
npx sextant-drift baseline .

# 2. Check will now report clean (0 new drifts)
npx sextant-drift check .
```

- **"No New Drift" Principle**: The `.sextant/baseline.json` file is committed to Git. All legacy debts are grandfathered, but **any newly introduced violation in a PR or feature branch is strictly blocked**.
- **Gradual Paydown**: As historical code is refactored, run `npx sextant-drift baseline .` to lock in the improvements.

---

### Workflow 5: Interactive C4 SVG Visual Dual-Diagram Report (`report`)

When preparing PR reviews, design documents, or executive summaries:

```bash
# Generate standalone offline report (default: drift-report.html)
npx sextant-drift report .

# Custom output path and English language
npx sextant-drift report . -o ./dist/architecture-report.html --lang en

# Generate report as part of CI check
npx sextant-drift check . --report drift-report.html --github-summary
```

#### Visual Report Capabilities (100% Offline, Zero CDN)
- **C4 Multi-Level Drill-Down**: Toggle between **Level 2 Containers** (Presentation, Domain, Infra) and **Level 3 Components** (individual services, controllers, repositories).
- **Red/Green Diff Highlighting**: Compliant architecture lines render in steady teal/blue; drift violations flash in vibrant red dashed arrows.
- **Interactive Probes**: Hover over any component to highlight inbound/outbound couplings and dependency degrees.
- **Contract Filter Drawer**: One-click toggle to isolate or hide shared low-level contract dependencies.
- **One-Click AI Fix Prompt**: Click the "Copy AI Fix Prompt" button on any red violation card to copy ready-to-paste context for immediate remediation.

---

### Workflow 6: API Contract Alignment (`--contract`)

To guarantee frontend/backend or microservice alignment between route code and API documentation:

```bash
npx sextant-drift check . --contract docs/api-contract.md
```

- Scans route controllers (Express, Fastify, NestJS, Next.js, Koa) and matches declared HTTP methods and paths against Markdown contract tables and headers.
- Catches:
  - `CONTRACT_SHADOW_ENDPOINT`: Controller introduces an undocumented endpoint.
  - `CONTRACT_MISSING_ENDPOINT`: Documented endpoint is missing from implementation.
  - `CONTRACT_LINT_ERROR`: Markdown contract syntax errors.

---

## Violation Diagnosis & Remediation Playbook

### 1. `[CRITICAL_BYPASS]` (跨层越界)
- **Error Example**:
  ```
  [CRITICAL_BYPASS] src/controllers/user.controller.ts:2:1
    Layer bypass detected: "Controllers" in layer "Presentation" (order 1)
    directly calls "Repositories" in layer "Infrastructure" (order 3),
    bypassing "Business Domain Layer" (order 2).
  ```
- **Remediation**:
  1. Never import a repository or database client directly inside a controller/view.
  2. Create or invoke a domain service in `src/services/` that encapsulates the business logic.
  3. Have the controller call the domain service.

### 2. `[CRITICAL_INVERSION]` (逆向依赖)
- **Error Example**:
  ```
  [CRITICAL_INVERSION] src/services/user.service.ts:1:1
    Layer inversion detected: "UserService" in lower layer "Domain" (order 2)
    reverse-imports "UserController" in upper layer "Presentation" (order 1).
  ```
- **Remediation**:
  1. Apply **Dependency Inversion Principle (DIP)**.
  2. Extract shared types, response DTOs, or interfaces into a shared contracts layer (e.g. `src/contracts/user.dto.ts`).
  3. Both the controller and the service import from `contracts`. Lower layers never import from upper layers.

### 3. `[CRITICAL_CYCLE]` (循环依赖)
- **Error Example**:
  ```
  [CRITICAL_CYCLE] src/services/service-b.ts:1:1
    Circular dependency detected: ServiceB -> ServiceA -> ServiceB
  ```
- **Remediation**:
  1. Locate the shared utility function, type, or constant causing the reciprocal import.
  2. Extract it into a separate leaf module (e.g. `src/services/common.ts`).
  3. If circular method invocation is required, decouple via dependency injection, callback functions, or event emitters.

### 4. `[CRITICAL_FORBIDDEN_IMPORT]` (违规导入)
- **Error Example**:
  ```
  [CRITICAL_FORBIDDEN_IMPORT] src/controllers/user.controller.ts:1:1
    Forbidden import detected: Component "Controllers" is forbidden from importing "@prisma/client".
  ```
- **Remediation**:
  1. Remove database client or ORM handles from presentation/controller layers.
  2. Confine `@prisma/client`, `typeorm`, `pg`, or raw drivers to `src/repos/` or `src/infra/`.

### 5. `[INVARIANT_BROKEN]` (语义不变量违例)
- **Error Example**:
  ```
  [INVARIANT_BROKEN] src/controllers/order.controller.ts:15:5
    Invariant broken: Rule "PERSIST_BEFORE_EXTERNAL" requires "db.save"
    to precede "paymentService.charge" in function "handleCheckout".
  ```
- **Remediation**:
  1. Inspect the function containing the violation.
  2. Reorder operations: persist initial order state with `status: 'PENDING'` first.
  3. Only after the database record is safely committed, initiate the external API call.

### 6. `[CONTRACT_SHADOW_ENDPOINT]` & `[CONTRACT_MISSING_ENDPOINT]`
- **Error Example**:
  ```
  [CONTRACT_SHADOW_ENDPOINT] src/controllers/admin.controller.ts:12:3
    Contract alignment broken: Undeclared shadow endpoint "DELETE /api/users/:id"
    found in code, but not defined in contract docs/api-contract.md.
  ```
- **Remediation**:
  1. If the endpoint is unauthorized or deprecated, remove the route handler.
  2. If the endpoint is legitimate, document it in `api-contract.md` with parameters and return status codes.

---

## GitHub Actions CI Integration

To establish an impenetrable zero-drift architectural gate in CI:

```yaml
name: Architecture Quality Gate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  architecture-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Run SextantDrift Architecture Gate
        run: npx --yes sextant-drift check . --github-summary --report drift-report.html --strict

      - name: Upload Visual Architecture Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: architecture-drift-report
          path: drift-report.html
```

---

## Detailed Reference Guides

For deep-dive syntax specifications and architectural patterns:
- [`references/invariants-dsl.md`](./references/invariants-dsl.md): Complete Invariants DSL specification, `sextant.json` schema, and Mermaid state/sequence diagram rules.
- [`references/remediation-patterns.md`](./references/remediation-patterns.md): Concrete before-and-after TypeScript refactoring patterns for all 8 violation types.
- [`references/api-contracts.md`](./references/api-contracts.md): Markdown API contract format, route extraction mechanics, and contract drift elimination.
