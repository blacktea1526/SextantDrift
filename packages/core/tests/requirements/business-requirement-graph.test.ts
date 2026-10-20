import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeModuleDrift,
  parseJsonSpec,
  projectBusinessRequirements,
  reviewScope,
  ConfigValidationError,
} from '../../src/index.js';
import * as impact from '../../src/requirements/impact.js';

const IDS = ['BR-001', 'FLOW-001', 'RULE-003', 'EVENT-002', 'STATE-001', 'TC-003', 'CODE-004'];

function architecture(extra: Record<string, unknown> = {}) {
  return {
    layers: [{ id: 'domain', name: 'Domain', order: 1 }],
    components: [{ id: 'svc', name: 'Service', layerId: 'domain', paths: ['src/**'] }],
    ...extra,
  };
}

function redeemGraph(overrides: Record<string, unknown> = {}) {
  return {
    entities: [
      {
        id: 'BR-001',
        kind: 'requirement',
        title: '兑换码开通会员',
        status: 'approved',
        actor: 'user',
        flows: ['FLOW-001'],
        trigger: 'EVENT-002',
        rules: ['RULE-003', 'RULE-003'],
        effects: ['STATE-001'],
        acceptance: ['TC-003'],
      },
      { id: 'FLOW-001', kind: 'flow', title: '兑换流程' },
      {
        id: 'RULE-003',
        kind: 'rule',
        title: '权益叠加规则',
        questions: [{ text: '改为按新套餐覆盖旧权益', open: true }],
      },
      { id: 'EVENT-002', kind: 'event', title: '兑换成功' },
      { id: 'STATE-001', kind: 'state', title: '会员状态' },
      { id: 'TC-003', kind: 'test', title: '权益叠加测试', checkId: 'stack' },
      { id: 'CODE-004', kind: 'code', title: '兑换服务' },
    ],
    relations: [
      { from: 'RULE-003', to: 'STATE-001', type: 'affects' },
      { from: 'RULE-003', to: 'CODE-004', type: 'implemented_by' },
      { from: 'RULE-003', to: 'TC-003', type: 'verified_by' },
    ],
    ...overrides,
  };
}

function parseGraph(graph: Record<string, unknown> = redeemGraph(), extra: Record<string, unknown> = {}) {
  return parseJsonSpec(JSON.stringify(architecture({ businessRequirements: graph, ...extra })));
}

const acceptance = {
  requirements: [{ id: 'ORD-1', designRef: 'docs/order.md#ord-1', checkIds: ['stack'] }],
  scenarios: [{ id: 'redeem' }],
  checks: [{
    id: 'stack',
    scenarioId: 'redeem',
    testFile: 'tests/redeem.test.ts',
    testName: 'stacks benefits',
    required: true,
  }],
};

describe('business requirement graph', () => {
  it('omits the graph when configuration does not declare it', () => {
    const parsed = parseJsonSpec(JSON.stringify(architecture()));
    expect(parsed.businessRequirements).toBeUndefined();
  });

  it('rejects shorthand on a flow and does not report acceptance FAIL', () => {
    const graph = redeemGraph();
    graph.entities = graph.entities.map((entity) =>
      entity.id === 'FLOW-001' ? { ...entity, rules: ['RULE-003'] } : entity);
    expect(() => parseGraph(graph)).toThrow(ConfigValidationError);
    try {
      parseGraph(graph);
    } catch (error) {
      expect((error as Error).message).toContain('FLOW-001');
      expect((error as Error).message).not.toContain('FAIL');
    }
  });

  it('normalizes the redeem shorthand to one constrains relation', () => {
    const graph = parseGraph().businessRequirements!;
    const constrains = graph.relations.filter((relation) =>
      relation.type === 'constrains' &&
      ((relation.from === 'RULE-003' && relation.to === 'BR-001') ||
        (relation.from === 'BR-001' && relation.to === 'RULE-003')));
    expect(constrains).toEqual([{ from: 'RULE-003', to: 'BR-001', type: 'constrains' }]);
  });

  it('names the bad id when the graph is invalid and does not report acceptance FAIL', () => {
    const cases = [
      redeemGraph({
        entities: redeemGraph().entities.map((entity) =>
          entity.id === 'RULE-003' ? { ...entity, id: 'R-003' } : entity),
        relations: [],
      }),
      redeemGraph({ relations: [{ from: 'BR-001', to: 'NOPE', type: 'includes' }] }),
      redeemGraph({
        relations: [
          { from: 'RULE-003', to: 'STATE-001', type: 'affects' },
          { from: 'RULE-003', to: 'STATE-001', type: 'includes' },
        ],
      }),
      redeemGraph({
        entities: redeemGraph().entities.map((entity) =>
          entity.id === 'BR-001' ? { ...entity, trigger: 'redeem_code_submitted' } : entity),
      }),
    ];
    const names = ['R-003', 'NOPE', 'RULE-003', 'redeem_code_submitted'];
    cases.forEach((graph, index) => {
      expect(() => parseGraph(graph)).toThrow(ConfigValidationError);
      try {
        parseGraph(graph);
      } catch (error) {
        expect((error as Error).message).toContain(names[index]);
        expect((error as Error).message).not.toContain('acceptance FAIL');
      }
    });
  });

  it('projects the same ids in stable JSON and mermaid regardless of key order', () => {
    const first = parseGraph();
    const shuffled = {
      relations: [...redeemGraph().relations].reverse(),
      entities: [...redeemGraph().entities].reverse().map((entity) => {
        const copy: Record<string, unknown> = {};
        for (const key of Object.keys(entity).reverse()) copy[key] = entity[key as keyof typeof entity];
        return copy;
      }),
    };
    const second = parseGraph(shuffled);
    const left = projectBusinessRequirements(first.businessRequirements!);
    const right = projectBusinessRequirements(second.businessRequirements!);
    expect(left.structured).toBe(right.structured);
    expect(left.mermaid).toBe(right.mermaid);
    expect(left.mermaid.startsWith('flowchart TD\n')).toBe(true);
    for (const id of IDS) {
      expect(left.structured).toContain(id);
      expect(left.mermaid).toContain(id);
    }
  });

  it('shows an open question in both projections', () => {
    const view = projectBusinessRequirements(parseGraph().businessRequirements!);
    expect(view.structured).toContain('改为按新套餐覆盖旧权益');
    expect(view.mermaid).toContain('改为按新套餐覆盖旧权益');
  });

  it('lists only the direct neighbors of RULE-003 as review scope', () => {
    const graph = redeemGraph();
    graph.entities = graph.entities.map((entity) =>
      entity.id === 'BR-001' ? { ...entity, rules: undefined } : entity);
    const scope = reviewScope(parseGraph(graph).businessRequirements!, 'RULE-003');
    expect(scope.items.map((item) => item.id)).toEqual(['CODE-004', 'STATE-001', 'TC-003']);
    expect(scope.items.every((item) => item.scope === 'review-scope')).toBe(true);
    expect(scope.items.some((item) => item.id === 'FLOW-001')).toBe(false);
  });

  it('sets anchors only for code and test neighbors', () => {
    const withSource = redeemGraph();
    withSource.entities = withSource.entities.map((entity) =>
      entity.id === 'CODE-004' ? { ...entity, source: 'src/redeem.ts' } : entity);
    const declared = reviewScope(parseGraph(withSource).businessRequirements!, 'RULE-003');
    const state = declared.items.find((item) => item.id === 'STATE-001');
    const code = declared.items.find((item) => item.id === 'CODE-004');
    expect(state).not.toHaveProperty('anchor');
    expect(code).toMatchObject({ source: 'src/redeem.ts', anchor: 'declared' });
    const missing = reviewScope(parseGraph().businessRequirements!, 'RULE-003')
      .items.find((item) => item.id === 'CODE-004');
    expect(missing?.anchor).toBe('missing');
  });

  it('keeps a code entity with no source as a missing anchor and invents no path', () => {
    const scope = reviewScope(parseGraph().businessRequirements!, 'RULE-003');
    const code = scope.items.find((item) => item.id === 'CODE-004');
    expect(code).toMatchObject({ anchor: 'missing', scope: 'review-scope' });
    expect(code).not.toHaveProperty('source');
    expect(JSON.stringify(scope)).not.toContain('src/services/redeem.ts');
  });

  it('rejects an unknown acceptance check without calling it an acceptance failure', () => {
    const graph = redeemGraph({
      entities: redeemGraph().entities.map((entity) =>
        entity.id === 'TC-003' ? { ...entity, checkId: 'missing-check' } : entity),
    });
    expect(() => parseGraph(graph, { acceptance })).toThrow(ConfigValidationError);
    try {
      parseGraph(graph, { acceptance });
    } catch (error) {
      expect((error as Error).message).toContain('missing-check');
      expect((error as Error).message).not.toContain('FAIL');
    }
  });

  it('does not assign PASS or FAIL when the check id is known', () => {
    const scope = reviewScope(parseGraph(redeemGraph(), { acceptance }).businessRequirements!, 'RULE-003');
    const test = scope.items.find((item) => item.id === 'TC-003');
    expect(test?.anchor).toBe('declared');
    expect(test).not.toHaveProperty('status');
    expect(JSON.stringify(test)).not.toContain('PASS');
    expect(JSON.stringify(test)).not.toContain('FAIL');
  });
});

describe('module drift ignores requirement review scope', () => {
  it('keeps the same violations when a valid graph is added and does not query review scope', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-br-'));
    fs.mkdirSync(path.join(root, 'src/controllers'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src/services'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'src/controllers/user.controller.ts'),
      "import { UserService } from '../services/user.service.js';\nexport class UserController {}\n",
    );
    fs.writeFileSync(path.join(root, 'src/services/user.service.ts'), 'export class UserService {}\n');
    const base = {
      name: 'Redeem',
      layers: [
        { id: 'presentation', name: 'Presentation', order: 1 },
        { id: 'domain', name: 'Domain', order: 2 },
      ],
      components: [
        { id: 'Controllers', name: 'Controllers', layerId: 'presentation', paths: ['src/controllers/**'] },
        { id: 'Services', name: 'Services', layerId: 'domain', paths: ['src/services/**'] },
      ],
      allowDependencies: [{ from: 'Controllers', to: 'Services' }],
    };
    const plain = path.join(root, 'plain.json');
    const withGraph = path.join(root, 'graph.json');
    fs.writeFileSync(plain, JSON.stringify(base));
    fs.writeFileSync(withGraph, JSON.stringify({ ...base, businessRequirements: redeemGraph() }));

    const spy = vi.spyOn(impact, 'reviewScope');
    const before = await analyzeModuleDrift({ rootDir: root, specPath: plain });
    const after = await analyzeModuleDrift({ rootDir: root, specPath: withGraph });
    const fingerprint = (report: typeof before) =>
      report.violations.map((item) => `${item.type}:${item.message}:${item.sourceFile}:${item.line}`);

    expect(after.passed).toBe(before.passed);
    expect(fingerprint(after)).toEqual(fingerprint(before));
    expect(spy).not.toHaveBeenCalled();
    expect(after.businessRequirementView?.mermaid).toContain('BR-001');
    spy.mockRestore();
  });
});
