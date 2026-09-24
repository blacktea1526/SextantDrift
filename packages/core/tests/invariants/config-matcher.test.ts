import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { InvariantRule } from '../../src/types/architecture.js';
import {
  matchConfigInvariants,
  getObjectLiteralPropertyNames,
} from '../../src/invariants/config-matcher.js';

describe('AST Config Matcher (require_config)', () => {
  const axiosTimeoutRule: InvariantRule = {
    id: 'AXIOS_REQUIRE_TIMEOUT',
    severity: 'critical',
    desc: 'All axios calls must explicitly set timeout',
    pattern: {
      target: ['axios.get', 'axios.post'],
      require_config: ['timeout'],
      scope: 'src/services/**',
    },
  };

  const targetedExternalCallRule: InvariantRule = {
    id: 'EXTERNAL_CALL_REQUIRE_TIMEOUT',
    severity: 'warning',
    desc: 'External network calls must configure timeout',
    pattern: {
      target: ['fetch', 'httpClient.request', 'apiClient.call'],
      require_config: ['timeout'],
      scope: 'src/api/**',
    },
  };

  describe('getObjectLiteralPropertyNames helper', () => {
    it('should extract property names from various property syntaxes', () => {
      const code = `
        const obj = {
          timeout: 5000,
          'retries': 3,
          ["maxRedirects"]: 5,
          shorthandProp,
          method() {},
          get accessor() { return 1; },
          set accessor(v) {}
        };
      `;
      const sf = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
      const varDecl = (sf.statements[0] as ts.VariableStatement).declarationList.declarations[0];
      const obj = varDecl.initializer as ts.ObjectLiteralExpression;
      const names = getObjectLiteralPropertyNames(obj);

      expect(names.has('timeout')).toBe(true);
      expect(names.has('retries')).toBe(true);
      expect(names.has('maxRedirects')).toBe(true);
      expect(names.has('shorthandProp')).toBe(true);
      expect(names.has('method')).toBe(true);
      expect(names.has('accessor')).toBe(true);
    });
  });

  describe('Explicit target pattern matching', () => {
    it('should pass with 0 violations when timeout is provided', () => {
      const code = `
        export async function fetchUser() {
          return await axios.get('https://api.example.com/user', { timeout: 3000 });
        }
      `;
      const violations = matchConfigInvariants(code, 'src/services/user.service.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(0);
    });

    it('should accept shorthand and computed properties', () => {
      const code = `
        export async function fetchUser() {
          const timeout = 3000;
          await axios.get('https://api.example.com/user', { timeout });
          await axios.post('https://api.example.com/user', {}, { ['timeout']: 5000 });
        }
      `;
      const violations = matchConfigInvariants(code, 'src/services/user.service.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(0);
    });

    it('should accept type assertion expressions', () => {
      const code = `
        export async function fetchUser() {
          return await axios.get('https://api.example.com/user', ({ timeout: 3000 } as any));
        }
      `;
      const violations = matchConfigInvariants(code, 'src/services/user.service.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(0);
    });

    it('should emit violation when no config object is passed to targeted call', () => {
      const code = [
        "export async function fetchUser() {",
        "  return await axios.get('https://api.example.com/user');",
        "}",
      ].join('\n');

      const violations = matchConfigInvariants(code, 'src/services/user.service.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].id).toBe('INVARIANT_AXIOS_REQUIRE_TIMEOUT_2_16');
      expect(violations[0].type).toBe('INVARIANT_BROKEN');
      expect(violations[0].severity).toBe('critical');
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBe(16);
      expect(violations[0].snippet).toContain("axios.get('https://api.example.com/user')");
      expect(violations[0].message).toContain('no config object was provided');
      expect(violations[0].suggestion).toContain('Pass a configuration object');
    });

    it('should emit violation when config object is missing required key', () => {
      const code = [
        "export async function postData() {",
        "  return await axios.post('https://api.example.com/data', {}, {",
        "    headers: { 'Authorization': 'token' }",
        "  });",
        "}",
      ].join('\n');

      const violations = matchConfigInvariants(code, 'src/services/user.service.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBe(16);
      expect(violations[0].message).toContain('missing required config: ["timeout"]');
      expect(violations[0].suggestion).toContain('Add missing configuration property');
    });

    it('should support wildcard targets like *.get', () => {
      const wildcardRule: InvariantRule = {
        id: 'HTTP_CLIENT_TIMEOUT',
        severity: 'critical',
        desc: 'All HTTP get/post calls require timeout',
        pattern: {
          target: ['*.get', '*.post'],
          require_config: ['timeout'],
        },
      };

      const code = `
        await httpClient.get('/items');
        await this.api.post('/items', { timeout: 1000 });
      `;

      const violations = matchConfigInvariants(code, 'src/client.ts', [wildcardRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
      expect(violations[0].snippet).toContain("httpClient.get('/items')");
    });
  });

  describe('Explicit target requirement (Zero False Positives)', () => {
    it('should audit calls matching target patterns when object arg lacks required config', () => {
      const code = [
        "export async function test() {",
        "  await fetch('https://api.com', { method: 'POST' });",
        "  await httpClient.request({ url: '/test' });",
        "  await apiClient.call({ action: 'send' });",
        "}",
      ].join('\n');

      const violations = matchConfigInvariants(code, 'src/api/endpoint.ts', [targetedExternalCallRule]);
      expect(violations).toHaveLength(3);
      expect(violations[0].line).toBe(2);
      expect(violations[0].snippet).toContain("fetch('https://api.com'");
      expect(violations[1].line).toBe(3);
      expect(violations[1].snippet).toContain("httpClient.request");
      expect(violations[2].line).toBe(4);
      expect(violations[2].snippet).toContain("apiClient.call");
    });

    it('should pass when timeout is configured on targeted calls', () => {
      const code = `
        export async function test() {
          await fetch('https://api.com', { method: 'POST', timeout: 5000 });
          await httpClient.request({ url: '/test', timeout: 3000 });
        }
      `;
      const violations = matchConfigInvariants(code, 'src/api/endpoint.ts', [targetedExternalCallRule]);
      expect(violations).toHaveLength(0);
    });

    it('should NOT produce false positives on Map.get or Cache.get with options (Zero False Positives)', () => {
      const code = `
        export function normalOperations() {
          // Plain Map.get or Cache.get with options object MUST NOT be falsely flagged
          const m = new Map<string, string>();
          m.get('key', { ttlMs: 30 });
          const item = cache.get('user_123', { force: true });
          const value = map.get(key);
          const header = req.get('Content-Type');
          const elem = list.get(0);
          console.log('hello');
          Math.max(1, 2);
          array.filter((x) => x > 0);
          return item;
        }
      `;
      const violations = matchConfigInvariants(code, 'src/api/service.ts', [targetedExternalCallRule]);
      expect(violations).toHaveLength(0);
    });

    it('should safely skip when target is not specified without guessing via regex heuristics', () => {
      const untargetedRule: InvariantRule = {
        id: 'UNSPECIFIED_TARGET_RULE',
        severity: 'warning',
        desc: 'Untargeted config rule',
        pattern: {
          require_config: ['timeout'],
          scope: 'src/api/**',
        },
      };
      const code = `
        const m = new Map<string, string>();
        m.get('k', { ttlMs: 30 });
      `;
      const violations = matchConfigInvariants(code, 'src/api/service.ts', [untargetedRule]);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Multiple required configs', () => {
    it('should report missing configs when partially satisfied', () => {
      const multiConfigRule: InvariantRule = {
        id: 'REQ_TIMEOUT_AND_RETRIES',
        severity: 'critical',
        desc: 'Calls must configure both timeout and retries',
        pattern: {
          target: ['fetch'],
          require_config: ['timeout', 'retries'],
        },
      };

      const code = "await fetch('/url', { timeout: 3000 });";
      const violations = matchConfigInvariants(code, 'src/api.ts', [multiConfigRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].message).toContain('missing required config: ["retries"]');
    });

    it('should pass when all required configs are present', () => {
      const multiConfigRule: InvariantRule = {
        id: 'REQ_TIMEOUT_AND_RETRIES',
        severity: 'critical',
        desc: 'Calls must configure both timeout and retries',
        pattern: {
          target: ['fetch'],
          require_config: ['timeout', 'retries'],
        },
      };

      const code = "await fetch('/url', { timeout: 3000, retries: 2 });";
      const violations = matchConfigInvariants(code, 'src/api.ts', [multiConfigRule]);
      expect(violations).toHaveLength(0);
    });
  });

  describe('Scope and in_path filtering', () => {
    it('should skip files outside scope', () => {
      const code = "await axios.get('https://api.com');";
      // File in src/utils/ is outside src/services/**
      const violations = matchConfigInvariants(code, 'src/utils/http.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(0);
    });

    it('should support in_path as alternative to scope', () => {
      const inPathRule: InvariantRule = {
        id: 'IN_PATH_RULE',
        severity: 'warning',
        desc: 'In path rule',
        pattern: {
          in_path: 'src/controllers/**',
          target: ['fetch'],
          require_config: ['timeout'],
        },
      };

      const code = "fetch('https://api.com');";
      expect(matchConfigInvariants(code, 'src/controllers/user.controller.ts', [inPathRule])).toHaveLength(1);
      expect(matchConfigInvariants(code, 'src/services/user.service.ts', [inPathRule])).toHaveLength(0);
    });
  });

  describe('Accepts ts.SourceFile as well as string', () => {
    it('should work with pre-parsed ts.SourceFile', () => {
      const code = "await axios.get('https://api.com');";
      const sf = ts.createSourceFile('src/services/user.ts', code, ts.ScriptTarget.Latest, true);
      const violations = matchConfigInvariants(sf, 'src/services/user.ts', [axiosTimeoutRule]);
      expect(violations).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array when rules array is empty', () => {
      const code = "await axios.get('https://api.com');";
      expect(matchConfigInvariants(code, 'src/services/user.ts', [])).toEqual([]);
    });

    it('should ignore rules without require_config', () => {
      const sequenceRule: InvariantRule = {
        id: 'SEQ_RULE',
        severity: 'critical',
        desc: 'Sequence rule',
        pattern: {
          must_precede: ['db.save'],
          target: ['llm.call'],
        },
      };

      const code = "await axios.get('https://api.com');";
      expect(matchConfigInvariants(code, 'src/services/user.ts', [sequenceRule])).toEqual([]);
    });
  });
});
