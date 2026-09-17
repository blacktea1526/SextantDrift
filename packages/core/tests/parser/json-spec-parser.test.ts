import { describe, it, expect } from 'vitest';
import { parseJsonSpec } from '../../src/parser/json-spec-parser.js';
import { ConfigSyntaxError, ConfigValidationError } from '../../src/errors/config-error.js';

describe('JSON Spec Parser', () => {
  it('should successfully parse valid sextant.json', () => {
    const validJson = JSON.stringify({
      $schema: 'https://sextant-drift.dev/schema/v2.json',
      name: 'Test Project',
      layers: [
        { id: 'Presentation', name: 'Presentation Layer', order: 1 },
        { id: 'Domain', name: 'Domain Layer', order: 2 },
        { id: 'Infra', name: 'Infrastructure Layer', order: 3 },
      ],
      components: [
        { id: 'Controller', name: 'API Controllers', layerId: 'Presentation', paths: ['src/controllers/**'] },
        { id: 'Service', name: 'Business Services', layerId: 'Domain', paths: ['src/services/**'] },
        { id: 'Repo', name: 'Data Repositories', layerId: 'Infra', paths: ['src/repos/**'] },
      ],
      allowDependencies: [
        { from: 'Controller', to: 'Service' },
        { from: 'Service', to: 'Repo' },
      ],
    });

    const arch = parseJsonSpec(validJson);
    expect(arch.layers).toHaveLength(3);
    expect(arch.components).toHaveLength(3);
    expect(arch.allowDependencies).toHaveLength(2);
    expect(arch.layers[0].id).toBe('Presentation');
  });

  it('should throw ConfigSyntaxError on invalid JSON with line and column', () => {
    const brokenJson = `{
      "layers": [
        { "id": "UI", "order": 1 },
      ]
    }`;

    expect(() => parseJsonSpec(brokenJson)).toThrow(ConfigSyntaxError);
  });

  it('should throw ConfigValidationError if layers are missing or empty', () => {
    const jsonWithoutLayers = JSON.stringify({
      components: [],
    });

    expect(() => parseJsonSpec(jsonWithoutLayers)).toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError if component references non-existent layer', () => {
    const invalidLayerRef = JSON.stringify({
      layers: [{ id: 'UI', name: 'UI', order: 1 }],
      components: [
        { id: 'CompA', name: 'CompA', layerId: 'NonExistentLayer', paths: ['src/**'] },
      ],
    });

    expect(() => parseJsonSpec(invalidLayerRef)).toThrow(ConfigValidationError);
  });

  it('should throw ConfigValidationError on duplicate component IDs', () => {
    const duplicateComp = JSON.stringify({
      layers: [{ id: 'UI', name: 'UI', order: 1 }],
      components: [
        { id: 'CompA', name: 'CompA', layerId: 'UI', paths: ['src/a/**'] },
        { id: 'CompA', name: 'Duplicate CompA', layerId: 'UI', paths: ['src/b/**'] },
      ],
    });

    expect(() => parseJsonSpec(duplicateComp)).toThrow(ConfigValidationError);
  });
});
