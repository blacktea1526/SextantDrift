import { describe, expect, it } from 'vitest';
import { generateHtmlReport } from '../src/index.js';
import type { DriftReport, ViolationEvidence } from '@sextant/core';

const IDS = ['BR-001', 'FLOW-001', 'RULE-003', 'EVENT-002', 'STATE-001', 'TC-003', 'CODE-004'];

function report(view?: DriftReport['businessRequirementView']): DriftReport {
  return {
    passed: true,
    exitCode: 0,
    durationMs: 1,
    summary: {
      totalFiles: 1,
      totalDependencies: 0,
      totalViolations: 0,
      bypassCount: 0,
      inversionCount: 0,
      cycleCount: 0,
      forbiddenImportCount: 0,
      invariantViolationCount: 0,
    },
    violations: [],
    targetArchitecture: {
      name: 'Redeem',
      layers: [{ id: 'domain', name: 'Domain', order: 1 }],
      components: [{ id: 'svc', name: 'Service', layerId: 'domain', paths: ['src/**'] }],
      allowDependencies: [],
    },
    graphData: {
      systemName: 'Redeem',
      containers: [],
      nodes: [],
      edges: [],
      targetEdges: [],
      actualEdges: [],
    },
    businessRequirementView: view,
  };
}

function viewOf(
  entities: Array<Record<string, unknown>>,
  relations: Array<{ from: string; to: string; type: string }>,
): NonNullable<DriftReport['businessRequirementView']> {
  return {
    mermaid: `flowchart TD\n  ${relations.map((relation) => `${relation.from} -->|"${relation.type}"| ${relation.to}`).join('\n  ')}\n`,
    structured: JSON.stringify({ entities, relations }),
  };
}

function sectionOf(html: string): string {
  const start = html.indexOf('id="business-requirement-graph"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</section>', start));
}

function articles(section: string): Array<{ id: string; hidden: boolean; html: string }> {
  return [...section.matchAll(/<article class="br-view" data-focus="([^"]+)"([^>]*)>([\s\S]*?)<\/article>/g)].map(
    (match) => ({
      id: match[1],
      hidden: match[2].includes('hidden'),
      html: match[3],
    }),
  );
}

function visibleArticle(section: string): { id: string; html: string } {
  const visible = articles(section).filter((article) => !article.hidden);
  expect(visible).toHaveLength(1);
  return visible[0];
}

function indexIds(section: string): string[] {
  const start = section.indexOf('<ol class="br-index">');
  const end = section.indexOf('</ol>', start);
  return [...section.slice(start, end).matchAll(/data-focus="([^"]+)"/g)].map((match) => match[1]);
}

interface DrawnNode {
  id: string;
  column: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DrawnEdge {
  from: string;
  to: string;
  type: string;
  route: string;
  points: Array<[number, number]>;
}

function nodesOf(article: string): DrawnNode[] {
  return [
    ...article.matchAll(
      /data-entity="([^"]+)" data-column="([^"]+)" data-x="(\d+)" data-y="(\d+)" data-width="(\d+)" data-height="(\d+)"/g,
    ),
  ].map((match) => ({
    id: match[1],
    column: match[2],
    x: Number(match[3]),
    y: Number(match[4]),
    width: Number(match[5]),
    height: Number(match[6]),
  }));
}

function edgesOf(article: string): DrawnEdge[] {
  return [
    ...article.matchAll(
      /<g class="br-edge" data-from="([^"]+)" data-to="([^"]+)" data-type="([^"]+)" data-route="([^"]+)">[\s\S]*?<path d="([^"]+)"/g,
    ),
  ].map((match) => {
    const nums = [...match[5].matchAll(/-?\d+(?:\.\d+)?/g)].map((item) => Number(item[0]));
    const points: Array<[number, number]> = [];
    for (let index = 0; index + 1 < nums.length; index += 2) points.push([nums[index], nums[index + 1]]);
    return { from: match[1], to: match[2], type: match[3], route: match[4], points };
  });
}

function onBorder(point: [number, number], node: DrawnNode): boolean {
  const [x, y] = point;
  const near = (left: number, right: number) => Math.abs(left - right) <= 1;
  const withinX = x >= node.x - 1 && x <= node.x + node.width + 1;
  const withinY = y >= node.y - 1 && y <= node.y + node.height + 1;
  return withinX && withinY && (near(x, node.x) || near(x, node.x + node.width) || near(y, node.y) || near(y, node.y + node.height));
}

const star = viewOf(
  [
    { id: 'BR-001', kind: 'requirement', title: '兑换码开通会员', questions: ['旧码是否仍可兑换'] },
    { id: 'RULE-002', kind: 'rule', title: '权益叠加规则' },
    { id: 'FLOW-003', kind: 'flow', title: '兑换验证流程' },
    { id: 'BR-010', kind: 'requirement', title: '另一条需求' },
  ],
  [
    { from: 'BR-001', to: 'RULE-002', type: 'includes' },
    { from: 'FLOW-003', to: 'BR-001', type: 'implemented_by' },
  ],
);

describe('business requirement graph section', () => {
  it('renders the same default neighborhood on two generations', () => {
    const first = sectionOf(generateHtmlReport(report(star)));
    const second = sectionOf(generateHtmlReport(report(star)));
    expect(second).toBe(first);
    expect(visibleArticle(first).id).toBe('BR-001');
    expect(nodesOf(visibleArticle(first).html).map((node) => node.id)).toEqual(['BR-001', 'FLOW-003', 'RULE-002']);
    expect(first).toContain('data-entity-count="4"');
    expect(first).toContain('data-max-neighbors="2"');
    expect(Number(first.match(/data-svg-bytes="(\d+)"/)?.[1])).toBeGreaterThan(0);
  });

  it('shows each focus with exactly its incoming and outgoing neighbors, keeping edge direction', () => {
    const section = sectionOf(generateHtmlReport(report(star)));
    const expected = new Map<string, string[]>([
      ['BR-001', ['FLOW-003', 'RULE-002']],
      ['RULE-002', ['BR-001']],
      ['FLOW-003', ['BR-001']],
      ['BR-010', []],
    ]);
    const declared = new Set(['BR-001|RULE-002|includes', 'FLOW-003|BR-001|implemented_by']);

    for (const article of articles(section)) {
      const nodes = nodesOf(article.html);
      expect(nodes.filter((node) => node.id !== article.id).map((node) => node.id).sort()).toEqual(
        [...(expected.get(article.id) ?? [])].sort(),
      );
      for (const edge of edgesOf(article.html)) {
        expect(declared.has(`${edge.from}|${edge.to}|${edge.type}`)).toBe(true);
        expect(edge.from === article.id || edge.to === article.id).toBe(true);
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        expect(from && to).toBeTruthy();
        expect(onBorder(edge.points[0], from!)).toBe(true);
        expect(onBorder(edge.points[edge.points.length - 1], to!)).toBe(true);
      }
    }
    const focus = visibleArticle(section).html;
    expect(focus).toContain('data-from="BR-001" data-to="RULE-002" data-type="includes"');
    expect(focus).toContain('data-from="FLOW-003" data-to="BR-001" data-type="implemented_by"');
  });

  it('keeps kind columns and routes same-column edges beside the cards', () => {
    const section = sectionOf(generateHtmlReport(report(viewOf(
      [
        { id: 'RULE-003', kind: 'rule', title: '焦点规则' },
        { id: 'RULE-009', kind: 'rule', title: '同列规则' },
        { id: 'BR-001', kind: 'requirement', title: '兑换需求' },
        { id: 'TC-007', kind: 'test', title: '重复兑换测试' },
      ],
      [
        { from: 'RULE-003', to: 'RULE-009', type: 'affects' },
        { from: 'BR-001', to: 'RULE-003', type: 'includes' },
        { from: 'RULE-003', to: 'TC-007', type: 'verified_by' },
      ],
    ))));
    const article = articles(section).find((item) => item.id === 'RULE-003');
    expect(article).toBeTruthy();
    const nodes = nodesOf(article!.html);
    const columnX = (column: string) => nodes.find((node) => node.column === column)!.x;
    expect(columnX('requirement')).toBeLessThan(columnX('activity'));
    expect(columnX('activity')).toBeLessThan(columnX('evidence'));
    expect(nodes.filter((node) => node.column === 'activity').map((node) => node.id)).toEqual(['RULE-003', 'RULE-009']);

    const side = edgesOf(article!.html).find((edge) => edge.type === 'affects')!;
    const channel = edgesOf(article!.html).filter((edge) => edge.type !== 'affects');
    expect(side.route).toBe('side');
    const sideNode = nodes.find((node) => node.id === 'RULE-003')!;
    expect(side.points.some(([x]) => x < sideNode.x)).toBe(true);
    expect(side.points.every(([x]) => x >= sideNode.x - 80 && x <= sideNode.x + sideNode.width)).toBe(true);
    const top = Math.min(...nodes.map((node) => node.y));
    for (const edge of channel) {
      expect(edge.route).toBe('channel');
      expect(edge.points.some(([, y]) => y < top)).toBe(true);
    }
  });

  it('orders requirements by numeric id and kinds before numbers', () => {
    const section = sectionOf(generateHtmlReport(report(viewOf(
      [
        { id: 'BR-10', kind: 'requirement', title: '十' },
        { id: 'EVENT-002', kind: 'event', title: '事件二' },
        { id: 'BR-2', kind: 'requirement', title: '二' },
        { id: 'BR-NOTE', kind: 'requirement', title: '无编号' },
        { id: 'RULE-003', kind: 'rule', title: '规则三' },
        { id: 'BR-002', kind: 'requirement', title: '零二' },
        { id: 'FLOW-010', kind: 'flow', title: '流程十' },
      ],
      [
        { from: 'BR-002', to: 'FLOW-010', type: 'includes' },
        { from: 'BR-002', to: 'RULE-003', type: 'includes' },
        { from: 'BR-002', to: 'EVENT-002', type: 'includes' },
      ],
    ))));
    expect(indexIds(section)).toEqual(['BR-002', 'BR-2', 'BR-10', 'BR-NOTE']);
    expect(visibleArticle(section).id).toBe('BR-002');
    const activity = nodesOf(visibleArticle(section).html).filter((node) => node.column === 'activity');
    expect(activity.map((node) => node.id)).toEqual(['FLOW-010', 'RULE-003', 'EVENT-002']);
    expect(section).not.toContain('<script');
    expect(articles(section).filter((article) => !article.hidden)).toHaveLength(1);
  });

  it('still draws the other neighbors when an anchor is missing', () => {
    const section = sectionOf(generateHtmlReport(report(viewOf(
      [
        { id: 'BR-001', kind: 'requirement', title: '兑换码开通会员' },
        { id: 'FLOW-001', kind: 'flow', title: '兑换流程' },
        { id: 'CODE-004', kind: 'code', title: '兑换服务' },
        { id: 'CODE-005', kind: 'code', title: '库存服务', source: 'src/store/inventory.ts' },
        { id: 'TC-003', kind: 'test', title: '重复兑换测试' },
      ],
      [
        { from: 'BR-001', to: 'FLOW-001', type: 'includes' },
        { from: 'BR-001', to: 'CODE-004', type: 'includes' },
        { from: 'BR-001', to: 'CODE-005', type: 'includes' },
        { from: 'BR-001', to: 'TC-003', type: 'verified_by' },
      ],
    ))));
    const article = visibleArticle(section).html;
    expect(article).toContain('兑换流程');
    expect(article).toContain('src/store/inventory.ts');
    expect(article).toContain('CODE-004');
    expect(article).toContain('TC-003');
    expect(article).toContain('锚点缺失');
    const code = article.slice(article.indexOf('data-entity="CODE-004"'), article.indexOf('data-entity="CODE-005"'));
    expect(code).toContain('锚点缺失');
    const flow = article.slice(article.indexOf('data-entity="FLOW-001"'), article.indexOf('</g>', article.indexOf('data-entity="FLOW-001"')));
    expect(flow).not.toContain('锚点缺失');
  });

  it('keeps the architecture verdict when the diagram is attached', () => {
    const violation = {
      id: 'V1',
      type: 'CRITICAL_BYPASS',
      severity: 'critical',
      message: 'Controller bypasses the service layer',
      sourceFile: 'src/controllers/user.controller.ts',
      line: 1,
      column: 1,
      snippet: 'import { UserService } from "../services/user.service.js";',
    } as ViolationEvidence;
    const plain = report();
    plain.passed = false;
    plain.exitCode = 1;
    plain.violations = [violation];
    const withGraph = report(star);
    withGraph.passed = false;
    withGraph.exitCode = 1;
    withGraph.violations = [violation];

    const withoutDiagram = generateHtmlReport(plain);
    const withDiagram = generateHtmlReport(withGraph);
    expect(withoutDiagram).toContain('发现 1 处架构偏航与违规');
    expect(withDiagram).toContain('发现 1 处架构偏航与违规');
    expect(withoutDiagram).toContain('Controller bypasses the service layer');
    expect(withDiagram).toContain('Controller bypasses the service layer');
    expect(withoutDiagram).not.toContain('id="business-requirement-graph"');
    expect(withDiagram).toContain('id="business-requirement-graph"');
  });

  it('reports a render error instead of dropping a relation the layout cannot place', () => {
    const source = viewOf(
      [
        { id: 'BR-001', kind: 'requirement', title: '兑换需求' },
        { id: 'GADGET-1', kind: 'gadget', title: '坏类型' },
      ],
      [{ from: 'BR-001', to: 'GADGET-1', type: 'includes' }],
    );
    const section = sectionOf(generateHtmlReport(report(source)));
    expect(section).toContain('br-render-error');
    expect(section).toContain('GADGET-1');
    expect(section).not.toContain('<svg');
    expect(section).toContain('includes');
    expect(section).toContain('data-entity-count="2"');
    expect(section).toContain('data-svg-bytes="0"');
    expect(section).toContain('data-max-neighbors="1"');
  });

  it('draws the selected requirement with its full title and question', () => {
    const title = '企业负责人承接本企业已经发布的项目需求';
    const question = '甲方可见的汇总口径尚未确认';
    const section = sectionOf(generateHtmlReport(report(viewOf(
      [
        { id: 'BR-AUTH-01', kind: 'requirement', title, questions: [question] },
        { id: 'BR-PROJ-01', kind: 'requirement', title: '发布项目需求' },
      ],
      [{ from: 'BR-AUTH-01', to: 'BR-PROJ-01', type: 'includes' }],
    ))));
    const visible = visibleArticle(section);
    expect(visible.id).toBe('BR-AUTH-01');
    expect(visible.html).toContain(title);
    expect(visible.html).toContain(question);
    expect(visible.html).toContain('includes');
    expect(section).not.toContain('身份、企业与成员');
    expect(section).not.toContain('待确认');
    expect(articles(section)).toHaveLength(2);
    expect(indexIds(section)).toEqual(['BR-AUTH-01', 'BR-PROJ-01']);
  });

  it('keeps every declared id available and omits the section when there is no graph', () => {
    const section = sectionOf(generateHtmlReport(report(viewOf(
      IDS.map((id) => ({
        id,
        kind: id.startsWith('BR-')
          ? 'requirement'
          : id.startsWith('FLOW-')
            ? 'flow'
            : id.startsWith('RULE-')
              ? 'rule'
              : id.startsWith('EVENT-')
                ? 'event'
                : id.startsWith('STATE-')
                  ? 'state'
                  : id.startsWith('TC-')
                    ? 'test'
                    : 'code',
        title: id,
      })),
      [{ from: 'RULE-003', to: 'BR-001', type: 'constrains' }],
    ))));
    for (const id of IDS) expect(section).toContain(id);
    const visible = visibleArticle(section);
    expect(visible.id).toBe('BR-001');
    expect(nodesOf(visible.html).map((node) => node.id).sort()).toEqual(['BR-001', 'RULE-003']);
    expect(section.indexOf('<svg')).toBeLessThan(section.indexOf('<pre>'));
    expect(generateHtmlReport(report())).not.toContain('id="business-requirement-graph"');
  });
});
