import { describe, expect, it } from 'vitest';
import {
  createVersionBinding, evaluateAcceptance, parseJsonSpec,
  type RunEvidence, type VersionInputs,
} from '../../src/index.js';

function project(): VersionInputs {
  return {
    sourceFiles: [{ path: 'src/order.ts', content: 'await save(); await pay();' }],
    designFiles: [{ path: 'docs/order.md', content: '# ORD-1\nSave before payment.' }],
    acceptanceFiles: [{ path: 'tests/order.test.ts', content: 'assertSavedBeforePayment();' }],
    config: parseJsonSpec(JSON.stringify({
      layers: [{ id: 'Domain', name: 'Domain', order: 1 }],
      components: [{ id: 'Order', name: 'Order', layerId: 'Domain', paths: ['src/**'] }],
      acceptance: {
        requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save'] }],
        scenarios: [{ id: 'checkout' }],
        checks: [{ id: 'save', scenarioId: 'checkout', testFile: 'tests/order.test.ts',
          testName: 'checkout saves before payment', required: true }],
      },
    })),
  };
}

function run(input: VersionInputs): RunEvidence {
  const versions = createVersionBinding(input);
  return {
    runId: 'integration-run', versionsBefore: versions, versionsAfter: versions, complete: true,
    checks: [{ checkId: 'save', scenarioId: 'checkout', testFile: 'tests/order.test.ts',
      testName: 'checkout saves before payment', status: 'PASS' }],
  };
}

function confirmSyntheticFixture(input: VersionInputs): void {
  const versions = createVersionBinding(input);
  // Test-only metadata exercises matching; no repository business asset is confirmed here.
  input.config.acceptance!.confirmation = {
    confirmedBy: 'synthetic-test-reviewer', designHash: versions.designHash,
    acceptanceHash: versions.acceptanceHash, configHash: versions.configHash,
  };
}

describe('public acceptance model integration', () => {
  it('keeps a candidate unverified and accepts complete evidence after matching synthetic confirmation', () => {
    const input = project();
    const evidence = run(input);
    const context = { runId: evidence.runId, versions: createVersionBinding(input) };
    expect(evaluateAcceptance(input.config.acceptance!, context, evidence).status).toBe('UNVERIFIED');
    confirmSyntheticFixture(input);
    expect(createVersionBinding(input)).toEqual(context.versions);
    expect(evaluateAcceptance(input.config.acceptance!, context, evidence).status).toBe('PASS');
  });

  it('requires fresh execution after a source edit without requiring semantic reconfirmation', () => {
    const input = project();
    confirmSyntheticFixture(input);
    const oldEvidence = run(input);
    input.sourceFiles[0].content = 'await persistOrder(); await chargePayment();';
    const context = { runId: oldEvidence.runId, versions: createVersionBinding(input) };
    expect(evaluateAcceptance(input.config.acceptance!, context, oldEvidence).status).toBe('UNVERIFIED');
    expect(evaluateAcceptance(input.config.acceptance!, context, run(input)).status).toBe('PASS');
  });

  it.each(['design', 'acceptance', 'config'] as const)
    ('requires semantic reconfirmation after a %s edit even with fresh passing evidence', kind => {
      const input = project();
      confirmSyntheticFixture(input);
      if (kind === 'design') input.designFiles[0].content += '\nNo duplicate charges.';
      if (kind === 'acceptance') input.acceptanceFiles[0].content += '\nassertSingleCharge();';
      if (kind === 'config') input.config.acceptance!.requirements[0].designRef = 'docs/order.md#revised';
      const evidence = run(input);
      expect(evaluateAcceptance(input.config.acceptance!, {
        runId: evidence.runId, versions: createVersionBinding(input),
      }, evidence).status).toBe('UNVERIFIED');
    });
});
