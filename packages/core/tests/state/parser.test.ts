import { describe, it, expect } from 'vitest';
import {
  extractStateDiagramsFromMarkdown,
  parseStateDiagram,
} from '../../src/state/parser.js';

describe('Mermaid stateDiagram-v2 Parser', () => {
  it('should extract stateDiagram-v2 blocks from markdown', () => {
    const markdown = `
# Architecture Spec

Here is the order state machine:

\`\`\`mermaid
stateDiagram-v2
    [*] --> Created
    Created --> Processing: pay
    Processing --> Completed: ship
    Completed --> [*]
\`\`\`

Some other text...
`;

    const diagrams = extractStateDiagramsFromMarkdown(markdown, 'docs/spec.md');
    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].sourceFile).toBe('docs/spec.md');
    expect(diagrams[0].code).toContain('[*] --> Created');
    expect(diagrams[0].startLine).toBeGreaterThan(1);
  });

  it('should parse simple state transitions with initial and terminal states', () => {
    const code = `
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: submit
    Processing --> Succeeded: success
    Processing --> Failed: error
    Succeeded --> [*]
    Failed --> [*]
`;

    const parsed = parseStateDiagram(code, {
      sourceFile: 'diagram.mmd',
      startLine: 1,
      title: 'Task Lifecycle',
    });

    expect(parsed.id).toBe('Task Lifecycle');
    expect(parsed.title).toBe('Task Lifecycle');
    expect(parsed.nodes.size).toBe(5); // [*], Idle, Processing, Succeeded, Failed
    expect(parsed.transitions).toHaveLength(6);

    const initialNode = parsed.nodes.get('[*]');
    expect(initialNode).toBeDefined();
    expect(initialNode?.isInitial).toBe(true);
    expect(initialNode?.isTerminal).toBe(true); // Since it has both out and in

    const idleNode = parsed.nodes.get('Idle');
    expect(idleNode).toBeDefined();
    expect(idleNode?.inDegree).toBe(1);
    expect(idleNode?.outDegree).toBe(1);

    const procNode = parsed.nodes.get('Processing');
    expect(procNode).toBeDefined();
    expect(procNode?.inDegree).toBe(1);
    expect(procNode?.outDegree).toBe(2);

    const failedTrans = parsed.transitions.find((t) => t.from === 'Processing' && t.to === 'Failed');
    expect(failedTrans?.event).toBe('error');
  });

  it('should parse state descriptions and ignore comments and notes', () => {
    const code = `
stateDiagram-v2
    %% This is a comment line
    [*] --> Active
    Active: Currently running in background
    note right of Active
      This is a note block
    end note
    Active --> Done: finish
    Done --> [*]
`;

    const parsed = parseStateDiagram(code);
    expect(parsed.nodes.has('Active')).toBe(true);
    expect(parsed.nodes.get('Active')?.description).toBe('Currently running in background');
    expect(parsed.nodes.has('%%')).toBe(false);
    expect(parsed.nodes.has('note')).toBe(false);
    expect(parsed.transitions).toHaveLength(3); // [*]->Active, Active->Done, Done->[*]
  });

  it('should support choice pseudo-states', () => {
    const code = `
stateDiagram-v2
    state if_state <<choice>>
    [*] --> if_state
    if_state --> Approved: is_valid
    if_state --> Rejected: not_valid
    Approved --> [*]
    Rejected --> [*]
`;

    const parsed = parseStateDiagram(code);
    expect(parsed.nodes.get('if_state')?.isChoice).toBe(true);
  });
});
