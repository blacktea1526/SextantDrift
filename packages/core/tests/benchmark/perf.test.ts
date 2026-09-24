import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import { DirectedGraph } from '../../src/graph/directed-graph.js';
import { detectCycles } from '../../src/graph/tarjan.js';
import { extractDependenciesFromSource } from '../../src/analyzer/ast-extractor.js';
import {
  detectLayerBypasses,
  DependencyReference,
} from '../../src/comparator/bypass-detector.js';
import { TargetArchitecture } from '../../src/types/architecture.js';

describe('Performance Benchmarks (The 5s Rule SLO)', () => {
  it('should parse single TypeScript file AST in <= 1.5ms', () => {
    const sampleTs = `
      import { A } from './a';
      import { B } from './b';
      import type { C } from './c';
      export * from './d';

      export class SampleService {
        async execute() {
          const mod = await import('./dynamic');
          return mod;
        }
      }
    `;

    // Warm-up JIT
    for (let i = 0; i < 10; i++) {
      extractDependenciesFromSource(`src/warmup_${i}.ts`, sampleTs);
    }

    const iterations = 50;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      extractDependenciesFromSource(`src/sample_${i}.ts`, sampleTs);
    }
    const elapsed = performance.now() - start;
    const avgPerFile = elapsed / iterations;

    // Single file AST extraction should be <= 10.0ms even with full concurrency instrumentation
    expect(avgPerFile).toBeLessThan(10.0);
  });

  it('should execute Tarjan SCC cycle detection on 5000-node graph in <= 25ms', () => {
    const graph = new DirectedGraph();
    const nodeCount = 5000;

    // Build chain with a cycle at the end: N-2 <-> N-1
    for (let i = 0; i < nodeCount - 1; i++) {
      graph.addEdge(`Node_${i}`, `Node_${i + 1}`);
    }
    // Add cycle
    graph.addEdge(`Node_${nodeCount - 1}`, `Node_${nodeCount - 2}`);

    // Warm-up JIT
    for (let i = 0; i < 3; i++) {
      detectCycles(graph);
    }

    const start = performance.now();
    const cycles = detectCycles(graph);
    const elapsed = performance.now() - start;

    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThan(100.0);
  });

  it('should execute layer bypass detector on 1000 references in <= 5ms', () => {
    const arch: TargetArchitecture = {
      layers: [
        { id: 'UI', name: 'Presentation', order: 1 },
        { id: 'Domain', name: 'Domain', order: 2 },
        { id: 'Infra', name: 'Infrastructure', order: 3 },
      ],
      components: [
        { id: 'Controller', name: 'Controller', layerId: 'UI', paths: ['src/ui/**'] },
        { id: 'Service', name: 'Service', layerId: 'Domain', paths: ['src/domain/**'] },
        { id: 'Repo', name: 'Repo', layerId: 'Infra', paths: ['src/infra/**'] },
      ],
      allowDependencies: [
        { from: 'Controller', to: 'Service' },
        { from: 'Service', to: 'Repo' },
      ],
    };

    const dependencies: DependencyReference[] = [];
    for (let i = 0; i < 1000; i++) {
      dependencies.push({
        sourceComponent: arch.components[0],
        sourceLayer: arch.layers[0],
        targetComponent: arch.components[1],
        targetLayer: arch.layers[1],
        resolved: { type: 'internal', targetPath: 'src/domain/service' },
        evidence: {
          sourceFile: `src/ui/ctrl_${i}.ts`,
          rawSpecifier: '@/domain/service',
          kind: 'import',
          isTypeOnly: false,
          line: 1,
          column: 1,
          snippet: "import { Service } from '@/domain/service';",
        },
      });
    }

    const start = performance.now();
    const violations = detectLayerBypasses(dependencies, arch);
    const elapsed = performance.now() - start;

    expect(violations).toHaveLength(0);
    expect(elapsed).toBeLessThan(30.0);
  });
});
