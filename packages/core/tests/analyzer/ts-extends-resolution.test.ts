import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  resolveModuleWithTsCompiler,
  clearTsResolverCache,
  findNearestTsConfigFile,
  getParsedTsConfig,
} from '../../src/analyzer/ts-project-resolver.js';

describe('TypeScript Official Project Resolver & Extends Support', () => {
  const rootDir = process.cwd();

  beforeEach(() => {
    clearTsResolverCache();
  });

  it('should locate the nearest tsconfig.json following directory hierarchy', () => {
    const coreSource = path.join(rootDir, 'packages/core/src/index.ts');
    const found = findNearestTsConfigFile(rootDir, coreSource);
    expect(found).toBeDefined();
    expect(found).toContain('packages/core/tsconfig.json');
  });

  it('should load tsconfig and automatically resolve extends inheritance', () => {
    const coreConfigPath = path.join(rootDir, 'packages/core/tsconfig.json');
    const parsed = getParsedTsConfig(coreConfigPath, rootDir);

    // packages/core/tsconfig.json extends ../../tsconfig.base.json
    // Verify target and moduleResolution are inherited from tsconfig.base.json
    expect(parsed.commandLine.options.target).toBeDefined();
    expect(parsed.commandLine.options.moduleResolution).toBeDefined();
    expect(parsed.commandLine.options.rootDir).toContain('packages/core/src');
  });

  it('should resolve ESM .js import specifier to physical .ts source file', () => {
    const sourceFile = path.join('packages/core/src/index.ts');
    const res = resolveModuleWithTsCompiler(rootDir, sourceFile, './analyzer/path-resolver.js');

    expect(res.type).toBe('internal');
    if (res.type === 'internal') {
      expect(res.targetPath).toBe('packages/core/src/analyzer/path-resolver');
      expect(res.fullPath).toBeDefined();
      expect(res.fullPath).toContain('path-resolver.ts');
    }
  });

  it('should return external for node_modules dependencies', () => {
    const sourceFile = path.join('packages/core/src/index.ts');
    const res = resolveModuleWithTsCompiler(rootDir, sourceFile, 'yaml');

    expect(res.type).toBe('external');
    if (res.type === 'external') {
      expect(res.packageName).toBe('yaml');
      expect(res.rawSpecifier).toBe('yaml');
    }
  });

  it('should return unresolved diagnostic when an internal relative module is missing', () => {
    const sourceFile = path.join('packages/core/src/index.ts');
    const res = resolveModuleWithTsCompiler(rootDir, sourceFile, './missing-module-xyz.js');

    expect(res.type).toBe('unresolved');
    if (res.type === 'unresolved') {
      expect(res.rawSpecifier).toBe('./missing-module-xyz.js');
      expect(res.reason).toContain('Could not resolve');
    }
  });

  it('should resolve workspace packages in monorepo', () => {
    const sourceFile = path.join('packages/cli/src/bin/sextant-drift.ts');
    const res = resolveModuleWithTsCompiler(rootDir, sourceFile, '@sextant/core');

    expect(res.type).toBe('internal');
    if (res.type === 'internal') {
      expect(res.targetPath).toBe('packages/core/src');
    }
  });
});
