import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { InvariantRule } from '../../src/types/architecture.js';
import {
  matchSequenceInvariants,
  matchesScope,
  getCalleeExpressionName,
  findMatchingPattern,
} from '../../src/invariants/sequence-matcher.js';

describe('AST Sequence Matcher (must_precede)', () => {
  const persistBeforeExternalRule: InvariantRule = {
    id: 'PERSIST_BEFORE_EXTERNAL',
    severity: 'critical',
    desc: 'User data must be persisted before calling external AI services or payments',
    pattern: {
      must_precede: ['db.save', 'repo.create', 'orm.save'],
      target: ['llmService.call', 'aiClient.chat', 'payment.charge'],
      scope: 'src/controllers/**',
    },
  };

  describe('matchesScope helper', () => {
    it('should match paths within wildcard scope', () => {
      expect(matchesScope('src/controllers/user.controller.ts', 'src/controllers/**')).toBe(true);
      expect(matchesScope('src/controllers/sub/auth.ts', 'src/controllers/**')).toBe(true);
    });

    it('should reject paths outside scope', () => {
      expect(matchesScope('src/services/ai.service.ts', 'src/controllers/**')).toBe(false);
      expect(matchesScope('tests/controllers/user.test.ts', 'src/controllers/**')).toBe(false);
    });

    it('should handle comma-separated scope patterns', () => {
      const multiScope = 'src/controllers/**, src/api/**';
      expect(matchesScope('src/controllers/user.ts', multiScope)).toBe(true);
      expect(matchesScope('src/api/auth.ts', multiScope)).toBe(true);
      expect(matchesScope('src/services/repo.ts', multiScope)).toBe(false);
    });

    it('should match any file when scope is undefined or empty', () => {
      expect(matchesScope('src/anything.ts', undefined)).toBe(true);
      expect(matchesScope('src/anything.ts', '')).toBe(true);
    });

    it('should normalize leading slash and ./ prefix', () => {
      expect(matchesScope('./src/controllers/user.ts', 'src/controllers/**')).toBe(true);
      expect(matchesScope('/src/controllers/user.ts', 'src/controllers/**')).toBe(true);
      expect(matchesScope('src/controllers/user.ts', './src/controllers/**')).toBe(true);
    });
  });

  describe('getCalleeExpressionName helper', () => {
    it('should extract identifier name', () => {
      const sf = ts.createSourceFile('test.ts', 'callExternal()', ts.ScriptTarget.Latest, true);
      const call = (sf.statements[0] as ts.ExpressionStatement).expression as ts.CallExpression;
      expect(getCalleeExpressionName(call.expression)).toBe('callExternal');
    });

    it('should extract property access expression name', () => {
      const sf = ts.createSourceFile('test.ts', 'db.save()', ts.ScriptTarget.Latest, true);
      const call = (sf.statements[0] as ts.ExpressionStatement).expression as ts.CallExpression;
      expect(getCalleeExpressionName(call.expression)).toBe('db.save');
    });

    it('should extract this-prefixed property access name', () => {
      const sf = ts.createSourceFile('test.ts', 'this.db.save()', ts.ScriptTarget.Latest, true);
      const call = (sf.statements[0] as ts.ExpressionStatement).expression as ts.CallExpression;
      expect(getCalleeExpressionName(call.expression)).toBe('this.db.save');
    });

    it('should unwrap parentheses and type assertions', () => {
      const sf = ts.createSourceFile(
        'test.ts',
        '((this.db as any)!.save)()',
        ts.ScriptTarget.Latest,
        true
      );
      const call = (sf.statements[0] as ts.ExpressionStatement).expression as ts.CallExpression;
      expect(getCalleeExpressionName(call.expression)).toBe('this.db.save');
    });
  });

  describe('findMatchingPattern helper', () => {
    const patterns = ['db.save', 'repo.create', 'callExternal'];

    it('should match exact string', () => {
      expect(findMatchingPattern('db.save', patterns)).toBe('db.save');
      expect(findMatchingPattern('callExternal', patterns)).toBe('callExternal');
    });

    it('should match this-prefixed callee by stripping "this."', () => {
      expect(findMatchingPattern('this.db.save', patterns)).toBe('db.save');
    });

    it('should return null for non-matching callee', () => {
      expect(findMatchingPattern('other.call', patterns)).toBeNull();
      expect(findMatchingPattern('console.log', patterns)).toBeNull();
    });

    it('should support glob wildcard patterns', () => {
      expect(findMatchingPattern('userRepo.create', ['*.create'])).toBe('*.create');
      expect(findMatchingPattern('this.userRepo.create', ['*.create'])).toBe('*.create');
    });
  });

  describe('Positive Test Cases (Compliant Sequences)', () => {
    it('should pass when db.save() is called before llmService.call() in an async function', () => {
      const code = `
        export async function handleRequest() {
          await db.save();
          await llmService.call();
        }
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/chat.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass when const user = await repo.create(...) is followed by await aiClient.chat(...)', () => {
      const code = `
        export async function createUser(data: any) {
          const user = await repo.create(data);
          const response = await aiClient.chat(user);
          return response;
        }
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/user.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass with class method using this.db.save() before this.llmService.call()', () => {
      const code = `
        export class ChatController {
          async process() {
            await this.db.save();
            const result = await this.llmService.call();
            return result;
          }
        }
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/chat.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass with arrow functions using compliant sequence', () => {
      const code = `
        export const handleChat = async () => {
          await orm.save();
          await payment.charge();
        };
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/payment.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass with function expressions using compliant sequence', () => {
      const code = `
        const handler = async function() {
          await db.save();
          return await llmService.call();
        };
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/handler.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('should pass when multiple target calls occur after a single must_precede call', () => {
      const code = `
        export async function multiChat() {
          await db.save();
          await llmService.call();
          await aiClient.chat();
        }
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/multi.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });
  });

  describe('Negative Test Cases (Invariant Violations)', () => {
    it('Negative case 1: should detect 100% violation when llmService.call() has no prior db.save()', () => {
      const code = `
export async function directCall() {
  const result = await llmService.call();
  return result;
}
      `.trim();

      const violations = matchSequenceInvariants(
        code,
        'src/controllers/direct.controller.ts',
        [persistBeforeExternalRule]
      );

      expect(violations).toHaveLength(1);
      const violation = violations[0];

      expect(violation.type).toBe('INVARIANT_BROKEN');
      expect(violation.severity).toBe('critical');
      expect(violation.ruleId).toBe('PERSIST_BEFORE_EXTERNAL');
      expect(violation.ruleDesc).toBe(persistBeforeExternalRule.desc);
      expect(violation.sourceFile).toBe('src/controllers/direct.controller.ts');
      expect(violation.line).toBe(2);
      expect(violation.column).toBe(24);
      expect(violation.snippet).toBe('const result = await llmService.call();');
      expect(violation.id).toBe('INVARIANT_PERSIST_BEFORE_EXTERNAL_2_24');
      expect(violation.message).toContain('no preceding call was found');
      expect(violation.message).toContain('llmService.call');
    });

    it('Negative case 2: should detect order inversion when llmService.call() is called before db.save()', () => {
      const code = `
export async function invertedOrder() {
  await llmService.call();
  await db.save();
}
      `.trim();

      const violations = matchSequenceInvariants(
        code,
        'src/controllers/inverted.controller.ts',
        [persistBeforeExternalRule]
      );

      expect(violations).toHaveLength(1);
      const violation = violations[0];

      expect(violation.type).toBe('INVARIANT_BROKEN');
      expect(violation.severity).toBe('critical');
      expect(violation.ruleId).toBe('PERSIST_BEFORE_EXTERNAL');
      expect(violation.line).toBe(2);
      expect(violation.column).toBe(9);
      expect(violation.snippet).toBe('await llmService.call();');
      expect(violation.id).toBe('INVARIANT_PERSIST_BEFORE_EXTERNAL_2_9');
      expect(violation.message).toContain('inverted order');
      expect(violation.message).toContain('llmService.call');
      expect(violation.message).toContain('db.save');
    });

    it('should detect multiple violations when multiple target calls precede must_precede call', () => {
      const code = `
export async function doubleInversion() {
  await llmService.call();
  await aiClient.chat();
  await db.save();
}
      `.trim();

      const violations = matchSequenceInvariants(
        code,
        'src/controllers/double.controller.ts',
        [persistBeforeExternalRule]
      );

      expect(violations).toHaveLength(2);
      expect(violations[0].line).toBe(2);
      expect(violations[0].snippet).toBe('await llmService.call();');
      expect(violations[1].line).toBe(3);
      expect(violations[1].snippet).toBe('await aiClient.chat();');
    });
  });

  describe('Scope Isolation & Noise Defense', () => {
    it('Scope isolation: file outside scope with target call produces 0 violations', () => {
      const code = `
export async function backgroundWorker() {
  // Service layer or outside controller scope: rule scope is "src/controllers/**"
  await llmService.call();
}
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/services/ai.service.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('False positive defense: comments or unrelated calls do not trigger violations', () => {
      const code = `
// db.save();
// await llmService.call();
export async function helper() {
  /* orm.save() */
  other.call();
  console.log("llmService.call()");
  const dummy = "payment.charge()";
}
      `;
      const violations = matchSequenceInvariants(
        code,
        'src/controllers/noise.controller.ts',
        [persistBeforeExternalRule]
      );
      expect(violations).toHaveLength(0);
    });

    it('Nested function isolation: call in inner function does not satisfy outer function requirement', () => {
      const code = `
export function outerHandler() {
  const innerHelper = () => {
    db.save();
  };
  llmService.call();
}
      `.trim();

      const violations = matchSequenceInvariants(
        code,
        'src/controllers/nested.controller.ts',
        [persistBeforeExternalRule]
      );

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(5);
      expect(violations[0].snippet).toBe('llmService.call();');
      expect(violations[0].message).toContain('no preceding call was found');
    });

    it('Nested function isolation: call in outer function does not satisfy inner function requirement', () => {
      const code = `
export function outerHandler() {
  db.save();
  const innerHelper = () => {
    llmService.call();
  };
}
      `.trim();

      const violations = matchSequenceInvariants(
        code,
        'src/controllers/nested2.controller.ts',
        [persistBeforeExternalRule]
      );

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(4);
      expect(violations[0].snippet).toBe('llmService.call();');
      expect(violations[0].message).toContain('no preceding call was found');
    });
  });

  describe('Identifier calls & ts.SourceFile direct input', () => {
    const identifierRule: InvariantRule = {
      id: 'IDENTIFIER_CALL_RULE',
      severity: 'warning',
      desc: 'persistData must precede invokeExternal',
      pattern: {
        must_precede: ['persistData'],
        target: ['invokeExternal'],
      },
    };

    it('should detect violation with top-level identifier calls in inverted sequence', () => {
      const code = `
function test() {
  invokeExternal();
  persistData();
}
      `.trim();

      const violations = matchSequenceInvariants(code, 'src/test.ts', [identifierRule]);
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('IDENTIFIER_CALL_RULE');
      expect(violations[0].severity).toBe('warning');
      expect(violations[0].message).toContain('inverted order');
      expect(violations[0].suggestion).toContain('Move "persistData" before "invokeExternal"');
    });

    it('should accept pre-created ts.SourceFile directly', () => {
      const code = `
function test() {
  invokeExternal();
}
      `.trim();

      const sourceFile = ts.createSourceFile('src/test.ts', code, ts.ScriptTarget.Latest, true);
      const violations = matchSequenceInvariants(sourceFile, 'src/test.ts', [identifierRule]);

      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(2);
      expect(violations[0].column).toBe(3);
      expect(violations[0].snippet).toBe('invokeExternal();');
    });

    it('should ignore rules without must_precede or target pattern', () => {
      const nonSequenceRule: InvariantRule = {
        id: 'FORBID_IMPORT_RULE',
        severity: 'critical',
        desc: 'Forbid import rule',
        pattern: {
          forbid_import: ['@prisma/client'],
        },
      };

      const code = `
function test() {
  llmService.call();
}
      `;
      const violations = matchSequenceInvariants(code, 'src/test.ts', [nonSequenceRule]);
      expect(violations).toHaveLength(0);
    });
  });
});
