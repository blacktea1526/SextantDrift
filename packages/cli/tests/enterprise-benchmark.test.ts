import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runInit } from '../src/commands/init.js';
import { runCheck } from '../src/commands/check.js';
import { EXIT_CODE_SUCCESS, EXIT_CODE_DRIFT_DETECTED } from '../src/utils/exit.js';
import { DirectedGraph } from '@sextant/core';
import { detectCycles } from '../../core/src/graph/tarjan.js';
import { extractDependenciesFromSource } from '../../core/src/analyzer/ast-extractor.js';

describe('Enterprise-Scale Architecture Benchmark & Stress Testing (Option B)', () => {
  const fixtureSrc = path.resolve(__dirname, '../../core/tests/fixtures/enterprise-shop');

  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  function copyDirRecursive(src: string, dest: string) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  it('should reverse-engineer enterprise architecture topology via runInit', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-enterprise-init-'));

    try {
      copyDirRecursive(fixtureSrc, tempDir);

      const exitCode = await runInit(tempDir, { force: true });
      expect(exitCode).toBe(EXIT_CODE_SUCCESS);

      const sextantJsonPath = path.join(tempDir, 'sextant.json');
      const architectureMdPath = path.join(tempDir, 'ARCHITECTURE.md');

      expect(fs.existsSync(sextantJsonPath)).toBe(true);
      expect(fs.existsSync(architectureMdPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(sextantJsonPath, 'utf-8'));
      expect(config.layers).toBeDefined();

      const layerIds = config.layers.map((l: any) => l.id);
      expect(layerIds).toContain('presentation');
      expect(layerIds).toContain('domain');
      expect(layerIds).toContain('infrastructure');

      // Verify layer ordering
      const pres = config.layers.find((l: any) => l.id === 'presentation');
      const dom = config.layers.find((l: any) => l.id === 'domain');
      const infra = config.layers.find((l: any) => l.id === 'infrastructure');

      expect(pres.order).toBeLessThan(dom.order);
      expect(dom.order).toBeLessThan(infra.order);

      // Verify allowDependencies between layers
      const deps = config.allowDependencies || [];
      const hasPresToDom = deps.some((d: any) => d.from === 'presentation' && d.to === 'domain');
      const hasDomToInfra = deps.some((d: any) => d.from === 'domain' && d.to === 'infrastructure');
      expect(hasPresToDom).toBe(true);
      expect(hasDomToInfra).toBe(true);

      // Verify Mermaid spec generated in ARCHITECTURE.md
      const mdContent = fs.readFileSync(architectureMdPath, 'utf-8');
      expect(mdContent).toContain('```mermaid');
      expect(mdContent).toContain('flowchart TD');
      expect(mdContent).toContain('presentation');
      expect(mdContent).toContain('domain');
      expect(mdContent).toContain('infrastructure');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should verify clean enterprise architecture with 0 false positives under 1.5s', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-enterprise-clean-'));

    try {
      copyDirRecursive(fixtureSrc, tempDir);
      await runInit(tempDir, { force: true });
      consoleLogSpy.mockClear();
      const startTime = performance.now();
      const exitCode = await runCheck(tempDir, { json: true });
      const duration = performance.now() - startTime;

      expect(exitCode).toBe(EXIT_CODE_SUCCESS);
      expect(duration).toBeLessThan(1500); // 5-second rule SLO check: < 1.5s

      const logged = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logged);

      expect(parsed.passed).toBe(true);
      expect(parsed.summary.totalFiles).toBeGreaterThanOrEqual(15);
      expect(parsed.summary.newViolations).toBe(0);
      expect(parsed.violations).toHaveLength(0);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should accurately detect intentional drifts (bypass & inversion) in enterprise project', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-enterprise-drift-'));

    try {
      copyDirRecursive(fixtureSrc, tempDir);
      await runInit(tempDir, { force: true });

      // 1. Inject Layer Bypass: Controller illegally importing Repository
      const ctrlFile = path.join(tempDir, 'src/presentation/controllers/order.controller.ts');
      const originalCtrl = fs.readFileSync(ctrlFile, 'utf-8');
      const driftedCtrl = `import { orderRepository } from '../../infrastructure/repositories/order.repo.js';\n` + originalCtrl;
      fs.writeFileSync(ctrlFile, driftedCtrl, 'utf-8');

      // 2. Inject Layer Inversion: Repository illegally importing Controller
      const repoFile = path.join(tempDir, 'src/infrastructure/repositories/user.repo.ts');
      const originalRepo = fs.readFileSync(repoFile, 'utf-8');
      const driftedRepo = `import { userController } from '../../presentation/controllers/user.controller.js';\n` + originalRepo;
      fs.writeFileSync(repoFile, driftedRepo, 'utf-8');

      consoleLogSpy.mockClear();
      const exitCode = await runCheck(tempDir, { json: true });
      expect(exitCode).toBe(EXIT_CODE_DRIFT_DETECTED);

      const logged = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logged);

      expect(parsed.passed).toBe(false);
      expect(parsed.violations.length).toBeGreaterThanOrEqual(2);

      const types = parsed.violations.map((v: any) => v.type);
      expect(types).toContain('CRITICAL_BYPASS');
      expect(types).toContain('CRITICAL_INVERSION');

      const bypass = parsed.violations.find((v: any) => v.type === 'CRITICAL_BYPASS');
      expect(bypass.sourceFile).toContain('order.controller.ts');

      const inversion = parsed.violations.find((v: any) => v.type === 'CRITICAL_INVERSION');
      expect(inversion.sourceFile).toContain('user.repo.ts');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should detect semantic invariant violation (must_precede) in enterprise business logic', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-enterprise-invariant-'));

    try {
      copyDirRecursive(fixtureSrc, tempDir);
      await runInit(tempDir, { force: true });

      // Add invariant rule to sextant.json
      const configPath = path.join(tempDir, 'sextant.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config.invariants = [
        {
          id: 'PERSIST_BEFORE_PAYMENT_CHARGE',
          severity: 'critical',
          desc: 'Must record payment in database before invoking external Stripe gateway',
          pattern: {
            must_precede: ['paymentRepository.recordPayment', '*.recordPayment'],
            target: ['stripeClient.charge', '*.charge'],
            scope: 'src/domain/services/**',
          },
        },
      ];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Invert execution order in payment.service.ts: charge before recordPayment
      const paymentServiceFile = path.join(tempDir, 'src/domain/services/payment.service.ts');
      const badCode = `
import { paymentRepository } from '../../infrastructure/repositories/payment.repo.js';
import { stripeClient } from '../../infrastructure/integrations/stripe.client.js';
import { generateUUID } from '../../common/id-generator.js';

export class PaymentService {
  async processPayment(orderId: string, amount: number) {
    const paymentId = generateUUID();
    // VIOLATION: Calling charge before recordPayment!
    const chargeResult = await stripeClient.charge({ amount, currency: 'USD', source: 'tok_visa' });
    await paymentRepository.recordPayment({ id: paymentId, orderId, amount, status: 'PENDING' });
    return { paymentId, success: chargeResult.success };
  }
}
export const paymentService = new PaymentService();
      `;
      fs.writeFileSync(paymentServiceFile, badCode, 'utf-8');

      consoleLogSpy.mockClear();
      const exitCode = await runCheck(tempDir, { json: true });
      expect(exitCode).toBe(EXIT_CODE_DRIFT_DETECTED);

      const logged = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logged);

      expect(parsed.passed).toBe(false);
      const invariantViolation = parsed.violations.find((v: any) => v.type === 'INVARIANT_BROKEN');
      expect(invariantViolation).toBeDefined();
      expect(invariantViolation.sourceFile).toContain('payment.service.ts');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should stress-test AST extraction and graph algorithms on 1000 modules with heap <= 256MB', () => {
    const nodeCount = 1000;
    const initialMemory = process.memoryUsage().heapUsed;

    const sampleModuleCode = (id: number) => `
      import { Service_${id + 1} } from './service_${id + 1}.js';
      export class Component_${id} {
        execute() {
          return Service_${id + 1};
        }
      }
    `;

    const graph = new DirectedGraph();
    const startTime = performance.now();

    // 1. Process 1000 files in memory
    for (let i = 0; i < nodeCount; i++) {
      const code = sampleModuleCode(i);
      const deps = extractDependenciesFromSource(`src/module_${i}.ts`, code);
      for (const dep of deps) {
        graph.addEdge(`Module_${i}`, dep.rawSpecifier);
      }
    }

    // 2. Tarjan SCC check
    const cycles = detectCycles(graph);
    const duration = performance.now() - startTime;

    const peakMemory = process.memoryUsage().heapUsed;
    const memoryUsedMb = (peakMemory - initialMemory) / (1024 * 1024);

    expect(duration).toBeLessThan(3000); // <= 3000ms for 1000 modules
    expect(memoryUsedMb).toBeLessThan(256); // <= 256MB heap
    expect(cycles).toBeDefined();
  });
});
