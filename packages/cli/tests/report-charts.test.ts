import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PALETTE,
  counterSegments,
  renderBreakdownBars,
  renderCompositionBar,
  renderCoverageGauge,
  renderSeverityDonut,
} from '../src/formatters/charts.js';
import { formatLightweightHtmlReport } from '../src/formatters/html.js';
import { DriftReport } from '@sextant/core';

describe('lightweight report SVG chart primitives', () => {
  it('renders a donut whose arc lengths are proportional to the values', () => {
    const svg = renderSeverityDonut(
      [
        { label: 'Critical', value: 3, color: DEFAULT_PALETTE.critical },
        { label: 'Warning', value: 1, color: DEFAULT_PALETTE.warning },
      ],
      'Violations'
    );

    expect(svg).toContain('<svg');
    expect(svg).toContain('>4<');
    expect(svg).toContain('aria-label="Violations"');
    // 3:1 split means the first arc owns 75% of the circumference.
    const dashes = [...svg.matchAll(/stroke-dasharray="([\d.]+) ([\d.]+)"/g)].map((m) => ({
      len: Number(m[1]),
      rest: Number(m[2]),
    }));
    expect(dashes).toHaveLength(2);
    expect(dashes[0].len / (dashes[0].len + dashes[0].rest)).toBeCloseTo(0.75, 3);
  });

  it('degrades an empty donut into a compliant ring with a zero total', () => {
    const svg = renderSeverityDonut([{ label: 'Critical', value: 0, color: DEFAULT_PALETTE.critical }], 'Violations');
    expect(svg).toContain(DEFAULT_PALETTE.compliant);
    expect(svg).not.toContain('stroke-dasharray');
    expect(svg).toContain('>0<');
  });

  it('escapes hostile series labels in the donut and the bars', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const donut = renderSeverityDonut([{ label: hostile, value: 1, color: '#000' }], 'Violations');
    expect(donut).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(donut).not.toContain('<img');

    const bars = renderBreakdownBars([{ label: hostile, value: 2, color: '#000' }]);
    expect(bars).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(bars).not.toContain('<img');
  });

  it('renders an explicit empty state instead of a chart with no data', () => {
    expect(renderBreakdownBars([], { emptyText: 'none here' })).toContain('none here');
    expect(renderCompositionBar([], { emptyText: 'nothing' })).toContain('nothing');
  });

  it('keeps small categories visible with a minimum bar width', () => {
    const html = renderBreakdownBars([
      { label: 'big', value: 100, color: '#000' },
      { label: 'tiny', value: 1, color: '#000' },
    ]);
    expect(html).toContain('width:100.00%');
    expect(html).toContain('width:3.00%');
  });

  it('reports composition percentages that add up to 100%', () => {
    const html = renderCompositionBar(
      [
        { label: 'Critical', value: 3, color: DEFAULT_PALETTE.critical },
        { label: 'Warning', value: 1, color: DEFAULT_PALETTE.warning },
      ],
      { ariaLabel: 'share' }
    );
    expect(html).toContain('75.0%');
    expect(html).toContain('25.0%');
    expect(html).toContain('width:75.000%');
  });

  it('renders a coverage gauge, switching to the danger colour below the threshold', () => {
    const low = renderCoverageGauge({
      label: 'mapping coverage',
      value: 21,
      total: 210,
    });
    expect(low).toContain('10.0');
    expect(low).toContain('21 / 210');
    expect(low).toContain('background:#DC2626');

    const healthy = renderCoverageGauge({
      label: 'mapping coverage',
      value: 200,
      total: 210,
    });
    expect(healthy).toContain('background:#16A34A');
  });

  it('clamps a coverage gauge that over-reports mapped files', () => {
    const html = renderCoverageGauge({ label: 'coverage', value: 99, total: 10 });
    expect(html).toContain('100.0');
    expect(html).toContain('10 / 10');
  });

  it('sorts counter segments descending without mutating the input', () => {
    const input = [
      { label: 'a', value: 1, color: '#000' },
      { label: 'b', value: 5, color: '#000' },
    ];
    const sorted = counterSegments(input);
    expect(sorted.map((s) => s.label)).toEqual(['b', 'a']);
    expect(input[0].label).toBe('a');
  });
});

describe('lightweight HTML report charts integration', () => {
  const baseReport: DriftReport = {
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
        { id: 'CartView', name: 'Cart View', layerId: 'UI', paths: ['src/views/**'] },
      ],
      allowDependencies: [{ from: 'UI', to: 'Domain' }],
    },
    graphData: undefined as never,
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
        suggestion: 'Call OrderService instead.',
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
        targetComponent: 'Repo',
      },
      {
        id: 'V3',
        type: 'CRITICAL_INVERSION',
        severity: 'critical',
        message: 'Repo imports a domain service',
        sourceFile: 'src/repos/order.ts',
        line: 8,
        column: 1,
        snippet: 'import { PricingService }',
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
    exemptions: [
      { id: 'X1', type: 'CRITICAL_BYPASS', severity: 'warning', message: 'Historical debt', sourceFile: 'legacy.ts', line: 1, column: 1, snippet: '' },
    ],
    summary: {
      totalFiles: 210,
      totalDependencies: 648,
      totalViolations: 5,
      exemptedViolations: 1,
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

  it('embeds the offline chart dashboard with severity, category and coverage plots', () => {
    const html = formatLightweightHtmlReport(baseReport, { lang: 'zh' });

    expect(html).toContain('class="charts-grid"');
    expect(html).toContain('chart-donut');
    expect(html).toContain('严重度构成');
    expect(html).toContain('违规类型分布');
    expect(html).toContain('门禁构成');

    // Human-readable categories replace raw union identifiers.
    expect(html).toContain('跨层旁路');
    expect(html).toContain('逆向依赖');
    expect(html).toContain('缺失降级回路');
    expect(html).toContain('导入未解析');

    // Coverage gauge reports the exact deterministic counts.
    expect(html).toContain('62 / 210');
    expect(html).toContain('29.5');
  });

  it('ships zero external assets: charts are inline SVG only', () => {
    const html = formatLightweightHtmlReport(baseReport, { lang: 'zh' });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://cdn');
    expect(html).not.toContain('mermaid');
    expect(html).toContain('<svg');
  });

  it('renders the open-source edition badge and keeps the extension call to action', () => {
    const zh = formatLightweightHtmlReport(baseReport, { lang: 'zh' });
    expect(zh).toContain('开源版');
    expect(zh).toContain('@sextant/web-report');

    const en = formatLightweightHtmlReport(baseReport, { lang: 'en' });
    expect(en).toContain('Open Source');
    expect(en).toContain('Layer Bypass');
    expect(en).toContain('Violation Categories');
  });

  it('exposes severity filter chips and a search box for the violation list', () => {
    const html = formatLightweightHtmlReport(baseReport, { lang: 'zh' });
    expect(html).toContain('data-filter="all"');
    expect(html).toContain('data-filter="critical"');
    expect(html).toContain('data-filter="warning"');
    expect(html).toContain('id="violation-search"');
    expect(html).toContain('data-severity="critical"');
    expect(html).toContain('data-search=');
  });

  it('escapes hostile violation content in the lightweight report', () => {
    const hostile: DriftReport = {
      ...baseReport,
      violations: [
        {
          ...baseReport.violations[0],
          message: '</script><script>alert("xss")</script>',
          sourceComponent: '"><img src=x>',
        },
      ],
    };
    const html = formatLightweightHtmlReport(hostile, { lang: 'zh' });
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).not.toContain('<img src=x>');
  });

  it('degrades gracefully to a compliant empty state with zero violations', () => {
    const clean: DriftReport = {
      ...baseReport,
      passed: true,
      exitCode: 0,
      violations: [],
      exemptions: [],
      summary: {
        ...baseReport.summary,
        totalViolations: 0,
        newViolations: 0,
        bypassCount: 0,
        inversionCount: 0,
        unresolvedImportCount: 0,
        componentCoverage: { totalFiles: 10, mappedFiles: 10, unmappedFiles: 0, coveragePercentage: 100 },
      },
    };

    const html = formatLightweightHtmlReport(clean, { lang: 'zh' });
    expect(html).toContain('架构验证通过（零偏航）');
    expect(html).toContain('完美合规：零架构偏航');
    expect(html).toContain('未发现违规，无需归类');
    expect(html).toContain('10 / 10');
    // No filter chrome is rendered when there is nothing to filter.
    expect(html).not.toContain('id="violation-search"');
  });

  it('omits the coverage gauge when the summary has no mapping data', () => {
    const lean: DriftReport = {
      ...baseReport,
      summary: {
        totalFiles: 40,
        totalDependencies: 12,
        totalViolations: 2,
        bypassCount: 1,
        inversionCount: 0,
        cycleCount: 0,
        forbiddenImportCount: 0,
        invariantViolationCount: 0,
      },
    };
    const html = formatLightweightHtmlReport(lean, { lang: 'zh' });
    expect(html).toContain('chart-donut');
    expect(html).not.toContain('架构映射覆盖率');
  });

  it('declares dark-scheme support and print rules for offline archiving', () => {
    const html = formatLightweightHtmlReport(baseReport, { lang: 'zh' });
    expect(html).toContain('color-scheme: light dark');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('@media print');
  });
});
