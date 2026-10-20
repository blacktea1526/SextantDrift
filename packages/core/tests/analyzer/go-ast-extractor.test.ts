import { describe, it, expect } from 'vitest';
import { extractGoDependencies } from '../../src/analyzer/go-ast-extractor.js';

describe('Go import extractor (go-ast-extractor)', () => {
  it('extracts single, aliased, dot, and blank imports from a group', () => {
    const code = `package api

import (
	"fmt"
	order "github.com/acme/shop/internal/order"
	. "github.com/acme/shop/internal/store"
	_ "net/http/pprof"
)
`;
    const evidences = extractGoDependencies('cmd/api/main.go', code);

    expect(evidences).toHaveLength(4);
    expect(evidences[0]).toMatchObject({
      sourceFile: 'cmd/api/main.go',
      rawSpecifier: 'fmt',
      kind: 'import',
      isTypeOnly: false,
      line: 4,
      column: 2,
    });
    expect(evidences[1]).toMatchObject({
      rawSpecifier: 'github.com/acme/shop/internal/order',
      importedSymbols: ['order'],
      line: 5,
    });
    expect(evidences[2]).toMatchObject({
      rawSpecifier: 'github.com/acme/shop/internal/store',
      importedSymbols: ['.'],
      line: 6,
    });
    expect(evidences[3]).toMatchObject({
      rawSpecifier: 'net/http/pprof',
      importedSymbols: ['_'],
      line: 7,
    });
  });

  it('extracts separate import declarations, including raw-string paths', () => {
    const code = 'package p\n\nimport "fmt"\nimport os `os`\n';
    const evidences = extractGoDependencies('main.go', code);

    expect(evidences.map((item) => item.rawSpecifier)).toEqual(['fmt', 'os']);
    expect(evidences[0]).toMatchObject({ line: 3, column: 8, snippet: 'import "fmt"' });
    expect(evidences[1].importedSymbols).toEqual(['os']);
  });

  it('ignores import-shaped text in strings, runes, and comments', () => {
    const code = `package p

const doc = "import \\"fmt\\""
const raw = \`import "net/http"\`
const quote = '\\''
// import "ignored"
/*
import "also-ignored"
*/
var x = 1 // import "still-ignored"
import "os"
`;
    const evidences = extractGoDependencies('main.go', code);
    expect(evidences.map((item) => item.rawSpecifier)).toEqual(['os']);
  });

  it('returns no edges for empty or comment-only files', () => {
    expect(extractGoDependencies('empty.go', '')).toEqual([]);
    expect(extractGoDependencies('comments.go', '// package docs\n\n')).toEqual([]);
  });
});
