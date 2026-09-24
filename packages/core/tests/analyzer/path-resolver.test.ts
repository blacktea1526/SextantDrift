import { describe, it, expect } from 'vitest';
import { resolveModulePath, getPackageName, clearResolutionCache } from '../../src/analyzer/path-resolver.js';

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

  it('should leverage resolution cache and support cache clearing', () => {
    clearResolutionCache();
    const res1 = resolveModulePath(
      '/project',
      'src/ui/app.ts',
      './utils/helper.js'
    );
    const res2 = resolveModulePath(
      '/project',
      'src/ui/app.ts',
      './utils/helper.js'
    );
    expect(res1).toBe(res2); // Referentially identical from resolutionCache
    clearResolutionCache();
    const res3 = resolveModulePath(
      '/project',
      'src/ui/app.ts',
      './utils/helper.js'
    );
    expect(res3).toEqual(res1);
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

  it('should isolate cache entries across different rootDirs and tsConfigPaths', () => {
    clearResolutionCache();
    const resA = resolveModulePath('/ROOT_A', 'src/x/y.ts', '@/widgets/Unique', {
      baseUrl: '.',
      paths: { '@/*': ['./src/*'] },
    });
    const resB = resolveModulePath('/ROOT_B', 'src/x/y.ts', '@/widgets/Unique', null);
    const resC = resolveModulePath('/ROOT_C', 'src/x/y.ts', '@/widgets/Unique', {
      baseUrl: '.',
      paths: { '@/*': ['./GENERATED/*'] },
    });

    expect(resA).toEqual({ type: 'internal', targetPath: 'src/widgets/Unique' });
    expect(resB).toEqual({ type: 'external', packageName: '@/widgets', rawSpecifier: '@/widgets/Unique' });
    expect(resC).toEqual({ type: 'internal', targetPath: 'GENERATED/widgets/Unique' });
  });
});
