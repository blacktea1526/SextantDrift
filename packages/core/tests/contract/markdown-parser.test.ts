import { describe, it, expect } from 'vitest';
import { parseMarkdownContract } from '../../src/contract/markdown-parser.js';

describe('Markdown Contract Parser (Line-by-Line Spec)', () => {
  it('should parse endpoints, parameters, and status codes with exact line numbers', () => {
    const markdown = `# Order Service API

### POST /api/v1/orders
- [method] POST /api/v1/orders
- [param] amount: number (required)
- [param] currency: string (required)
- [param] remark: string (optional)
- [status] 201 (Created)
- [status] 400 (Bad Request)
- [status] 409 (Conflict)

### GET /api/v1/orders/:id
- [param] id: string (required)
- [status] 200 (OK)
- [status] 404 (Not Found)
`;

    const spec = parseMarkdownContract(markdown, 'docs/api-contract.md');
    expect(spec.endpoints).toHaveLength(2);

    // Endpoint 1: POST /api/v1/orders
    const ep1 = spec.endpoints[0];
    expect(ep1.id).toBe('POST /api/v1/orders');
    expect(ep1.method).toBe('POST');
    expect(ep1.path).toBe('/api/v1/orders');
    expect(ep1.specLine).toBe(3); // Line 3 has "### POST /api/v1/orders"

    expect(ep1.params).toHaveLength(3);
    expect(ep1.params[0]).toEqual({
      name: 'amount',
      type: 'number',
      required: true,
      specLine: 5,
    });
    expect(ep1.params[1]).toEqual({
      name: 'currency',
      type: 'string',
      required: true,
      specLine: 6,
    });
    expect(ep1.params[2]).toEqual({
      name: 'remark',
      type: 'string',
      required: false,
      specLine: 7,
    });

    expect(ep1.statuses).toHaveLength(3);
    expect(ep1.statuses[0]).toEqual({
      code: 201,
      description: 'Created',
      specLine: 8,
    });
    expect(ep1.statuses[2]).toEqual({
      code: 409,
      description: 'Conflict',
      specLine: 10,
    });

    // Endpoint 2: GET /api/v1/orders/:id (header inferred)
    const ep2 = spec.endpoints[1];
    expect(ep2.id).toBe('GET /api/v1/orders/:id');
    expect(ep2.method).toBe('GET');
    expect(ep2.path).toBe('/api/v1/orders/:id');
    expect(ep2.specLine).toBe(12);

    expect(ep2.params).toHaveLength(1);
    expect(ep2.params[0]).toEqual({
      name: 'id',
      type: 'string',
      required: true,
      specLine: 13,
    });

    expect(ep2.statuses).toHaveLength(2);
    expect(ep2.statuses[0].code).toBe(200);
    expect(ep2.statuses[1].code).toBe(404);
  });

  it('should support colon syntax without brackets: - param: name, - status: 200', () => {
    const markdown = `
### DELETE /api/v1/items/:id
- param: id (required)
- status: 204 (No Content)
- status: 404
`;
    const spec = parseMarkdownContract(markdown, 'contract.md');
    expect(spec.endpoints).toHaveLength(1);
    const ep = spec.endpoints[0];
    expect(ep.method).toBe('DELETE');
    expect(ep.path).toBe('/api/v1/items/:id');
    expect(ep.params[0]).toMatchObject({ name: 'id', required: true });
    expect(ep.statuses[0]).toMatchObject({ code: 204, description: 'No Content' });
    expect(ep.statuses[1]).toMatchObject({ code: 404 });
  });

  it('should parse Markdown tables defining API endpoints', () => {
    const markdown = `# API Spec Table

| Method | Endpoint | Status | Description |
| :--- | :--- | :--- | :--- |
| GET | /api/v1/health | 200 | Health check |
| POST | /api/v1/auth/login | 200 | User login |
| DELETE | /api/v1/users/:id | 204 | Delete user |
`;

    const spec = parseMarkdownContract(markdown, 'docs/api.md');
    expect(spec.endpoints).toHaveLength(3);

    expect(spec.endpoints[0].method).toBe('GET');
    expect(spec.endpoints[0].path).toBe('/api/v1/health');
    expect(spec.endpoints[0].statuses[0].code).toBe(200);

    expect(spec.endpoints[1].method).toBe('POST');
    expect(spec.endpoints[1].path).toBe('/api/v1/auth/login');
    expect(spec.endpoints[1].statuses[0].code).toBe(200);

    expect(spec.endpoints[2].method).toBe('DELETE');
    expect(spec.endpoints[2].path).toBe('/api/v1/users/:id');
    expect(spec.endpoints[2].statuses[0].code).toBe(204);
  });
});

