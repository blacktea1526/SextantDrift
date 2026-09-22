import { describe, it, expect } from 'vitest';
import { ViolationEvidence } from '../../src/types/report.js';
import {
  generateAiFixManifest,
  generateAiFixPrompt,
  estimateTokenCount,
  determineFixAction,
} from '../../src/contract/fix-manifest.js';

describe('Token-Optimized AI Fix Manifest (Gen 4)', () => {
  const sampleViolations: ViolationEvidence[] = [
    {
      id: 'CONTRACT_SHADOW_DELETE_/api/v1/orders/debug',
      type: 'CONTRACT_SHADOW_ENDPOINT',
      severity: 'critical',
      message: 'Route DELETE /api/v1/orders/debug implemented in code but not declared in contract',
      sourceFile: 'src/controllers/order.controller.ts',
      line: 28,
      column: 1,
      snippet: 'router.delete("/api/v1/orders/debug", handler)',
      suggestion: 'Remove unauthorized route DELETE /api/v1/orders/debug or declare it in api-contract.md.',
    },
    {
      id: 'CONTRACT_PARAM_MISSING_POST_/api/v1/orders_currency',
      type: 'CONTRACT_MISSING_PARAM',
      severity: 'critical',
      message: "Required parameter 'currency' is missing from handler",
      sourceFile: 'src/controllers/order.controller.ts',
      line: 12,
      column: 1,
      snippet: 'router.post("/api/v1/orders", (req, res) => ...)',
      suggestion: "Add required parameter 'currency' to route handler (e.g. @Body('currency') or req.body.currency).",
    },
    {
      id: 'BYPASS_CONTROLLER_TO_REPO',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'Layer bypass: Presentation layer directly imports Infrastructure repository',
      sourceFile: 'src/controllers/user.controller.ts',
      line: 4,
      column: 1,
      snippet: 'import { UserRepository } from "../infra/user.repo.js"',
      sourceComponent: 'UserController',
      targetComponent: 'UserRepository',
      suggestion: 'Inject UserService from domain layer instead of directly accessing UserRepository.',
    },
  ];

  it('should determine appropriate concise actions for different drift types', () => {
    expect(determineFixAction('CONTRACT_SHADOW_ENDPOINT')).toBe('REMOVE_ROUTE');
    expect(determineFixAction('CONTRACT_MISSING_ENDPOINT')).toBe('IMPLEMENT_ROUTE');
    expect(determineFixAction('CONTRACT_MISSING_PARAM')).toBe('ADD_PARAM');
    expect(determineFixAction('CONTRACT_UNHANDLED_STATUS')).toBe('HANDLE_STATUS');
    expect(determineFixAction('CONTRACT_LINT_ERROR')).toBe('FIX_SPEC');
    expect(determineFixAction('CRITICAL_BYPASS')).toBe('REMOVE_BYPASS');
    expect(determineFixAction('CRITICAL_CYCLE')).toBe('BREAK_CYCLE');
  });

  it('should generate ultra-compact YAML manifest without noisy boilerplate', () => {
    const manifest = generateAiFixManifest(sampleViolations);

    expect(manifest).toContain('# SextantDrift AI Fix Manifest');
    expect(manifest).toContain('fixes:');
    expect(manifest).toContain('file: src/controllers/order.controller.ts:28');
    expect(manifest).toContain('action: REMOVE_ROUTE');
    expect(manifest).toContain('file: src/controllers/user.controller.ts:4');
    expect(manifest).toContain('action: REMOVE_BYPASS');

    // Ensure no redundant verbose JSON fields
    expect(manifest).not.toContain('"fingerprint"');
    expect(manifest).not.toContain('"column"');
    expect(manifest).not.toContain('"traceId"');
  });

  it('should achieve > 70% token savings compared to full diagnostic report', () => {
    const fullReportPayload = {
      passed: false,
      summary: { totalFiles: 140, totalViolations: 3, newViolations: 3 },
      violations: sampleViolations.map((v) => ({
        ...v,
        fingerprint: 'sha256_9876543210abcdef9876543210abcdef98765432',
        column: 1,
        ruleId: 'TEST_RULE_ID',
        ruleDesc: 'Detailed description of the rule that was broken in system architecture',
        enclosingFunction: 'createOrderHandler',
      })),
      graphData: { nodes: [{ id: 'a' }, { id: 'b' }], edges: [] },
      actualMermaid: 'graph TD\n  UserController --> UserRepository',
    };

    const rawJson = JSON.stringify(fullReportPayload, null, 2);
    const manifest = generateAiFixManifest(sampleViolations);

    const jsonTokens = estimateTokenCount(rawJson);
    const manifestTokens = estimateTokenCount(manifest);

    const savingsPercent = Math.round(((jsonTokens - manifestTokens) / jsonTokens) * 100);
    expect(savingsPercent).toBeGreaterThanOrEqual(70);
  });

  it('should generate a ready-to-paste AI prompt wrapper', () => {
    const prompt = generateAiFixPrompt(sampleViolations);

    expect(prompt).toContain('Please resolve the following 3 architectural & contract drifts');
    expect(prompt).toContain('```yaml');
    expect(prompt).toContain('fixes:');
    expect(prompt).toContain('```');
  });

  it('should handle empty violations gracefully', () => {
    const manifest = generateAiFixManifest([]);
    expect(manifest).toContain('# SextantDrift AI Fix Manifest');
    expect(manifest).toContain('fixes: []');
  });
});
