import { describe, it, expect } from 'vitest';
import { extractPythonDependencies } from '../../src/analyzer/python-ast-extractor.js';

describe('Python AST Import Extractor (python-ast-extractor)', () => {
  it('extracts simple and multiple import statements with aliases', () => {
    const code = `
import os
import sys as system, math
import services.billing as billing
`;
    const evidences = extractPythonDependencies('app/main.py', code);

    expect(evidences).toHaveLength(4);

    expect(evidences[0]).toMatchObject({
      sourceFile: 'app/main.py',
      rawSpecifier: 'os',
      kind: 'import',
      isTypeOnly: false,
      line: 2,
    });

    expect(evidences[1]).toMatchObject({
      sourceFile: 'app/main.py',
      rawSpecifier: 'sys',
      kind: 'import',
      isTypeOnly: false,
      line: 3,
    });

    expect(evidences[2]).toMatchObject({
      sourceFile: 'app/main.py',
      rawSpecifier: 'math',
      kind: 'import',
      isTypeOnly: false,
      line: 3,
    });

    expect(evidences[3]).toMatchObject({
      sourceFile: 'app/main.py',
      rawSpecifier: 'services.billing',
      kind: 'import',
      isTypeOnly: false,
      line: 4,
    });
  });

  it('extracts from ... import statements with multiple symbols and aliases', () => {
    const code = `
from services.billing import calculate_tax, create_invoice as inv
from services.common import *
`;
    const evidences = extractPythonDependencies('services/api.py', code);

    expect(evidences).toHaveLength(2);

    expect(evidences[0]).toMatchObject({
      sourceFile: 'services/api.py',
      rawSpecifier: 'services.billing',
      kind: 'import',
      isTypeOnly: false,
      importedSymbols: ['calculate_tax', 'create_invoice'],
      line: 2,
    });

    expect(evidences[1]).toMatchObject({
      sourceFile: 'services/api.py',
      rawSpecifier: 'services.common',
      kind: 'import',
      isTypeOnly: false,
      importedSymbols: ['*'],
      line: 3,
    });
  });

  it('extracts relative imports with various dot depths', () => {
    const code = `
from . import helper
from .helper import run_task
from ..models import User, Account
from ...core.config import settings
`;
    const evidences = extractPythonDependencies('services/billing/worker.py', code);

    expect(evidences).toHaveLength(4);

    expect(evidences[0]).toMatchObject({
      rawSpecifier: '.',
      importedSymbols: ['helper'],
      line: 2,
    });

    expect(evidences[1]).toMatchObject({
      rawSpecifier: '.helper',
      importedSymbols: ['run_task'],
      line: 3,
    });

    expect(evidences[2]).toMatchObject({
      rawSpecifier: '..models',
      importedSymbols: ['User', 'Account'],
      line: 4,
    });

    expect(evidences[3]).toMatchObject({
      rawSpecifier: '...core.config',
      importedSymbols: ['settings'],
      line: 5,
    });
  });

  it('extracts multiline parenthesized imports and backslash line continuations', () => {
    const code = `
from services.billing import (
    calculate_vat,
    apply_discount as discount,
    generate_invoice,
)

from services.auth import token_verify, \\
    refresh_token
`;
    const evidences = extractPythonDependencies('services/controller.py', code);

    expect(evidences).toHaveLength(2);

    expect(evidences[0]).toMatchObject({
      rawSpecifier: 'services.billing',
      importedSymbols: ['calculate_vat', 'apply_discount', 'generate_invoice'],
      line: 2,
    });

    expect(evidences[1]).toMatchObject({
      rawSpecifier: 'services.auth',
      importedSymbols: ['token_verify', 'refresh_token'],
      line: 8,
    });
  });

  it('completely ignores fake imports inside comments and multiline docstrings', () => {
    const code = `
"""
Module Docstring
import fake_module_1
from fake_module_2 import fake_symbol
'''
import nested_fake
'''
"""

# import commented_out
# from commented_from import symbol

def helper():
    '''Function docstring
    import inside_docstring
    '''
    sample_sql = "SELECT * FROM users WHERE status = 'import'"
    return sample_sql

import real.service
`;
    const evidences = extractPythonDependencies('app/utils.py', code);

    expect(evidences).toHaveLength(1);
    expect(evidences[0]).toMatchObject({
      rawSpecifier: 'real.service',
      line: 21,
    });
  });

  it('correctly marks imports inside "if TYPE_CHECKING:" blocks as isTypeOnly: true', () => {
    const code = `
from typing import TYPE_CHECKING
import runtime_lib

if TYPE_CHECKING:
    from heavy.service import HeavyClient
    import types_module

def execute():
    pass

import another_runtime
`;
    const evidences = extractPythonDependencies('app/client.py', code);

    expect(evidences).toHaveLength(5);

    // from typing import TYPE_CHECKING
    expect(evidences[0]).toMatchObject({
      rawSpecifier: 'typing',
      isTypeOnly: false,
      line: 2,
    });

    // import runtime_lib
    expect(evidences[1]).toMatchObject({
      rawSpecifier: 'runtime_lib',
      isTypeOnly: false,
      line: 3,
    });

    // Inside if TYPE_CHECKING:
    expect(evidences[2]).toMatchObject({
      rawSpecifier: 'heavy.service',
      isTypeOnly: true,
      importedSymbols: ['HeavyClient'],
      line: 6,
    });

    expect(evidences[3]).toMatchObject({
      rawSpecifier: 'types_module',
      isTypeOnly: true,
      line: 7,
    });

    // Outside block
    expect(evidences[4]).toMatchObject({
      rawSpecifier: 'another_runtime',
      isTypeOnly: false,
      line: 12,
    });
  });

  it('handles empty code and code with only comments or whitespace', () => {
    expect(extractPythonDependencies('empty.py', '')).toEqual([]);
    expect(extractPythonDependencies('comments.py', '# just a comment\n\n')).toEqual([]);
  });
});
