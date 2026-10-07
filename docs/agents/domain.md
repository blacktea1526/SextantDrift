# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root (create lazily via `/domain-modeling` when terms are resolved)
- **`docs/decisions/`**: ADRs for this repo live here (not `docs/adr/`). Read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront.

## File structure

Single-context layout for this monorepo (packages share one product language):

```
/
├── GLOSSARY.md                 ← optional, lazy
├── docs/decisions/             ← ADRs (ADR-001 …)
├── docs/agents/                ← skill config (this folder)
├── packages/
│   ├── core/
│   ├── cli/
│   ├── web-report/
│   └── mcp-server/
└── .scratch/                   ← local issue tracker
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
