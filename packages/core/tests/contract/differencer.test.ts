import { describe, it, expect } from 'vitest';
import { diffContractAlignment } from '../../src/contract/differencer.js';
import { TargetContractSpec, ActualEndpoint } from '../../src/contract/types.js';

describe('Contract Alignment Differencer', () => {
  const spec: TargetContractSpec = {
    title: 'Order Service',
    sourceFile: 'docs/api-contract.md',
    endpoints: [
      {
        id: 'POST /api/v1/orders',
        method: 'POST',
        path: '/api/v1/orders',
        specFile: 'docs/api-contract.md',
        specLine: 3,
        params: [
          { name: 'amount', type: 'number', required: true, specLine: 4 },
          { name: 'currency', type: 'string', required: true, specLine: 5 },
          { name: 'remark', type: 'string', required: false, specLine: 6 },
        ],
        statuses: [
          { code: 201, description: 'Created', specLine: 7 },
          { code: 400, description: 'Bad Request', specLine: 8 },
          { code: 409, description: 'Conflict', specLine: 9 },
        ],
      },
      {
        id: 'GET /api/v1/orders/:id',
        method: 'GET',
        path: '/api/v1/orders/:id',
        specFile: 'docs/api-contract.md',
        specLine: 12,
        params: [{ name: 'id', type: 'string', required: true, specLine: 13 }],
        statuses: [
          { code: 200, description: 'OK', specLine: 14 },
          { code: 404, description: 'Not Found', specLine: 15 },
        ],
      },
    ],
  };

  it('should pass with 0 violations when all endpoints, params, and statuses are aligned', () => {
    const actual: ActualEndpoint[] = [
      {
        id: 'POST /api/v1/orders',
        method: 'POST',
        path: '/api/v1/orders',
        sourceFile: 'src/controllers/order.controller.ts',
        line: 10,
        column: 1,
        snippet: "router.post('/api/v1/orders', ...)",
        extractedParams: ['amount', 'currency', 'remark'],
        extractedStatuses: [201, 400, 409],
      },
      {
        id: 'GET /api/v1/orders/:id',
        method: 'GET',
        path: '/api/v1/orders/:id',
        sourceFile: 'src/controllers/order.controller.ts',
        line: 25,
        column: 1,
        snippet: "router.get('/api/v1/orders/:id', ...)",
        extractedParams: ['id'],
        extractedStatuses: [200, 404],
      },
    ];

    const violations = diffContractAlignment(spec, actual);
    expect(violations).toHaveLength(0);
  });

  it('should detect missing endpoint, shadow endpoint, missing param, and unhandled status', () => {
    const driftedActual: ActualEndpoint[] = [
      {
        id: 'POST /api/v1/orders',
        method: 'POST',
        path: '/api/v1/orders',
        sourceFile: 'src/controllers/order.controller.ts',
        line: 10,
        column: 1,
        snippet: "router.post('/api/v1/orders', ...)",
        // Missing 'currency'
        extractedParams: ['amount'],
        // Missing 409
        extractedStatuses: [201, 400],
      },
      // Missing 'GET /api/v1/orders/:id'
      // Extra undeclared shadow endpoint
      {
        id: 'DELETE /api/v1/orders/debug_reset',
        method: 'DELETE',
        path: '/api/v1/orders/debug_reset',
        sourceFile: 'src/controllers/order.controller.ts',
        line: 45,
        column: 1,
        snippet: "router.delete('/api/v1/orders/debug_reset', ...)",
        extractedParams: [],
        extractedStatuses: [200],
      },
    ];

    const violations = diffContractAlignment(spec, driftedActual);
    expect(violations.length).toBe(4);

    // 1. Missing endpoint: GET /api/v1/orders/:id
    const missingEp = violations.find((v) => v.type === 'CONTRACT_MISSING_ENDPOINT');
    expect(missingEp).toBeDefined();
    expect(missingEp?.message).toContain('GET /api/v1/orders/:id');
    expect(missingEp?.line).toBe(12);
    expect(missingEp?.suggestion).toContain('Implement route "GET /api/v1/orders/:id"');

    // 2. Shadow endpoint: DELETE /api/v1/orders/debug_reset
    const shadowEp = violations.find((v) => v.type === 'CONTRACT_SHADOW_ENDPOINT');
    expect(shadowEp).toBeDefined();
    expect(shadowEp?.message).toContain('DELETE /api/v1/orders/debug_reset');
    expect(shadowEp?.line).toBe(45);
    expect(shadowEp?.suggestion).toContain('Remove undeclared route');

    // 3. Missing param: currency
    const missingParam = violations.find((v) => v.type === 'CONTRACT_MISSING_PARAM');
    expect(missingParam).toBeDefined();
    expect(missingParam?.message).toContain('currency');
    expect(missingParam?.line).toBe(5);
    expect(missingParam?.suggestion).toContain('currency');

    // 4. Unhandled status: 409 Conflict
    const unhandledStatus = violations.find((v) => v.type === 'CONTRACT_UNHANDLED_STATUS');
    expect(unhandledStatus).toBeDefined();
    expect(unhandledStatus?.message).toContain('409');
    expect(unhandledStatus?.line).toBe(9);
    expect(unhandledStatus?.suggestion).toContain('409');
  });
});
