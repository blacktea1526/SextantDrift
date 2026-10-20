import { describe, expect, it } from 'vitest';
import { createVersionBinding } from '../../src/index.js';

const inputs = () => ({
  sourceFiles: [{ path: 'src/order.ts', content: 'export const amount = 10;\n' }],
  designFiles: [{ path: 'docs/order.md', content: '# Order\nPersist before payment.' }],
  acceptanceFiles: [{ path: 'tests/order.test.ts', content: 'assertPaymentAfterSave();' }],
  config: {
    layers: [{ id: 'Domain', name: 'Domain', order: 1 }],
    components: [{ id: 'Order', name: 'Order', layerId: 'Domain', paths: ['src/**'] }],
    allowDependencies: [],
  },
});

describe('acceptance content versions', () => {
  it('binds exact UTF-8 source content without relying on a git commit', () => {
    const input = inputs();
    const first = createVersionBinding(input);
    expect(first.sourceHash).toBe('4f6a305fa58f713263521b00e484c44842615ac6f209a15ceb3651dca0cec813');
    input.sourceFiles[0].content = 'export const amount = 20;\n';
    const changed = createVersionBinding(input);
    expect(changed.sourceHash).not.toBe(first.sourceHash);
    expect(changed.designHash).toBe(first.designHash);
    expect(changed.acceptanceHash).toBe(first.acceptanceHash);
    expect(changed.configHash).toBe(first.configHash);
  });

  it('sorts file paths and object keys, excludes outputs, and never mutates inputs', () => {
    const input = inputs();
    input.sourceFiles.push({ path: 'src/a.ts', content: 'α' });
    const original = structuredClone(input);
    const first = createVersionBinding(input);
    expect(input).toEqual(original);
    input.sourceFiles.reverse();
    input.sourceFiles.push({ path: 'dist/result.js', content: 'generated' });
    input.config = {
      allowDependencies: [],
      components: [{ paths: ['src/**'], layerId: 'Domain', name: 'Order', id: 'Order' }],
      layers: [{ order: 1, name: 'Domain', id: 'Domain' }],
    };
    expect(createVersionBinding(input)).toEqual(first);
  });

  it('binds semantic configuration without circularly hashing its confirmation', () => {
    const input = inputs();
    const config = { ...input.config, acceptance: {
      requirements: [], scenarios: [], checks: [],
      confirmation: { confirmedBy: 'reviewer', designHash: 'a'.repeat(64),
        acceptanceHash: 'b'.repeat(64), configHash: 'c'.repeat(64) },
    } };
    const first = createVersionBinding({ ...input, config });
    config.acceptance.confirmation.confirmedBy = 'another reviewer';
    expect(createVersionBinding({ ...input, config })).toEqual(first);
    config.components[0] = { ...config.components[0], paths: ['domain/**'] };
    expect(createVersionBinding({ ...input, config }).configHash).not.toBe(first.configHash);
  });

  it.each(['../escape.ts', '/abs.ts', 'C:/abs.ts', './local.ts', 'src//a.ts', 'src\\a.ts', 'src/../a.ts', ''])
    ('rejects unsafe or ambiguous manifest path %j', path => {
      expect(() => createVersionBinding({ ...inputs(), sourceFiles: [{ path, content: 'x' }] }))
        .toThrow(/path/i);
    });

  it('rejects duplicate paths and manifests empty after output exclusions', () => {
    const input = inputs();
    expect(() => createVersionBinding({ ...input, sourceFiles: [...input.sourceFiles, ...input.sourceFiles] }))
      .toThrow(/duplicate/i);
    expect(() => createVersionBinding({ ...input, designFiles: [] })).toThrow(/empty/i);
    expect(() => createVersionBinding({ ...input, acceptanceFiles: [{ path: '.sextant/run.json', content: 'old run' }] }))
      .toThrow(/empty/i);
  });

  it.each([
    ['designFiles', 'designHash'], ['acceptanceFiles', 'acceptanceHash'],
  ] as const)('detects changed %s content and path', (group, hash) => {
    const input = inputs();
    const original = createVersionBinding(input);
    input[group][0].content += '\r\n';
    expect(createVersionBinding(input)[hash]).not.toBe(original[hash]);
    input[group][0].content = inputs()[group][0].content;
    input[group][0].path = 'renamed/' + input[group][0].path;
    expect(createVersionBinding(input)[hash]).not.toBe(original[hash]);
  });

  it.each(['node_modules', '.git', '.sextant', 'dist', 'coverage', '.omx', '.scratch'])
    ('excludes %s runtime/output content', output => {
      const input = inputs();
      const first = createVersionBinding(input);
      input.sourceFiles.push({ path: `packages/app/${output}/generated.txt`, content: 'not input' });
      expect(createVersionBinding(input)).toEqual(first);
    });
});
