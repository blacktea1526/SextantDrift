import { describe, it, expect } from 'vitest';
import { TargetArchitecture } from '../../src/types/architecture.js';
import { buildActualDependencyGraph } from '../../src/pipeline/actual-graph-builder.js';

describe('ActualGraphBuilder (确定性实际依赖图构建器)', () => {
  const mockArch: TargetArchitecture = {
    version: '2.0.0',
    layers: [
      { id: 'ui', name: 'UI Layer', order: 1 },
      { id: 'domain', name: 'Domain Layer', order: 2 },
      { id: 'infra', name: 'Infra Layer', order: 3 },
    ],
    components: [
      { id: 'controller', name: 'Controllers', layerId: 'ui', paths: ['src/controllers/**'] },
      { id: 'service', name: 'Services', layerId: 'domain', paths: ['src/services/**'] },
      { id: 'repo', name: 'Repositories', layerId: 'infra', paths: ['src/repositories/**'] },
    ],
    allowDependencies: [
      { from: 'ui', to: 'domain' },
      { from: 'domain', to: 'infra' },
    ],
  };

  it('should build component nodes and direct dependency edges from file contents', () => {
    const rootDir = '/fake/root';
    const filePaths = [
      'src/controllers/user.controller.ts',
      'src/services/user.service.ts',
      'src/repositories/user.repo.ts',
    ];

    const fileContentMap = new Map<string, string>([
      [
        'src/controllers/user.controller.ts',
        `import { UserService } from '../services/user.service.js';
export class UserController {}`,
      ],
      [
        'src/services/user.service.ts',
        `import { UserRepo } from '../repositories/user.repo.js';
export class UserService {}`,
      ],
      [
        'src/repositories/user.repo.ts',
        `export class UserRepo {}`,
      ],
    ]);

    const result = buildActualDependencyGraph({
      rootDir,
      filePaths,
      arch: mockArch,
      fileContentMap,
      tsConfigPaths: { baseUrl: rootDir, paths: {} },
    });

    // 1. All component nodes should be added
    expect(result.componentGraph.hasNode('controller')).toBe(true);
    expect(result.componentGraph.hasNode('service')).toBe(true);
    expect(result.componentGraph.hasNode('repo')).toBe(true);

    // 2. Edges should be extracted accurately
    expect(result.componentGraph.hasEdge('controller', 'service')).toBe(true);
    expect(result.componentGraph.hasEdge('service', 'repo')).toBe(true);
    expect(result.componentGraph.hasEdge('controller', 'repo')).toBe(false);

    // 3. Dependency references count
    expect(result.componentDependencies.length).toBe(2);
    expect(result.componentFileCounts.get('controller')).toBe(1);
    expect(result.componentFileCounts.get('service')).toBe(1);
    expect(result.componentFileCounts.get('repo')).toBe(1);
  });

  it('should track unresolved imports as resolution warnings', () => {
    const rootDir = '/fake/root';
    const filePaths = ['src/controllers/broken.py'];
    const fileContentMap = new Map<string, string>([
      [
        'src/controllers/broken.py',
        `from .non_existent import Missing`,
      ],
    ]);

    const result = buildActualDependencyGraph({
      rootDir,
      filePaths,
      arch: mockArch,
      fileContentMap,
      tsConfigPaths: { baseUrl: rootDir, paths: {} },
    });

    expect(result.unresolvedImportCount).toBe(1);
    expect(result.resolutionWarnings.length).toBe(1);
    expect(result.resolutionWarnings[0].type).toBe('WARN_UNRESOLVED_IMPORT');
  });
});
