# Verification runner (R4 prototype)

`sextant-drift verify [dir] --json --timeout 10000` runs a fresh structural gate and the exact acceptance checks declared in `sextant.json`. `--config <path>` selects another specification. The timeout is the entire child-test-process deadline in milliseconds (1–300000), including startup. It is independent of the structural `check` command and its 0/1/2 exit contract.

| Exit | Status | Meaning |
| --- | --- | --- |
| 0 | PASS | Structural gate passes and current, confirmed acceptance evidence is complete and passing. |
| 1 | FAIL | A structural counterexample or current acceptance assertion fails. |
| 2 | ERROR | Invalid configuration, inconsistent evidence, unsupported runtime or execution failure. |
| 3 | UNVERIFIED | Required evidence or confirmation is missing/skipped/stale, or inputs change during execution. |

Combined priority is ERROR, FAIL, UNVERIFIED, PASS. JSON retains `structural`, `acceptance`, current `versions`, run metadata and `issues`. Test locations are test locations. An old configuration without acceptance yields UNVERIFIED, while a structural violation remains FAIL. Structural baseline exemptions never waive acceptance failures. This command does not write confirmation metadata.

## Execution scope

The prototype supports a project-local **Vitest 2.1.x** and Node environment. Install it in the target project using that project's normal dependency management. The adapter resolves the project's installation; it never downloads a runner or executes commands embedded in design documents. Core remains framework independent.

A generated, dedicated Vitest configuration selects the files in the mapping, uses isolated fork workers and fixes runner/reporter settings. Project Vitest configurations, workspace selection, custom environments and plugins are not imported. Acceptance tests must therefore work in this explicit Node configuration. Unsupported retries, repeats and expected-failure modes are execution errors rather than a way to mask a counterexample.

Each invocation creates `.sextant/verification/runs/<UUID>/`. Actual worker results are written atomically with run, scenario, check and attempt identity, then checked against the final reporter inventory and completion marker. A previous run directory is never reused. Malformed, duplicate, mismatched or missing execution artifacts cannot produce PASS. The deadline terminates the child process group. Evidence directories remain available for review and may be deleted after review; do not commit sensitive fixture data.

A passing test proves only the assertions it actually executes. Public port wrappers may observe invocation, success/failure completion, final persisted fixture state and call count. A test double completing a store operation does not establish a production database transaction's commit. This adapter does not attest hostile tests, cryptographically authenticate human confirmation or prove unseen business requirements.

## Versions and review

The CLI captures versions before execution and again afterward, including uncommitted inputs. A changed or unreadable post-run input invalidates the acceptance result. Confirmation is supplied only after independent review of the exact design, acceptance and configuration versions; successful candidate execution alone cannot produce PASS. See [the acceptance model](acceptance-model.md) for confirmation fields and pure hashing semantics.

R4 provides basic text/JSON output. Acceptance HTML views, MCP querying and release-install compatibility gates remain later roadmap stages.
