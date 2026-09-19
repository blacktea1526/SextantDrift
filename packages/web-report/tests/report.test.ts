import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from '../src/index.js';
import { DriftReport } from '@sextant/core';

describe('@sextant/web-report Visual Inspection Report Generator', () => {
  const baseReport: DriftReport = {
    passed: false,
    exitCode: 1,
    durationMs: 42,
    targetArchitecture: {
      name: 'Test Ecommerce App',
      layers: [
        { id: 'UI', name: 'Presentation', order: 1 },
        { id: 'Domain', name: 'Domain', order: 2 },
        { id: 'Infra', name: 'Infra', order: 3 },
      ],
      components: [
        { id: 'OrderCtrl', name: 'Order Controller', layerId: 'UI', paths: ['src/controllers/**'] },
        { id: 'OrderRepo', name: 'Order Repository', layerId: 'Infra', paths: ['src/repos/**'] },
      ],
      allowDependencies: [{ from: 'UI', to: 'Domain' }, { from: 'Domain', to: 'Infra' }],
      mermaid: 'flowchart TD\n  UI --> Domain\n  Domain --> Infra',
    },
    actualMermaid: 'flowchart TD\n  OrderCtrl -.->|DRIFT!| OrderRepo',
    violations: [
      {
        id: 'V1',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'Presentation directly calls Infra bypassing Domain',
        sourceFile: 'src/controllers/order.ts',
        line: 47,
        column: 1,
        snippet: "import { OrderRepo } from '../repos/order';",
        sourceComponent: 'OrderCtrl',
        targetComponent: 'OrderRepo',
        suggestion: 'Inject and call OrderService instead of OrderRepo.',
      },
    ],
    exemptions: [
      {
        id: 'EX1',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'Historical debt in legacy payment',
        sourceFile: 'src/controllers/legacy.ts',
        line: 12,
        column: 1,
        snippet: "import { legacyDb } from '../repos/legacy';",
      },
    ],
    summary: {
      totalFiles: 15,
      totalDependencies: 38,
      totalViolations: 2,
      exemptedViolations: 1,
      newViolations: 1,
      bypassCount: 1,
      inversionCount: 0,
      cycleCount: 0,
      forbiddenImportCount: 0,
      invariantViolationCount: 0,
    },
  };

  it('should generate self-contained HTML with dual Mermaid diagrams and violation details', () => {
    const html = generateHtmlReport(baseReport);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('SextantDrift Visual Inspection Report');
    expect(html).toContain('Test Ecommerce App');
    expect(html).toContain('1 ARCHITECTURAL DRIFT(S) DETECTED');
    expect(html).toContain('flowchart TD');
    expect(html).toContain('OrderCtrl -.->|DRIFT!| OrderRepo');
    expect(html).toContain('src/controllers/order.ts:47:1');
    expect(html).toContain("import { OrderRepo } from &#039;../repos/order&#039;;");
    expect(html).toContain('Historical Exemptions (1 debts snapshot in baseline)');
    expect(html).toContain('src/controllers/legacy.ts:12');
  });

  it('should generate interactive toolbar, filter controls, and diagram cross-linking hooks', () => {
    const html = generateHtmlReport(baseReport);

    // Filter controls and search input
    expect(html).toContain('id="violationSearch"');
    expect(html).toContain('data-filter="all"');
    expect(html).toContain('data-filter="critical"');
    expect(html).toContain('Critical (1)');
    expect(html).toContain('Warning (0)');

    // AI Fix Prompt button and functionality
    expect(html).toContain('🤖 Copy AI Fix Prompt');
    expect(html).toContain('copyAiFixPrompt(');
    expect(html).toContain('showToast');
    expect(html).toContain('id="toast"');

    // Diagram cross-linking
    expect(html).toContain('locateInDiagram(');
    expect(html).toContain('data-source-component="OrderCtrl"');
    expect(html).toContain('data-target-component="OrderRepo"');
    expect(html).toContain('OrderCtrl ➔ OrderRepo');
    expect(html).toContain('Inject and call OrderService instead of OrderRepo.');
  });

  it('should generate clean verified badge when report has 0 violations', () => {
    const cleanReport: DriftReport = {
      ...baseReport,
      passed: true,
      exitCode: 0,
      violations: [],
      summary: {
        ...baseReport.summary,
        totalViolations: 0,
        newViolations: 0,
        bypassCount: 0,
      },
    };

    const html = generateHtmlReport(cleanReport);
    expect(html).toContain('ARCHITECTURE VERIFIED');
    expect(html).toContain('All modules and dependencies conform strictly to target topology');
  });
});
