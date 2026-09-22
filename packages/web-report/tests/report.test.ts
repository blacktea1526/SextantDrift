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
    },
    graphData: {
      systemName: 'Test Ecommerce App',
      containers: [
        { id: 'UI', name: 'Presentation', order: 1, status: 'drift', componentIds: ['OrderCtrl'] },
        { id: 'Domain', name: 'Domain', order: 2, status: 'compliant', componentIds: [] },
        { id: 'Infra', name: 'Infra', order: 3, status: 'drift', componentIds: ['OrderRepo'] },
      ],
      nodes: [
        {
          id: 'OrderCtrl',
          name: 'Order Controller',
          layerId: 'UI',
          paths: ['src/controllers/**'],
          fileCount: 3,
          status: 'drift',
          violationCount: 1,
        },
        {
          id: 'OrderRepo',
          name: 'Order Repository',
          layerId: 'Infra',
          paths: ['src/repos/**'],
          fileCount: 2,
          status: 'drift',
          violationCount: 1,
        },
      ],
      edges: [
        {
          id: 'OrderCtrl->OrderRepo',
          from: 'OrderCtrl',
          to: 'OrderRepo',
          status: 'drift',
          type: 'bypass',
          violations: ['V1'],
        },
      ],
      targetEdges: [],
      actualEdges: [
        {
          id: 'OrderCtrl->OrderRepo',
          from: 'OrderCtrl',
          to: 'OrderRepo',
          status: 'drift',
          type: 'bypass',
          violations: ['V1'],
        },
      ],
    },
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

  it('should generate Chinese-first report by default with brand vector logo, native C4 SVG, and decluttering', () => {
    const html = generateHtmlReport(baseReport);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('lang="zh-CN"');
    expect(html).toContain('SextantDrift');
    expect(html).toContain('架构差分审查报告');
    expect(html).toContain('发现 1 处架构偏航与违规');

    // Vector Brand SVG Logo
    expect(html).toContain('class="brand-logo-icon"');
    expect(html).toContain('viewBox="0 0 40 40"');

    // Completely Zero External Mermaid CDN Dependency
    expect(html).not.toContain('mermaid.min.js');
    expect(html).not.toContain('<pre class="mermaid">');

    // Native C4 Architecture Canvas & Diff View
    expect(html).toContain('id="unified-panel"');
    expect(html).toContain('id="unified-canvas"');
    expect(html).toContain('class="c4-canvas c4-mode-unified"');
    expect(html).toContain('🌟 规划与现实同图差分');
    expect(html).toContain('C4 ARCHITECTURE X-RAY');

    // C4 Inspector Drawer
    expect(html).toContain('id="c4-inspector"');
    expect(html).toContain('C4 架构组件审查面板');

    // Clutter Filter & Component Isolation
    expect(html).toContain('btn-toggle-contracts-unified');
    expect(html).toContain('过滤底层契约连线');
    expect(html).toContain('comp-isolate-select-unified');
    expect(html).toContain('聚焦指定组件...');

    // Violation details
    expect(html).toContain('OrderCtrl <span class="flow-arrow">➔</span> OrderRepo');
    expect(html).toContain('src/controllers/order.ts:47:1');
    expect(html).toContain("import { OrderRepo } from &#039;../repos/order&#039;;");
    expect(html).toContain('Historical Exemptions (1 debts snapshot in baseline)');

    // In-browser language toggle button
    expect(html).toContain('btn-lang-toggle');
    expect(html).toContain('🌐 English');
  });

  it('should generate English report when options.lang is "en"', () => {
    const html = generateHtmlReport(baseReport, { lang: 'en' });

    expect(html).toContain('lang="en"');
    expect(html).toContain('Architecture Drift Report');
    expect(html).toContain('1 ARCHITECTURAL DRIFT(S) DETECTED');
    expect(html).toContain('All Violations (1)');
    expect(html).toContain('Critical Only (1)');
    expect(html).toContain('Warning Only (0)');
    expect(html).toContain('Copy AI Fix Prompt');
    expect(html).toContain('⚡ Motion: ON');
    expect(html).toContain('🌐 中文');
    expect(html).toContain('C4 Component Inspector');
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

    const zhHtml = generateHtmlReport(cleanReport, { lang: 'zh' });
    expect(zhHtml).toContain('架构验证通过（零偏航）');
    expect(zhHtml).toContain('所有代码模块依赖均严格符合目标架构拓扑与不变量规范。');

    const enHtml = generateHtmlReport(cleanReport, { lang: 'en' });
    expect(enHtml).toContain('ARCHITECTURE VERIFIED');
    expect(enHtml).toContain('All modules and dependencies conform strictly to target topology');
  });

  it('should dynamically generate native C4 architecture with containers and swimlanes when graphData is absent', () => {
    const reportWithoutGraphData: any = {
      ...baseReport,
      graphData: undefined,
    };
    const html = generateHtmlReport(reportWithoutGraphData);
    expect(html).toContain('c4-container-group');
    expect(html).toContain('LAYER 1');
    expect(html).toContain('Presentation');
    expect(html).toContain('Domain');
    expect(html).toContain('Infra');
    expect(html).toContain('diff-legend-bar');
    expect(html).not.toContain('mermaid.min.js');
  });

  it('should render C4 Level 2 Container Overview and level switcher controls', () => {
    const html = generateHtmlReport(baseReport);
    expect(html).toContain('id="btn-level-container"');
    expect(html).toContain('id="btn-level-component"');
    expect(html).toContain('id="unified-container-view"');
    expect(html).toContain('id="unified-component-view"');
    expect(html).toContain('c4-container-canvas');
    expect(html).toContain('container-filter-bar');
    expect(html).toContain('function setC4Level(');
    expect(html).toContain('function drillDownContainer(');
    expect(html).toContain('function filterByContainer(');
  });

  it('should inject Web Motion dynamic flows, radar beacons, accessibility rules, and toggle button', () => {
    const html = generateHtmlReport(baseReport);

    // Motion Toggle Button
    expect(html).toContain('id="btn-toggle-motion"');
    expect(html).toContain('⚡ 动效: 开启');
    expect(html).toContain('function toggleMotionFx(');

    // Dynamic Edge Flow Keyframes & Classes
    expect(html).toContain('@keyframes c4-flow-green');
    expect(html).toContain('@keyframes c4-flow-drift');
    expect(html).toContain('@keyframes c4-drift-glow');
    expect(html).toContain('c4-edge.compliant');
    expect(html).toContain('c4-edge.drift');

    // Radar Beacon & Card Flash
    expect(html).toContain('@keyframes c4-radar-ping');
    expect(html).toContain('@keyframes c4-card-flash');
    expect(html).toContain('.c4-radar-beacon');

    // Accessibility & Motion Disable controls
    expect(html).toContain('body.motion-disabled');
    expect(html).toContain('@media (prefers-reduced-motion: reduce)');

    // Smooth Camera & View Transitions
    expect(html).toContain('.panzoom-canvas.smooth-camera');
    expect(html).toContain('.c4-view-transition');
  });

  it('should render high-clarity double-bezel cards, domain role icons, and sub-component chips gallery', () => {
    const html = generateHtmlReport(baseReport);

    // Double-bezel top accent stripe and SVG precision
    expect(html).toContain('shape-rendering: geometricPrecision');
    expect(html).toContain('c4-components-layer');
    expect(html).toContain('c4-subcomponent-chip');

    // Domain role icons in component and container cards
    expect(html).toContain('⚡'); // Order Controller API/Controller icon
    expect(html).toContain('🗄️'); // Order Repository Infra/Database icon
    expect(html).toContain('🖥️'); // UI / Presentation Container icon

    // Level 2 Sub-Component Chips with status dots
    expect(html).toContain('包含组件 (1):');
    expect(html).toContain('Order Controller');
    expect(html).toContain('Order Repository');

    // Outer gutter orthogonal/bezier routing
    expect(html).toContain('c4-container-edges-layer');
  });
});
