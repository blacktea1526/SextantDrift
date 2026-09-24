import ts from 'typescript';
import { InvariantRule } from '../types/architecture.js';
import { ViolationEvidence } from '../types/report.js';
import {
  matchesScope,
  unwrapExpression,
  getCalleeExpressionName,
  findMatchingPattern,
} from './sequence-matcher.js';

/**
 * Extracts a property name string from an AST PropertyName node.
 */
function getPropertyNameString(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  if (ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    if (
      ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression)
    ) {
      return name.expression.text;
    }
  }
  return null;
}

/**
 * Collects all explicit property name keys declared in an ObjectLiteralExpression.
 */
export function getObjectLiteralPropertyNames(obj: ts.ObjectLiteralExpression): Set<string> {
  const names = new Set<string>();
  for (const prop of obj.properties) {
    if (
      ts.isPropertyAssignment(prop) ||
      ts.isShorthandPropertyAssignment(prop) ||
      ts.isMethodDeclaration(prop) ||
      ts.isGetAccessorDeclaration(prop) ||
      ts.isSetAccessorDeclaration(prop)
    ) {
      const name = getPropertyNameString(prop.name);
      if (name) {
        names.add(name);
      }
    }
  }
  return names;
}

function getEnclosingFunctionName(node: ts.Node): string {
  let curr = node.parent;
  while (curr) {
    if (ts.isFunctionDeclaration(curr)) {
      return curr.name ? curr.name.text : '<anonymous_function>';
    }
    if (ts.isMethodDeclaration(curr)) {
      return curr.name.getText();
    }
    if (ts.isConstructorDeclaration(curr)) {
      return 'constructor';
    }
    if (ts.isArrowFunction(curr) || ts.isFunctionExpression(curr)) {
      if (curr.parent && ts.isVariableDeclaration(curr.parent) && ts.isIdentifier(curr.parent.name)) {
        return curr.parent.name.text;
      }
      if (curr.parent && ts.isPropertyAssignment(curr.parent) && ts.isIdentifier(curr.parent.name)) {
        return curr.parent.name.text;
      }
      return '<anonymous_arrow>';
    }
    curr = curr.parent;
  }
  return '<top_level>';
}

/**
 * Audits call expressions against require_config invariant rules.
 * Ensures external and configured network calls pass an options object with required configuration keys (e.g. 'timeout').
 */
export function matchConfigInvariants(
  sourceFileOrContent: ts.SourceFile | string,
  relPath: string,
  rules: InvariantRule[]
): ViolationEvidence[] {
  const sourceFile =
    typeof sourceFileOrContent === 'string'
      ? ts.createSourceFile(relPath, sourceFileOrContent, ts.ScriptTarget.Latest, true)
      : sourceFileOrContent;

  const applicableRules = rules.filter((rule) => {
    if (!rule.pattern.require_config || rule.pattern.require_config.length === 0) {
      return false;
    }
    if (rule.pattern.in_path && !matchesScope(relPath, rule.pattern.in_path)) {
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

  // Collect all CallExpression nodes in AST
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const violations: ViolationEvidence[] = [];

  for (const call of calls) {
    const calleeName = getCalleeExpressionName(call.expression);
    if (!calleeName) continue;

    for (const rule of applicableRules) {
      const hasTarget = rule.pattern.target && rule.pattern.target.length > 0;

      // Invariant: require_config MUST have an explicit target pattern (e.g. ['fetch', 'axios.*', '*.request'])
      // Never guess based on heuristic regex (/(fetch|request|get|post|client|call)/i) to prevent false positives on Map.get, Cache.get, etc. (AGENTS.md 戒律 2)
      if (!hasTarget) {
        continue;
      }

      const isCalleeMatch = findMatchingPattern(calleeName, rule.pattern.target!) !== null;
      if (!isCalleeMatch) {
        continue;
      }

      // Inspect call arguments for ObjectLiteralExpression
      const objectArgs: ts.ObjectLiteralExpression[] = [];
      for (const arg of call.arguments) {
        const unwrapped = unwrapExpression(arg);
        if (ts.isObjectLiteralExpression(unwrapped)) {
          objectArgs.push(unwrapped);
        }
      }

      const requiredConfigs = rule.pattern.require_config!;
      const pos = call.getStart(sourceFile);
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      const lineNumber = line + 1;
      const columnNumber = character + 1;
      const snippet = getLineSnippet(lineNumber);
      const enclosingFn = getEnclosingFunctionName(call);

      if (objectArgs.length === 0) {
        // Explicit target was specified, but no config object was provided
        violations.push({
          id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
          type: 'INVARIANT_BROKEN',
          severity: rule.severity,
          ruleId: rule.id,
          ruleDesc: rule.desc,
          message: `Invariant broken: Rule "${rule.id}" requires config [${requiredConfigs.map((c) => `"${c}"`).join(', ')}] on "${calleeName}", but no config object was provided.`,
          sourceFile: relPath,
          line: lineNumber,
          column: columnNumber,
          snippet,
          enclosingFunction: enclosingFn,
          targetCall: calleeName,
          suggestion: `Pass a configuration object containing [${requiredConfigs.map((c) => `"${c}"`).join(', ')}] when calling "${calleeName}".`,
        });
      } else {
        // Verify that all required keys are present across object literal arguments
        const presentKeys = new Set<string>();
        for (const obj of objectArgs) {
          const props = getObjectLiteralPropertyNames(obj);
          for (const p of props) {
            presentKeys.add(p);
          }
        }

        const missingKeys = requiredConfigs.filter((key) => !presentKeys.has(key));
        if (missingKeys.length > 0) {
          violations.push({
            id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
            type: 'INVARIANT_BROKEN',
            severity: rule.severity,
            ruleId: rule.id,
            ruleDesc: rule.desc,
            message: `Invariant broken: Rule "${rule.id}" requires config [${requiredConfigs.map((c) => `"${c}"`).join(', ')}] on "${calleeName}", but missing required config: [${missingKeys.map((c) => `"${c}"`).join(', ')}].`,
            sourceFile: relPath,
            line: lineNumber,
            column: columnNumber,
            snippet,
            enclosingFunction: enclosingFn,
            targetCall: calleeName,
            suggestion: `Add missing configuration property [${missingKeys.map((c) => `"${c}"`).join(', ')}] to the options passed to "${calleeName}".`,
          });
        }
      }
    }
  }

  return violations;
}
