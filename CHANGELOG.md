# Changelog

## Unreleased

- **Go**: Tier 1 static import topology. `.go` files join the module DAG through `import` declarations and `go.mod` (standard library, module packages, third-party modules, local `replace`). Layer bypass, cycles, `forbiddenImports`, and `forbid_import` invariants apply. Statement-order invariants stay on TypeScript/JavaScript.

## 2.0.3

- **MCP**: `@sextant/mcp-server` + `sextant-drift mcp` for Cursor / Claude Code / Windsurf (`check_file`, `check_drift`, `init_target`, `explain_violation`).
- **File checker**: incremental single-file drift guard (`checkFile`) for Agent / IDE workflows.
- **Python**: Tier 1 native static import topology (no longer listed as Tier 3 roadmap).
- **Publish hygiene**: `scripts/publish-to-npm.sh` refuses dirty trees unless `ALLOW_DIRTY=1`; fails on `@sextant/*` publish errors unless `CLI_ONLY=1` / `--cli-only`.
- **Docs**: refreshed test counts (65 files / 392 tests); `--trace` marked experimental (Phase 5 dynamic causality).
