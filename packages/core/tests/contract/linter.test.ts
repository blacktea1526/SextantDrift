import { describe, it, expect } from 'vitest';
import { parseMarkdownContract } from '../../src/contract/markdown-parser.js';
import { lintContractSpec, contractLintIssuesToViolations } from '../../src/contract/linter.js';

describe('Contract Specification Linter & Sanity Checker (Gen 3)', () => {
  it('should pass cleanly with 0 issues on well-formed contract spec', () => {
    const validSpec = `
# Valid Store API
### POST /api/v1/orders
- [param] amount: number (required)
- [status] 201 (Created)
- [status] 400 (Bad Request)

### GET /api/v1/orders/:id
- [param] id: string (required)
- [status] 200 (OK)
- [status] 404 (Not Found)
`;
    const spec = parseMarkdownContract(validSpec, 'api-contract.md');
    const issues = lintContractSpec(validSpec, 'api-contract.md', spec);
    expect(issues).toHaveLength(0);

    const violations = contractLintIssuesToViolations(issues);
    expect(violations).toHaveLength(0);
  });

  it('should detect DUPLICATE_ENDPOINT when same method and path are declared multiple times', () => {
    const duplicateSpec = `
# Duplicate API
### POST /api/v1/orders
- [param] amount: number (required)
- [status] 201 (Created)

### POST /api/v1/orders
- [param] currency: string (optional)
- [status] 400 (Bad Request)
`;
    const spec = parseMarkdownContract(duplicateSpec, 'api-contract.md');
    const issues = lintContractSpec(duplicateSpec, 'api-contract.md', spec);

    const dupIssues = issues.filter((i) => i.ruleId === 'DUPLICATE_ENDPOINT');
    expect(dupIssues.length).toBeGreaterThanOrEqual(1);
    expect(dupIssues[0].endpointId).toBe('POST /api/v1/orders');
    expect(dupIssues[0].severity).toBe('critical');
    expect(dupIssues[0].suggestion).toContain('POST /api/v1/orders');
  });

  it('should detect INVALID_HTTP_METHOD for invented or non-standard verbs', () => {
    const invalidVerbSpec = `
# Invalid Verbs API
### UPDATE /api/v1/orders/:id
- [status] 200 (OK)

### DEL /api/v1/orders/:id
- [status] 204 (Deleted)

### FETCH /api/v1/orders
- [status] 200 (OK)
`;
    const spec = parseMarkdownContract(invalidVerbSpec, 'api-contract.md');
    const issues = lintContractSpec(invalidVerbSpec, 'api-contract.md', spec);

    const verbIssues = issues.filter((i) => i.ruleId === 'INVALID_HTTP_METHOD');
    expect(verbIssues.length).toBe(3);
    expect(verbIssues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('UPDATE'),
        expect.stringContaining('DEL'),
        expect.stringContaining('FETCH'),
      ])
    );
    expect(verbIssues[0].suggestion).toContain('GET, POST, PUT, DELETE, PATCH');
  });

  it('should detect INVALID_STATUS_CODE for non-standard HTTP status codes', () => {
    const invalidStatusSpec = `
# Invalid Status API
### POST /api/v1/items
- [status] 99 (Too Low)
- [status] 201 (Created)
- [status] 700 (Too High)
`;
    const spec = parseMarkdownContract(invalidStatusSpec, 'api-contract.md');
    const issues = lintContractSpec(invalidStatusSpec, 'api-contract.md', spec);

    const statusIssues = issues.filter((i) => i.ruleId === 'INVALID_STATUS_CODE');
    expect(statusIssues.length).toBe(2);
    expect(statusIssues[0].message).toContain('99');
    expect(statusIssues[1].message).toContain('700');
    expect(statusIssues[0].severity).toBe('critical');
  });

  it('should detect MALFORMED_PARAM when parameter specification is invalid', () => {
    const malformedParamSpec = `
# Malformed Param API
### POST /api/v1/users
- [param] : string (required)
- [param] 123invalid (required)
- [param] validName: string (required)
`;
    const spec = parseMarkdownContract(malformedParamSpec, 'api-contract.md');
    const issues = lintContractSpec(malformedParamSpec, 'api-contract.md', spec);

    const paramIssues = issues.filter((i) => i.ruleId === 'MALFORMED_PARAM');
    expect(paramIssues.length).toBeGreaterThanOrEqual(1);
  });

  it('should warn with EMPTY_ENDPOINT_SPEC when an endpoint has no params and no status codes', () => {
    const emptyEndpointSpec = `
# Empty Endpoint API
### GET /api/v1/health

### GET /api/v1/users
- [status] 200 (OK)
`;
    const spec = parseMarkdownContract(emptyEndpointSpec, 'api-contract.md');
    const issues = lintContractSpec(emptyEndpointSpec, 'api-contract.md', spec);

    const emptyIssues = issues.filter((i) => i.ruleId === 'EMPTY_ENDPOINT_SPEC');
    expect(emptyIssues.length).toBe(1);
    expect(emptyIssues[0].endpointId).toBe('GET /api/v1/health');
    expect(emptyIssues[0].severity).toBe('warning');
  });

  it('should convert lint issues into standard ViolationEvidence objects', () => {
    const problematicSpec = `
### CREATE /api/v1/test
- [status] 999 (Invalid)
`;
    const spec = parseMarkdownContract(problematicSpec, 'api-contract.md');
    const issues = lintContractSpec(problematicSpec, 'api-contract.md', spec);
    const violations = contractLintIssuesToViolations(issues);

    expect(violations.length).toBeGreaterThanOrEqual(2);
    expect(violations[0].type).toBe('CONTRACT_LINT_ERROR');
    expect(violations[0].sourceFile).toBe('api-contract.md');
    expect(violations[0].suggestion).toBeDefined();
  });
});
