import { describe, it, expect, beforeEach } from 'vitest';
import { traceBarrelExports, clearBarrelCache } from '../../src/analyzer/barrel-tracer.js';

describe('Barrel Tracer (Multi-hop Re-export Tracing)', () => {
  const rootDir = process.cwd();

  beforeEach(() => {
    clearBarrelCache();
  });

  it('should identify a barrel file and trace single-hop re-exports', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/services/index.ts',
        `export * from './user.service.js';
export { OrderService } from './order.service.js';`,
      ],
      ['src/services/user.service.ts', 'export class UserService {}'],
      ['src/services/order.service.ts', 'export class OrderService {}'],
    ]);

    const result = traceBarrelExports(rootDir, 'src/services/index.ts', fileContentMap);
    expect(result.isBarrel).toBe(true);
    expect(result.tracedTargets).toHaveLength(2);

    const targetPaths = result.tracedTargets.map((t) => t.targetPath);
    expect(targetPaths).toContain('src/services/user.service');
    expect(targetPaths).toContain('src/services/order.service');
  });

  it('should recursively trace multi-hop re-export chains across barrels', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/entry/index.ts',
        `export * from '../services/index.js';`,
      ],
      [
        'src/services/index.ts',
        `export * from '../repos/index.js';`,
      ],
      [
        'src/repos/index.ts',
        `export { UserRepo } from './user.repo.js';`,
      ],
      [
        'src/repos/user.repo.ts',
        `export class UserRepo {}`,
      ],
    ]);

    const result = traceBarrelExports(rootDir, 'src/entry/index.ts', fileContentMap);
    expect(result.isBarrel).toBe(true);
    // Should have traced all hops: services/index -> repos/index -> repos/user.repo
    const targetPaths = result.tracedTargets.map((t) => t.targetPath);
    expect(targetPaths).toContain('src/repos/user.repo');

    const deepTarget = result.tracedTargets.find((t) => t.targetPath === 'src/repos/user.repo');
    expect(deepTarget).toBeDefined();
    expect(deepTarget?.hopCount).toBeGreaterThanOrEqual(2);
    expect(deepTarget?.chain).toContain('src/repos/user.repo');
  });

  it('should gracefully handle circular re-exports without infinite loops', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/barrel-a.ts',
        `export * from './barrel-b.js';`,
      ],
      [
        'src/barrel-b.ts',
        `export * from './barrel-a.js';`,
      ],
    ]);

    const result = traceBarrelExports(rootDir, 'src/barrel-a.ts', fileContentMap);
    expect(result.isBarrel).toBe(true);
    // Should terminate safely without stack overflow
    expect(result.tracedTargets.length).toBeLessThanOrEqual(2);
  });

  it('should record unresolved hops when barrel re-exports non-existent modules', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/broken-barrel.ts',
        `export * from './non-existent-submodule.js';`,
      ],
    ]);

    const result = traceBarrelExports(rootDir, 'src/broken-barrel.ts', fileContentMap);
    expect(result.isBarrel).toBe(true);
    expect(result.unresolvedHops.length).toBeGreaterThanOrEqual(1);
    expect(result.unresolvedHops[0].rawSpecifier).toBe('./non-existent-submodule.js');
  });

  it('should return empty tracedTargets when all imported symbols are declared locally in the barrel', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/facade.ts',
        `export * from './internal/heavy-infra.js';
export function localPublicApi() { return 'ok'; }
export const FACADE_VERSION = '1.0.0';`,
      ],
      ['src/internal/heavy-infra.ts', 'export function queryRawDb() {}'],
    ]);

    // Caller only imports local functions from the facade
    const result = traceBarrelExports(
      rootDir,
      'src/facade.ts',
      ['localPublicApi', 'FACADE_VERSION'],
      fileContentMap
    );

    expect(result.isBarrel).toBe(true);
    // Must NOT trace into heavy-infra because the imported symbols are local!
    expect(result.tracedTargets).toHaveLength(0);
  });

  it('should trace only the specific re-exported module providing the named imported symbol', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/services/index.ts',
        `export { UserRepo } from '../repos/user.repo.js';
export { OrderService } from './order.service.js';
export function localService() {}`,
      ],
      ['src/repos/user.repo.ts', 'export class UserRepo {}'],
      ['src/services/order.service.ts', 'export class OrderService {}'],
    ]);

    // Caller only imports OrderService
    const resultOrder = traceBarrelExports(
      rootDir,
      'src/services/index.ts',
      ['OrderService'],
      fileContentMap
    );

    expect(resultOrder.isBarrel).toBe(true);
    expect(resultOrder.tracedTargets).toHaveLength(1);
    expect(resultOrder.tracedTargets[0].targetPath).toBe('src/services/order.service');

    // Caller imports UserRepo (the bypass candidate)
    const resultRepo = traceBarrelExports(
      rootDir,
      'src/services/index.ts',
      ['UserRepo'],
      fileContentMap
    );

    expect(resultRepo.isBarrel).toBe(true);
    expect(resultRepo.tracedTargets).toHaveLength(1);
    expect(resultRepo.tracedTargets[0].targetPath).toBe('src/repos/user.repo');
  });

  it('should accurately detect type-only re-exports through barrels', () => {
    const fileContentMap = new Map<string, string>([
      [
        'src/types/index.ts',
        `export * from './user.dto.js';
export * from './order.dto.js';`,
      ],
      ['src/types/user.dto.ts', 'export interface UserDto { id: string; }'],
      ['src/types/order.dto.ts', 'export type OrderDto = { orderId: string; };'],
    ]);

    const result = traceBarrelExports(
      rootDir,
      'src/types/index.ts',
      ['UserDto'],
      fileContentMap
    );

    expect(result.isBarrel).toBe(true);
    const userTarget = result.tracedTargets.find((t) => t.targetPath.includes('user.dto'));
    expect(userTarget).toBeDefined();
    expect(userTarget?.isTypeOnly).toBe(true);
  });
});
