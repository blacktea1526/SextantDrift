import { describe, it, expect } from 'vitest';
import {
  detectLayerInversions,
  detectForbiddenImports,
  RawFileDependency,
} from '../../src/comparator/inversion-detector.js';
import { DependencyReference } from '../../src/comparator/bypass-detector.js';
import { TargetArchitecture } from '../../src/types/architecture.js';

describe('Layer Inversion & Forbidden Import Detector', () => {
  const arch: TargetArchitecture = {
    layers: [
      { id: 'UI', name: 'Presentation', order: 1 },
      { id: 'Domain', name: 'Domain', order: 2 },
    ],
    components: [
      {
        id: 'Controller',
        name: 'Controllers',
        layerId: 'UI',
        paths: ['src/controllers/**'],
        forbiddenImports: ['@prisma/client'],
      },
      {
        id: 'Service',
        name: 'Services',
        layerId: 'Domain',
        paths: ['src/services/**'],
      },
    ],
    allowDependencies: [{ from: 'Controller', to: 'Service' }],
  };

  it('should detect layer inversion when Service imports Controller', () => {
    const dependencies: DependencyReference[] = [
      {
        sourceComponent: arch.components[1], // Service (order 2)
        sourceLayer: arch.layers[1],
        targetComponent: arch.components[0], // Controller (order 1)
        targetLayer: arch.layers[0],
        resolved: { type: 'internal', targetPath: 'src/controllers/user.controller' },
        evidence: {
          sourceFile: 'src/services/user.service.ts',
          rawSpecifier: '../controllers/user.controller.js',
          kind: 'import',
          isTypeOnly: false,
          line: 3,
          column: 1,
          snippet: "import { UserController } from '../controllers/user.controller.js';",
        },
      },
    ];

    const violations = detectLayerInversions(dependencies, arch);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('CRITICAL_INVERSION');
    expect(violations[0].line).toBe(3);
    expect(violations[0].sourceComponent).toBe('Service');
    expect(violations[0].targetComponent).toBe('Controller');
  });

  it('should detect forbidden import when Controller imports @prisma/client', () => {
    const rawDependencies: RawFileDependency[] = [
      {
        sourceFile: 'src/controllers/user.controller.ts',
        sourceComponent: arch.components[0],
        resolved: { type: 'external', packageName: '@prisma/client', rawSpecifier: '@prisma/client' },
        evidence: {
          sourceFile: 'src/controllers/user.controller.ts',
          rawSpecifier: '@prisma/client',
          kind: 'import',
          isTypeOnly: false,
          line: 2,
          column: 1,
          snippet: "import { PrismaClient } from '@prisma/client';",
        },
      },
    ];

    const violations = detectForbiddenImports(rawDependencies, arch);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('CRITICAL_FORBIDDEN_IMPORT');
    expect(violations[0].line).toBe(2);
    expect(violations[0].message).toContain('@prisma/client');
  });
});
