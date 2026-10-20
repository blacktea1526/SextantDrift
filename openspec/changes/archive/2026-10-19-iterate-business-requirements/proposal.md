# Proposal

## Why

The business-requirement graph can be declared and queried, but the report diagram and the review listing do not say what the graph says. Titles are cut off, open questions become a generic label, id prefixes grow module names the graph never declared, and the review command calls entities that have no anchor “锚点已声明” while hiding a declared source path. A reader cannot trust the picture or the checklist.

## What Changes

- The visible report diagram shows each entity’s full title and the same open-question text as the structured projection. It draws every declared relation, including edges that cross id prefixes. It does not add module titles, groups, or labels that are not in the graph.
- The review listing prints a code entity’s declared source path when one exists. Only a code entity without a source, or a test entity without a check id, is reported as a missing anchor. Flow, rule, event, state, and requirement neighbors stay review scope and are not described as having a declared anchor.
- **BREAKING**: A shorthand list (`flows`, `trigger`, `preconditions`, `rules`, `effects`, `acceptance`) on an entity that is not a requirement fails validation and names that entity. Today those fields are ignored.

Out of scope: requirement-level git diff, a diagram editor, code-impact proof, scanning the repository for missing anchors, and any change to architecture-check or acceptance exit semantics.

## Capabilities

### New Capabilities

### Modified Capabilities

- `business-requirement-graph`: The visible diagram must match the declared graph, the review listing must report anchors only for code and test entities, and shorthand lists are valid only on requirements.

## Impact

- `@sextant/web-report` diagram renderer and its tests. The report section still reads `businessRequirementView`; it must not invent groups.
- `@sextant/core` review-scope items and parser validation for shorthand on non-requirements.
- `sextant-drift requirements` text output. `check` and `verify` exit semantics stay as they are.
- Existing graphs that put shorthand fields only on requirements keep the same relations. Graphs that put those fields on other kinds start failing at load.
