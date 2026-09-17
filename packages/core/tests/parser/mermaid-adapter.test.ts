import { describe, it, expect } from 'vitest';
import {
  extractMermaidFromMarkdown,
  parseMermaidArchitecture,
  toMermaid,
} from '../../src/parser/mermaid-adapter.js';

describe('Mermaid Adapter', () => {
  it('should extract mermaid code block from markdown', () => {
    const md = `# Architecture
Here is our design:
\`\`\`mermaid
flowchart TD
    subgraph UI ["Presentation"]
        Controller["Controllers"]
    end
    subgraph Infra ["Infrastructure"]
        Repo["Repositories"]
    end
    Controller --> Repo
\`\`\`
More text...`;

    const mermaid = extractMermaidFromMarkdown(md);
    expect(mermaid).toBeDefined();
    expect(mermaid).toContain('subgraph UI');
    expect(mermaid).toContain('Controller --> Repo');
  });

  it('should parse mermaid flowchart into TargetArchitecture model', () => {
    const mermaid = `flowchart TD
    subgraph UI ["Presentation"]
        Controller["Controllers"]
    end
    subgraph Domain ["Domain Layer"]
        Service["Services"]
    end
    Controller --> Service`;

    const arch = parseMermaidArchitecture(mermaid);
    expect(arch.layers).toHaveLength(2);
    expect(arch.layers[0].id).toBe('UI');
    expect(arch.layers[0].name).toBe('Presentation');
    expect(arch.layers[1].id).toBe('Domain');
    expect(arch.components).toHaveLength(2);
    expect(arch.allowDependencies).toHaveLength(1);
    expect(arch.allowDependencies[0]).toEqual({ from: 'Controller', to: 'Service' });
  });

  it('should serialize TargetArchitecture to Mermaid flowchart via toMermaid()', () => {
    const arch = {
      layers: [
        { id: 'UI', name: 'Presentation', order: 1 },
        { id: 'Domain', name: 'Domain', order: 2 },
      ],
      components: [
        { id: 'Controller', name: 'API Controllers', layerId: 'UI', paths: ['src/ui/**'] },
        { id: 'Service', name: 'Domain Services', layerId: 'Domain', paths: ['src/domain/**'] },
      ],
      allowDependencies: [{ from: 'Controller', to: 'Service' }],
    };

    const output = toMermaid(arch);
    expect(output).toContain('flowchart TD');
    expect(output).toContain('subgraph UI ["Presentation"]');
    expect(output).toContain('Controller["API Controllers"]');
    expect(output).toContain('Controller --> Service');
  });
});
