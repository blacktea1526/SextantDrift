import { describe, it, expect } from 'vitest';
import { extractAndVerifyStateDiagrams, verifyStateDiagram } from '../../src/state/index.js';

describe('State Verifier End-to-End Suite', () => {
  it('should extract and verify multiple state diagrams from a markdown spec', () => {
    const markdown = `
# System Architecture Specification

## Clean Order Flow
\`\`\`mermaid
stateDiagram-v2
    [*] --> OrderCreated
    OrderCreated --> Processing: submit
    Processing --> Succeeded: success
    Processing --> Failed: timeout / error
    Succeeded --> [*]
    Failed --> [*]
\`\`\`

## Flawed Auth Flow
\`\`\`mermaid
stateDiagram-v2
    [*] --> RequestReceived
    RequestReceived --> Authenticating: verify
    Authenticating --> AuthDeadlock: success
    Authenticating --> BadIsland: fail
    BadIsland --> IslandLoop: ping
    IslandLoop --> BadIsland: pong
\`\`\`
`;

    const results = extractAndVerifyStateDiagrams(markdown, 'ARCHITECTURE.md');
    expect(results).toHaveLength(2);

    // Clean order flow
    const cleanResult = results[0];
    expect(cleanResult.violations).toHaveLength(0);

    // Flawed auth flow
    const flawedResult = results[1];
    expect(flawedResult.violations.length).toBeGreaterThan(0);

    // Should detect:
    // 1. Deadlock in AuthDeadlock
    // 2. Missing fallback in Authenticating? Wait, Authenticating has AuthDeadlock: success, BadIsland: fail (has fail!)
    // 3. What about AuthDeadlock? InDegree 1, OutDegree 0 -> Deadlock!
    const deadlock = flawedResult.violations.find((v) => v.type === 'STATE_DEADLOCK');
    expect(deadlock).toBeDefined();
    expect(deadlock?.stateId).toBe('AuthDeadlock');
    expect(deadlock?.severity).toBe('critical');
  });

  it('should verify raw Mermaid state diagram text directly', () => {
    const rawMermaid = `
stateDiagram-v2
    [*] --> Init
    Init --> WaitingResponse: send
    WaitingResponse --> Completed: ack
    Completed --> [*]
`;
    const result = verifyStateDiagram(rawMermaid, { title: 'Direct Check' });
    expect(result.diagramTitle).toBe('Direct Check');
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].type).toBe('STATE_MISSING_FALLBACK');
    expect(result.violations[0].stateId).toBe('WaitingResponse');
  });
});
