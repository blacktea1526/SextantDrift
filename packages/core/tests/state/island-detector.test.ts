import { describe, it, expect } from 'vitest';
import { parseStateDiagram } from '../../src/state/parser.js';
import { detectIslandStates } from '../../src/state/island-detector.js';

describe('Unreachable Island State Detector', () => {
  it('should pass cleanly when all states are reachable from [*]', () => {
    const code = `
stateDiagram-v2
    [*] --> Step1
    Step1 --> Step2: next
    Step2 --> [*]
`;
    const graph = parseStateDiagram(code);
    const violations = detectIslandStates(graph);
    expect(violations).toHaveLength(0);
  });

  it('should detect orphan states and unreachable cycles', () => {
    const code = `
stateDiagram-v2
    [*] --> MainFlow
    MainFlow --> [*]

    OrphanSolo: Standalone state
    IslandA --> IslandB: loop
    IslandB --> IslandA: loop
`;
    const graph = parseStateDiagram(code, { sourceFile: 'specs/workflow.md' });
    const violations = detectIslandStates(graph);

    expect(violations).toHaveLength(3);
    const ids = violations.map((v) => v.stateId);
    expect(ids).toContain('OrphanSolo');
    expect(ids).toContain('IslandA');
    expect(ids).toContain('IslandB');

    for (const v of violations) {
      expect(v.type).toBe('STATE_UNREACHABLE');
      expect(v.severity).toBe('warning');
      expect(v.message).toContain('Unreachable island state');
      expect(v.suggestion).toContain('Add an incoming transition');
    }
  });

  it('should handle multiple initial states if present', () => {
    const code = `
stateDiagram-v2
    [*] --> FlowA
    FlowA --> [*]
    [*] --> FlowB
    FlowB --> [*]
`;
    const graph = parseStateDiagram(code);
    const violations = detectIslandStates(graph);
    expect(violations).toHaveLength(0);
  });
});
