import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runRequirements } from '../src/commands/requirements.js';
import { runCheck } from '../src/commands/check.js';
import { EXIT_CODE_SUCCESS } from '../src/utils/exit.js';

describe('requirements review scope command', () => {
  it('prints the three declared neighbors as review scope and does not claim code was analyzed', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-req-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/service.ts'), 'export const redeem = 1;\n');
    fs.writeFileSync(path.join(root, 'sextant.json'), JSON.stringify({
      layers: [{ id: 'domain', name: 'Domain', order: 1 }],
      components: [{ id: 'svc', name: 'Service', layerId: 'domain', paths: ['src/**'] }],
      businessRequirements: {
        entities: [
          { id: 'BR-001', kind: 'requirement', title: '兑换码开通会员', flows: ['FLOW-001'], rules: ['RULE-003'] },
          { id: 'FLOW-001', kind: 'flow', title: '兑换流程' },
          { id: 'RULE-003', kind: 'rule', title: '权益叠加规则' },
          { id: 'STATE-001', kind: 'state', title: '会员状态' },
          { id: 'TC-003', kind: 'test', title: '权益叠加测试', checkId: 'stack' },
          { id: 'CODE-004', kind: 'code', title: '兑换服务', source: 'src/store/modules/collaboration/roleContext.ts' },
        ],
        relations: [
          { from: 'RULE-003', to: 'STATE-001', type: 'affects' },
          { from: 'RULE-003', to: 'CODE-004', type: 'implemented_by' },
          { from: 'RULE-003', to: 'TC-003', type: 'verified_by' },
        ],
      },
    }));

    const lines: string[] = [];
    const code = await runRequirements('RULE-003', root, { stdout: (line) => lines.push(line) });
    const text = lines.join('\n');
    expect(code).toBe(EXIT_CODE_SUCCESS);
    expect(text).toContain('待检查 RULE-003');
    expect(text).toContain('复核范围');
    for (const id of ['STATE-001', 'CODE-004', 'TC-003']) expect(text).toContain(id);
    expect(text).toContain('src/store/modules/collaboration/roleContext.ts');
    expect(text).toContain('复核范围');
    const stateLine = lines.find((line) => line.includes('STATE-001'));
    expect(stateLine).not.toContain('锚点已声明');
    expect(text).not.toContain('已分析代码');
  });

  it('keeps check success on a configuration without the graph', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-check-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/service.ts'), 'export const redeem = 1;\n');
    fs.writeFileSync(path.join(root, 'sextant.json'), JSON.stringify({
      layers: [{ id: 'domain', name: 'Domain', order: 1 }],
      components: [{ id: 'svc', name: 'Service', layerId: 'domain', paths: ['src/**'] }],
    }));
    expect(await runCheck(root, { json: true })).toBe(EXIT_CODE_SUCCESS);
  });
});
