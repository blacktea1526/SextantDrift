import ts from 'typescript';

export type ImportKind = 'import' | 'export-from' | 'dynamic-import' | 'require';

export interface ImportEvidence {
  sourceFile: string;
  rawSpecifier: string;
  kind: ImportKind;
  isTypeOnly: boolean;
  importedSymbols?: string[];
  line: number;
  column: number;
  snippet: string;
}

function isModuleStringLike(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function extractSymbolsFromCallContext(callNode: ts.CallExpression): string[] {
  let curr: ts.Node = callNode;
  while (curr.parent && (ts.isAwaitExpression(curr.parent) || ts.isParenthesizedExpression(curr.parent))) {
    curr = curr.parent;
  }

  const parent = curr.parent;
  if (!parent) return ['*'];

  // Case 1: VariableDeclaration: const { a, b: c } = await import(...) / require(...)
  if (ts.isVariableDeclaration(parent) && parent.initializer === curr) {
    if (ts.isObjectBindingPattern(parent.name)) {
      const symbols: string[] = [];
      for (const el of parent.name.elements) {
        if (ts.isBindingElement(el)) {
          const symName =
            el.propertyName && ts.isIdentifier(el.propertyName)
              ? el.propertyName.text
              : ts.isIdentifier(el.name)
                ? el.name.text
                : undefined;
          if (symName) symbols.push(symName);
        }
      }
      if (symbols.length > 0) return symbols;
    }
  }

  // Case 2: PropertyAccessExpression: (await import(...)).foo
  if (ts.isPropertyAccessExpression(parent) && parent.expression === curr) {
    return [parent.name.text];
  }

  return ['*'];
}

/**
 * Extracts all module dependencies from a TypeScript/JavaScript source text or parsed SourceFile
 * using the official TypeScript Compiler API.
 */
export function extractDependenciesFromSource(
  sourceFilePath: string,
  sourceInput: string | ts.SourceFile
): ImportEvidence[] {
  const sourceFile =
    typeof sourceInput === 'string'
      ? ts.createSourceFile(sourceFilePath, sourceInput, ts.ScriptTarget.Latest, true)
      : sourceInput;

  const lines = sourceFile.text.split('\n');
  const evidences: ImportEvidence[] = [];

  function getLineSnippet(lineNumber: number): string {
    return lines[lineNumber - 1] ? lines[lineNumber - 1].trim() : '';
  }

  function visit(node: ts.Node) {
    // 1. Static import declarations: import ... from '...'
    if (ts.isImportDeclaration(node)) {
      if (node.moduleSpecifier && isModuleStringLike(node.moduleSpecifier)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        let isTypeOnly = node.importClause?.isTypeOnly ?? false;
        const importedSymbols: string[] = [];

        if (node.importClause) {
          if (node.importClause.name) {
            importedSymbols.push('default');
          }
          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              importedSymbols.push('*');
            } else if (ts.isNamedImports(node.importClause.namedBindings)) {
              const elements = node.importClause.namedBindings.elements;
              if (!isTypeOnly && elements.length > 0 && elements.every((e) => e.isTypeOnly)) {
                isTypeOnly = true;
              }
              for (const el of elements) {
                importedSymbols.push((el.propertyName || el.name).text);
              }
            }
          }
        }

        evidences.push({
          sourceFile: sourceFilePath,
          rawSpecifier: node.moduleSpecifier.text,
          kind: 'import',
          isTypeOnly,
          importedSymbols,
          line: line + 1,
          column: character + 1,
          snippet: getLineSnippet(line + 1),
        });
      }
    }

    // 2. Export-from declarations: export * from '...' or export { X } from '...'
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && isModuleStringLike(node.moduleSpecifier)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        let isTypeOnly = node.isTypeOnly;
        const importedSymbols: string[] = [];

        if (!node.exportClause) {
          importedSymbols.push('*');
        } else if (ts.isNamespaceExport(node.exportClause)) {
          importedSymbols.push('*');
        } else if (ts.isNamedExports(node.exportClause)) {
          const elements = node.exportClause.elements;
          if (!isTypeOnly && elements.length > 0 && elements.every((e) => e.isTypeOnly)) {
            isTypeOnly = true;
          }
          for (const el of elements) {
            importedSymbols.push((el.propertyName || el.name).text);
          }
        }

        evidences.push({
          sourceFile: sourceFilePath,
          rawSpecifier: node.moduleSpecifier.text,
          kind: 'export-from',
          isTypeOnly,
          importedSymbols,
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
        if (firstArg && isModuleStringLike(firstArg)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          evidences.push({
            sourceFile: sourceFilePath,
            rawSpecifier: firstArg.text,
            kind: 'dynamic-import',
            isTypeOnly: false,
            importedSymbols: extractSymbolsFromCallContext(node),
            line: line + 1,
            column: character + 1,
            snippet: getLineSnippet(line + 1),
          });
        }
      }

      // require('...')
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const firstArg = node.arguments[0];
        if (firstArg && isModuleStringLike(firstArg)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          evidences.push({
            sourceFile: sourceFilePath,
            rawSpecifier: firstArg.text,
            kind: 'require',
            isTypeOnly: false,
            importedSymbols: extractSymbolsFromCallContext(node),
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

