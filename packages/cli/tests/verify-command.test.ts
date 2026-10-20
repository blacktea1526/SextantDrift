import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runVerify } from '../src/commands/verify.js';
import { snapshotVerification } from '../src/verification/snapshot.js';

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function project(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-verify-command-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/app.ts'), 'export const app = true;');
  fs.writeFileSync(
    path.join(root, 'sextant.json'),
    JSON.stringify({
      layers: [{ id: 'App', name: 'App', order: 1 }],
      components: [{ id: 'App', name: 'App', layerId: 'App', paths: ['src/**'] }],
      allowDependencies: [],
    }),
  );
  return root;
}

function projectWithAcceptance(options: {
  testCode?: string;
  confirmation?: boolean;
  linkNodeModules?: boolean;
} = {}): string {
  const root = project();

  if (options.linkNodeModules !== false) {
    const workspaceNodeModules = path.resolve(__dirname, '../../../node_modules');
    fs.symlinkSync(workspaceNodeModules, path.join(root, 'node_modules'), 'junction');
  }

  fs.mkdirSync(path.join(root, 'tests'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs/order.md'), '# Order requirements\nORD-1: must save before payment');

  const testContent = options.testCode ?? `
import { test, expect } from 'vitest';
test('order acceptance saves before payment', () => {
  expect(1).toBe(1);
});
`;
  fs.writeFileSync(path.join(root, 'tests/order.test.ts'), testContent);

  const sextantConfig: any = {
    layers: [{ id: 'App', name: 'App', order: 1 }],
    components: [{ id: 'App', name: 'App', layerId: 'App', paths: ['src/**'] }],
    allowDependencies: [],
    acceptance: {
      requirements: [
        { id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['save-before-pay'] },
      ],
      scenarios: [{ id: 'checkout' }],
      checks: [
        {
          id: 'save-before-pay',
          scenarioId: 'checkout',
          testFile: 'tests/order.test.ts',
          testName: 'order acceptance saves before payment',
          required: true,
        },
      ],
    },
  };

  fs.writeFileSync(path.join(root, 'sextant.json'), JSON.stringify(sextantConfig, null, 2));

  if (options.confirmation) {
    const snap = snapshotVerification(root);
    if (snap.versions) {
      sextantConfig.acceptance.confirmation = {
        confirmedBy: 'architect',
        designHash: snap.versions.designHash,
        acceptanceHash: snap.versions.acceptanceHash,
        configHash: snap.versions.configHash,
      };
      fs.writeFileSync(path.join(root, 'sextant.json'), JSON.stringify(sextantConfig, null, 2));
    }
  }

  return root;
}

describe('verify command public output', () => {
  it('returns UNVERIFIED for old configuration without inventing acceptance', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runVerify(project(), { json: true })).toBe(3);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      status: 'UNVERIFIED',
      exitCode: 3,
      structural: { passed: true },
      acceptance: { status: 'UNVERIFIED', requirements: [] },
    });
  });

  it('keeps structural counterexamples visible without acceptance mapping', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = project();
    fs.cpSync(path.resolve(__dirname, '../../core/tests/fixtures/drifted-bypass-app'), root, { recursive: true });
    expect(await runVerify(root, { json: true })).toBe(1);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      status: 'FAIL',
      exitCode: 1,
      structural: { passed: false },
      acceptance: { status: 'UNVERIFIED' },
    });
  });

  it('reports malformed configuration as ERROR with one JSON document', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = project();
    fs.writeFileSync(path.join(root, 'sextant.json'), '{');
    expect(await runVerify(root, { json: true })).toBe(2);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({ status: 'ERROR', exitCode: 2 });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it.each(['0', '-1', 'abc', '0.5', '300001'])('rejects invalid whole-process deadline %s', async (timeout) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runVerify(project(), { json: true, timeout })).toBe(2);
    expect(JSON.parse(String(log.mock.calls[0][0])).issues).toContain(
      '--timeout must be an integer from 1 to 300000 milliseconds',
    );
  });

  it('returns PASS and exit code 0 for passing configured acceptance with valid confirmation', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({ confirmation: true });

    const exitCode = await runVerify(root, { json: true });
    if (exitCode !== 0) {
      console.error('DEBUG REPORT:', log.mock.calls[0]?.[0]);
    }
    expect(exitCode).toBe(0);
    expect(log).toHaveBeenCalledTimes(1);

    const report = JSON.parse(String(log.mock.calls[0][0]));
    expect(report.status).toBe('PASS');
    expect(report.exitCode).toBe(0);
    expect(report.structural.passed).toBe(true);
    expect(report.acceptance.status).toBe('PASS');
    expect(report.run.complete).toBe(true);
    expect(report.acceptance.requirements).toHaveLength(1);
    expect(report.acceptance.requirements[0].status).toBe('PASS');
  });

  it('returns UNVERIFIED and exit code 3 when passing acceptance lacks confirmation', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({ confirmation: false });

    const exitCode = await runVerify(root, { json: true });
    expect(exitCode).toBe(3);
    const report = JSON.parse(String(log.mock.calls[0][0]));
    expect(report.status).toBe('UNVERIFIED');
    expect(report.exitCode).toBe(3);
    expect(report.acceptance.status).toBe('UNVERIFIED');
    expect(report.acceptance.issues).toContain('Acceptance confirmation is missing or stale.');
  });

  it('returns FAIL and exit code 1 for failing assertion', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({
      confirmation: true,
      testCode: `
import { test, expect } from 'vitest';
test('order acceptance saves before payment', () => {
  expect(1).toBe(2);
});
`,
    });

    const exitCode = await runVerify(root, { json: true });
    expect(exitCode).toBe(1);
    const report = JSON.parse(String(log.mock.calls[0][0]));
    expect(report.status).toBe('FAIL');
    expect(report.exitCode).toBe(1);
    expect(report.acceptance.status).toBe('FAIL');
    expect(report.run.complete).toBe(true);
  });

  it('returns ERROR and exit code 2 when test throws runtime error', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({
      confirmation: true,
      testCode: `
import { test } from 'vitest';
test('order acceptance saves before payment', () => {
  throw new Error('infrastructure explosion');
});
`,
    });

    const exitCode = await runVerify(root, { json: true });
    expect(exitCode).toBe(2);
    const report = JSON.parse(String(log.mock.calls[0][0]));
    expect(report.status).toBe('ERROR');
    expect(report.exitCode).toBe(2);
    expect(report.acceptance.status).toBe('ERROR');
  });

  it('returns ERROR and exit code 2 on process timeout without false PASS', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({
      confirmation: true,
      testCode: `
import { test } from 'vitest';
test('order acceptance saves before payment', async () => {
  await new Promise(r => setTimeout(r, 2000));
});
`,
    });

    const exitCode = await runVerify(root, { json: true, timeout: 200 });
    expect(exitCode).toBe(2);
    const report = JSON.parse(String(log.mock.calls[0][0]));
    expect(report.status).toBe('ERROR');
    expect(report.exitCode).toBe(2);
    expect(report.run.complete).toBe(false);
  });

  it('returns UNVERIFIED when version mutates during run', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({
      confirmation: true,
      testCode: `
import { test, expect } from 'vitest';
import fs from 'node:fs';
test('order acceptance saves before payment', () => {
  // Mutate source during test execution
  fs.writeFileSync('src/app.ts', 'export const app = false; // mutated');
  expect(1).toBe(1);
});
`,
    });

    const exitCode = await runVerify(root, { json: true });
    expect(exitCode).toBe(3);
    const report = JSON.parse(String(log.mock.calls[0][0]));
    expect(report.status).toBe('UNVERIFIED');
    expect(report.exitCode).toBe(3);
    expect(report.issues).toEqual(expect.arrayContaining([expect.stringContaining('changed during the run')]));
  });

  it('verifies command JSON shape conforms to contract', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const root = projectWithAcceptance({ confirmation: true });

    await runVerify(root, { json: true });
    const report = JSON.parse(String(log.mock.calls[0][0]));

    expect(report).toHaveProperty('status');
    expect(report).toHaveProperty('exitCode');
    expect(report).toHaveProperty('structural');
    expect(report).toHaveProperty('acceptance');
    expect(report).toHaveProperty('versions');
    expect(report).toHaveProperty('run');
    expect(report).toHaveProperty('issues');

    expect(report.structural).toHaveProperty('passed');
    expect(report.acceptance).toHaveProperty('status');
    expect(report.acceptance).toHaveProperty('requirements');
    expect(report.versions).toHaveProperty('sourceHash');
    expect(report.versions).toHaveProperty('designHash');
    expect(report.versions).toHaveProperty('acceptanceHash');
    expect(report.versions).toHaveProperty('configHash');
    expect(report.run).toHaveProperty('runId');
    expect(report.run).toHaveProperty('runDir');
    expect(report.run).toHaveProperty('complete');
    expect(report.run).toHaveProperty('durationMs');
  });
});
