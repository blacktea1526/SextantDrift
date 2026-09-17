import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { InvariantRule } from '../../src/types/architecture.js';
import {
  matchImportInvariants,
  isForbiddenImportMatch,
} from '../../src/invariants/import-matcher.js';

describe('AST Import Matcher (forbid_import)', () => {
  const forbidPrismaRule: InvariantRule = {
    id: 'FORBID_PRISMA_IN_VIEWS',
    severity: 'critical',
    desc: 'Views and presentation layer must not import database client directly',
    pattern: {
      forbid_import: ['@prisma/client', 'src/repositories/**'],
      in_path: 'src/views/**',
    },
  };

  describe('isForbiddenImportMatch helper', () => {
    it('should match exact package name', () => {
      expect(isForbiddenImportMatch('@prisma/client', '@prisma/client', 'src/views/test.ts')).toBe(true);
    });

    it('should match subpaths of forbidden package', () => {
      expect(isForbiddenImportMatch('@prisma/client/runtime', '@prisma/client', 'src/views/test.ts')).toBe(true);
      expect(isForbiddenImportMatch('@prisma/client/edge', '@prisma/client', 'src/views/test.ts')).toBe(true);
    });

    it('should not match package name prefix collision', () => {
      expect(isForbiddenImportMatch('@prisma/client-extension', '@prisma/client', 'src/views/test.ts')).toBe(false);
    });

    it('should match glob patterns with wildcards', () => {
      expect(isForbiddenImportMatch('@prisma/adapter-pg', '@prisma/*', 'src/views/test.ts')).toBe(true);
      expect(isForbiddenImportMatch('src/repositories/user.repo', 'src/repositories/**', 'src/views/test.ts')).toBe(true);
    });

    it('should resolve relative imports against relPath and match globs', () => {
      expect(
        isForbiddenImportMatch('../repositories/user.repo', 'src/repositories/**', 'src/views/user.view.ts')
      ).toBe(true);
    });

    it('should return false for non-matching modules', () => {
      expect(isForbiddenImportMatch('react', '@prisma/client', 'src/views/test.ts')).toBe(false);
      expect(isForbiddenImportMatch('../services/user.service', 'src/repositories/**', 'src/views/user.view.ts')).toBe(false);
    });
  });

  describe('Positive cases: clean code passes with 0 violations', () => {
    it('should emit 0 violations when importing allowed modules', () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import { UserService } from '../services/user.service';
        export * from './components/button';
        export { Header } from './components/header';

        export async function loadData() {
          const helper = await import('../utils/formatter');
          return helper.format('clean');
        }
      `;

      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Negative cases: static ImportDeclaration', () => {
    it('should catch named static imports with exact line, column, and snippet', () => {
      const code = [
        "import React from 'react';",
        "import { PrismaClient } from '@prisma/client';",
        "export const view = 'test';",
      ].join('\n');

      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].id).toBe('INVARIANT_FORBID_PRISMA_IN_VIEWS_2_1');
      expect(violations[0].type).toBe('INVARIANT_BROKEN');
      expect(violations[0].severity).toBe('critical');
      expect(violations[0].ruleId).toBe('FORBID_PRISMA_IN_VIEWS');
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBe(1);
      expect(violations[0].snippet).toBe("import { PrismaClient } from '@prisma/client';");
      expect(violations[0].sourceFile).toBe('src/views/UserView.tsx');
      expect(violations[0].message).toContain('forbids import "@prisma/client"');
    });

    it('should catch default and namespace imports', () => {
      const code = [
        "import * as Prisma from '@prisma/client';",
        "import prismaClient from '@prisma/client';",
      ].join('\n');

      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(2);
      expect(violations[0].line).toBe(1);
      expect(violations[1].line).toBe(2);
    });

    it('should catch side-effect only imports', () => {
      const code = "import '@prisma/client';";
      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
      expect(violations[0].snippet).toBe("import '@prisma/client';");
    });

    it('should catch type-only imports of forbidden packages', () => {
      const code = "import type { User } from '@prisma/client';";
      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
      expect(violations[0].snippet).toBe("import type { User } from '@prisma/client';");
    });
  });

  describe('Negative cases: re-exports (ExportDeclaration)', () => {
    it('should catch export * from forbidden module', () => {
      const code = "export * from '@prisma/client';";
      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
      expect(violations[0].snippet).toBe("export * from '@prisma/client';");
    });

    it('should catch export { X } from forbidden module', () => {
      const code = "export { PrismaClient, User } from '@prisma/client';";
      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
      expect(violations[0].snippet).toBe("export { PrismaClient, User } from '@prisma/client';");
    });

    it('should not flag local exports without from clause', () => {
      const code = `
        const localVal = 42;
        export { localVal };
      `;
      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Negative cases: dynamic import() and require() in CallExpression', () => {
    it('should catch dynamic import() calls with exact position', () => {
      const code = [
        "export async function initDb() {",
        "  const { PrismaClient } = await import('@prisma/client');",
        "  return new PrismaClient();",
        "}",
      ].join('\n');

      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBe(34);
      expect(violations[0].snippet).toContain("await import('@prisma/client');");
    });

    it('should catch CommonJS require() calls', () => {
      const code = [
        "function getPrisma() {",
        "  const prisma = require('@prisma/client');",
        "  return prisma;",
        "}",
      ].join('\n');

      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBe(18);
      expect(violations[0].snippet).toContain("require('@prisma/client')");
    });

    it('should handle template literals without substitution', () => {
      const code = "const p = require(`@prisma/client`);";
      const violations = matchImportInvariants(code, 'src/views/UserView.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
    });
  });

  describe('Relative imports & Glob patterns', () => {
    it('should catch relative import matching forbidden directory glob', () => {
      const code = "import { UserRepo } from '../repositories/user.repo.js';";
      const violations = matchImportInvariants(code, 'src/views/user-card.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
      expect(violations[0].message).toContain('forbids import "../repositories/user.repo.js"');
    });

    it('should catch deep relative import matching forbidden directory glob', () => {
      const code = "import { UserRepo } from '../../repositories/user.repo.js';";
      const violations = matchImportInvariants(code, 'src/views/sub/user-card.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
      expect(violations[0].message).toContain('forbids import "../../repositories/user.repo.js"');
    });

    it('should allow relative import not matching forbidden directory', () => {
      const code = "import { UserCard } from './user-card-header.js';";
      const violations = matchImportInvariants(code, 'src/views/user-card.tsx', [forbidPrismaRule]);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Scope and in_path filtering', () => {
    it('should not check files outside in_path', () => {
      const code = "import { PrismaClient } from '@prisma/client';";
      // File in src/repositories/ is NOT in src/views/**
      const violations = matchImportInvariants(code, 'src/repositories/user.repo.ts', [forbidPrismaRule]);
      expect(violations).toHaveLength(0);
    });

    it('should respect comma-separated in_path patterns', () => {
      const multiPathRule: InvariantRule = {
        id: 'FORBID_IN_VIEWS_AND_COMPONENTS',
        severity: 'critical',
        desc: 'Forbidden in views or components',
        pattern: {
          forbid_import: ['@prisma/client'],
          in_path: 'src/views/**, src/components/**',
        },
      };

      const code = "import { PrismaClient } from '@prisma/client';";
      expect(matchImportInvariants(code, 'src/views/Page.tsx', [multiPathRule])).toHaveLength(1);
      expect(matchImportInvariants(code, 'src/components/Card.tsx', [multiPathRule])).toHaveLength(1);
      expect(matchImportInvariants(code, 'src/services/Service.ts', [multiPathRule])).toHaveLength(0);
    });

    it('should support scope field as well as in_path', () => {
      const scopeRule: InvariantRule = {
        id: 'SCOPE_FORBID_RULE',
        severity: 'warning',
        desc: 'Forbid via scope',
        pattern: {
          forbid_import: ['axios'],
          scope: 'src/models/**',
        },
      };

      const code = "import axios from 'axios';";
      expect(matchImportInvariants(code, 'src/models/user.model.ts', [scopeRule])).toHaveLength(1);
      expect(matchImportInvariants(code, 'src/controllers/user.controller.ts', [scopeRule])).toHaveLength(0);
    });

    it('should apply to all files if neither in_path nor scope is specified', () => {
      const globalRule: InvariantRule = {
        id: 'GLOBAL_FORBID_TELNET',
        severity: 'critical',
        desc: 'Telnet is globally forbidden',
        pattern: {
          forbid_import: ['telnet-client'],
        },
      };

      const code = "import Telnet from 'telnet-client';";
      expect(matchImportInvariants(code, 'src/anywhere/file.ts', [globalRule])).toHaveLength(1);
      expect(matchImportInvariants(code, 'tests/helper.ts', [globalRule])).toHaveLength(1);
    });
  });

  describe('Accepts ts.SourceFile as well as string', () => {
    it('should work with pre-parsed ts.SourceFile', () => {
      const code = "import { PrismaClient } from '@prisma/client';";
      const sf = ts.createSourceFile('src/views/test.ts', code, ts.ScriptTarget.Latest, true);
      const violations = matchImportInvariants(sf, 'src/views/test.ts', [forbidPrismaRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array when rules array is empty', () => {
      const code = "import { PrismaClient } from '@prisma/client';";
      expect(matchImportInvariants(code, 'src/views/test.ts', [])).toEqual([]);
    });

    it('should ignore rules without forbid_import', () => {
      const sequenceRule: InvariantRule = {
        id: 'SEQ_RULE',
        severity: 'critical',
        desc: 'Sequence rule',
        pattern: {
          must_precede: ['db.save'],
          target: ['llm.call'],
        },
      };

      const code = "import { PrismaClient } from '@prisma/client';";
      expect(matchImportInvariants(code, 'src/views/test.ts', [sequenceRule])).toEqual([]);
    });
  });
});
