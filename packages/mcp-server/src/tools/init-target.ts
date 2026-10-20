import fs from 'node:fs';
import path from 'node:path';
import { TargetArchitecture } from '@sextant/core';

export interface InitTargetArgs {
  rootDir?: string;
  sourceDir?: string;
}

const LAYER_MATCHERS: Record<string, { layerId: string; layerName: string; order: number }> = {
  // Presentation
  presentation: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  ui: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  controllers: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  controller: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  routes: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  views: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  components: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  pages: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },
  api: { layerId: 'presentation', layerName: 'Presentation Layer', order: 1 },

  // Domain
  services: { layerId: 'domain', layerName: 'Domain Layer', order: 2 },
  service: { layerId: 'domain', layerName: 'Domain Layer', order: 2 },
  domain: { layerId: 'domain', layerName: 'Domain Layer', order: 2 },
  models: { layerId: 'domain', layerName: 'Domain Layer', order: 2 },
  entities: { layerId: 'domain', layerName: 'Domain Layer', order: 2 },
  state: { layerId: 'domain', layerName: 'Domain Layer', order: 2 },

  // Infrastructure
  repos: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  repositories: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  repository: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  infra: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  infrastructure: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  db: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  database: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
  integrations: { layerId: 'infrastructure', layerName: 'Infrastructure Layer', order: 3 },
};

export function runInitTarget(args: InitTargetArgs = {}): TargetArchitecture {
  const rootDir = path.resolve(args.rootDir || process.cwd());
  const srcBase = args.sourceDir || (fs.existsSync(path.join(rootDir, 'src')) ? 'src' : '.');
  const targetDir = path.join(rootDir, srcBase);

  const layersMap = new Map<string, { id: string; name: string; order: number }>();
  const components: TargetArchitecture['components'] = [];

  if (fs.existsSync(targetDir)) {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirName = entry.name.toLowerCase();
      if (['node_modules', 'dist', 'coverage', '.git'].includes(dirName)) continue;

      const matched = LAYER_MATCHERS[dirName] || {
        layerId: 'domain',
        layerName: 'Domain Layer',
        order: 2,
      };

      if (!layersMap.has(matched.layerId)) {
        layersMap.set(matched.layerId, {
          id: matched.layerId,
          name: matched.layerName,
          order: matched.order,
        });
      }

      const compId = entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
      components.push({
        id: compId,
        name: `${compId} Module`,
        layerId: matched.layerId,
        paths: [`${srcBase}/${entry.name}/**`],
      });
    }
  }

  // Ensure default standard 3-tier layers if empty
  if (layersMap.size === 0) {
    layersMap.set('presentation', { id: 'presentation', name: 'Presentation Layer', order: 1 });
    layersMap.set('domain', { id: 'domain', name: 'Domain Layer', order: 2 });
    layersMap.set('infrastructure', { id: 'infrastructure', name: 'Infrastructure Layer', order: 3 });

    components.push(
      { id: 'Controllers', name: 'Controllers', layerId: 'presentation', paths: ['src/controllers/**', 'src/api/**'] },
      { id: 'Services', name: 'Domain Services', layerId: 'domain', paths: ['src/services/**', 'src/domain/**'] },
      { id: 'Repositories', name: 'Repositories', layerId: 'infrastructure', paths: ['src/repositories/**', 'src/db/**'] }
    );
  }

  const layers = Array.from(layersMap.values()).sort((a, b) => a.order - b.order);

  // Standard downward flow
  const allowDependencies: TargetArchitecture['allowDependencies'] = [];
  for (let i = 0; i < layers.length - 1; i++) {
    const fromComps = components.filter((c) => c.layerId === layers[i].id);
    const toComps = components.filter((c) => c.layerId === layers[i + 1].id);
    for (const from of fromComps) {
      for (const to of toComps) {
        allowDependencies.push({ from: from.id, to: to.id });
      }
    }
  }

  return {
    $schema: 'https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json',
    name: path.basename(rootDir),
    version: '2.0.0',
    description: `Auto-generated architecture target specification for ${path.basename(rootDir)}`,
    layers,
    components,
    allowDependencies,
    invariants: [
      {
        id: 'FORBID_DIRECT_DB_IN_UI',
        severity: 'critical',
        desc: 'UI/Presentation components are forbidden from directly importing database drivers or repositories',
        pattern: {
          forbid_import: ['@prisma/client', 'typeorm', 'pg', 'mysql2', 'src/repositories/**'],
          in_path: 'src/presentation/**,src/controllers/**',
        },
      },
    ],
  };
}
