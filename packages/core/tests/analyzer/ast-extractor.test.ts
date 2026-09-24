import { describe, it, expect } from 'vitest';
import { extractDependenciesFromSource } from '../../src/analyzer/ast-extractor.js';

describe('AST Extractor', () => {
  it('should capture static import, import type, re-export, and dynamic calls with exact line and column', () => {
    const code = `
import { UserService } from './services/user.service.js';
import type { UserDto } from './dto/user.dto.js';
export * from './domain/index.js';

export async function loadRepo() {
  const repo = await import('./repos/user.repo.js');
  const legacy = require('./legacy/db.js');
  return { repo, legacy };
}
`;

    const evidences = extractDependenciesFromSource('src/controllers/user.controller.ts', code);
    expect(evidences).toHaveLength(5);

    // 1. Static import
    expect(evidences[0]).toMatchObject({
      rawSpecifier: './services/user.service.js',
      kind: 'import',
      isTypeOnly: false,
      line: 2,
    });
    expect(evidences[0].snippet).toContain("import { UserService } from './services/user.service.js'");

    // 2. Type-only import
    expect(evidences[1]).toMatchObject({
      rawSpecifier: './dto/user.dto.js',
      kind: 'import',
      isTypeOnly: true,
      line: 3,
    });

    // 3. Re-export
    expect(evidences[2]).toMatchObject({
      rawSpecifier: './domain/index.js',
      kind: 'export-from',
      isTypeOnly: false,
      line: 4,
    });

    // 4. Dynamic import
    expect(evidences[3]).toMatchObject({
      rawSpecifier: './repos/user.repo.js',
      kind: 'dynamic-import',
      isTypeOnly: false,
      line: 7,
    });

    // 5. CommonJS require
    expect(evidences[4]).toMatchObject({
      rawSpecifier: './legacy/db.js',
      kind: 'require',
      isTypeOnly: false,
      line: 8,
    });
  });

  it('should capture no-substitution template literals for require and dynamic import', () => {
    const code = `
const service = require(\`./services/auth.service.js\`);
export async function init() {
  const mod = await import(\`./dynamic/loader.js\`);
  return { service, mod };
}
`;
    const evidences = extractDependenciesFromSource('src/app.ts', code);
    expect(evidences).toHaveLength(2);
    expect(evidences[0]).toMatchObject({
      rawSpecifier: './services/auth.service.js',
      kind: 'require',
      line: 2,
    });
    expect(evidences[1]).toMatchObject({
      rawSpecifier: './dynamic/loader.js',
      kind: 'dynamic-import',
      line: 4,
    });
  });

  it('should recognize TypeScript 4.5+ named type-only imports and exports', () => {
    const code = `
import { type UserDto, type AdminDto } from './dto/user.dto.js';
import { UserService, type RoleDto } from './services/user.service.js';
export { type ConfigDto } from './config/dto.js';
export { AppService, type AppConfig } from './app.service.js';
`;
    const evidences = extractDependenciesFromSource('src/test.ts', code);
    expect(evidences).toHaveLength(4);

    // 1. All named imports are type-only
    expect(evidences[0]).toMatchObject({
      rawSpecifier: './dto/user.dto.js',
      isTypeOnly: true,
      kind: 'import',
      line: 2,
    });

    // 2. Mixed named imports (value + type)
    expect(evidences[1]).toMatchObject({
      rawSpecifier: './services/user.service.js',
      isTypeOnly: false,
      kind: 'import',
      line: 3,
    });

    // 3. All named exports are type-only
    expect(evidences[2]).toMatchObject({
      rawSpecifier: './config/dto.js',
      isTypeOnly: true,
      kind: 'export-from',
      line: 4,
    });

    // 4. Mixed named exports (value + type)
    expect(evidences[3]).toMatchObject({
      rawSpecifier: './app.service.js',
      isTypeOnly: false,
      kind: 'export-from',
      line: 5,
    });
  });

  it('should extract importedSymbols precisely for static imports and dynamic destructuring', () => {
    const code = `
import { foo, bar as baz } from './module-a.js';
import DefaultItem from './module-b.js';
import * as AllItems from './module-c.js';

export async function load() {
  const { helper1, helper2: aliased } = await import('./dynamic-module.js');
  const { legacyUtil } = require('./legacy-module.js');
  const entireModule = await import('./wildcard-dynamic.js');
  return { helper1, aliased, legacyUtil, entireModule };
}
`;
    const evidences = extractDependenciesFromSource('src/test-symbols.ts', code);
    expect(evidences).toHaveLength(6);

    // Named imports
    expect(evidences[0].importedSymbols).toEqual(['foo', 'bar']);
    // Default import
    expect(evidences[1].importedSymbols).toEqual(['default']);
    // Namespace import
    expect(evidences[2].importedSymbols).toEqual(['*']);
    // Dynamic import with destructuring
    expect(evidences[3].importedSymbols).toEqual(['helper1', 'helper2']);
    // Require with destructuring
    expect(evidences[4].importedSymbols).toEqual(['legacyUtil']);
    // Wildcard dynamic import (no destructuring)
    expect(evidences[5].importedSymbols).toEqual(['*']);
  });
});

