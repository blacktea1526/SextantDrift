import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { executeAcceptanceTests } from '../src/verification/vitest-executor.js';
import type { AcceptanceConfig } from '@sextant/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
});

function createTempProject(options: { linkVitest?: boolean; pkgJson?: Record<string, unknown> } = {}): string {
  const { linkVitest = true, pkgJson = { name: 'test-project', type: 'module' } } = options;
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-executor-test-'));
  tempDirs.push(projectDir);

  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');

  if (linkVitest) {
    const targetNodeModules = path.join(repoRoot, 'node_modules');
    const linkNodeModules = path.join(projectDir, 'node_modules');
    fs.symlinkSync(targetNodeModules, linkNodeModules, 'junction');
  }

  return projectDir;
}

describe('executeAcceptanceTests', () => {
  it('returns complete false without spawning child process when checks are empty', async () => {
    const projectDir = createTempProject();
    const acceptance: AcceptanceConfig = {
      requirements: [],
      scenarios: [],
      checks: [],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(typeof result.runId).toBe('string');
    expect(typeof result.runDir).toBe('string');
    expect(result.runDir).toContain(result.runId);
    expect(fs.existsSync(result.runDir)).toBe(true);
  });

  it('fails with ERROR when Vitest is missing in node_modules', async () => {
    const projectDir = createTempProject({ linkVitest: false });
    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'R1', designRef: 'ref', checkIds: ['chk-1'] }],
      scenarios: [{ id: 's1' }],
      checks: [
        {
          id: 'chk-1',
          scenarioId: 's1',
          testFile: 'tests/dummy.test.js',
          testName: 'dummy test',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/Vitest not found/i);
  });

  it('fails with ERROR when Vitest has unsupported version', async () => {
    const projectDir = createTempProject({ linkVitest: false });
    const nm = path.join(projectDir, 'node_modules', 'vitest');
    fs.mkdirSync(nm, { recursive: true });
    fs.writeFileSync(
      path.join(nm, 'package.json'),
      JSON.stringify({ name: 'vitest', version: '3.0.0', bin: { vitest: './vitest.mjs' } }),
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'R1', designRef: 'ref', checkIds: ['chk-1'] }],
      scenarios: [{ id: 's1' }],
      checks: [
        {
          id: 'chk-1',
          scenarioId: 's1',
          testFile: 'tests/dummy.test.js',
          testName: 'dummy test',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/unsupported vitest version/i);
  });

  it('fails with ERROR when acceptance checks have duplicate IDs or duplicate test identities', async () => {
    const projectDir = createTempProject();
    const acceptance: AcceptanceConfig = {
      requirements: [],
      scenarios: [{ id: 's1' }],
      checks: [
        {
          id: 'chk-1',
          scenarioId: 's1',
          testFile: 'tests/example.test.js',
          testName: 'example test',
          required: true,
        },
        {
          id: 'chk-1',
          scenarioId: 's1',
          testFile: 'tests/example.test.js',
          testName: 'another test',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(false);
    expect(result.checks).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('executes a passing acceptance check and returns PASS evidence in actual child process', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it, expect } from 'vitest';
describe('order acceptance', () => {
  it('saves before payment', () => {
    expect(1 + 1).toBe(2);
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]).toMatchObject({
      checkId: 'save-before-pay',
      scenarioId: 'checkout',
      testFile: 'tests/order.test.js',
      testName: 'order acceptance saves before payment',
      status: 'PASS',
    });
    expect(fs.existsSync(result.runDir)).toBe(true);
    expect(fs.existsSync(path.join(result.runDir, 'end-marker.json'))).toBe(true);
  });

  it('executes a failing assertion check and returns FAIL evidence with location', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it, expect } from 'vitest';
describe('order acceptance', () => {
  it('saves before payment', () => {
    expect(true).toBe(false);
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].status).toBe('FAIL');
    expect(result.checks[0].checkId).toBe('save-before-pay');
    expect(result.checks[0].message).toContain('expected true to be false');
    expect(result.checks[0].location).toBeDefined();
    expect(result.checks[0].location?.file).toBe('tests/order.test.js');
    expect(result.checks[0].location?.line).toBe(4);
  });

  it('handles skipped tests via reporter inventory as SKIP evidence', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it, expect } from 'vitest';
describe('order acceptance', () => {
  it.skip('saves before payment', () => {
    expect(true).toBe(true);
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]).toMatchObject({
      checkId: 'save-before-pay',
      scenarioId: 'checkout',
      testFile: 'tests/order.test.js',
      testName: 'order acceptance saves before payment',
      status: 'SKIP',
    });
  });

  it('treats arbitrary thrown runtime errors as ERROR status instead of FAIL', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it } from 'vitest';
describe('order acceptance', () => {
  it('saves before payment', () => {
    throw new Error('Database connection crashed');
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.complete).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].status).toBe('ERROR');
    expect(result.checks[0].message).toContain('Database connection crashed');
  });

  it('rejects test-level retry/repeats/fails modes with ERROR status', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it, expect } from 'vitest';
describe('order acceptance', () => {
  it('saves before payment', { retry: 2 }, () => {
    expect(1).toBe(1);
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance);

    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].status).toBe('ERROR');
    expect(result.checks[0].message).toMatch(/retry.*repeats.*not permitted/i);
    expect(result.errors.some((e) => /retry/i.test(e))).toBe(true);
  });

  it('detects and handles process timeout by killing process group and recording error', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it } from 'vitest';
describe('order acceptance', () => {
  it('saves before payment', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10000));
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const result = await executeAcceptanceTests(projectDir, acceptance, { timeoutMs: 1500 });

    expect(result.complete).toBe(false);
    expect(result.errors.some((e) => /timed out/i.test(e))).toBe(true);
  });

  it('isolates concurrent runs with separate runDirs and does not load old artifacts', async () => {
    const projectDir = createTempProject();
    const testDir = path.join(projectDir, 'tests');
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'order.test.js'),
      `import { describe, it, expect } from 'vitest';
describe('order acceptance', () => {
  it('saves before payment', () => {
    expect(1).toBe(1);
  });
});
`,
      'utf-8'
    );

    const acceptance: AcceptanceConfig = {
      requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] }],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.js',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    };

    const [run1, run2] = await Promise.all([
      executeAcceptanceTests(projectDir, acceptance),
      executeAcceptanceTests(projectDir, acceptance),
    ]);

    expect(run1.runId).not.toBe(run2.runId);
    expect(run1.runDir).not.toBe(run2.runDir);
    expect(run1.complete).toBe(true);
    expect(run2.complete).toBe(true);
    expect(fs.existsSync(run1.runDir)).toBe(true);
    expect(fs.existsSync(run2.runDir)).toBe(true);
  });
});
