# Tasks

## 1. Shorthand only on requirements

- [x] 1.1 Reject `flows`, `trigger`, `preconditions`, `rules`, `effects`, and `acceptance` on a non-requirement in `packages/core/src/requirements/parse.ts`, and verify a core test that a flow carrying `rules` throws `ConfigValidationError` naming that id and not `acceptance FAIL`
- [x] 1.2 Keep requirement shorthand expansion, and verify the existing redeem-graph test still has one `constrains` relation from `RULE-003` to `BR-001`

## 2. Review listing

- [x] 2.1 Make `ReviewItem.anchor` optional and set it only for code and test neighbors in `packages/core/src/requirements/impact.ts`, copying `source` only from a code entity that declared one, and verify a core test that a state neighbor has no `anchor` while a code neighbor with a path exposes that path and a code neighbor without a path has `anchor: 'missing'`
- [x] 2.2 Print the declared path for a code neighbor, `锚点缺失` only for a missing code or test anchor, and no anchor phrase for other kinds in `packages/cli/src/commands/requirements.ts`, and verify the CLI test output contains the path, contains `复核范围`, and does not contain `锚点已声明` on a state line

## 3. Visible diagram

- [x] 3.1 Render one SVG for the whole graph in `packages/web-report/src/business-requirement-svg.ts`, drawing every relation and showing the full title plus open-question text without the hardcoded module titles, and verify the web-report test that a title longer than sixteen characters and its question text appear, a cross-prefix relation is drawn, and `身份、企业与成员` is absent

## Workflow follow-up

- Archive the change after review and sync the delta into `openspec/specs/business-requirement-graph/spec.md`.
