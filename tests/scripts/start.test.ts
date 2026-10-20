import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const rootDir = path.resolve(__dirname, '../../');
const startShPath = path.resolve(rootDir, 'start.sh');
const ciYmlPath = path.resolve(rootDir, '.github/workflows/ci.yml');

const req = createRequire(path.resolve(rootDir, 'packages/core/package.json'));
const YAML = req('yaml');

describe('R0: start.sh & CI Script Verification', () => {
  let tempDir: string;
  let binDir: string;
  let pnpmBin: string;
  let pnpmLog: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-r0-test-'));
    binDir = path.join(tempDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    // Setup fake local pnpm at node_modules/.bin/pnpm inside temp project
    const pnpmDir = path.join(tempDir, 'node_modules', '.bin');
    fs.mkdirSync(pnpmDir, { recursive: true });
    pnpmBin = path.join(pnpmDir, 'pnpm');
    pnpmLog = path.join(tempDir, 'pnpm.log');

    fs.writeFileSync(
      pnpmBin,
      `#!/usr/bin/env bash
echo "$@" >> "${pnpmLog}"
exit \${STUB_PNPM_EXIT_CODE:-0}
`,
      { mode: 0o755 }
    );

    // Setup stub node
    const nodeStub = path.join(binDir, 'node');
    fs.writeFileSync(
      nodeStub,
      `#!/usr/bin/env bash
if [ "$1" = "-v" ]; then
  echo "v20.0.0"
  exit 0
fi

for arg in "$@"; do
  if [[ "$arg" == *"drifted-bypass-app"* ]]; then
    exit \${STUB_DRIFTED_EXIT_CODE:-1}
  fi
done

exit 0
`,
      { mode: 0o755 }
    );

    // Copy start.sh to tempDir
    const tempStartSh = path.join(tempDir, 'start.sh');
    fs.copyFileSync(startShPath, tempStartSh);
    fs.chmodSync(tempStartSh, 0o755);

    // Create fake dist file so start.sh check doesn't need to rebuild unless intended
    const fakeCliDistDir = path.join(tempDir, 'packages', 'cli', 'dist', 'bin');
    fs.mkdirSync(fakeCliDistDir, { recursive: true });
    fs.writeFileSync(path.join(fakeCliDistDir, 'sextant-drift.js'), '#!/usr/bin/env node\n');
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Requirement 3: Help text updates', () => {
    it('should list all 4 packages under --build and remove outdated test counts under --test', () => {
      const res = spawnSync('bash', [path.join(tempDir, 'start.sh'), '--help'], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      });

      expect(res.status).toBe(0);
      const output = res.stdout;

      // 1. Should list all four packages in --build
      expect(output).toContain('@sextant/core');
      expect(output).toContain('sextant-drift');
      expect(output).toContain('@sextant/mcp-server');
      expect(output).toContain('@sextant/web-report');

      // 2. Should remove outdated hardcoded suite & test counts
      expect(output).not.toContain('49 个套件');
      expect(output).not.toContain('250 个用例');

      // 3. Should still mention Vitest CLI
      expect(output).toContain('--test');
      expect(output).toContain('Vitest CLI');
    });
  });

  describe('Requirement 1: start.sh --build with pnpm -r run build and failure propagation', () => {
    it('should invoke pnpm -r run build across all packages and succeed when pnpm exits 0', () => {
      const res = spawnSync('bash', [path.join(tempDir, 'start.sh'), '--build'], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_PNPM_EXIT_CODE: '0',
        },
      });

      expect(res.status).toBe(0);
      expect(fs.existsSync(pnpmLog)).toBe(true);
      const logContent = fs.readFileSync(pnpmLog, 'utf-8').trim();
      expect(logContent).toBe('-r run build');
    });

    it('should propagate failure when pnpm -r run build exits non-zero', () => {
      const res = spawnSync('bash', [path.join(tempDir, 'start.sh'), '--build'], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_PNPM_EXIT_CODE: '42',
        },
      });

      expect(res.status).toBe(42);
    });
  });

  describe('Requirement 2: start.sh --check exit code verification', () => {
    it('should succeed (exit 0) when drifted fixture check exits 1 (drift intercepted)', () => {
      const res = spawnSync('bash', [path.join(tempDir, 'start.sh'), '--check'], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_DRIFTED_EXIT_CODE: '1',
        },
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain('成功');
    });

    it('should fail (exit 1) when drifted fixture check exits 0 (false negative / leak)', () => {
      const res = spawnSync('bash', [path.join(tempDir, 'start.sh'), '--check'], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_DRIFTED_EXIT_CODE: '0',
        },
      });

      expect(res.status).toBe(1);
      expect(res.stdout).toContain('未被拦截');
    });

    it('should fail when drifted fixture check exits 2 or other abnormal codes (crash / exception)', () => {
      const res = spawnSync('bash', [path.join(tempDir, 'start.sh'), '--check'], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_DRIFTED_EXIT_CODE: '2',
        },
      });

      expect(res.status).toBe(2);
      expect(res.stdout).not.toContain('成功：sextant-drift 架构门禁成功阻断');
    });
  });

  describe('Requirement 2: .github/workflows/ci.yml drifted step execution verification', () => {
    function extractCiDriftedScript(): string {
      const ciContent = fs.readFileSync(ciYmlPath, 'utf-8');
      const doc = YAML.parse(ciContent);
      const steps = doc.jobs['build-test-and-verify'].steps;
      const driftedStep = steps.find((s: any) =>
        s.name && s.name.includes('Verify Drifted Project Gate')
      );
      if (!driftedStep || !driftedStep.run) {
        throw new Error('Could not find Verify Drifted Project Gate step in ci.yml');
      }
      return driftedStep.run;
    }

    it('CI script should succeed (exit 0) when node check exits 1', () => {
      const script = extractCiDriftedScript();
      const res = spawnSync('bash', ['-e', '-c', script], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_DRIFTED_EXIT_CODE: '1',
        },
      });

      expect(res.status).toBe(0);
      expect(res.stdout).toContain('Drifted fixture was correctly blocked with exit code 1');
    });

    it('CI script should fail (exit 1) when node check exits 0 (leak)', () => {
      const script = extractCiDriftedScript();
      const res = spawnSync('bash', ['-e', '-c', script], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_DRIFTED_EXIT_CODE: '0',
        },
      });

      expect(res.status).toBe(1);
      expect(res.stdout).toContain('Drifted fixture was expected to fail but passed');
    });

    it('CI script should fail with abnormal exit code when node check exits 2', () => {
      const script = extractCiDriftedScript();
      const res = spawnSync('bash', ['-e', '-c', script], {
        encoding: 'utf-8',
        cwd: tempDir,
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
          STUB_DRIFTED_EXIT_CODE: '2',
        },
      });

      expect(res.status).toBe(2);
      expect(res.stdout).not.toContain('correctly blocked with exit code 1');
    });
  });
});
