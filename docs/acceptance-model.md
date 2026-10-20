# Acceptance model (R3)

This optional core API evaluates explicitly mapped test evidence. It does not run tests or prove the origin of supplied evidence. The R4 CLI [`verify` adapter](verification-runner.md) runs project-local tests and composes acceptance with the structural result. Existing architecture `check` and baseline behavior remain unchanged.

## Mapping

Add `acceptance` to `sextant.json` alongside the existing architecture fields. This example refers to a hypothetical project's test; it is not a confirmed acceptance asset:

```json
{
  "acceptance": {
    "requirements": [
      { "id": "ORD-1", "designRef": "docs/order.md#ord-1", "checkIds": ["save-before-pay"] }
    ],
    "scenarios": [{ "id": "checkout" }],
    "checks": [
      {
        "id": "save-before-pay",
        "scenarioId": "checkout",
        "testFile": "tests/order.test.ts",
        "testName": "order acceptance saves before payment",
        "required": true
      }
    ]
  }
}
```

`testName` is the exact full name including suites. The identity is the pair of project-relative POSIX file path and full name. Duplicate identities and dangling references are configuration errors. Empty mappings are valid incomplete configuration and yield UNVERIFIED. `designRef` references requirement text; core does not execute or interpret commands from Markdown. The caller must check that the referenced requirement text exists; R3 does not resolve Markdown anchors.

## Versions and confirmation

`createVersionBinding` accepts explicit UTF-8 manifests (`{path, content}[]`) for `sourceFiles`, `designFiles`, `acceptanceFiles`, plus the effective parsed architecture `config`. The caller owns complete file enumeration. An omitted input file cannot be detected by this pure function.

Manifest paths are unique project-relative POSIX paths without empty segments, `.` or `..`. Paths are sorted by UTF-8 bytes. The SHA-256 input is JSON encoding of `[path, content]` tuples; content is exact, including line endings and uncommitted edits. Paths containing `node_modules`, `.git`, `.sextant`, `dist`, `coverage`, `.omx` or `.scratch` segments are excluded. Every group must retain at least one input. Configuration hashes recursively sort object keys and preserve array order; `acceptance.confirmation` is excluded to avoid circular binding.

An external reviewer may supply `confirmation` with `confirmedBy`, `designHash`, `acceptanceHash` and `configHash`. These hashes must match the current semantic assets. Source changes require new execution evidence, but do not themselves invalidate semantic confirmation. Agents must not create a record claiming human review. Confirmation metadata and content hashes identify declared versions; they do not authenticate a human or protect against malicious fabrication.

The execution adapter must capture bindings before and after a run using the same complete scope. A changed input, an old run ID or a stale binding cannot retain PASS or FAIL. R3 accepts supplied bindings; R4 must produce them from the actual execution environment.

## Evaluation

`evaluateAcceptance(config, {runId, versions}, evidence)` returns an acceptance-only `VerificationReport`, with each requirement and mapped check retained. Structural `DriftReport` remains a separate result for later composition.

| Status | Meaning |
| --- | --- |
| PASS | Current, complete evidence passes every required check, with current semantic confirmation and at least one required check per requirement. |
| FAIL | Current valid evidence contains an observed failing check. A candidate can expose a counterexample without becoming a confirmed requirement. |
| UNVERIFIED | Required evidence is missing or skipped, the mapping is incomplete, confirmation is missing/stale, or run/version evidence is stale. |
| ERROR | Configuration/evidence is malformed, check identity is ambiguous or inconsistent, or the current executor reports an error. |

Aggregate priority is ERROR, FAIL, UNVERIFIED, PASS. Optional absent or skipped checks do not block a requirement; observed optional failures/errors still matter. An incomplete run prevents PASS while retaining valid current counterexamples. An invalid or stale payload cannot serve as a counterexample. Test assertion locations remain test locations and are not converted into application source violations. Structural baseline exemptions do not affect acceptance.

Every declared check is in the run's scope, including checks not yet mapped to a requirement. Current unmapped failures/errors affect the overall status; missing or skipped required unmapped checks prevent PASS. Their issues are reported globally while existing mapped requirement results remain visible.

The core evaluator validates supplied data, not its provenance. Worker collection, deadlines and execution isolation belong to the CLI adapter, described in [the runner contract](verification-runner.md). See [ADR-008](decisions/ADR-008-design-intent-evidence-boundary.md) for integration boundaries.
