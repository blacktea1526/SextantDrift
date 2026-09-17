import { describe, it, expect, vi } from 'vitest';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { InvariantRule } from '../../src/types/architecture.js';
import { executeInvariantsEngine } from '../../src/invariants/engine.js';

describe('Invariant Orchestration Engine (executeInvariantsEngine)', () => {
  const sequenceRule: InvariantRule = {
    id: 'AUTH_BEFORE_QUERY',
    severity: 'critical',
    desc: 'auth.verify must precede db.query',
    pattern: {
      must_precede: ['auth.verify'],
      target: ['db.query'],
      scope: 'src/controllers/**',
    },
  };

  const importRule: InvariantRule = {
    id: 'NO_RAW_SQL_DRIVER',
    severity: 'critical',
    desc: 'Do not import raw pg or mysql driver in controllers',
    pattern: {
      forbid_import: ['pg', 'mysql2'],
      in_path: 'src/controllers/**',
    },
  };

  const configRule: InvariantRule = {
    id: 'REQUIRE_TIMEOUT_ON_FETCH',
    severity: 'warning',
    desc: 'External HTTP calls must declare a timeout',
    pattern: {
      target: ['httpClient.get', 'fetch'],
      require_config: ['timeout'],
      scope: 'src/controllers/**',
    },
  };

  const allRules: InvariantRule[] = [sequenceRule, importRule, configRule];

  describe('Edge Cases & Empty Inputs', () => {
    it('should return empty array when rules list is empty', () => {
      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/controllers/user.ts'],
        rules: [],
      });
      expect(violations).toEqual([]);
    });

    it('should return empty array when filePaths list is empty', () => {
      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: [],
        rules: allRules,
      });
      expect(violations).toEqual([]);
    });

    it('should return empty array when rules have no executable capabilities', () => {
      const dummyRule: InvariantRule = {
        id: 'DUMMY_RULE',
        severity: 'info',
        desc: 'Dummy empty pattern',
        pattern: {},
      };
      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/controllers/user.ts'],
        rules: [dummyRule],
      });
      expect(violations).toEqual([]);
    });

    it('should gracefully ignore files that do not exist on disk without throwing', () => {
      const violations = executeInvariantsEngine({
        rootDir: '/non/existent/root/dir',
        filePaths: ['missing/file.ts'],
        rules: allRules,
      });
      expect(violations).toEqual([]);
    });
  });

  describe('Scope Isolation', () => {
    it('should ignore violations in files outside rule scope', () => {
      const contentMap = new Map<string, string>([
        [
          'src/services/user.service.ts',
          `
            import { Client } from 'pg';
            export async function search() {
              await db.query();
              fetch('http://example.com');
            }
          `,
        ],
      ]);

      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/services/user.service.ts'],
        rules: allRules,
        fileContentMap: contentMap,
      });

      // All 3 rules have scope/in_path: "src/controllers/**", so "src/services/**" should be untouched
      expect(violations).toHaveLength(0);
    });
  });

  describe('Compliant Code Execution', () => {
    it('should return 0 violations when all rules are properly followed', () => {
      const contentMap = new Map<string, string>([
        [
          'src/controllers/user.controller.ts',
          `
            import { safeHelper } from '../helpers/safe.js';

            export async function handleUser(req: any) {
              await auth.verify(req);
              const data = await db.query('SELECT * FROM users');
              const res = await httpClient.get('http://api.internal', { timeout: 3000 });
              return { data, res };
            }
          `,
        ],
      ]);

      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/controllers/user.controller.ts'],
        rules: allRules,
        fileContentMap: contentMap,
      });

      expect(violations).toHaveLength(0);
    });
  });

  describe('Combined Multi-Rule Detection on a Single File', () => {
    it('should simultaneously detect sequence, import, and config violations in a single file', () => {
      const code = `
        import { Client } from 'pg';

        export async function handleRequest() {
          // Invariant violation 1: db.query without preceding auth.verify
          await db.query('SELECT 1');

          // Invariant violation 2: httpClient.get without timeout config
          await httpClient.get('http://api.external');
        }
      `.trim();

      const contentMap = new Map<string, string>([
        ['src/controllers/bad.controller.ts', code],
      ]);

      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/controllers/bad.controller.ts'],
        rules: allRules,
        fileContentMap: contentMap,
      });

      expect(violations).toHaveLength(3);

      // 1. Import violation
      const impViol = violations.find((v) => v.ruleId === 'NO_RAW_SQL_DRIVER');
      expect(impViol).toBeDefined();
      expect(impViol?.type).toBe('INVARIANT_BROKEN');
      expect(impViol?.severity).toBe('critical');
      expect(impViol?.sourceFile).toBe('src/controllers/bad.controller.ts');
      expect(impViol?.line).toBe(1);
      expect(impViol?.snippet).toContain("import { Client } from 'pg'");

      // 2. Sequence violation
      const seqViol = violations.find((v) => v.ruleId === 'AUTH_BEFORE_QUERY');
      expect(seqViol).toBeDefined();
      expect(seqViol?.type).toBe('INVARIANT_BROKEN');
      expect(seqViol?.severity).toBe('critical');
      expect(seqViol?.sourceFile).toBe('src/controllers/bad.controller.ts');
      expect(seqViol?.line).toBe(5);
      expect(seqViol?.snippet).toContain("await db.query('SELECT 1');");

      // 3. Config violation
      const cfgViol = violations.find((v) => v.ruleId === 'REQUIRE_TIMEOUT_ON_FETCH');
      expect(cfgViol).toBeDefined();
      expect(cfgViol?.type).toBe('INVARIANT_BROKEN');
      expect(cfgViol?.severity).toBe('warning');
      expect(cfgViol?.sourceFile).toBe('src/controllers/bad.controller.ts');
      expect(cfgViol?.line).toBe(8);
      expect(cfgViol?.snippet).toContain("await httpClient.get('http://api.external');");
    });
  });

  describe('Multi-File Aggregation', () => {
    it('should aggregate violations across multiple files while skipping compliant ones', () => {
      const file1 = `
        import { Client } from 'pg';
        export const x = 1;
      `;
      const file2 = `
        export async function run() {
          await db.query();
        }
      `;
      const file3 = `
        export async function clean() {
          await auth.verify();
          await db.query();
        }
      `;

      const contentMap = new Map<string, string>([
        ['src/controllers/f1.controller.ts', file1],
        ['src/controllers/f2.controller.ts', file2],
        ['src/controllers/f3.controller.ts', file3],
      ]);

      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: [
          'src/controllers/f1.controller.ts',
          'src/controllers/f2.controller.ts',
          'src/controllers/f3.controller.ts',
        ],
        rules: allRules,
        fileContentMap: contentMap,
      });

      expect(violations).toHaveLength(2);
      expect(violations.some((v) => v.sourceFile === 'src/controllers/f1.controller.ts')).toBe(true);
      expect(violations.some((v) => v.sourceFile === 'src/controllers/f2.controller.ts')).toBe(true);
      expect(violations.some((v) => v.sourceFile === 'src/controllers/f3.controller.ts')).toBe(false);
    });
  });

  describe('Single-Pass AST Parsing & Caching Optimization', () => {
    it('should populate sourceFilesMap with parsed ts.SourceFile for reuse', () => {
      const contentMap = new Map<string, string>([
        [
          'src/controllers/perf.controller.ts',
          `
            import 'mysql2';
            export async function test() {
              await db.query();
              fetch('http://example.com');
            }
          `,
        ],
      ]);

      const sourceFilesMap = new Map<string, ts.SourceFile>();

      const violations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/controllers/perf.controller.ts'],
        rules: allRules, // Has sequence, import, and config rules!
        fileContentMap: contentMap,
        sourceFilesMap,
      });

      expect(violations).toHaveLength(3);
      expect(sourceFilesMap.has('src/controllers/perf.controller.ts')).toBe(true);

      const cachedSf = sourceFilesMap.get('src/controllers/perf.controller.ts')!;
      expect(cachedSf).toBeDefined();
      expect(cachedSf.fileName).toBe('src/controllers/perf.controller.ts');

      // Subsequent call reuses the exact same AST instance from sourceFilesMap
      const secondViolations = executeInvariantsEngine({
        rootDir: '/fake/root',
        filePaths: ['src/controllers/perf.controller.ts'],
        rules: allRules,
        sourceFilesMap,
      });

      expect(secondViolations).toEqual(violations);
      expect(sourceFilesMap.get('src/controllers/perf.controller.ts')).toBe(cachedSf);
    });

    it('should directly reuse pre-cached sourceFilesMap without needing fileContentMap or disk file', () => {
      const code = `
        import 'mysql2';
        export async function test() {
          await db.query();
        }
      `;
      const relPath = 'src/controllers/cached.controller.ts';
      const sf = ts.createSourceFile(relPath, code, ts.ScriptTarget.Latest, true);

      const sourceFilesMap = new Map<string, ts.SourceFile>([[relPath, sf]]);

      // Notice: No fileContentMap, and file does not exist on disk in '/non/existent/root'!
      // Engine should successfully use the pre-parsed AST from sourceFilesMap.
      const violations = executeInvariantsEngine({
        rootDir: '/non/existent/root',
        filePaths: [relPath],
        rules: allRules,
        sourceFilesMap,
      });

      expect(violations).toHaveLength(2);
      expect(violations.some((v) => v.ruleId === 'NO_RAW_SQL_DRIVER')).toBe(true);
      expect(violations.some((v) => v.ruleId === 'AUTH_BEFORE_QUERY')).toBe(true);
    });
  });

  describe('Disk-based File Execution', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-engine-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should read files from disk when fileContentMap is not provided', () => {
      const controllerDir = path.join(tmpDir, 'src', 'controllers');
      fs.mkdirSync(controllerDir, { recursive: true });

      const filePath = path.join(controllerDir, 'disk.controller.ts');
      fs.writeFileSync(
        filePath,
        `
import { Pool } from 'pg';

export async function diskAction() {
  await db.query();
}
`.trim()
      );

      const violations = executeInvariantsEngine({
        rootDir: tmpDir,
        filePaths: ['src/controllers/disk.controller.ts'],
        rules: allRules,
      });

      expect(violations).toHaveLength(2);
      expect(violations[0].sourceFile).toBe('src/controllers/disk.controller.ts');
    });
  });
});
