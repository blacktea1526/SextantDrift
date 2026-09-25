import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from '../src/index.js';
import { DriftReport } from '@sextant/core';

/**
 * UI-refinement contract for the Pro inspection report:
 * information hierarchy, offline analytics, dark theming and print readiness.
 */
describe('@sextant/web-report UI refinement contract', () => {
  const report: DriftReport = {
    passed: false,
    exitCode: 1,
    durationMs: 1834,
    targetArchitecture: {
      name: 'Checkout Platform',
      layers: [
        { id: 'UI', name: 'Presentation', order: 1 },
        { id: 'Domain', name: 'Domain', order: 2 },
        { id: 'Infra', name: 'Infrastructure', order: 3 },
      ],
      components: [
        { id: 'CartView', name: 'Cart View', layerId: 'UI', paths: ['src/views/**'], fileCount: 4 },
        { id: 'OrderService', name: 'Order Service', layerId: 'Domain', paths: ['src/services/**'], fileCount: 7 },
        { id: 'OrderRepo', name: 'Order Repository', layerId: 'Infra', paths: ['src/repos/**'], fileCount: 5 },
      ],
      allowDependencies: [
        { from: 'UI', to: 'Domain' },
        { from: 'Domain', to: 'Infra' },
      ],
    },
    graphData: {
      systemName: 'Checkout Platform',
      containers: [
        { id: 'UI', name: 'Presentation', order: 1, status: 'drift', componentIds: ['CartView'] },
        { id: 'Domain', name: 'Domain', order: 2, status: 'compliant', componentIds: ['OrderService'] },
        { id: 'Infra', name: 'Infrastructure', order: 3, status: 'drift', componentIds: ['OrderRepo'] },
      ],
      nodes: [
        { id: 'CartView', name: 'Cart View', layerId: 'UI', paths: ['src/views/**'], fileCount: 4, status: 'drift', violationCount: 2 },
        { id: 'OrderService', name: 'Order Service', layerId: 'Domain', paths: ['src/services/**'], fileCount: 7, status: 'compliant', violationCount: 0 },
        { id: 'OrderRepo', name: 'Order Repository', layerId: 'Infra', paths: ['src/repos/**'], fileCount: 5, status: 'drift', violationCount: 1 },
      ],
      edges: [],
      targetEdges: [],
      actualEdges: [],
    },
    violations: [
      {
        id: 'V1',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'Cart view bypasses the domain layer',
        sourceFile: 'src/views/cart.ts',
        line: 12,
        column: 1,
        snippet: 'const repo = new OrderRepo();',
        sourceComponent: 'CartView',
        targetComponent: 'OrderRepo',
        suggestion: 'Call OrderService.',
      },
      {
        id: 'V2',
        type: 'CRITICAL_BYPASS',
        severity: 'critical',
        message: 'Second bypass',
        sourceFile: 'src/views/checkout.ts',
        line: 30,
        column: 1,
        snippet: 'db.order.find()',
        sourceComponent: 'CartView',
        targetComponent: 'OrderRepo',
      },
      {
        id: 'V3',
        type: 'CRITICAL_INVERSION',
        severity: 'critical',
        message: 'Repo imports a domain service',
        sourceFile: 'src/repos/order-repo.ts',
        line: 8,
        column: 1,
        snippet: 'import { PricingService }',
        sourceComponent: 'OrderRepo',
        targetComponent: 'OrderService',
      },
      {
        id: 'V4',
        type: 'WARN_UNRESOLVED_IMPORT',
        severity: 'warning',
        message: 'Unresolved import',
        sourceFile: 'src/utils/loose.ts',
        line: 3,
        column: 1,
        snippet: "import x from './missing'",
      },
      {
        id: 'V5',
        type: 'STATE_MISSING_FALLBACK',
        severity: 'warning',
        message: 'Missing fallback transition',
        sourceFile: 'src/state/machine.ts',
        line: 44,
        column: 1,
        snippet: 'AWAITING_PAYMENT',
      },
    ],
    exemptions: [],
    summary: {
      totalFiles: 210,
      totalDependencies: 648,
      totalViolations: 5,
      exemptedViolations: 0,
      newViolations: 5,
      bypassCount: 2,
      inversionCount: 1,
      cycleCount: 0,
      forbiddenImportCount: 0,
      invariantViolationCount: 0,
      unresolvedImportCount: 2,
      partialBarrelCount: 5,
      componentCoverage: { totalFiles: 210, mappedFiles: 62, unmappedFiles: 148, coveragePercentage: 29.52 },
    },
  };

  it('renders the architecture health overview with severity, category and visibility analytics', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });

    expect(html).toContain('id="overview-panel"');
    expect(html).toContain('架构体检总览');
    expect(html).toContain('违规严重度构成');
    expect(html).toContain('违规类型分布');
    expect(html).toContain('代码可见度覆盖');

    // Severity donut: 3 critical + 2 warning = 5 total in the hole
    expect(html).toContain('class="rpt-donut"');
    expect(html).toContain('>5<');

    // Category bars use translated core violation type names
    expect(html).toContain('跨层旁路');
    expect(html).toContain('逆向依赖');
    expect(html).toContain('缺失降级回路');
    expect(html).toContain('data-i18n="typeBypass"');

    // Visibility composition is exact: 62 mapped + 146 untraced + 2 unresolved
    expect(html).toContain('62 / 210');
    expect(html).toContain('data-i18n="visUntraced"');
    expect(html).toContain('未纳入架构追踪');
  });

  it('surfaces architecture mapping coverage as a first-class stat', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('data-i18n="statCoverage"');
    expect(html).toContain('29.5<span class="stat-unit">%</span>');
  });

  it('consolidates the C4 level, layout mode and graph actions into one control bar', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('class="control-bar"');
    expect(html).toContain('id="btn-level-container"');
    expect(html).toContain('id="btn-mode-unified"');
    expect(html).toContain('id="btn-toggle-contracts-unified"');
    expect(html).toContain('control-divider');
    // The previously duplicated chrome rows are gone.
    expect(html).not.toContain('class="view-controls-bar"');
    expect(html).not.toContain('class="c4-level-bar"');
  });

  it('keeps the diff legend but folds the drill-down hint into it', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('class="diff-legend-bar"');
    expect(html).toContain('data-i18n="legendGreen"');
    expect(html).toContain('data-i18n="legendRed"');
    expect(html).toContain('data-i18n="legendGrey"');
    expect(html).toContain('class="legend-tip"');
    expect(html).toContain('data-i18n="drillDownHint"');
  });

  it('offers a fully offline audit-evidence JSON export', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('id="btn-export-json"');
    expect(html).toContain('function exportEvidenceJson()');
    expect(html).toContain('sextant-drift-evidence.json');
    expect(html).toContain('URL.createObjectURL');
    // No network calls are introduced by the export path.
    expect(html).not.toContain('fetch(');
  });

  it('declares native colour-scheme support and ships a token-driven dark theme', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('color-scheme: light dark');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('.c4-canvas {');
    expect(html).toContain('--c4-surface: #16223A');
  });

  it('remaps neutral C4 canvas literals onto dark tokens while keeping drift reds literal', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('var(--c4-surface-alt, #F8FAFC)');
    expect(html).toContain('var(--c4-text, #0F172A)');
    expect(html).toContain('var(--c4-border, #CBD5E1)');
    // Drift semantics survive the remap untouched.
    expect(html).toContain('fill="#DC2626"');
  });

  it('ships print styles so the report can be archived as a PDF', () => {
    const html = generateHtmlReport(report, { lang: 'zh' });
    expect(html).toContain('@media print');
    expect(html).toContain('@page');
    expect(html).toContain('break-inside: avoid');
  });

  it('localises overview analytics in the English build', () => {
    const html = generateHtmlReport(report, { lang: 'en' });
    expect(html).toContain('Architecture Health Overview');
    expect(html).toContain('Severity Composition');
    expect(html).toContain('Violation Categories');
    expect(html).toContain('Code Visibility Coverage');
    expect(html).toContain('Layer Bypass');
    expect(html).toContain('Mapped into blueprint');
  });

  it('degrades analytics gracefully to a zero-drift report', () => {
    const clean: DriftReport = {
      ...report,
      passed: true,
      exitCode: 0,
      violations: [],
      summary: {
        ...report.summary,
        totalViolations: 0,
        newViolations: 0,
        bypassCount: 0,
        inversionCount: 0,
        unresolvedImportCount: 0,
        componentCoverage: { totalFiles: 10, mappedFiles: 10, unmappedFiles: 0, coveragePercentage: 100 },
      },
    };

    const html = generateHtmlReport(clean, { lang: 'zh' });
    expect(html).toContain('id="overview-panel"');
    expect(html).toContain('零偏航，无需统计');
    expect(html).toContain('零违规，无需归类');
    expect(html).toContain('100.0<span class="stat-unit">%</span>');
  });

  it('renders analytics even when the summary omits component coverage', () => {
    const lean: DriftReport = {
      ...report,
      summary: {
        totalFiles: 40,
        totalDependencies: 12,
        totalViolations: 5,
        bypassCount: 2,
        inversionCount: 1,
        cycleCount: 0,
        forbiddenImportCount: 0,
        invariantViolationCount: 0,
      },
    };

    const html = generateHtmlReport(lean, { lang: 'zh' });
    expect(html).toContain('id="overview-panel"');
    expect(html).toContain('0.0<span class="stat-unit">%</span>');
  });
});
