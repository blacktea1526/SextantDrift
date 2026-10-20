import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { getReportScript } from '../src/scripts/report.js.js';

describe('Report diagram viewport', () => {
  it.each([
    { viewport: [1100, 480], graph: [1360, 1400] },
    { viewport: [320, 480], graph: [1240, 800] },
    { viewport: [1100, 600], graph: [200, 200] },
  ])('fits the complete graph inside $viewport without clipping', ({ viewport, graph }) => {
    const canvas = { style: { transform: '' } };
    const elements: Record<string, unknown> = {
      'unified-viewport': { getBoundingClientRect: () => ({ width: viewport[0], height: viewport[1] }) },
      'unified-c4-container-svg': { viewBox: { baseVal: { width: graph[0], height: graph[1] } } },
      'unified-canvas': canvas,
    };
    const window: { addEventListener: () => void; fitDiagram?: (key: string) => void } = { addEventListener() {} };
    const script = getReportScript({
      violationsJson: '[]', graphDataJson: '{}', contractCompIdsJson: '[]',
      dependencyMapJson: '{}', i18nJson: '{}', lang: 'en', passed: true,
    });
    runInNewContext(script, {
      window,
      document: { getElementById: (id: string) => elements[id] || null, addEventListener() {} },
      sessionStorage: { getItem: () => 'false' },
    });
    window.fitDiagram!('unified');
    const match = /translate\(([^p]+)px, ([^p]+)px\) scale\(([^)]+)\)/.exec(canvas.style.transform)!;
    const [x, y, scale] = match.slice(1).map(Number);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + graph[0] * scale).toBeLessThanOrEqual(viewport[0]);
    expect(y + graph[1] * scale).toBeLessThanOrEqual(viewport[1]);
    expect(scale).toBeLessThanOrEqual(1);
  });
});
