import { createHash } from 'node:crypto';
import type { TargetArchitecture } from '../types/architecture.js';
import { ConfigValidationError } from '../errors/config-error.js';
import type { AcceptanceConfig, VersionBinding } from './types.js';

export interface ContentFile { path: string; content: string }
export interface VersionInputs {
  sourceFiles: ContentFile[];
  designFiles: ContentFile[];
  acceptanceFiles: ContentFile[];
  config: TargetArchitecture & { acceptance?: AcceptanceConfig };
}

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');
const outputs = new Set(['node_modules', '.git', '.sextant', 'dist', 'coverage', '.omx', '.scratch']);
const comparePaths = (a: string, b: string): number => Buffer.compare(Buffer.from(a), Buffer.from(b));

function manifestHash(files: ContentFile[]): string {
  const paths = new Set<string>();
  for (const file of files) {
    if (typeof file.path !== 'string' || /[\\:\u0000]/.test(file.path) ||
        file.path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new ConfigValidationError('Content manifest path must be a project-relative POSIX file path');
    }
    if (typeof file.content !== 'string') {
      throw new ConfigValidationError('Content manifest must contain UTF-8 text');
    }
    if (paths.has(file.path)) throw new ConfigValidationError(`Duplicate manifest path: ${file.path}`);
    paths.add(file.path);
  }
  const entries = files
    .filter(file => !file.path.split('/').some(part => outputs.has(part)))
    .map(({ path, content }) => [path, content])
    .sort((a, b) => comparePaths(a[0], b[0]));
  if (entries.length === 0) throw new ConfigValidationError('Content manifest is empty after output exclusions');
  return sha256(JSON.stringify(entries));
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort(comparePaths).map(key => [key, item[key]]));
    }
    return item;
  });
}

/** Caller supplies exact UTF-8 inputs, including uncommitted changes. No filesystem or Git access. */
export function createVersionBinding(input: VersionInputs): VersionBinding {
  const config = { ...input.config };
  if (config.acceptance) {
    const { confirmation: _confirmation, ...semantics } = config.acceptance;
    config.acceptance = semantics;
  }
  return {
    sourceHash: manifestHash(input.sourceFiles),
    designHash: manifestHash(input.designFiles),
    acceptanceHash: manifestHash(input.acceptanceFiles),
    configHash: sha256(canonicalJson(config)),
  };
}
