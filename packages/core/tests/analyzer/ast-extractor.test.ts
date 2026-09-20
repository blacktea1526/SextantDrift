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
});

