import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadBaseline,
  saveBaseline,
  diffWithBaseline,
} from '../../src/baseline/manager.js';
import { ViolationEvidence } from '../../src/types/report.js';

describe('Baseline Manager & Exemption Diffing (ADR-006)', () => {
  let tmpDir: string;
  let baselineFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-baseline-test-'));
    baselineFile = path.join(tmpDir, '.sextant', 'baseline.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should return null when baseline file does not exist', () => {
    const result = loadBaseline(baselineFile);
    expect(result).toBeNull();
  });

  it('should save violations to baseline file and load them accurately', () => {
    const violations: ViolationEvidence[] = [
      {
        id: 'V1',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'Direct DB access from Controller',
        sourceFile: 'src/controllers/order.ts',
        line: 45,
        column: 1,
        snippet: "import { repo } from '../repos/order';",
        sourceComponent: 'OrderCtrl',
        targetComponent: 'OrderRepo',
      },
      {
        id: 'V2',
        type: 'INVARIANT_BROKEN',
        severity: 'critical',
        message: 'Must persist before charge',
        sourceFile: 'src/controllers/order.ts',
        line: 80,
        column: 5,
        snippet: 'payment.charge()',
        enclosingFunction: 'checkout',
        targetCall: 'payment.charge',
        ruleId: 'PERSIST_BEFORE_CHARGE',
      },
    ];

    const saved = saveBaseline(baselineFile, violations);
    expect(saved.totalExemptions).toBe(2);
    expect(fs.existsSync(baselineFile)).toBe(true);

    const loaded = loadBaseline(baselineFile);
    expect(loaded).not.toBeNull();
    expect(loaded!.totalExemptions).toBe(2);
    expect(loaded!.fingerprints[0].type).toBe('CRITICAL_BYPASS');
    expect(loaded!.fingerprints[1].type).toBe('INVARIANT_BROKEN');
  });

  it('should exempt matching historical debts and only report new drifts', () => {
    const oldViolation: ViolationEvidence = {
      id: 'OLD_V',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'Historical bypass',
      sourceFile: 'src/controllers/order.ts',
      line: 45,
      column: 1,
      snippet: "import { repo } from '../repos/order';",
      sourceComponent: 'OrderCtrl',
      targetComponent: 'OrderRepo',
    };

    const baseline = saveBaseline(baselineFile, [oldViolation]);

    // Scenario A: Same violation but shifted line numbers (inserted blank lines)
    const shiftedOldViolation: ViolationEvidence = {
      ...oldViolation,
      line: 95, // shifted
      snippet: "  import { repo } from '../repos/order';  ", // formatted
    };

    const diff1 = diffWithBaseline([shiftedOldViolation], baseline);
    expect(diff1.newViolations).toHaveLength(0);
    expect(diff1.exemptions).toHaveLength(1);
    expect(diff1.resolvedFingerprints).toHaveLength(0);

    // Scenario B: Old violation + 1 Brand new violation
    const brandNewViolation: ViolationEvidence = {
      id: 'NEW_V',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'New bypass into user repo',
      sourceFile: 'src/controllers/user.ts',
      line: 10,
      column: 1,
      snippet: "import { userRepo } from '../repos/user';",
      sourceComponent: 'UserCtrl',
      targetComponent: 'UserRepo',
    };

    const diff2 = diffWithBaseline([shiftedOldViolation, brandNewViolation], baseline);
    expect(diff2.newViolations).toHaveLength(1);
    expect(diff2.newViolations[0].sourceComponent).toBe('UserCtrl');
    expect(diff2.exemptions).toHaveLength(1);
    expect(diff2.resolvedFingerprints).toHaveLength(0);

    // Scenario C: Old violation was resolved (fixed by developer)
    const diff3 = diffWithBaseline([], baseline);
    expect(diff3.newViolations).toHaveLength(0);
    expect(diff3.exemptions).toHaveLength(0);
    expect(diff3.resolvedFingerprints).toHaveLength(1);
  });
});
