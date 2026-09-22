import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyContractAlignment } from '../../src/contract/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, '../fixtures/contract-app');

describe('E2E: Contract Alignment Engine', () => {
  it('should verify clean controller against contract with 0 violations', () => {
    const result = verifyContractAlignment({
      rootDir: fixtureDir,
      contractPath: path.join(fixtureDir, 'api-contract.md'),
      files: [path.join(fixtureDir, 'clean-order.controller.ts')],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.actualEndpoints).toHaveLength(2);
  });

  it('should detect 4 violations on drifted controller with 100% actionable hints', () => {
    const result = verifyContractAlignment({
      rootDir: fixtureDir,
      contractPath: path.join(fixtureDir, 'api-contract.md'),
      files: [path.join(fixtureDir, 'drifted-order.controller.ts')],
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(4);

    const types = result.violations.map((v) => v.type);
    expect(types).toContain('CONTRACT_MISSING_ENDPOINT');
    expect(types).toContain('CONTRACT_SHADOW_ENDPOINT');
    expect(types).toContain('CONTRACT_MISSING_PARAM');
    expect(types).toContain('CONTRACT_UNHANDLED_STATUS');

    // Verify 100% actionable suggestions
    for (const v of result.violations) {
      expect(v.suggestion).toBeDefined();
      expect(typeof v.suggestion).toBe('string');
      expect(v.suggestion!.length).toBeGreaterThan(15);
    }
  });
});
