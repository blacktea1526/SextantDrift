import { describe, expect, it } from 'vitest';
import { evaluateAcceptance } from '../../src/acceptance/evaluate.js';
import type { AcceptanceConfig, RunEvidence, VersionBinding } from '../../src/acceptance/types.js';

const versions: VersionBinding = {
  sourceHash: 'a'.repeat(64),
  designHash: 'b'.repeat(64),
  acceptanceHash: 'c'.repeat(64),
  configHash: 'd'.repeat(64),
};

const context = { runId: 'run-1', versions };

const confirmed = {
  confirmedBy: 'human@example.com',
  designHash: versions.designHash,
  acceptanceHash: versions.acceptanceHash,
  configHash: versions.configHash,
};

const baseConfig = (overrides: Partial<AcceptanceConfig> = {}): AcceptanceConfig => ({
  requirements: [{ id: 'ORD-1', designRef: 'order-design.md#ord-1', checkIds: ['save-before-pay'] }],
  scenarios: [{ id: 'checkout' }],
  checks: [
    {
      id: 'save-before-pay',
      scenarioId: 'checkout',
      testFile: 'packages/core/tests/acceptance/order.test.ts',
      testName: 'order acceptance saves before payment',
      required: true,
    },
  ],
  confirmation: confirmed,
  ...overrides,
});

const evidence = (overrides: Partial<RunEvidence> = {}): RunEvidence => ({
  runId: context.runId,
  versionsBefore: versions,
  versionsAfter: versions,
  complete: true,
  checks: [
    {
      checkId: 'save-before-pay',
      scenarioId: 'checkout',
      testFile: 'packages/core/tests/acceptance/order.test.ts',
      testName: 'order acceptance saves before payment',
      status: 'PASS',
    },
  ],
  ...overrides,
});

describe('evaluateAcceptance', () => {
  it('passes a confirmed requirement only when a current required check passes in a complete run', () => {
    const report = evaluateAcceptance(baseConfig(), context, evidence());

    expect(report.status).toBe('PASS');
    expect(report.issues).toEqual([]);
    expect(report.requirements).toEqual([
      {
        requirementId: 'ORD-1',
        status: 'PASS',
        checks: [
          {
            checkId: 'save-before-pay',
            status: 'PASS',
            evidence: {
              checkId: 'save-before-pay',
              scenarioId: 'checkout',
              testFile: 'packages/core/tests/acceptance/order.test.ts',
              testName: 'order acceptance saves before payment',
              status: 'PASS',
            },
            issues: [],
          },
        ],
        issues: [],
      },
    ]);
  });

  it('keeps missing evidence and absent required checks unverified instead of failing', () => {
    expect(evaluateAcceptance(baseConfig(), context, undefined).status).toBe('UNVERIFIED');

    const report = evaluateAcceptance(baseConfig(), context, evidence({ checks: [] }));
    expect(report.status).toBe('UNVERIFIED');
    expect(report.requirements[0].checks[0]).toMatchObject({
      checkId: 'save-before-pay',
      status: 'UNVERIFIED',
      issues: ['Required acceptance check "save-before-pay" did not produce evidence.'],
    });
  });

  it('treats stale runs and version mismatches as unverified while preserving current failures', () => {
    const oldRun = evaluateAcceptance(baseConfig(), context, evidence({ runId: 'old-run' }));
    expect(oldRun.status).toBe('UNVERIFIED');
    expect(oldRun.issues).toContain('Evidence runId "old-run" does not match requested runId "run-1".');

    const changedDuringRun = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({ versionsAfter: { ...versions, sourceHash: 'e'.repeat(64) } }),
    );
    expect(changedDuringRun.status).toBe('UNVERIFIED');
    expect(changedDuringRun.issues).toContain('Evidence versions changed during the run.');

    const staleFailure = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({
        versionsBefore: { ...versions, acceptanceHash: 'f'.repeat(64) },
        checks: [
          {
            checkId: 'save-before-pay',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance saves before payment',
            status: 'FAIL',
          },
        ],
      }),
    );
    expect(staleFailure.status).toBe('UNVERIFIED');

    const staleError = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({
        runId: 'old-run',
        checks: [
          {
            checkId: 'save-before-pay',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance saves before payment',
            status: 'ERROR',
            message: 'old execution crashed',
          },
        ],
      }),
    );
    expect(staleError.status).toBe('UNVERIFIED');

    const currentFailure = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({
        checks: [
          {
            checkId: 'save-before-pay',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance saves before payment',
            status: 'FAIL',
            message: 'payment happened before persistence',
          },
        ],
      }),
    );
    expect(currentFailure.status).toBe('FAIL');
    expect(currentFailure.requirements[0].checks[0].issues).toContain('payment happened before persistence');
  });

  it.each([
    ['sourceHash', 'Evidence versionsBefore does not match the requested version binding.'],
    ['designHash', 'Evidence versionsBefore does not match the requested version binding.'],
    ['acceptanceHash', 'Evidence versionsBefore does not match the requested version binding.'],
    ['configHash', 'Evidence versionsBefore does not match the requested version binding.'],
  ] as const)('treats stale %s evidence as unverified', (key, issue) => {
    const report = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({
        versionsBefore: { ...versions, [key]: 'e'.repeat(64) },
        checks: [
          {
            checkId: 'save-before-pay',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance saves before payment',
            status: 'FAIL',
          },
        ],
      }),
    );

    expect(report.status).toBe('UNVERIFIED');
    expect(report.issues).toContain(issue);
    expect(report.requirements[0].checks[0]).toMatchObject({
      checkId: 'save-before-pay',
      status: 'UNVERIFIED',
    });
    expect(report.requirements[0].checks[0]).not.toHaveProperty('evidence');
  });

  it('blocks required skipped and incomplete passing checks but preserves complete current failures', () => {
    const skipped = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({ checks: [{ ...evidence().checks[0], status: 'SKIP' }] }),
    );
    expect(skipped.status).toBe('UNVERIFIED');
    expect(skipped.requirements[0].checks[0].issues).toContain(
      'Required acceptance check "save-before-pay" was skipped.',
    );

    const incompletePass = evaluateAcceptance(baseConfig(), context, evidence({ complete: false }));
    expect(incompletePass.status).toBe('UNVERIFIED');
    expect(incompletePass.issues).toContain('Evidence run did not complete.');

    const incompleteFailure = evaluateAcceptance(
      baseConfig(),
      context,
      evidence({
        complete: false,
        checks: [{ ...evidence().checks[0], status: 'FAIL', message: 'observed counterexample' }],
      }),
    );
    expect(incompleteFailure.status).toBe('FAIL');
    expect(incompleteFailure.requirements[0].checks[0].issues).toContain('observed counterexample');
  });

  it('returns error reports for malformed evidence, duplicate checks, unknown checks and identity mismatches', () => {
    expect(evaluateAcceptance(baseConfig(), context, null).status).toBe('ERROR');
    expect(evaluateAcceptance(baseConfig(), context, []).status).toBe('ERROR');
    const unknownField = evaluateAcceptance(baseConfig(), context, { ...evidence(), unexpected: true });
    expect(unknownField.status).toBe('ERROR');
    expect(unknownField.requirements[0].checks[0]).toMatchObject({
      checkId: 'save-before-pay',
      status: 'ERROR',
      issues: ['Run evidence contains unknown fields.'],
    });
    expect(
      evaluateAcceptance(baseConfig(), context, {
        ...evidence(),
        checks: [{ ...evidence().checks[0], status: { toString: () => 'PASS' } }],
      }).status,
    ).toBe('ERROR');
    expect(evaluateAcceptance(baseConfig(), null as never, undefined).status).toBe('ERROR');
    expect(
      evaluateAcceptance(baseConfig(), { ...context, versions: { ...versions, sourceHash: 'not-a-hash' } }, undefined)
        .status,
    ).toBe('ERROR');
    expect(
      evaluateAcceptance(
        baseConfig(),
        context,
        evidence({
          checks: [
            evidence().checks[0],
            { ...evidence().checks[0], status: 'FAIL' },
          ],
        }),
      ).status,
    ).toBe('ERROR');
    expect(
      evaluateAcceptance(
        baseConfig(),
        context,
        evidence({
          checks: [{ ...evidence().checks[0], checkId: 'unknown-check' }],
        }),
      ).status,
    ).toBe('ERROR');
    expect(
      evaluateAcceptance(
        baseConfig(),
        context,
        evidence({
          checks: [{ ...evidence().checks[0], testName: 'different test identity' }],
        }),
      ).status,
    ).toBe('ERROR');
  });

  it('applies status precedence across mixed requirement outcomes', () => {
    const config = baseConfig({
      requirements: [
        { id: 'ORD-1', designRef: 'order-design.md#ord-1', checkIds: ['save-before-pay'] },
        { id: 'ORD-2', designRef: 'order-design.md#ord-2', checkIds: ['release-on-fail'] },
        { id: 'ORD-3', designRef: 'order-design.md#ord-3', checkIds: ['idempotent-payment'] },
      ],
      scenarios: [{ id: 'checkout' }, { id: 'failure' }, { id: 'retry' }],
      checks: [
        baseConfig().checks[0],
        {
          id: 'release-on-fail',
          scenarioId: 'failure',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance releases inventory on payment failure',
          required: true,
        },
        {
          id: 'idempotent-payment',
          scenarioId: 'retry',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance charges only once',
          required: true,
        },
      ],
    });

    const report = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'release-on-fail',
            scenarioId: 'failure',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance releases inventory on payment failure',
            status: 'SKIP',
          },
          {
            checkId: 'idempotent-payment',
            scenarioId: 'retry',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance charges only once',
            status: 'ERROR',
            message: 'test runtime crashed',
          },
        ],
      }),
    );

    expect(report.status).toBe('ERROR');
    expect(report.requirements.map((requirement) => requirement.status)).toEqual([
      'PASS',
      'UNVERIFIED',
      'ERROR',
    ]);
  });

  it('does not allow optional checks, missing confirmation or unmapped requirements to create pass', () => {
    const optionalOnly = evaluateAcceptance(
      baseConfig({
        requirements: [{ id: 'ORD-1', designRef: 'order-design.md#ord-1', checkIds: ['save-before-pay'] }],
        checks: [{ ...baseConfig().checks[0], required: false }],
      }),
      context,
      evidence(),
    );
    expect(optionalOnly.status).toBe('UNVERIFIED');
    expect(optionalOnly.requirements[0].issues).toContain(
      'Requirement "ORD-1" has no required acceptance checks.',
    );

    const missingConfirmation = evaluateAcceptance(
      baseConfig({ confirmation: undefined }),
      context,
      evidence(),
    );
    expect(missingConfirmation.status).toBe('UNVERIFIED');
    expect(missingConfirmation.issues).toContain('Acceptance confirmation is missing or stale.');

    const confirmationMismatch = evaluateAcceptance(
      baseConfig({ confirmation: { ...confirmed, configHash: '0'.repeat(64) } }),
      context,
      evidence(),
    );
    expect(confirmationMismatch.status).toBe('UNVERIFIED');

    const unconfirmedFailure = evaluateAcceptance(
      baseConfig({ confirmation: undefined }),
      context,
      evidence({
        checks: [
          {
            checkId: 'save-before-pay',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance saves before payment',
            status: 'FAIL',
          },
        ],
      }),
    );
    expect(unconfirmedFailure.status).toBe('FAIL');

    const noMapping = evaluateAcceptance(
      baseConfig({ requirements: [{ id: 'ORD-1', designRef: 'order-design.md#ord-1', checkIds: [] }] }),
      context,
      evidence(),
    );
    expect(noMapping.status).toBe('UNVERIFIED');
  });

  it('does not let optional missing or skipped checks block a required pass', () => {
    const config = baseConfig({
      requirements: [
        { id: 'ORD-1', designRef: 'order-design.md#ord-1', checkIds: ['save-before-pay', 'optional-doc'] },
      ],
      checks: [
        baseConfig().checks[0],
        {
          id: 'optional-doc',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance documents payment order',
          required: false,
        },
      ],
    });

    const missingOptional = evaluateAcceptance(config, context, evidence());
    expect(missingOptional.status).toBe('PASS');
    expect(missingOptional.requirements[0].checks[1]).toMatchObject({
      checkId: 'optional-doc',
      status: 'UNVERIFIED',
      issues: [],
    });

    const skippedOptional = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'optional-doc',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance documents payment order',
            status: 'SKIP',
          },
        ],
      }),
    );
    expect(skippedOptional.status).toBe('PASS');
    expect(skippedOptional.requirements[0].checks[1]).toMatchObject({
      checkId: 'optional-doc',
      status: 'UNVERIFIED',
      issues: [],
    });
  });

  it.each([
    ['FAIL', 'optional counterexample', 'FAIL'],
    ['ERROR', 'optional runtime crash', 'ERROR'],
  ] as const)('lets optional current %s block its requirement explicitly', (status, message, expected) => {
    const config = baseConfig({
      requirements: [
        { id: 'ORD-1', designRef: 'order-design.md#ord-1', checkIds: ['save-before-pay', 'optional-doc'] },
      ],
      checks: [
        baseConfig().checks[0],
        {
          id: 'optional-doc',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance documents payment order',
          required: false,
        },
      ],
    });

    const report = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'optional-doc',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance documents payment order',
            status,
            message,
          },
        ],
      }),
    );

    expect(report.status).toBe(expected);
    expect(report.requirements[0].status).toBe(expected);
    expect(report.requirements[0].checks[1].issues).toContain(message);
  });

  it('reports unmapped current execution errors globally without inventing requirement evidence', () => {
    const config = baseConfig({
      checks: [
        baseConfig().checks[0],
        {
          id: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          required: false,
        },
      ],
    });

    const report = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'unmapped-runtime-error',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped helper',
            status: 'ERROR',
            message: 'helper crashed',
          },
        ],
      }),
    );

    expect(report.status).toBe('ERROR');
    expect(report.issues).toContain('Unmapped acceptance check "unmapped-runtime-error" errored: helper crashed');
    expect(report.requirements).toHaveLength(1);
    expect(report.requirements[0].status).toBe('PASS');
    expect(report.requirements[0].checks[0].evidence).toMatchObject({ checkId: 'save-before-pay' });
  });

  it('reports unmapped current failures globally without inventing requirement evidence', () => {
    const config = baseConfig({
      checks: [
        baseConfig().checks[0],
        {
          id: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          required: false,
        },
      ],
    });

    const report = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'unmapped-counterexample',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped counterexample',
            status: 'FAIL',
            message: 'counterexample outside requirement mapping',
          },
        ],
      }),
    );

    expect(report.status).toBe('FAIL');
    expect(report.issues).toContain(
      'Unmapped acceptance check "unmapped-counterexample" failed: counterexample outside requirement mapping',
    );
    expect(report.requirements[0].status).toBe('PASS');

    const stale = evaluateAcceptance(
      config,
      context,
      evidence({
        runId: 'old-run',
        checks: [
          evidence().checks[0],
          {
            checkId: 'unmapped-counterexample',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped counterexample',
            status: 'FAIL',
            message: 'old counterexample',
          },
        ],
      }),
    );
    expect(stale.status).toBe('UNVERIFIED');
  });

  it('prioritizes unmapped current errors over unmapped current failures regardless of evidence order', () => {
    const config = baseConfig({
      checks: [
        baseConfig().checks[0],
        {
          id: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          required: false,
        },
        {
          id: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          required: false,
        },
      ],
    });

    for (const checks of [
      [
        evidence().checks[0],
        {
          checkId: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          status: 'FAIL',
          message: 'counterexample outside requirement mapping',
        },
        {
          checkId: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          status: 'ERROR',
          message: 'helper crashed',
        },
      ],
      [
        evidence().checks[0],
        {
          checkId: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          status: 'ERROR',
          message: 'helper crashed',
        },
        {
          checkId: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          status: 'FAIL',
          message: 'counterexample outside requirement mapping',
        },
      ],
    ] as const) {
      const report = evaluateAcceptance(config, context, evidence({ checks }));
      expect(report.status).toBe('ERROR');
      expect(report.issues).toContain(
        'Unmapped acceptance check "unmapped-counterexample" failed: counterexample outside requirement mapping',
      );
      expect(report.issues).toContain('Unmapped acceptance check "unmapped-runtime-error" errored: helper crashed');
      expect(report.requirements[0].status).toBe('PASS');
    }
  });

  it('treats unmapped required checks as part of the run scope without inventing requirement evidence', () => {
    const config = baseConfig({
      checks: [
        baseConfig().checks[0],
        {
          id: 'unmapped-required',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped required helper',
          required: true,
        },
        {
          id: 'unmapped-optional',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped optional helper',
          required: false,
        },
      ],
    });

    const missingRequired = evaluateAcceptance(config, context, evidence());
    expect(missingRequired.status).toBe('UNVERIFIED');
    expect(missingRequired.issues).toContain(
      'Unmapped required acceptance check "unmapped-required" did not produce evidence.',
    );
    expect(missingRequired.requirements[0].status).toBe('PASS');

    const skippedRequired = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'unmapped-required',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped required helper',
            status: 'SKIP',
          },
        ],
      }),
    );
    expect(skippedRequired.status).toBe('UNVERIFIED');
    expect(skippedRequired.issues).toContain('Unmapped required acceptance check "unmapped-required" was skipped.');
    expect(skippedRequired.requirements[0].status).toBe('PASS');

    const passingRequired = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'unmapped-required',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped required helper',
            status: 'PASS',
          },
        ],
      }),
    );
    expect(passingRequired.status).toBe('PASS');

    const skippedOptional = evaluateAcceptance(
      config,
      context,
      evidence({
        checks: [
          evidence().checks[0],
          {
            checkId: 'unmapped-required',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped required helper',
            status: 'PASS',
          },
          {
            checkId: 'unmapped-optional',
            scenarioId: 'checkout',
            testFile: 'packages/core/tests/acceptance/order.test.ts',
            testName: 'order acceptance unmapped optional helper',
            status: 'SKIP',
          },
        ],
      }),
    );
    expect(skippedOptional.status).toBe('PASS');
  });

  it('combines unmapped required missing, fail, and error statuses by global precedence regardless of order', () => {
    const config = baseConfig({
      checks: [
        baseConfig().checks[0],
        {
          id: 'unmapped-required',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped required helper',
          required: true,
        },
        {
          id: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          required: false,
        },
        {
          id: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          required: false,
        },
      ],
    });

    for (const checks of [
      [
        evidence().checks[0],
        {
          checkId: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          status: 'FAIL',
          message: 'counterexample outside requirement mapping',
        },
        {
          checkId: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          status: 'ERROR',
          message: 'helper crashed',
        },
      ],
      [
        evidence().checks[0],
        {
          checkId: 'unmapped-runtime-error',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped helper',
          status: 'ERROR',
          message: 'helper crashed',
        },
        {
          checkId: 'unmapped-counterexample',
          scenarioId: 'checkout',
          testFile: 'packages/core/tests/acceptance/order.test.ts',
          testName: 'order acceptance unmapped counterexample',
          status: 'FAIL',
          message: 'counterexample outside requirement mapping',
        },
      ],
    ] as const) {
      const report = evaluateAcceptance(config, context, evidence({ checks }));
      expect(report.status).toBe('ERROR');
      expect(report.issues).toContain(
        'Unmapped required acceptance check "unmapped-required" did not produce evidence.',
      );
      expect(report.issues).toContain(
        'Unmapped acceptance check "unmapped-counterexample" failed: counterexample outside requirement mapping',
      );
      expect(report.issues).toContain('Unmapped acceptance check "unmapped-runtime-error" errored: helper crashed');
    }
  });
});
