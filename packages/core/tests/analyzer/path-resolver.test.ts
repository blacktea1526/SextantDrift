import { describe, it, expect } from 'vitest';
import { resolveModulePath, getPackageName } from '../../src/analyzer/path-resolver.js';

describe('Path Resolver', () => {
  it('should extract package name for scoped and non-scoped packages', () => {
    expect(getPackageName('@prisma/client/runtime')).toBe('@prisma/client');
    expect(getPackageName('lodash/get')).toBe('lodash');
    expect(getPackageName('express')).toBe('express');
  });

  it('should resolve relative internal imports', () => {
    const res = resolveModulePath(
      '/project',
      'src/controllers/user.controller.ts',
      '../services/user.service.js'
    );

    expect(res).toEqual({
      type: 'internal',
      targetPath: 'src/services/user.service',
    });
  });

  it('should resolve path aliases via tsconfig.json paths', () => {
    const tsConfigPaths = {
      baseUrl: '.',
      paths: {
        '@/*': ['src/*'],
        '@domain/*': ['src/domain/*'],
      },
    };

    const res = resolveModulePath(
      '/project',
      'src/controllers/user.controller.ts',
      '@/services/auth.service',
      tsConfigPaths
    );

    expect(res).toEqual({
      type: 'internal',
      targetPath: 'src/services/auth.service',
    });

    const resDomain = resolveModulePath(
      '/project',
      'src/controllers/user.controller.ts',
      '@domain/models',
      tsConfigPaths
    );

    expect(resDomain).toEqual({
      type: 'internal',
      targetPath: 'src/domain/models',
    });
  });

  it('should identify third-party external dependencies', () => {
    const res = resolveModulePath(
      '/project',
      'src/controllers/user.controller.ts',
      '@prisma/client'
    );

    expect(res).toEqual({
      type: 'external',
      packageName: '@prisma/client',
      rawSpecifier: '@prisma/client',
    });
  });
});
