# Design

## Context

See proposal.md for why the visible diagram and review listing diverge from the graph. The writable model stays `businessRequirements` on `sextant.json`. `projectMermaid` and `projectStructured` already keep full titles, open questions, and every relation. The HTML section draws a separate SVG in `packages/web-report/src/business-requirement-svg.ts` that truncates titles, replaces questions with “待确认”, and splits entities by a hardcoded prefix map (`AUTH`, `PROJ`, and five others). `reviewScope` sets `anchor: 'declared'` for every neighbor that is not a code entity without `source` or a test entity without `checkId`. The CLI prints that flag and never prints `item.source`. Shorthand fields are expanded only when `kind === 'requirement'`; the same fields on other kinds are dropped.

## Goals / Non-Goals

**Goals:**

- One visible SVG of the whole graph, with full titles, open-question text, and every declared edge.
- Review text that names a source path only when the graph declared one, and that uses anchor language only for code and test neighbors.
- A configuration error when shorthand appears on a non-requirement.

**Non-Goals:**

- A new group or module field on entities.
- Changing Mermaid or stable JSON as the machine projections.
- Loading Mermaid in the browser. The report stays native SVG.

## Decisions

### 1. One SVG, no prefix groups

Remove the prefix map and the per-group headings. Lay out every entity in one diagram and draw every relation, including edges whose ids would previously have been split apart.

Alternative: keep groups, but only when the graph declares them. The model has no group field, and this change does not add one. Inventing groups from id letters is the defect.

Node width and height follow the title and question text. Do not ellipsize. Kind labels such as “需求” or “规则” may stay, because they restate `kind`, which is in the graph. Relation pills keep the relation type string.

### 2. Anchor status exists only for code and test

`ReviewItem.anchor` becomes optional. Set it to `missing` or `declared` only when the neighbor is code or test. For code with a source, keep `source` as that declared path and nothing else. Other kinds omit `anchor` and `source`.

The CLI prints:

- code or test with `anchor: 'missing'`: `锚点缺失`
- code with a declared source: `锚点已声明` plus that path
- every other neighbor: id, `复核范围`, and the relation, with no anchor phrase

Alternative: keep `anchor: 'declared'` for states and teach the CLI to hide it. That leaves the structured review item claiming an anchor the entity does not have.

### 3. Parser rejects shorthand off requirements

If a non-requirement has any of `flows`, `trigger`, `preconditions`, `rules`, `effects`, or `acceptance`, throw `ConfigValidationError` naming the entity id. Do not expand those fields. Requirement shorthand stays on the existing expansion table.

The JSON Schema may still list those fields. The parser is the gate that names the entity. A schema `if/then` is not required for the error contract.

## Risks / Trade-offs

- [A large graph becomes one tall SVG] → Accept the height. Splitting by undeclared prefixes hid edges.
- [CLI lines change for current callers that expect `锚点已声明` on every row] → Update the command tests. The disclaimer line stays.
- [A graph that stuffed shorthand onto a flow starts failing load] → That data was already discarded. Failing names the entity instead of dropping the list.

## Migration Plan

No stored migration. Requirement-only shorthand graphs keep the same normalized relations. Rollback is reverting the parser, review item, CLI text, and SVG renderer together.

## Open Questions

None.
