---
name: sextant-drift
description: Detect architecture drift (layer bypass, cycle, inversion) with SextantDrift. Use when gating PRs or pre-commit for layer boundaries, healing check failures via fix-manifest, cold-starting with init reverse X-ray or baseline no-new-drift, or calling MCP check_file/check_drift.
---

# SextantDrift

Compares Target architecture (Mermaid / `sextant.json` invariants) against Actual topology from CLI AST extraction. Tier-1 languages include TypeScript/JavaScript and Python.

## When to use

- Import, layer, or module-boundary changes need a drift gate
- Check exited 1 and you must heal from a fix-manifest
- No `sextant.json` yet (init) or brownfield grandfathering (baseline)
- MCP write-guard or workspace drift check is available

Skip for pure typos or cosmetic edits that do not change imports or boundaries.

## Primary spine → stay gate-green

**gate-green** means `npx sextant-drift check .` exits **0**.

**Actual** topology comes only from CLI/AST output (or MCP tools that wrap the same engine). Never invent or self-attest Actual.

1. **Gate** — run `npx sextant-drift check .` (default `npx sextant-drift [dir]` equals `check`).
   - Done when exit code is known: `0` gate-green | `1` drift → heal | `2` config/spec fatal.
2. **Heal** (exit **1** only) — run `npx sextant-drift check . --fix-manifest`. Apply listed `fixes[].action` items only; no speculative topology changes.
   - Need a concrete fix for a listed `action`, or `action` is unknown → read [`references/remediation-patterns.md`](./references/remediation-patterns.md).
   - Done when every manifest item is addressed from the listed actions.
3. **Re-gate** — repeat step 1 until **gate-green**.
   - Exit **2** → fix `sextant.json` / paths / spec parse errors; do not invent Actual topology.
   - Editing layers, invariants, or Mermaid target → read [`references/invariants-dsl.md`](./references/invariants-dsl.md).

## Branches (take only when needed)

### init (x-ray)
No target spec yet → `npx sextant-drift init .`, human-confirm generated Target, then enter primary spine.
Done when `sextant.json` exists and is confirmed; then pursue **gate-green**.

### baseline
Brownfield grandfathering → `npx sextant-drift baseline .`, then gate.
Done when `check` is **gate-green** under No New Drift (legacy fingerprints committed).

### report
Need a visual dual-diagram artifact → `npx sextant-drift report .` (or `check` with `--report`).
Done when the HTML report path is written.

### mcp
MCP available → prefer `check_file` before write; `check_drift` for workspace gate; `init_target` for cold-start Target; `explain_violation` for remediation text.
Done when the tool result is applied and CLI/MCP gate is **gate-green** (or write aborted).
Note: `explain_violation` may use `LAYER_*` / `CIRCULAR_DEPENDENCY` aliases; CLI Fix Manifest uses `CRITICAL_*` types—map synonyms when calling explain.

### contract
API route alignment → `check` with `--contract` (auto-detects contract files when omitted).
Shadow/missing endpoints or contract edits → read [`references/api-contracts.md`](./references/api-contracts.md).
Done when contract drifts are cleared and check is **gate-green** (or exit 2 fixed in the contract/spec).

## Environment

Discover commands and flags via `npx sextant-drift --help` and `npx sextant-drift <cmd> --help`. Do not cache a flag matrix from this skill.
