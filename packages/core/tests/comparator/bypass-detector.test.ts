import { describe, it, expect } from 'vitest';
import { detectLayerBypasses, DependencyReference } from '../../src/comparator/bypass-detector.js';
import { TargetArchitecture } from '../../src/types/architecture.js';

describe('Layer Bypass Detector', () => {
  const arch: TargetArchitecture = {
    layers: [
      { id: 'UI', name: 'Presentation', order: 1 },
      { id: 'Domain', name: 'Domain', order: 2 },
      { id: 'Infra', name: 'Infrastructure', order: 3 },
    ],
    components: [
      { id: 'Controller', name: 'Controllers', layerId: 'UI', paths: ['src/controllers/**'] },
      { id: 'Service', name: 'Services', layerId: 'Domain', paths: ['src/services/**'] },
      { id: 'Repo', name: 'Repositories', layerId: 'Infra', paths: ['src/repos/**'] },
    ],
    allowDependencies: [
      { from: 'Controller', to: 'Service' },
      { from: 'Service', to: 'Repo' },
    ],
  };

  it('should detect layer bypass when Controller directly calls Repo', () => {
    const dependencies: DependencyReference[] = [
      {
        sourceComponent: arch.components[0], // Controller (order 1)
        sourceLayer: arch.layers[0],
        targetComponent: arch.components[2], // Repo (order 3)
        targetLayer: arch.layers[2],
        resolved: { type: 'internal', targetPath: 'src/repos/user.repo' },
        evidence: {
          sourceFile: 'src/controllers/user.controller.ts',
          rawSpecifier: '../repos/user.repo.js',
          kind: 'import',
          isTypeOnly: false,
          line: 5,
          column: 1,
          snippet: "import { UserRepo } from '../repos/user.repo.js';",
        },
      },
    ];

    const violations = detectLayerBypasses(dependencies, arch);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('CRITICAL_BYPASS');
    expect(violations[0].line).toBe(5);
    expect(violations[0].sourceComponent).toBe('Controller');
    expect(violations[0].targetComponent).toBe('Repo');
  });

  it('should NOT report bypass when explicitly allowed in allowDependencies', () => {
    const archWithExemption: TargetArchitecture = {
      ...arch,
      allowDependencies: [
        ...arch.allowDependencies,
        { from: 'Controller', to: 'Repo' },
      ],
    };

    const dependencies: DependencyReference[] = [
      {
        sourceComponent: arch.components[0],
        sourceLayer: arch.layers[0],
        targetComponent: arch.components[2],
        targetLayer: arch.layers[2],
        resolved: { type: 'internal', targetPath: 'src/repos/user.repo' },
        evidence: {
          sourceFile: 'src/controllers/user.controller.ts',
          rawSpecifier: '../repos/user.repo.js',
          kind: 'import',
          isTypeOnly: false,
          line: 5,
          column: 1,
          snippet: "import { UserRepo } from '../repos/user.repo.js';",
        },
      },
    ];

    const violations = detectLayerBypasses(dependencies, archWithExemption);
    expect(violations).toHaveLength(0);
  });
});
