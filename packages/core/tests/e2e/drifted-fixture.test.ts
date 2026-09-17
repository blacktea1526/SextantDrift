import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeModuleDrift } from '../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('E2E: Drifted Bypass App Fixture (Negative Test)', () => {
  const fixtureDir = path.resolve(__dirname, '../fixtures/drifted-bypass-app');

  it('should capture all 5 architectural and invariant violations with 100% accuracy, exact line numbers, and exitCode 1', async () => {
    const report = await analyzeModuleDrift({
      rootDir: fixtureDir,
    });

    // 1. Overall report status
    expect(report.passed).toBe(false);
    expect(report.exitCode).toBe(1);
    expect(report.violations).toHaveLength(5);
    expect(report.summary.totalViolations).toBe(5);
    expect(report.summary.bypassCount).toBe(1);
    expect(report.summary.inversionCount).toBe(1);
    expect(report.summary.cycleCount).toBe(1);
    expect(report.summary.forbiddenImportCount).toBe(1);
    expect(report.summary.invariantViolationCount).toBe(1);

    // 2. Exact assertion on CRITICAL_FORBIDDEN_IMPORT
    const forbiddenViolation = report.violations.find((v) => v.type === 'CRITICAL_FORBIDDEN_IMPORT');
    expect(forbiddenViolation).toBeDefined();
    expect(forbiddenViolation?.sourceFile).toContain('src/controllers/user.controller.ts');
    expect(forbiddenViolation?.line).toBe(1);
    expect(forbiddenViolation?.snippet).toContain("import { PrismaClient } from '@prisma/client'");
    expect(forbiddenViolation?.sourceComponent).toBe('Controller');

    // 3. Exact assertion on CRITICAL_BYPASS
    const bypassViolation = report.violations.find((v) => v.type === 'CRITICAL_BYPASS');
    expect(bypassViolation).toBeDefined();
    expect(bypassViolation?.sourceFile).toContain('src/controllers/user.controller.ts');
    expect(bypassViolation?.line).toBe(2);
    expect(bypassViolation?.snippet).toContain("import { UserRepo } from '../repos/user.repo.js'");
    expect(bypassViolation?.sourceComponent).toBe('Controller');
    expect(bypassViolation?.targetComponent).toBe('Repo');

    // 4. Exact assertion on CRITICAL_INVERSION
    const inversionViolation = report.violations.find((v) => v.type === 'CRITICAL_INVERSION');
    expect(inversionViolation).toBeDefined();
    expect(inversionViolation?.sourceFile).toContain('src/services/service-b/index.ts');
    expect(inversionViolation?.line).toBe(2);
    expect(inversionViolation?.snippet).toContain("import { UserController } from '../../controllers/user.controller.js'");
    expect(inversionViolation?.sourceComponent).toBe('ServiceB');
    expect(inversionViolation?.targetComponent).toBe('Controller');

    // 5. Exact assertion on CRITICAL_CYCLE
    const cycleViolation = report.violations.find((v) => v.type === 'CRITICAL_CYCLE');
    expect(cycleViolation).toBeDefined();
    expect(cycleViolation?.cycle).toBeDefined();
    expect(cycleViolation?.message).toContain('ServiceA');
    expect(cycleViolation?.message).toContain('ServiceB');

    // 6. Exact assertion on INVARIANT_BROKEN
    const invariantViolation = report.violations.find((v) => v.type === 'INVARIANT_BROKEN');
    expect(invariantViolation).toBeDefined();
    expect(invariantViolation?.ruleId).toBe('AUTH_BEFORE_REPO_ACCESS');
    expect(invariantViolation?.severity).toBe('critical');
    expect(invariantViolation?.sourceFile).toContain('src/controllers/user.controller.ts');
    expect(invariantViolation?.line).toBe(9);
    expect(invariantViolation?.snippet).toContain('return this.repo.findUser();');
    expect(invariantViolation?.message).toContain('AUTH_BEFORE_REPO_ACCESS');

    // 7. Actual Mermaid should highlight drift edges with DRIFT! and red style
    expect(report.actualMermaid).toContain('-.->|DRIFT!|');
    expect(report.actualMermaid).toContain('stroke:#E5484D');
  });
});
