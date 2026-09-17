import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { resolveTargetArchitecture } from '../../src/parser/spec-resolver.js';

describe('Spec Resolver', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-spec-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should resolve sextant.json by default', () => {
    const spec = {
      layers: [{ id: 'Core', name: 'Core Layer', order: 1 }],
      components: [{ id: 'Engine', name: 'Engine', layerId: 'Core', paths: ['src/**'] }],
      allowDependencies: [],
    };
    fs.writeFileSync(path.join(tmpDir, 'sextant.json'), JSON.stringify(spec));

    const arch = resolveTargetArchitecture(tmpDir);
    expect(arch.layers[0].id).toBe('Core');
  });

  it('should fallback to ARCHITECTURE.md when sextant.json is absent', () => {
    const md = `# Target Architecture
\`\`\`mermaid
flowchart TD
    subgraph Service ["Service Layer"]
        App["Application"]
    end
\`\`\``;
    fs.writeFileSync(path.join(tmpDir, 'ARCHITECTURE.md'), md);

    const arch = resolveTargetArchitecture(tmpDir);
    expect(arch.layers[0].id).toBe('Service');
    expect(arch.components[0].id).toBe('App');
  });

  it('should load custom path when provided', () => {
    const customPath = path.join(tmpDir, 'custom-arch.json');
    const spec = {
      layers: [{ id: 'Custom', name: 'Custom Layer', order: 1 }],
      components: [{ id: 'Comp', name: 'Comp', layerId: 'Custom', paths: ['src/**'] }],
      allowDependencies: [],
    };
    fs.writeFileSync(customPath, JSON.stringify(spec));

    const arch = resolveTargetArchitecture(tmpDir, customPath);
    expect(arch.layers[0].id).toBe('Custom');
  });

  it('should extract invariants from ARCHITECTURE.md alongside mermaid diagram', () => {
    const md = `# Target Architecture
\`\`\`mermaid
flowchart TD
    subgraph Service ["Service Layer"]
        App["Application"]
    end
\`\`\`

\`\`\`yaml
invariants:
  - id: rule-md-inv
    severity: critical
    desc: DB save before external call
    pattern:
      must_precede:
        - "db.save"
\`\`\`
`;
    fs.writeFileSync(path.join(tmpDir, 'ARCHITECTURE.md'), md);

    const arch = resolveTargetArchitecture(tmpDir);
    expect(arch.layers[0].id).toBe('Service');
    expect(arch.invariants).toHaveLength(1);
    expect(arch.invariants?.[0].id).toBe('rule-md-inv');
    expect(arch.invariants?.[0].pattern.must_precede).toEqual(['db.save']);
  });

  it('should merge invariants from AGENTS.md when sextant.json is present', () => {
    const spec = {
      layers: [{ id: 'Core', name: 'Core Layer', order: 1 }],
      components: [{ id: 'Engine', name: 'Engine', layerId: 'Core', paths: ['src/**'] }],
      allowDependencies: [],
    };
    fs.writeFileSync(path.join(tmpDir, 'sextant.json'), JSON.stringify(spec));

    const agentsMd = `# Rules
\`\`\`yaml
invariants:
  - id: rule-from-agents
    severity: warning
    desc: Forbid axios
    pattern:
      forbid_import:
        - axios
\`\`\`
`;
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), agentsMd);

    const arch = resolveTargetArchitecture(tmpDir);
    expect(arch.layers[0].id).toBe('Core');
    expect(arch.invariants).toHaveLength(1);
    expect(arch.invariants?.[0].id).toBe('rule-from-agents');
  });
});
