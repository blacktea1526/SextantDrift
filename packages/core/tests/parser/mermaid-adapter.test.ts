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

  it('should parse complex Mermaid with classDef, unquoted brackets, and node styling', () => {
    const complexMermaid = `flowchart TD
    classDef person fill:#1A365D,stroke:#2B6CB0;
    classDef system fill:#2B6CB0,stroke:#4299E1;

    subgraph UI [Presentation Tier]
        Controller[API Controllers]:::system
    end

    subgraph Infra [Infrastructure Tier]
        Repo["Data Repository"]:::system
    end

    Controller -->|uses| Repo
`;

    const arch = parseMermaidArchitecture(complexMermaid);
    expect(arch.layers).toHaveLength(2);
    expect(arch.layers[0].name).toBe('Presentation Tier');
    expect(arch.components).toHaveLength(2);
    expect(arch.components[0].id).toBe('Controller');
    expect(arch.components[0].name).toBe('API Controllers');
    expect(arch.components[1].id).toBe('Repo');
    expect(arch.allowDependencies).toHaveLength(1);
    expect(arch.allowDependencies[0]).toEqual({ from: 'Controller', to: 'Repo' });
  });

  it('should select architecture diagram with subgraphs when markdown has multiple mermaid blocks', () => {
    const md = `# System Overview
\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\`

## Architecture
\`\`\`mermaid
flowchart TD
    subgraph Core [Core Domain]
        Engine[Engine Service]
    end
\`\`\`
`;

    const mermaid = extractMermaidFromMarkdown(md);
    expect(mermaid).toBeDefined();
    expect(mermaid).toContain('subgraph Core');
    const arch = parseMermaidArchitecture(mermaid!);
    expect(arch.layers).toHaveLength(1);
    expect(arch.components).toHaveLength(1);
  });

  it('should support dotted node IDs and multiple chained edges on a single line', () => {
    const mermaid = `flowchart TD
    subgraph Services [Service Tier]
        App.OrderService["Order Service"]
        App.PaymentService["Payment Service"]
    end
    subgraph Data [Data Tier]
        Db.Postgres["Postgres DB"]
    end
    App.OrderService --> App.PaymentService --> Db.Postgres`;

    const arch = parseMermaidArchitecture(mermaid);
    expect(arch.components).toHaveLength(3);
    expect(arch.components.map((c) => c.id)).toContain('App.OrderService');
    expect(arch.components.map((c) => c.id)).toContain('App.PaymentService');
    expect(arch.components.map((c) => c.id)).toContain('Db.Postgres');
    expect(arch.allowDependencies).toHaveLength(2);
    expect(arch.allowDependencies[0]).toEqual({ from: 'App.OrderService', to: 'App.PaymentService' });
    expect(arch.allowDependencies[1]).toEqual({ from: 'App.PaymentService', to: 'Db.Postgres' });
  });

  it('should support nested subgraphs with layer stack restore on inner end', () => {
    const mermaid = `flowchart TD
    subgraph Outer [Outer Tier]
        OuterComp[Outer Component]
        subgraph Inner [Inner Tier]
            InnerComp[Inner Component]
        end
        AfterInnerComp[After Inner Component]
    end`;

    const arch = parseMermaidArchitecture(mermaid);
    expect(arch.layers).toHaveLength(2);
    expect(arch.components).toHaveLength(3);

    const outerComp = arch.components.find((c) => c.id === 'OuterComp');
    const innerComp = arch.components.find((c) => c.id === 'InnerComp');
    const afterInnerComp = arch.components.find((c) => c.id === 'AfterInnerComp');

    expect(outerComp?.layerId).toBe('Outer');
    expect(innerComp?.layerId).toBe('Inner');
    expect(afterInnerComp?.layerId).toBe('Outer');
  });
});

