import { describe, it, expect } from 'vitest';
import {
  parseSequenceDiagram,
  extractSequenceDiagrams,
} from '../../src/causality/sequence-parser.js';

describe('Mermaid sequenceDiagram Parser (Phase 5 Task 3)', () => {
  it('should parse simple sequence diagram with implicit participants', () => {
    const mermaid = `
sequenceDiagram
    Client->>OrderController: createOrder
    OrderController->>OrderService: processOrder
    OrderService->>OrderRepo: save
    OrderService->>PaymentGateway: charge
`;
    const spec = parseSequenceDiagram(mermaid, 'test.md');
    expect(spec.participants).toEqual(['Client', 'OrderController', 'OrderService', 'OrderRepo', 'PaymentGateway']);
    expect(spec.interactions).toHaveLength(4);

    expect(spec.interactions[0]).toMatchObject({
      source: 'Client',
      target: 'OrderController',
      message: 'createOrder',
      type: 'sync',
    });

    expect(spec.interactions[2]).toMatchObject({
      source: 'OrderService',
      target: 'OrderRepo',
      message: 'save',
      type: 'sync',
    });

    expect(spec.interactions[3]).toMatchObject({
      source: 'OrderService',
      target: 'PaymentGateway',
      message: 'charge',
      type: 'sync',
    });
  });

  it('should parse explicit participants and alias mappings', () => {
    const mermaid = `
sequenceDiagram
    autonumber
    participant C as OrderController
    participant S as OrderService
    participant R as OrderRepo

    %% Comments should be filtered
    C->>S: processOrder(req)
    S->>R: insert(order)
    R-->>S: ack
    S--)C: notifyDone
`;
    const spec = parseSequenceDiagram(mermaid, 'arch.md');
    expect(spec.participants).toEqual(['OrderController', 'OrderService', 'OrderRepo']);
    expect(spec.interactions).toHaveLength(4);

    expect(spec.interactions[0].source).toBe('OrderController');
    expect(spec.interactions[0].target).toBe('OrderService');
    expect(spec.interactions[0].type).toBe('sync');

    expect(spec.interactions[2].type).toBe('reply');
    expect(spec.interactions[3].type).toBe('async');
  });

  it('should ignore diagrams of other types (e.g. flowchart or stateDiagram)', () => {
    const nonSeq = `
flowchart TD
    A --> B
`;
    expect(() => parseSequenceDiagram(nonSeq)).toThrow('Not a valid Mermaid sequenceDiagram');
  });

  it('should extract multiple sequence diagrams from Markdown content', () => {
    const md = `
# System Design

Here is the primary checkout sequence:
\`\`\`mermaid
sequenceDiagram
    User->>Controller: checkout
    Controller->>Service: process
\`\`\`

Here is another section with a flowchart:
\`\`\`mermaid
flowchart TD
    A --> B
\`\`\`

And an async refund sequence:
\`\`\`mermaid
sequenceDiagram
    Admin->>RefundService: triggerRefund
    RefundService-)PaymentGateway: refundAsync
\`\`\`
`;
    const diagrams = extractSequenceDiagrams(md, 'DESIGN.md');
    expect(diagrams).toHaveLength(2);
    expect(diagrams[0].interactions[0].source).toBe('User');
    expect(diagrams[1].interactions[0].source).toBe('Admin');
    expect(diagrams[1].interactions[1].type).toBe('async');
  });
});
