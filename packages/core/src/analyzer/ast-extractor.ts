import ts from 'typescript';

export type ImportKind = 'import' | 'export-from' | 'dynamic-import' | 'require';

export interface ImportEvidence {
  sourceFile: string;
  rawSpecifier: string;
  kind: ImportKind;
  isTypeOnly: boolean;
  line: number;
  column: number;
  snippet: string;
}

/**
 * Extracts all module dependencies from a TypeScript/JavaScript source text
 * using the official TypeScript Compiler API.
 */
export function extractDependenciesFromSource(
  sourceFilePath: string,
  sourceText: string
): ImportEvidence[] {
  const sourceFile = ts.createSourceFile(
    sourceFilePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const lines = sourceText.split('\n');
  const evidences: ImportEvidence[] = [];

  function getLineSnippet(lineNumber: number): string {
    return lines[lineNumber - 1] ? lines[lineNumber - 1].trim() : '';
  }

  function visit(node: ts.Node) {
    // 1. Static import declarations: import ... from '...'
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const isTypeOnly = node.importClause?.isTypeOnly ?? false;
        evidences.push({
          sourceFile: sourceFilePath,
          rawSpecifier: node.moduleSpecifier.text,
          kind: 'import',
          isTypeOnly,
          line: line + 1,
          column: character + 1,
          snippet: getLineSnippet(line + 1),
        });
      }
    }

    // 2. Export-from declarations: export * from '...' or export { X } from '...'
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const isTypeOnly = node.isTypeOnly;
        evidences.push({
          sourceFile: sourceFilePath,
          rawSpecifier: node.moduleSpecifier.text,
          kind: 'export-from',
          isTypeOnly,
          line: line + 1,
          column: character + 1,
          snippet: getLineSnippet(line + 1),
        });
      }
    }

    // 3. CallExpressions: dynamic import('...') or require('...')
    if (ts.isCallExpression(node)) {
      // Dynamic import: import('...')
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          evidences.push({
            sourceFile: sourceFilePath,
            rawSpecifier: firstArg.text,
            kind: 'dynamic-import',
            isTypeOnly: false,
            line: line + 1,
            column: character + 1,
            snippet: getLineSnippet(line + 1),
          });
        }
      }

      // require('...')
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          evidences.push({
            sourceFile: sourceFilePath,
            rawSpecifier: firstArg.text,
            kind: 'require',
            isTypeOnly: false,
            line: line + 1,
            column: character + 1,
            snippet: getLineSnippet(line + 1),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return evidences;
}
