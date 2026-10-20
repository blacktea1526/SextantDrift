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
  return calls;
}

interface StatementCallOccurrence {
  call: ts.CallExpression;
  calleeName: string;
  matchedPattern: string;
  statementIndex: number;
  callOrder: number;
  branchPath: string[];
  concurrentScope?: number;
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

interface RawCallOccurrence {
  call: ts.CallExpression;
  statementIndex: number;
  callOrder: number;
  branchPath: string[];
  concurrentScope?: number;
}

/**
 * Traverses statements with branch path tracking and concurrency scope identification.
 */
function collectCallsWithBranching(
  statements: readonly ts.Statement[],
  sourceFile: ts.SourceFile
): RawCallOccurrence[] {
  const result: RawCallOccurrence[] = [];
  let orderCounter = 0;

  function walkStatement(stmt: ts.Statement, statementIndex: number, branchPath: string[]) {
    if (ts.isIfStatement(stmt)) {
      walkNode(stmt.expression, statementIndex, branchPath);

      const thenPath = [...branchPath, `then_${stmt.thenStatement.getStart(sourceFile)}`];
      if (ts.isBlock(stmt.thenStatement)) {
        for (const s of stmt.thenStatement.statements) {
          walkStatement(s, statementIndex, thenPath);
        }
      } else {
        walkStatement(stmt.thenStatement, statementIndex, thenPath);
      }

      if (stmt.elseStatement) {
        const elsePath = [...branchPath, `else_${stmt.elseStatement.getStart(sourceFile)}`];
        if (ts.isBlock(stmt.elseStatement)) {
          for (const s of stmt.elseStatement.statements) {
            walkStatement(s, statementIndex, elsePath);
          }
        } else {
          walkStatement(stmt.elseStatement, statementIndex, elsePath);
        }
      }
      return;
    }

    if (ts.isTryStatement(stmt)) {
      const tryPath = [...branchPath, `try_${stmt.tryBlock.getStart(sourceFile)}`];
      for (const s of stmt.tryBlock.statements) {
        walkStatement(s, statementIndex, tryPath);
      }

      if (stmt.catchClause && stmt.catchClause.block) {
        const catchPath = [...branchPath, `catch_${stmt.catchClause.getStart(sourceFile)}`];
        for (const s of stmt.catchClause.block.statements) {
          walkStatement(s, statementIndex, catchPath);
        }
      }

      if (stmt.finallyBlock) {
        const finallyPath = [...branchPath, `finally_${stmt.finallyBlock.getStart(sourceFile)}`];
        for (const s of stmt.finallyBlock.statements) {
          walkStatement(s, statementIndex, finallyPath);
        }
      }
      return;
    }

    if (ts.isSwitchStatement(stmt)) {
      walkNode(stmt.expression, statementIndex, branchPath);
      for (const clause of stmt.caseBlock.clauses) {
        const casePath = [...branchPath, `case_${clause.getStart(sourceFile)}`];
        for (const s of clause.statements) {
          walkStatement(s, statementIndex, casePath);
        }
      }
      return;
    }

    if (ts.isBlock(stmt)) {
      for (const s of stmt.statements) {
        walkStatement(s, statementIndex, branchPath);
      }
      return;
    }

    walkNode(stmt, statementIndex, branchPath);
  }

  function walkNode(
    node: ts.Node,
    statementIndex: number,
    branchPath: string[],
    concurrentScope?: number
  ) {
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

    if (ts.isConditionalExpression(node)) {
      walkNode(node.condition, statementIndex, branchPath, concurrentScope);
      const truePath = [...branchPath, `ternary_true_${node.whenTrue.getStart(sourceFile)}`];
      walkNode(node.whenTrue, statementIndex, truePath, concurrentScope);
      const falsePath = [...branchPath, `ternary_false_${node.whenFalse.getStart(sourceFile)}`];
      walkNode(node.whenFalse, statementIndex, falsePath, concurrentScope);
      return;
    }

    if (ts.isCallExpression(node)) {
      const calleeName = getCalleeExpressionName(node.expression);
      const isConcurrentCall =
        calleeName === 'Promise.all' ||
        calleeName === 'Promise.race' ||
        calleeName === 'Promise.any';

      if (isConcurrentCall && node.arguments.length > 0) {
        const cScope = node.getStart(sourceFile);
        const firstArg = node.arguments[0];
        let arrayExpr: ts.ArrayLiteralExpression | null = null;
        if (ts.isArrayLiteralExpression(firstArg)) {
          arrayExpr = firstArg;
        } else if (ts.isParenthesizedExpression(firstArg) && ts.isArrayLiteralExpression(firstArg.expression)) {
          arrayExpr = firstArg.expression;
        }

        if (arrayExpr) {
          for (const elem of arrayExpr.elements) {
            walkNode(elem, statementIndex, branchPath, cScope);
          }
          return;
        }
      }
    }

    ts.forEachChild(node, (child) => walkNode(child, statementIndex, branchPath, concurrentScope));

    if (ts.isCallExpression(node)) {
      result.push({
        call: node,
        statementIndex,
        callOrder: orderCounter++,
        branchPath,
        concurrentScope,
      });
    }
  }

  for (let i = 0; i < statements.length; i++) {
    walkStatement(statements[i], i, ['root']);
  }

  return result;
}

function isSameBranchPath(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isAncestorBranchPath(ancestor: string[], child: string[]): boolean {
  if (ancestor.length >= child.length) return false;
  for (let i = 0; i < ancestor.length; i++) {
    if (ancestor[i] !== child[i]) return false;
  }
  return true;
}

function isDivergentBranchPath(a: string[], b: string[]): boolean {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

function isGuaranteedToPrecede(
  precede: StatementCallOccurrence,
  target: StatementCallOccurrence
): boolean {
  if (
    precede.concurrentScope !== undefined &&
    target.concurrentScope !== undefined &&
    precede.concurrentScope === target.concurrentScope
  ) {
    return false;
  }

  if (precede.callOrder >= target.callOrder) {
    return false;
  }

  if (isSameBranchPath(precede.branchPath, target.branchPath)) {
    return true;
  }

  if (isAncestorBranchPath(precede.branchPath, target.branchPath)) {
    return true;
  }

  return false;
}

function isGuaranteedToFollow(
  following: StatementCallOccurrence,
  target: StatementCallOccurrence
): boolean {
  if (
    following.concurrentScope !== undefined &&
    target.concurrentScope !== undefined &&
    following.concurrentScope === target.concurrentScope
  ) {
    return false;
  }

  if (following.callOrder <= target.callOrder) {
    return false;
  }

  if (isSameBranchPath(following.branchPath, target.branchPath)) {
    return true;
  }

  if (isAncestorBranchPath(target.branchPath, following.branchPath)) {
    return true;
  }

  return false;
}

/**
 * Evaluates AST statement sequences against must_precede invariant rules.
 * Strictly operates within the same function or block scope (ADR-004) with control-flow branch awareness.
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
    const rawCalls = collectCallsWithBranching(block.statements, sourceFile);

    for (const rule of applicableRules) {
      const mustPrecedePatterns = rule.pattern.must_precede!;
      const targetPatterns = rule.pattern.target!;

      const mustPrecedeOccurrences: StatementCallOccurrence[] = [];
      const targetOccurrences: StatementCallOccurrence[] = [];

      for (const item of rawCalls) {
        const calleeName = getCalleeExpressionName(item.call.expression);
        if (!calleeName) continue;

        const precedeMatch = findMatchingPattern(calleeName, mustPrecedePatterns);
        if (precedeMatch) {
          mustPrecedeOccurrences.push({
            call: item.call,
            calleeName,
            matchedPattern: precedeMatch,
            statementIndex: item.statementIndex,
            callOrder: item.callOrder,
            branchPath: item.branchPath,
            concurrentScope: item.concurrentScope,
          });
        }

        const targetMatch = findMatchingPattern(calleeName, targetPatterns);
        if (targetMatch) {
          targetOccurrences.push({
            call: item.call,
            calleeName,
            matchedPattern: targetMatch,
            statementIndex: item.statementIndex,
            callOrder: item.callOrder,
            branchPath: item.branchPath,
            concurrentScope: item.concurrentScope,
          });
        }
      }

      // Check each target call occurrence
      for (const targetOcc of targetOccurrences) {
        const targetPos = targetOcc.call.getStart(sourceFile);

        const hasGuaranteedPreceding = mustPrecedeOccurrences.some((mp) =>
          isGuaranteedToPrecede(mp, targetOcc)
        );

        if (!hasGuaranteedPreceding) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(targetPos);
          const lineNumber = line + 1;
          const columnNumber = character + 1;
          const snippet = getLineSnippet(lineNumber);
          const precedeListStr = mustPrecedePatterns.map((p) => `"${p}"`).join(' or ');

          // Check if concurrent evaluation inside Promise.all / race / any
          const concurrentPrecede = mustPrecedeOccurrences.find(
            (mp) =>
              mp.concurrentScope !== undefined &&
              targetOcc.concurrentScope !== undefined &&
              mp.concurrentScope === targetOcc.concurrentScope
          );

          if (concurrentPrecede) {
            violations.push({
              id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
              type: 'INVARIANT_BROKEN',
              severity: 'warning',
              ruleId: rule.id,
              ruleDesc: rule.desc,
              message: `Concurrent execution: Rule "${rule.id}" requires ${precedeListStr} to precede "${targetOcc.calleeName}", but both are evaluated concurrently inside Promise.all/race. Concurrency order cannot be guaranteed statically.`,
              sourceFile: relPath,
              line: lineNumber,
              column: columnNumber,
              snippet,
              enclosingFunction: block.enclosingFunction,
              targetCall: targetOcc.calleeName,
              suggestion: `Separate "${targetOcc.calleeName}" into a sequential await step following the persistence call.`,
            });
            continue;
          }

          // Check if must_precede occurs after target (inverted order in same execution path)
          const followingPrecede = mustPrecedeOccurrences.find((mp) =>
            isGuaranteedToFollow(mp, targetOcc)
          );

          if (followingPrecede) {
            violations.push({
              id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
              type: 'INVARIANT_BROKEN',
              severity: rule.severity,
              ruleId: rule.id,
              ruleDesc: rule.desc,
              message: `Invariant broken: Rule "${rule.id}" requires ${precedeListStr} to precede "${targetOcc.calleeName}", but "${followingPrecede.calleeName}" appeared after the target call (inverted order).`,
              sourceFile: relPath,
              line: lineNumber,
              column: columnNumber,
              snippet,
              enclosingFunction: block.enclosingFunction,
              targetCall: targetOcc.calleeName,
              suggestion: `Move "${followingPrecede.calleeName}" before "${targetOcc.calleeName}" to satisfy required execution sequence for rule "${rule.id}".`,
            });
            continue;
          }

          // Check if must_precede is in an alternative divergent branch
          const divergentPrecede = mustPrecedeOccurrences.find((mp) =>
            isDivergentBranchPath(mp.branchPath, targetOcc.branchPath)
          );

          if (divergentPrecede) {
            violations.push({
              id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
              type: 'INVARIANT_BROKEN',
              severity: 'warning',
              ruleId: rule.id,
              ruleDesc: rule.desc,
              message: `Conditional precedence: Rule "${rule.id}" requires ${precedeListStr} to precede "${targetOcc.calleeName}", but preceding call only exists in an alternative branch.`,
              sourceFile: relPath,
              line: lineNumber,
              column: columnNumber,
              snippet,
              enclosingFunction: block.enclosingFunction,
              targetCall: targetOcc.calleeName,
              suggestion: `Ensure "${targetOcc.calleeName}" is either moved inside the branch where persistence happens, or elevate persistence before the branching structure.`,
            });
            continue;
          }

          // Default: no preceding call found anywhere
          violations.push({
            id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
            type: 'INVARIANT_BROKEN',
            severity: rule.severity,
            ruleId: rule.id,
            ruleDesc: rule.desc,
            message: `Invariant broken: Rule "${rule.id}" requires ${precedeListStr} to precede "${targetOcc.calleeName}" in the same function block, but no preceding call was found.`,
            sourceFile: relPath,
            line: lineNumber,
            column: columnNumber,
            snippet,
            enclosingFunction: block.enclosingFunction,
            targetCall: targetOcc.calleeName,
            suggestion: `Ensure one of [${rule.pattern.must_precede?.join(', ')}] is invoked before "${targetOcc.calleeName}" in function "${block.enclosingFunction || 'anonymous'}".`,
          });
        }
      }
    }
  }

  return violations;
}
