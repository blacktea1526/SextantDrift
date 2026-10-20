import { describe, expect, it } from 'vitest';
import { C4GraphData } from '@sextant/core';
import { renderC4ContainerSvg, renderC4Svg } from '../src/c4-svg-renderer.js';

describe('@sextant/web-report C4 diagram visual style contract', () => {
  const graphData: C4GraphData = {
    systemName: 'Checkout Platform',
    containers: [
      { id: 'UI', name: 'Presentation', order: 1, status: 'compliant', componentIds: ['CartView'] },
      { id: 'Domain', name: 'Domain', order: 2, status: 'compliant', componentIds: ['OrderService'] },
      { id: 'Infra', name: 'Infrastructure', order: 3, status: 'drift', componentIds: ['OrderRepo'] },
    ],
    nodes: [
      {
        id: 'CartView',
        name: 'Cart View',
        layerId: 'UI',
        paths: ['src/views/**'],
        fileCount: 4,
        status: 'compliant',
        violationCount: 0,
      },
      {
        id: 'OrderService',
        name: 'Order Service',
        layerId: 'Domain',
        paths: ['src/services/**'],
        fileCount: 7,
        status: 'compliant',
        violationCount: 0,
      },
      {
        id: 'OrderRepo',
        name: 'Order Repository',
        layerId: 'Infra',
        paths: ['src/repos/**'],
        fileCount: 5,
        status: 'drift',
        violationCount: 1,
      },
    ],
    edges: [
      { id: 'CartView->OrderService', from: 'CartView', to: 'OrderService', status: 'compliant' },
      { id: 'CartView->OrderRepo', from: 'CartView', to: 'OrderRepo', status: 'drift', type: 'bypass' },
    ],
    containerEdges: [
      { id: 'UI->Domain', from: 'UI', to: 'Domain', status: 'compliant' },
      { id: 'UI->Infra', from: 'UI', to: 'Infra', status: 'drift', type: 'bypass' },
    ],
    targetEdges: [],
    actualEdges: [],
  };

  it('renders compact decluttered cards on soft lavender groups while preserving drift colors', () => {
    const { svg, nodePositions } = renderC4Svg(graphData, 'unified', {} as any);

    expect(svg).toContain('fill="#EEF2FF"');
    expect(svg).toContain('stroke="#C7D2FE"');
    expect(svg).toContain('class="node-port source-port');
    expect(svg).toContain('class="node-port target-port');
    expect(svg).toContain('class="node-icon-disc"');
    expect(svg).toContain('fill="#F5F3FF"');
    expect(svg).toContain('stroke="#7C3AED"');
    expect(svg).toContain('<rect width="100%" height="100%" fill="none" />');
    expect(svg).toMatch(/>\s*L1\s*</);
    expect(svg).toMatch(/>\s*L2\s*</);
    expect(svg).toContain('<desc>LAYER 1</desc>');

    expect(svg).toContain('stroke="#16A34A"');
    expect(svg).toContain('stroke="#DC2626"');
    expect(svg).toContain('fill="#DC2626"');
    expect(svg).toMatch(/source-port compliant" cx="597\.8" cy="196"/);
    expect(svg).toMatch(/target-port compliant" cx="680" cy="376"/);
    expect(svg).not.toContain('cx="0" cy="0"');

    expect(svg).not.toContain('stroke-width="3.2"');

    expect(nodePositions.CartView.height).toBeLessThanOrEqual(92);
  });

  it('renders the container overview with the same lightweight grouped-node style', () => {
    const { svg } = renderC4ContainerSvg(graphData, 'unified', {} as any);

    expect(svg).toContain('<rect width="100%" height="100%" fill="none" />');
    expect(svg).toContain('fill="#EEF2FF"');
    expect(svg).toContain('stroke="#C7D2FE"');
    expect(svg).toContain('class="container-port source-port');
    expect(svg).toContain('class="container-icon-disc"');
    expect(svg).toMatch(/>\s*L1\s*</);
    expect(svg).toContain('<desc>LAYER 2</desc>');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke="#16A34A"');
    expect(svg).toContain('stroke="#DC2626"');

    expect(svg).not.toContain('Top Accent Stripe');
    expect(svg).not.toContain('stroke-width="3.6"');
    expect(svg).not.toContain('fill="#F0FDF4"');
    expect(svg).not.toContain('架构分层合规');
  });
});
