import { TargetArchitecture } from '../types/architecture.js';
import { ConfigSyntaxError, ConfigValidationError } from '../errors/config-error.js';

export function parseJsonSpec(rawJson: string): TargetArchitecture {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: unknown) {
    const error = err as Error;
    let line: number | undefined;
    let column: number | undefined;
    let snippet: string | undefined;

    // Try extracting position from V8 error message e.g. "at position 42"
    const posMatch = error.message.match(/at position (\d+)/);
    if (posMatch && posMatch[1]) {
      const pos = parseInt(posMatch[1], 10);
      const lines = rawJson.slice(0, pos).split('\n');
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
      snippet = rawJson.split('\n')[line - 1];
    } else {
      // Try line/column regex e.g. "at line 2 column 5"
      const lineColMatch = error.message.match(/line (\d+) column (\d+)/);
      if (lineColMatch) {
        line = parseInt(lineColMatch[1], 10);
        column = parseInt(lineColMatch[2], 10);
        snippet = rawJson.split('\n')[line - 1];
      }
    }

    throw new ConfigSyntaxError(`Failed to parse JSON architecture spec: ${error.message}`, {
      line,
      column,
      snippet,
    });
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigValidationError('Architecture spec root must be a valid JSON object');
  }

  const spec = parsed as Record<string, unknown>;

  // Validate layers
  if (!Array.isArray(spec.layers) || spec.layers.length === 0) {
    throw new ConfigValidationError('Architecture spec must define a non-empty "layers" array', {
      field: 'layers',
    });
  }

  const layerIds = new Set<string>();
  for (let i = 0; i < spec.layers.length; i++) {
    const layer = spec.layers[i];
    if (typeof layer !== 'object' || layer === null) {
      throw new ConfigValidationError(`layers[${i}] must be an object`, { field: `layers[${i}]` });
    }
    const { id, order } = layer as { id?: unknown; order?: unknown };
    if (typeof id !== 'string' || !id.trim()) {
      throw new ConfigValidationError(`layers[${i}].id must be a non-empty string`, {
        field: `layers[${i}].id`,
      });
    }
    if (typeof order !== 'number' || Number.isNaN(order)) {
      throw new ConfigValidationError(`layers[${i}].order must be a valid number`, {
        field: `layers[${i}].order`,
      });
    }
    if (layerIds.has(id)) {
      throw new ConfigValidationError(`Duplicate layer id "${id}" found`, {
        field: `layers[${i}].id`,
      });
    }
    layerIds.add(id);
  }

  // Validate components
  if (!Array.isArray(spec.components)) {
    throw new ConfigValidationError('Architecture spec must define a "components" array', {
      field: 'components',
    });
  }

  const componentIds = new Set<string>();
  for (let i = 0; i < spec.components.length; i++) {
    const comp = spec.components[i];
    if (typeof comp !== 'object' || comp === null) {
      throw new ConfigValidationError(`components[${i}] must be an object`, {
        field: `components[${i}]`,
      });
    }
    const { id, layerId, paths } = comp as { id?: unknown; layerId?: unknown; paths?: unknown };
    if (typeof id !== 'string' || !id.trim()) {
      throw new ConfigValidationError(`components[${i}].id must be a non-empty string`, {
        field: `components[${i}].id`,
      });
    }
    if (componentIds.has(id)) {
      throw new ConfigValidationError(`Duplicate component id "${id}" found`, {
        field: `components[${i}].id`,
      });
    }
    componentIds.add(id);

    if (typeof layerId !== 'string' || !layerIds.has(layerId)) {
      throw new ConfigValidationError(
        `Component "${id}" references unknown layerId "${layerId}"`,
        { field: `components[${i}].layerId` }
      );
    }

    if (!Array.isArray(paths) || paths.length === 0 || !paths.every((p) => typeof p === 'string')) {
      throw new ConfigValidationError(
        `Component "${id}" must define non-empty "paths" array of strings`,
        { field: `components[${i}].paths` }
      );
    }
  }

  // Validate allowDependencies
  const allowDependencies = Array.isArray(spec.allowDependencies) ? spec.allowDependencies : [];
  for (let i = 0; i < allowDependencies.length; i++) {
    const dep = allowDependencies[i];
    if (typeof dep !== 'object' || dep === null) {
      throw new ConfigValidationError(`allowDependencies[${i}] must be an object`, {
        field: `allowDependencies[${i}]`,
      });
    }
    const { from, to } = dep as { from?: unknown; to?: unknown };
    if (typeof from !== 'string' || typeof to !== 'string') {
      throw new ConfigValidationError(
        `allowDependencies[${i}] must contain string "from" and "to"`,
        { field: `allowDependencies[${i}]` }
      );
    }
  }

  return {
    $schema: typeof spec.$schema === 'string' ? spec.$schema : undefined,
    name: typeof spec.name === 'string' ? spec.name : undefined,
    version: typeof spec.version === 'string' ? spec.version : undefined,
    layers: spec.layers as TargetArchitecture['layers'],
    components: spec.components as TargetArchitecture['components'],
    allowDependencies: allowDependencies as TargetArchitecture['allowDependencies'],
    invariants: Array.isArray(spec.invariants) ? spec.invariants as TargetArchitecture['invariants'] : [],
  };
}
