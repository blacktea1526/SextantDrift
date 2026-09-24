import { describe, it, expect } from 'vitest';
import { parseStateDiagram } from '../../src/state/parser.js';
import { detectDeadlockStates } from '../../src/state/deadlock-detector.js';

describe('Deadlock / Black Hole State Detector', () => {
  it('should pass cleanly when all non-terminal states have exit paths to [*]', () => {
    const code = `
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: submit
    Processing --> Succeeded: success
    Processing --> Failed: error
    Succeeded --> [*]
    Failed --> [*]
`;
    const graph = parseStateDiagram(code, { sourceFile: 'valid.mmd' });
    const violations = detectDeadlockStates(graph);
    expect(violations).toHaveLength(0);
  });

  it('should detect a black hole state with inDegree >= 1 and outDegree == 0', () => {
    const code = `
stateDiagram-v2
    [*] --> Pending
    Pending --> BlackHoleState: hang
    Pending --> Done: ok
    Done --> [*]
`;
    const graph = parseStateDiagram(code, { sourceFile: 'workflows/order.md', startLine: 10 });
    const violations = detectDeadlockStates(graph);

    expect(violations).toHaveLength(1);
    const v = violations[0];
    expect(v.type).toBe('STATE_DEADLOCK');
    expect(v.severity).toBe('critical');
    expect(v.stateId).toBe('BlackHoleState');
    expect(v.sourceFile).toBe('workflows/order.md');
    expect(v.message).toContain('Black hole / deadlock state detected: "BlackHoleState"');
    expect(v.suggestion).toContain('Add an exit transition or route it to terminal state "[*]"');
  });

  it('should detect multiple black hole states in complex flows', () => {
    const code = `
stateDiagram-v2
    [*] --> Start
    Start --> DeadlockA: opt1
    Start --> DeadlockB: opt2
    Start --> Healthy: opt3
    Healthy --> [*]
`;
    const graph = parseStateDiagram(code);
    const violations = detectDeadlockStates(graph);

    expect(violations).toHaveLength(2);
    const ids = violations.map((v) => v.stateId);
    expect(ids).toContain('DeadlockA');
    expect(ids).toContain('DeadlockB');
  });

  it('should not flag semantic terminal states (Completed, Cancelled, Failed) as deadlocks', () => {
    const code = `
stateDiagram-v2
    [*] --> Processing
    Processing --> Completed: success
    Processing --> Cancelled: user_abort
    Processing --> Failed: timeout
`;
    const graph = parseStateDiagram(code);
    const violations = detectDeadlockStates(graph);
    expect(violations).toHaveLength(0);
  });
});
