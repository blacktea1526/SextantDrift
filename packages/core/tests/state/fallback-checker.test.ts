import { describe, it, expect } from 'vitest';
import { parseStateDiagram } from '../../src/state/parser.js';
import { detectMissingFallbackStates } from '../../src/state/fallback-checker.js';

describe('Missing Fallback & Timeout State Checker', () => {
  it('should pass cleanly when async states have error/timeout/fallback transitions', () => {
    const code = `
stateDiagram-v2
    [*] --> Idle
    Idle --> OrderProcessing: submit
    OrderProcessing --> OrderCompleted: success
    OrderProcessing --> OrderFailed: error / timeout
    OrderCompleted --> [*]
    OrderFailed --> [*]
`;
    const graph = parseStateDiagram(code);
    const violations = detectMissingFallbackStates(graph);
    expect(violations).toHaveLength(0);
  });

  it('should flag an async/waiting state that only has happy path transitions', () => {
    const code = `
stateDiagram-v2
    [*] --> Idle
    Idle --> PaymentPending: request
    PaymentPending --> Succeeded: ok
    Succeeded --> [*]
`;
    const graph = parseStateDiagram(code, { sourceFile: 'payment.md' });
    const violations = detectMissingFallbackStates(graph);

    expect(violations).toHaveLength(1);
    const v = violations[0];
    expect(v.type).toBe('STATE_MISSING_FALLBACK');
    expect(v.severity).toBe('warning');
    expect(v.stateId).toBe('PaymentPending');
    expect(v.message).toContain('Missing fallback/timeout degradation');
    expect(v.suggestion).toContain('timeout, error, retry, fail, or cancel');
  });

  it('should ignore states that are not asynchronous/waiting states', () => {
    const code = `
stateDiagram-v2
    [*] --> Created
    Created --> Confirmed: approve
    Confirmed --> [*]
`;
    const graph = parseStateDiagram(code);
    const violations = detectMissingFallbackStates(graph);
    expect(violations).toHaveLength(0);
  });

  it('should accept fallback if target state name conveys failure', () => {
    const code = `
stateDiagram-v2
    [*] --> ExecutingWorkflow
    ExecutingWorkflow --> Completed: done
    ExecutingWorkflow --> TaskFailed: next
    Completed --> [*]
    TaskFailed --> [*]
`;
    const graph = parseStateDiagram(code);
    const violations = detectMissingFallbackStates(graph);
    expect(violations).toHaveLength(0);
  });
});
