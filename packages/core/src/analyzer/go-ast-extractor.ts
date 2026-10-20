import { ImportEvidence } from './ast-extractor.js';

/**
 * Extracts import paths from Go source.
 * Covers single imports, grouped imports, aliases, dot imports, and blank imports.
 * Strings, runes, and comments are skipped so an import-shaped token inside them is not an edge.
 */
export function extractGoDependencies(
  sourceFilePath: string,
  sourceContent: string
): ImportEvidence[] {
  if (!sourceContent || !sourceContent.trim()) {
    return [];
  }

  const source = sourceContent;
  const lines = source.split('\n');
  const evidences: ImportEvidence[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  function peek(offset = 0): string {
    return source[i + offset] ?? '';
  }

  function advance(): string {
    const ch = source[i] ?? '';
    i++;
    if (ch === '\n') {
      line++;
      col = 1;
    } else if (ch) {
      col++;
    }
    return ch;
  }

  function skipSpaceAndComments(): void {
    for (;;) {
      if (i >= source.length) return;
      const ch = peek();
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        advance();
        continue;
      }
      if (ch === '/' && peek(1) === '/') {
        while (i < source.length && peek() !== '\n') advance();
        continue;
      }
      if (ch === '/' && peek(1) === '*') {
        advance();
        advance();
        while (i < source.length && !(peek() === '*' && peek(1) === '/')) advance();
        if (peek() === '*' && peek(1) === '/') {
          advance();
          advance();
        }
        continue;
      }
      return;
    }
  }

  function isIdentStart(ch: string): boolean {
    return /[A-Za-z_]/.test(ch);
  }

  function isIdentChar(ch: string): boolean {
    return /[A-Za-z0-9_]/.test(ch);
  }

  function readIdentifier(): string {
    const start = i;
    while (i < source.length && isIdentChar(peek())) advance();
    return source.slice(start, i);
  }

  function skipRune(): void {
    advance();
    if (i >= source.length) return;
    if (peek() === '\\') {
      advance();
      if (i < source.length) advance();
    } else if (peek() !== '\n') {
      advance();
    }
    if (peek() === "'") advance();
  }

  function readGoString(): string | null {
    const quote = peek();
    if (quote !== '"' && quote !== '`') return null;
    advance();
    let out = '';
    if (quote === '`') {
      while (i < source.length && peek() !== '`') out += advance();
      if (peek() === '`') advance();
      return out;
    }
    while (i < source.length && peek() !== '"' && peek() !== '\n') {
      if (peek() === '\\') {
        advance();
        const esc = advance();
        if (esc === 'n') out += '\n';
        else if (esc === 't') out += '\t';
        else out += esc;
        continue;
      }
      out += advance();
    }
    if (peek() === '"') advance();
    return out;
  }

  function snippetAt(lineNo: number): string {
    return (lines[lineNo - 1] ?? '').replace(/\r$/, '').trim();
  }

  function parseImportSpec(): boolean {
    skipSpaceAndComments();
    if (i >= source.length) return false;

    let alias: string | undefined;
    if (peek() === '.') {
      alias = '.';
      advance();
      skipSpaceAndComments();
    } else if (isIdentStart(peek())) {
      alias = readIdentifier();
      skipSpaceAndComments();
    }

    if (peek() !== '"' && peek() !== '`') return false;

    const startLine = line;
    const startCol = col;
    const rawSpecifier = readGoString();
    if (!rawSpecifier) return false;

    evidences.push({
      sourceFile: sourceFilePath,
      rawSpecifier,
      kind: 'import',
      isTypeOnly: false,
      importedSymbols: alias ? [alias] : undefined,
      line: startLine,
      column: startCol,
      snippet: snippetAt(startLine),
    });
    return true;
  }

  function parseImportDecl(): void {
    skipSpaceAndComments();
    if (peek() !== '(') {
      parseImportSpec();
      return;
    }

    advance();
    while (i < source.length) {
      const before = i;
      skipSpaceAndComments();
      if (peek() === ')') {
        advance();
        return;
      }
      if (peek() === ';') {
        advance();
        continue;
      }
      if (i >= source.length) return;
      if (!parseImportSpec()) {
        if (i === before) advance();
      }
    }
  }

  while (i < source.length) {
    skipSpaceAndComments();
    if (i >= source.length) break;
    const ch = peek();
    if (ch === '"' || ch === '`') {
      readGoString();
      continue;
    }
    if (ch === "'") {
      skipRune();
      continue;
    }
    if (isIdentStart(ch)) {
      const ident = readIdentifier();
      if (ident === 'import') parseImportDecl();
      continue;
    }
    advance();
  }

  return evidences;
}
