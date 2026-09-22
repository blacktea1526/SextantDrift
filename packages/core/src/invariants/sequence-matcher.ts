import ts from 'typescript';
import { InvariantRule } from '../types/architecture.js';
import { ViolationEvidence } from '../types/report.js';
import { getCachedGlobRegExp } from '../analyzer/noise-filter.js';

/**
 * Checks if a file path matches the given scope pattern (supports comma-separated globs).
 * If scope is not specified or empty, matches all files.
 */
export function matchesScope(filePath: string, scope?: string): boolean {
  if (!scope || !scope.trim()) {
    return true;
  }
  const normalizedFile = filePath.split('\\').join('/').replace(/^(\.\/|\/)/, '');
  const patterns = scope
    .split(',')
    .map((s) => s.trim().replace(/^(\.\/|\/)/, ''))
    .filter(Boolean);

  for (const pattern of patterns) {
    const reg = getCachedGlobRegExp(pattern);
    if (reg.test(normalizedFile)) {
      return true;
    }
  }
  return false;
}

/**
 * Unwraps parentheses, type assertions, and non-null assertions from an expression.
 */
export function unwrapExpression(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression;
    } else if (ts.isNonNullExpression(current)) {
      current = current.expression;
    } else if (ts.isAsExpression(current)) {
      current = current.expression;
    } else if (ts.isTypeAssertionExpression(current)) {
      current = current.expression;
    }
  }
  return current;
}

/**
 * Extracts a normalized callee name string from a call's callee expression.
 * Handles identifiers ('callExternal') and property access ('db.save', 'this.db.save').
 */
export function getCalleeExpressionName(expr: ts.Expression): string | null {
  const unwrapped = unwrapExpression(expr);
  if (ts.isIdentifier(unwrapped)) {
    return unwrapped.text;
  }
  if (unwrapped.kind === ts.SyntaxKind.ThisKeyword) {
    return 'this';
  }
  if (ts.isPropertyAccessExpression(unwrapped)) {
    const parentName = getCalleeExpressionName(unwrapped.expression);
    if (parentName) {
      return `${parentName}.${unwrapped.name.text}`;
    }
    return unwrapped.name.text;
  }
  return null;
}

/**
 * Checks if a callee name matches any pattern in the list.
 * Supports exact match, stripping 'this.' prefix, and glob wildcard patterns ('*.save').
 */
export function findMatchingPattern(calleeName: string, patterns: string[]): string | null {
  const strippedThis = calleeName.startsWith('this.') ? calleeName.slice(5) : null;

  for (const pattern of patterns) {
    if (pattern === calleeName) {
      return pattern;
    }
    if (strippedThis !== null && pattern === strippedThis) {
      return pattern;
    }
    if (pattern.includes('*')) {
      const reg = getCachedGlobRegExp(pattern);
      if (reg.test(calleeName) || (strippedThis !== null && reg.test(strippedThis))) {
        return pattern;
      }
    }
  }

  return null;
}

/**
 * Finds all CallExpression nodes in a statement without descending into nested function or class bodies.
 * Preserves evaluation order.
 */
function findCallsInStatement(stmt: ts.Statement): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];

  function walk(node: ts.Node) {
    // Boundary: do not descend into nested function or class bodies
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isClassExpression(node)
    ) {
      return;
    }

    // Children first so inner calls evaluate before outer calls
    ts.forEachChild(node, walk);

    if (ts.isCallExpression(node)) {
      calls.push(node);
    }
  }

  walk(stmt);
  return calls.sort((a, b) => a.getStart() - b.getStart());
}

interface StatementCallOccurrence {
  call: ts.CallExpression;
  calleeName: string;
  matchedPattern: string;
  statementIndex: number;
}

interface StatementBlockInfo {
  statements: readonly ts.Statement[];
  enclosingFunction: string;
}

function getEnclosingFunctionName(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) {
    return node.name ? node.name.text : '<anonymous_function>';
  }
  if (ts.isMethodDeclaration(node)) {
    return node.name.getText();
  }
  if (ts.isConstructorDeclaration(node)) {
    return 'constructor';
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
      return node.parent.name.text;
    }
    if (node.parent && ts.isPropertyAssignment(node.parent) && ts.isIdentifier(node.parent.name)) {
      return node.parent.name.text;
    }
    return '<anonymous_arrow>';
  }
  return '<top_level>';
}

/**
 * Traverses AST to find all statement blocks to evaluate:
 * 1. Top-level statements of the source file
 * 2. Function bodies with a block (FunctionDeclaration, MethodDeclaration, ArrowFunction, FunctionExpression, Constructor, Accessors)
 */
function collectStatementBlocks(sourceFile: ts.SourceFile): StatementBlockInfo[] {
  const blocks: StatementBlockInfo[] = [];

  // Top-level statements
  if (sourceFile.statements && sourceFile.statements.length > 0) {
    blocks.push({ statements: sourceFile.statements, enclosingFunction: '<top_level>' });
  }

  function visit(node: ts.Node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    ) {
      if (node.body && ts.isBlock(node.body)) {
        blocks.push({
          statements: node.body.statements,
          enclosingFunction: getEnclosingFunctionName(node),
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return blocks;
}

/**
 * Evaluates AST statement sequences against must_precede invariant rules.
 * Strictly operates within the same function or block scope (ADR-004).
 */
export function matchSequenceInvariants(
  sourceFileOrContent: ts.SourceFile | string,
  relPath: string,
  rules: InvariantRule[]
): ViolationEvidence[] {
  const sourceFile =
    typeof sourceFileOrContent === 'string'
      ? ts.createSourceFile(relPath, sourceFileOrContent, ts.ScriptTarget.Latest, true)
      : sourceFileOrContent;

  const applicableRules = rules.filter((rule) => {
    if (
      !rule.pattern.must_precede ||
      rule.pattern.must_precede.length === 0 ||
      !rule.pattern.target ||
      rule.pattern.target.length === 0
    ) {
      return false;
    }
    if (rule.pattern.scope && !matchesScope(relPath, rule.pattern.scope)) {
      return false;
    }
    return true;
  });

  if (applicableRules.length === 0) {
    return [];
  }

  const lines = sourceFile.text.split(/\r?\n/);
  function getLineSnippet(lineNumber: number): string {
    return lines[lineNumber - 1] ? lines[lineNumber - 1].trim() : '';
  }

  const blocks = collectStatementBlocks(sourceFile);
  const violations: ViolationEvidence[] = [];

  for (const block of blocks) {
    for (const rule of applicableRules) {
      const mustPrecedePatterns = rule.pattern.must_precede!;
      const targetPatterns = rule.pattern.target!;

      const mustPrecedeOccurrences: StatementCallOccurrence[] = [];
      const targetOccurrences: StatementCallOccurrence[] = [];

      for (let i = 0; i < block.statements.length; i++) {
        const stmt = block.statements[i];
        const calls = findCallsInStatement(stmt);

        for (const call of calls) {
          const calleeName = getCalleeExpressionName(call.expression);
          if (!calleeName) continue;

          const precedeMatch = findMatchingPattern(calleeName, mustPrecedePatterns);
          if (precedeMatch) {
            mustPrecedeOccurrences.push({
              call,
              calleeName,
              matchedPattern: precedeMatch,
              statementIndex: i,
            });
          }

          const targetMatch = findMatchingPattern(calleeName, targetPatterns);
          if (targetMatch) {
            targetOccurrences.push({
              call,
              calleeName,
              matchedPattern: targetMatch,
              statementIndex: i,
            });
          }
        }
      }

      // Check each target call occurrence
      for (const targetOcc of targetOccurrences) {
        const targetPos = targetOcc.call.getStart(sourceFile);

        const hasPreceding = mustPrecedeOccurrences.some((mp) => {
          if (mp.statementIndex < targetOcc.statementIndex) {
            return true;
          }
          if (mp.statementIndex === targetOcc.statementIndex) {
            return mp.call.getStart(sourceFile) < targetPos;
          }
          return false;
        });

        if (!hasPreceding) {
          // Check if must_precede occurs after target (inverted order)
          const followingPrecede = mustPrecedeOccurrences.find((mp) => {
            if (mp.statementIndex > targetOcc.statementIndex) {
              return true;
            }
            if (mp.statementIndex === targetOcc.statementIndex) {
              return mp.call.getStart(sourceFile) > targetPos;
            }
            return false;
          });

          const { line, character } = sourceFile.getLineAndCharacterOfPosition(targetPos);
          const lineNumber = line + 1;
          const columnNumber = character + 1;
          const snippet = getLineSnippet(lineNumber);

          const precedeListStr = mustPrecedePatterns.map((p) => `"${p}"`).join(' or ');
          let message: string;

          if (followingPrecede) {
            message = `Invariant broken: Rule "${rule.id}" requires ${precedeListStr} to precede "${targetOcc.calleeName}", but "${followingPrecede.calleeName}" appeared after the target call (inverted order).`;
          } else {
            message = `Invariant broken: Rule "${rule.id}" requires ${precedeListStr} to precede "${targetOcc.calleeName}" in the same function block, but no preceding call was found.`;
          }

          const suggestion = followingPrecede
            ? `Move "${followingPrecede.calleeName}" before "${targetOcc.calleeName}" to satisfy required execution sequence for rule "${rule.id}".`
            : `Ensure one of [${rule.pattern.must_precede?.join(', ')}] is invoked before "${targetOcc.calleeName}" in function "${block.enclosingFunction || 'anonymous'}".`;

          violations.push({
            id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
            type: 'INVARIANT_BROKEN',
            severity: rule.severity,
            ruleId: rule.id,
            ruleDesc: rule.desc,
            message,
            sourceFile: relPath,
            line: lineNumber,
            column: columnNumber,
            snippet,
            enclosingFunction: block.enclosingFunction,
            targetCall: targetOcc.calleeName,
            suggestion,
          });
        }
      }
    }
  }

  return violations;
}
