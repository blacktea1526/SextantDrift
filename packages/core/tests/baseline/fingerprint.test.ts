import { describe, it, expect } from 'vitest';
import {
  computeViolationFingerprint,
  createBaselineFingerprint,
  normalizeSnippet,
  normalizeFilePath,
} from '../../src/baseline/fingerprint.js';
import { ViolationEvidence } from '../../src/types/report.js';

describe('Baseline AST Semantic Fingerprinting (ADR-006)', () => {
  it('should normalize file paths to forward slashes without leading ./', () => {
    expect(normalizeFilePath('.\\src\\controllers\\order.ts')).toBe('src/controllers/order.ts');
    expect(normalizeFilePath('./src/services/user.ts')).toBe('src/services/user.ts');
    expect(normalizeFilePath('/src/repos/db.ts')).toBe('src/repos/db.ts');
  });

  it('should normalize snippets by collapsing extra spaces and newlines', () => {
    const raw = `  import  {   OrderRepo  }   \n  from '../repos/order-repo';  `;
    expect(normalizeSnippet(raw)).toBe("import { OrderRepo } from '../repos/order-repo';");
  });

  it('should generate constant SHA-256 fingerprint for bypass violations regardless of line numbers', () => {
    const violationAtLine47: ViolationEvidence = {
      id: 'BYPASS_OrderController_OrderRepo_47',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'Bypass detected',
      sourceFile: 'src/controllers/order.ts',
      line: 47,
      column: 1,
      snippet: "import { OrderRepo } from '../repos/order-repo';",
      sourceComponent: 'OrderController',
      targetComponent: 'OrderRepo',
    };

    const violationAtLine89: ViolationEvidence = {
      id: 'BYPASS_OrderController_OrderRepo_89',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'Bypass detected',
      sourceFile: 'src/controllers/order.ts',
      line: 89, // Line number changed!
      column: 5,
      snippet: "  import { OrderRepo } from '../repos/order-repo';  ", // Formatting changed!
      sourceComponent: 'OrderController',
      targetComponent: 'OrderRepo',
    };

    const fp1 = computeViolationFingerprint(violationAtLine47);
    const fp2 = computeViolationFingerprint(violationAtLine89);

    expect(fp1).toBeDefined();
    expect(fp1).toHaveLength(64); // Valid SHA-256
    expect(fp1).toBe(fp2); // Must be strictly identical
  });

  it('should generate constant SHA-256 fingerprint for invariant violations regardless of line numbers', () => {
    const invariantAtLine30: ViolationEvidence = {
      id: 'INVARIANT_PERSIST_BEFORE_EXTERNAL_30_5',
      type: 'INVARIANT_BROKEN',
      severity: 'critical',
      message: 'Invariant broken',
      sourceFile: 'src/controllers/order.ts',
      line: 30,
      column: 5,
      snippet: 'await paymentClient.charge(req.body);',
      enclosingFunction: 'checkout',
      targetCall: 'paymentClient.charge',
      ruleId: 'PERSIST_BEFORE_EXTERNAL',
    };

    const invariantAtLine75: ViolationEvidence = {
      id: 'INVARIANT_PERSIST_BEFORE_EXTERNAL_75_9',
      type: 'INVARIANT_BROKEN',
      severity: 'critical',
      message: 'Invariant broken with different message',
      sourceFile: '.\\src\\controllers\\order.ts', // Windows-style path
      line: 75, // Shifted line number
      column: 9,
      snippet: '  await paymentClient.charge(req.body);  ',
      enclosingFunction: 'checkout',
      targetCall: 'paymentClient.charge',
      ruleId: 'PERSIST_BEFORE_EXTERNAL',
    };

    const fp1 = computeViolationFingerprint(invariantAtLine30);
    const fp2 = computeViolationFingerprint(invariantAtLine75);

    expect(fp1).toBe(fp2);
  });

  it('should generate different fingerprints for different functions or different rules', () => {
    const inv1: ViolationEvidence = {
      id: 'INVARIANT_1',
      type: 'INVARIANT_BROKEN',
      severity: 'critical',
      message: 'msg',
      sourceFile: 'src/controllers/order.ts',
      line: 30,
      column: 1,
      snippet: 'call()',
      enclosingFunction: 'fnA',
      targetCall: 'call',
      ruleId: 'RULE_1',
    };

    const inv2: ViolationEvidence = {
      ...inv1,
      enclosingFunction: 'fnB', // different function
    };

    const inv3: ViolationEvidence = {
      ...inv1,
      ruleId: 'RULE_2', // different rule
    };

    expect(computeViolationFingerprint(inv1)).not.toBe(computeViolationFingerprint(inv2));
    expect(computeViolationFingerprint(inv1)).not.toBe(computeViolationFingerprint(inv3));
  });

  it('should create valid structured BaselineFingerprint records', () => {
    const violation: ViolationEvidence = {
      id: 'V1',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'Bypass from UI to DB',
      sourceFile: 'src/views/User.ts',
      line: 12,
      column: 1,
      snippet: "import { db } from '../infra/db';",
      sourceComponent: 'UserView',
      targetComponent: 'DbInfra',
    };

    const record = createBaselineFingerprint(violation);
    expect(record.hash).toHaveLength(64);
    expect(record.type).toBe('CRITICAL_BYPASS');
    expect(record.sourceComponent).toBe('UserView');
    expect(record.targetComponent).toBe('DbInfra');
    expect(record.sourceFile).toBe('src/views/User.ts');
  });
});
