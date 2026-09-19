---
name: sextant-drift
description: Architecture X-Ray & Drift Compass for detecting architectural erosion, layer bypasses, circular dependencies, semantic invariant violations, state machine deadlocks, and runtime causality drifts using SextantDrift. Use when verifying architecture compliance, checking PRs for layer boundary breaches, auditing dependency graphs, reverse-engineering target architectures, or setting up zero-drift architectural CI gates.
---

# SextantDrift — Architecture X-Ray & Drift Compass

## Overview

SextantDrift is an architecture-level X-ray machine and drift compass designed for engineering teams and AI coding agents. It terminates blind, fragmented line-by-line PR reviews by comparing the **Target Architecture (Design Intent)** against the **Actual Code AST & Dynamic Trace (Real Topology)**.

### The Core Mental Model: Design by Diagram, Diff by Diagram
- **Left Screen (Target)**: Architecture intent defined in standard Mermaid diagrams and 3~5 semantic invariant rules.
- **Right Screen (Actual)**: Machine-extracted physical dependency DAG and runtime execution traces.
- **Red Alert (Drift Alert)**: Exact cross-layer bypasses, circular dependencies, inverted imports, state deadlocks, and broken invariants highlighted with red warning lines down to the exact file, line, and code snippet.

### Core Guarantees (The Litmus Test)
1. **The 5-Second Rule**: Scans 100,000 lines of code end-to-end in **≤ 3s** (typically < 700ms).
2. **Zero False Positives**: 100% deterministic AST & trace evidence. No regex guessing, no LLM hallucinations.
3. **Clean Token Economics**: Compact ANSI terminal output consuming **50 ~ 200 tokens**, engineered for AI agents to instantly comprehend and self-heal in a single turn.

---

## When to Use This Skill

Activate this skill when:
- **Architecture Verification**: You or the user want to check if the codebase complies with its architectural design.
- **Pre-PR / Pre-Commit Inspection**: Reviewing code changes before merging to prevent architectural decay.
- **Refactoring & Modularity**: Investigating circular dependencies, layer violations, or unwanted couplings.
- **Adopting a New / Legacy Project**: Running "Reverse X-Ray" (`init`) to automatically deduce architecture topology and invariants.
- **Establishing CI Gates**: Setting up GitHub Actions or pre-push gates with strict exit code enforcement.
- **Fixing Drift Violations**: An agent receives a drift violation error from `sextant-drift check` and needs to resolve it cleanly.

---

## Quick Command Reference

All commands run via `npx sextant-drift` (or `node ./packages/cli/dist/bin/sextant-drift.js` in this repo):

| Command | Purpose | When to Use |
| :--- | :--- | :--- |
| `npx sextant-drift check [dir]` | Run architectural drift gate | CI pipelines, pre-commit, agent verification |
| `npx sextant-drift init [dir]` | Reverse X-Ray: auto-generate config | Cold start on new or legacy projects |
| `npx sextant-drift baseline [dir]` | Snapshot debts into baseline | Adopting brownfield projects with existing debt |
| `npx sextant-drift report [dir]` | Generate offline HTML dual-diagram report | PR reviews, visual architecture audits |

### Common CLI Flags
- `--json`: Output machine-readable JSON for programmatic agent processing.
- `--strict`: Treat warnings (e.g. state machine missing fallbacks) as fatal errors (Exit Code 1).
- `--report [path]`: Export self-contained offline dual-diagram HTML report (`drift-report.html`).
- `--trace <path>`: Pass runtime execution trace JSON (`.sextant/trace.json`) for dynamic causality checks.
- `--config <path>`: Specify custom configuration file (default: `sextant.json` or `ARCHITECTURE.md`).
- `--baseline <path>`: Specify custom baseline file (default: `.sextant/baseline.json`).

---

## Standard Workflows

### Workflow 1: Pre-Flight Architecture Gate (`check`)

Always run the check command before completing any code change touching module boundaries:

```bash
npx sextant-drift check .
```

#### Interpreting Exit Codes
- **`0` (Clean / Passed)**: No architectural drifts detected, or all existing issues are exempt in baseline.
- **`1` (Drift Detected)**: New architectural violations found. **You must fix them before proceeding.**
- **`2` (Fatal Error)**: Configuration syntax error, missing file, or broken AST parser.

---

### Workflow 2: Cold Start on an Existing Project (`init`)

When entering a repository without a `sextant.json`:

1. Run the Reverse X-Ray scanner:
   ```bash
   npx sextant-drift init .
   ```
2. Inspect the generated `sextant.json` and `ARCHITECTURE.md` (with embedded Mermaid diagram).
3. Review component boundaries with the human engineer or refine component mappings in 30 seconds.
4. Run `npx sextant-drift check .` to verify.

---

### Workflow 3: Brownfield Adoption with Baseline (`baseline`)

If an existing legacy codebase already has architectural debts and you want to prevent **new** decay without blocking current delivery:

1. Snapshot historical violations:
   ```bash
   npx sextant-drift baseline .
   ```
2. Commit `.sextant/baseline.json` into Git.
3. Future `check` runs enforce the **"No New Drift"** policy: historical debts are exempted, but any newly introduced drift immediately triggers Exit Code 1.

---

### Workflow 4: Visual PR Review Report (`--report`)

To provide an executive visual inspection artifact for humans in PR reviews:

```bash
npx sextant-drift check . --report drift-report.html
```

Open `drift-report.html` in any browser. It is 100% self-contained (zero network dependencies, inline CSS and Mermaid renderer) with side-by-side Target vs Actual diagrams and collapsible violation cards.

---

## Violation Diagnosis & Self-Healing Playbook

When `sextant-drift check` reports a violation, use this playbook to diagnose and fix it:

### 1. `[CRITICAL_BYPASS]` (跨层越界)
- **Symptom**: Presentation/UI component directly imports Infrastructure/DB component, skipping Domain/Service layer.
- **Root Cause**: Developer or AI took a shortcut and bypassed intermediate business logic layers.
- **Remediation**:
  1. Move the data access or driver logic from Presentation into the appropriate Service or Repository.
  2. Have Presentation call Domain Service; have Domain Service call Repository.
  3. Remove the direct import from the upper layer.

### 2. `[CRITICAL_INVERSION]` (逆向依赖)
- **Symptom**: Lower-layer component (e.g. Business Domain or Infrastructure) imports an upper-layer component (e.g. Controller or CLI).
- **Root Cause**: Inverted dependency coupling. Lower levels should never know about upper delivery mechanisms.
- **Remediation**:
  1. Apply **Dependency Inversion Principle (DIP)**: Define an interface or type in the lower layer or a shared `contracts` layer.
  2. Have the upper layer implement the interface.
  3. Pass dependencies via constructor parameters or dependency injection.

### 3. `[CRITICAL_CYCLE]` (循环依赖)
- **Symptom**: Component A imports Component B, which directly or indirectly imports Component A (`A -> B -> A`).
- **Root Cause**: Circular coupling creates runtime `undefined` import bugs and prevents independent testing.
- **Remediation**:
  1. Identify the shared types or utility functions causing the cycle.
  2. Extract the shared logic into a leaf utility/contract module that both components can import.
  3. Alternatively, decouple using event emitter, callbacks, or dependency injection.

### 4. `[CRITICAL_FORBIDDEN_IMPORT]` (违规导入)
- **Symptom**: Component imports a prohibited external package (e.g. `@prisma/client`, `pg`, `mysql2`, or `fs` in presentation).
- **Root Cause**: Breaking encapsulation or leaking infrastructure concerns.
- **Remediation**:
  1. Encapsulate all driver/database interactions inside the designated repository/infrastructure layer.
  2. Export clean domain models instead of database client handles.

### 5. `[INVARIANT_BROKEN]` (语义不变量违例)
- **Symptom**: Function execution fails an AST pattern rule (e.g. `auth.verify` must precede `db.save`, or missing timeout configuration).
- **Root Cause**: Critical business order or non-functional safety guard omitted.
- **Remediation**:
  1. Read the rule description and hint in the error snippet.
  2. Ensure the required preceding call (`must_precede`) is executed before the target call in the same scope.
  3. If missing configuration (`require_config`), add `{ timeout: ... }` to the options parameter.

### 6. `[STATE_DEADLOCK]` & `[STATE_MISSING_FALLBACK]` (状态机缺陷)
- **Symptom**: Mermaid state diagram in documentation contains a black hole state (in-degree $\ge 1$, out-degree $= 0$) or an async pending state lacking timeout/failure transitions.
- **Root Cause**: Incomplete state machine modeling leaving systems prone to hanging.
- **Remediation**:
  1. Add an exit transition from the deadlocked state to `[*]` (terminal state) or an error state.
  2. For `Pending`/`Waiting` states, add explicit `--> Failed: error / timeout` fallbacks.

### 7. `[DYNAMIC_OUT_OF_ORDER]` (运行时因果偏航)
- **Symptom**: Dynamic execution trace shows an operation (e.g. `PaymentGateway.charge`) was initiated before a preceding mandatory operation (e.g. `OrderRepo.save`) finished.
- **Root Cause**: Missing `await`, broken Promise chaining, or out-of-order event emitter dispatch.
- **Remediation**:
  1. Verify async execution flow. Ensure `await this.repo.save()` resolves before calling external network endpoints.

---

## Spec Authoring Standards

For detailed DSL and architecture specifications, consult:
- [`references/invariants-dsl.md`](./references/invariants-dsl.md): Complete Invariant DSL syntax and examples.
- [`references/remediation-patterns.md`](./references/remediation-patterns.md): Concrete TypeScript refactoring patterns.
