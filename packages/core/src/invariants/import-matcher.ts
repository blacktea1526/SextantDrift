import path from 'node:path';
import ts from 'typescript';
import { InvariantRule } from '../types/architecture.js';
import { ViolationEvidence } from '../types/report.js';
import { globToRegExp } from '../analyzer/noise-filter.js';
import { matchesScope, unwrapExpression } from './sequence-matcher.js';

/**
 * Checks if an import specifier matches a forbidden pattern.
 * Supports exact package names, package subpaths, glob wildcards, and relative path resolution.
 */
export function isForbiddenImportMatch(specifier: string, pattern: string, relPath: string): boolean {
  const normSpec = specifier.split('\\').join('/');
  const normPat = pattern.split('\\').join('/');

  // Exact match or subpath match
  if (normSpec === normPat || normSpec.startsWith(normPat + '/')) {
    return true;
  }

  // Normalized without leading ./
  const cleanSpec = normSpec.replace(/^(\.\/|\/)/, '');
  const cleanPat = normPat.replace(/^(\.\/|\/)/, '');
  if (cleanSpec === cleanPat || cleanSpec.startsWith(cleanPat + '/')) {
    return true;
  }

  // Glob test directly on specifier
  const regClean = globToRegExp(cleanPat);
  if (regClean.test(cleanSpec)) {
    return true;
  }
  if (!cleanPat.includes('.')) {
    const withoutExt = cleanSpec.replace(/\.[^/.]+$/, '');
    if (regClean.test(withoutExt)) {
      return true;
    }
  }

  // If specifier is relative, resolve relative to relPath
  if (normSpec.startsWith('.')) {
    const normRelPath = relPath.split('\\').join('/').replace(/^(\.\/|\/)/, '');
    const dir = path.posix.dirname(normRelPath);
    const resolvedRel = path.posix.normalize(path.posix.join(dir, normSpec)).replace(/^(\.\/|\/)/, '');

    if (resolvedRel === cleanPat || resolvedRel.startsWith(cleanPat + '/')) {
      return true;
    }
    if (regClean.test(resolvedRel)) {
      return true;
    }
    if (!cleanPat.includes('.')) {
      const withoutExt = resolvedRel.replace(/\.[^/.]+$/, '');
      if (regClean.test(withoutExt)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Matches import invariants for a file.
 * Inspects AST nodes:
 * 1. ImportDeclaration (static imports)
 * 2. ExportDeclaration (re-exports)
 * 3. CallExpression with dynamic import() or require()
 */
export function matchImportInvariants(
  sourceFileOrContent: ts.SourceFile | string,
  relPath: string,
  rules: InvariantRule[]
): ViolationEvidence[] {
  const sourceFile =
    typeof sourceFileOrContent === 'string'
      ? ts.createSourceFile(relPath, sourceFileOrContent, ts.ScriptTarget.Latest, true)
      : sourceFileOrContent;

  const applicableRules = rules.filter((rule) => {
    if (!rule.pattern.forbid_import || rule.pattern.forbid_import.length === 0) {
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

  const violations: ViolationEvidence[] = [];

  function checkImport(node: ts.Node, specifier: string) {
    for (const rule of applicableRules) {
      const matchedForbidden = rule.pattern.forbid_import!.find((pat) =>
        isForbiddenImportMatch(specifier, pat, relPath)
      );

      if (matchedForbidden) {
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        const lineNumber = line + 1;
        const columnNumber = character + 1;
        const snippet = getLineSnippet(lineNumber);

        violations.push({
          id: `INVARIANT_${rule.id}_${lineNumber}_${columnNumber}`,
          type: 'INVARIANT_BROKEN',
          severity: rule.severity,
          ruleId: rule.id,
          ruleDesc: rule.desc,
          message: `Invariant broken: Rule "${rule.id}" forbids import "${specifier}" matching pattern "${matchedForbidden}".`,
          sourceFile: relPath,
          line: lineNumber,
          column: columnNumber,
          snippet,
        });
      }
    }
  }

  function visit(node: ts.Node) {
    // 1. Static ImportDeclaration: import ... from '...'
    if (ts.isImportDeclaration(node)) {
      if (
        node.moduleSpecifier &&
        (ts.isStringLiteral(node.moduleSpecifier) || ts.isNoSubstitutionTemplateLiteral(node.moduleSpecifier))
      ) {
        checkImport(node, node.moduleSpecifier.text);
      }
      return;
    }

    // 2. Re-export ExportDeclaration: export * from '...' or export { X } from '...'
    if (ts.isExportDeclaration(node)) {
      if (
        node.moduleSpecifier &&
        (ts.isStringLiteral(node.moduleSpecifier) || ts.isNoSubstitutionTemplateLiteral(node.moduleSpecifier))
      ) {
        checkImport(node, node.moduleSpecifier.text);
      }
      return;
    }

    // 3. Dynamic import() or CommonJS require()
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const firstArg = node.arguments[0];
        if (firstArg) {
          const unwrapped = unwrapExpression(firstArg);
          if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
            checkImport(node, unwrapped.text);
          }
        }
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const firstArg = node.arguments[0];
        if (firstArg) {
          const unwrapped = unwrapExpression(firstArg);
          if (ts.isStringLiteral(unwrapped) || ts.isNoSubstitutionTemplateLiteral(unwrapped)) {
            checkImport(node, unwrapped.text);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return violations;
}
