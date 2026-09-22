import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { extractEndpointsFromSource } from '../../src/contract/ast-route-extractor.js';

describe('AST Route & Parameter Extractor', () => {
  it('should extract Express/Fastify routes, destructured parameters, and HTTP status codes', () => {
    const code = `
import { Router } from 'express';
const router = Router();

router.post('/api/v1/orders', (req, res) => {
  const { amount, currency, remark } = req.body;
  if (!amount) {
    return res.status(400).json({ error: 'Missing amount' });
  }
  if (isDuplicate()) {
    return res.status(409).json({ error: 'Conflict' });
  }
  res.status(201).json({ id: '123' });
});

router.get('/api/v1/orders/:id', (req, res) => {
  const { id } = req.params;
  const order = findOrder(id);
  if (!order) {
    return res.sendStatus(404);
  }
  res.status(200).json(order);
});
`;

    const sf = ts.createSourceFile('src/controllers/order.controller.ts', code, ts.ScriptTarget.Latest, true);
    const endpoints = extractEndpointsFromSource(sf, 'src/controllers/order.controller.ts');

    expect(endpoints).toHaveLength(2);

    // Endpoint 1
    const ep1 = endpoints[0];
    expect(ep1.id).toBe('POST /api/v1/orders');
    expect(ep1.method).toBe('POST');
    expect(ep1.path).toBe('/api/v1/orders');
    expect(ep1.line).toBe(5);
    expect(ep1.extractedParams).toContain('amount');
    expect(ep1.extractedParams).toContain('currency');
    expect(ep1.extractedParams).toContain('remark');
    expect(ep1.extractedStatuses).toContain(400);
    expect(ep1.extractedStatuses).toContain(409);
    expect(ep1.extractedStatuses).toContain(201);

    // Endpoint 2
    const ep2 = endpoints[1];
    expect(ep2.id).toBe('GET /api/v1/orders/:id');
    expect(ep2.method).toBe('GET');
    expect(ep2.path).toBe('/api/v1/orders/:id');
    expect(ep2.line).toBe(16);
    expect(ep2.extractedParams).toContain('id');
    expect(ep2.extractedStatuses).toContain(404);
    expect(ep2.extractedStatuses).toContain(200);
  });

  it('should extract NestJS decorator routes, parameters, and HTTP exceptions', () => {
    const code = `
import { Controller, Post, Get, Body, Param, ConflictException, NotFoundException } from '@nestjs/common';

@Controller('api/v1/orders')
export class OrderController {
  @Post()
  create(@Body() body: { amount: number; currency: string }) {
    if (checkConflict()) {
      throw new ConflictException('Already exists');
    }
    return { id: '1' };
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    throw new NotFoundException();
  }
}
`;

    const sf = ts.createSourceFile('src/controllers/order.nest.ts', code, ts.ScriptTarget.Latest, true);
    const endpoints = extractEndpointsFromSource(sf, 'src/controllers/order.nest.ts');

    expect(endpoints).toHaveLength(2);

    const postEp = endpoints.find((e) => e.method === 'POST');
    expect(postEp).toBeDefined();
    expect(postEp?.path).toBe('/api/v1/orders');
    expect(postEp?.extractedParams).toContain('amount');
    expect(postEp?.extractedParams).toContain('currency');
    expect(postEp?.extractedStatuses).toContain(409); // ConflictException -> 409

    const getEp = endpoints.find((e) => e.method === 'GET');
    expect(getEp).toBeDefined();
    expect(getEp?.path).toBe('/api/v1/orders/:id');
    expect(getEp?.extractedParams).toContain('id');
    expect(getEp?.extractedStatuses).toContain(404); // NotFoundException -> 404
  });
});
