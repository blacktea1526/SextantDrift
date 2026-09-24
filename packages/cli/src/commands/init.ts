import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { EXIT_CODE_FATAL_ERROR, EXIT_CODE_SUCCESS } from '../utils/exit.js';

export interface InitOptions {
  force?: boolean;
  sourceDir?: string;
  json?: boolean;
}

interface LayerDefinition {
  id: string;
  name: string;
  order: number;
}

interface ComponentDefinition {
  id: string;
  name: string;
  layerId: string;
  paths: string[];
}

interface AllowDependencyDefinition {
  from: string;
  to: string;
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

/**
 * Reverse-engineers directory topology and generates sextant.json and ARCHITECTURE.md.
 */
export async function runInit(
  dir: string = '.',
  options: InitOptions = {}
): Promise<number> {
  try {
    const rootDir = path.resolve(process.cwd(), dir);
    const sextantConfigPath = path.resolve(rootDir, 'sextant.json');
    const architectureMdPath = path.resolve(rootDir, 'ARCHITECTURE.md');

    if (fs.existsSync(sextantConfigPath) && !options.force) {
      if (!options.json) {
        console.log(
          pc.yellow(
            `⚠ "sextant.json" already exists in ${path.relative(
              process.cwd(),
              rootDir
            )}. Use --force to overwrite.`
          )
        );
      }
      return EXIT_CODE_SUCCESS;
    }

    const srcDirName = options.sourceDir || (fs.existsSync(path.resolve(rootDir, 'src')) ? 'src' : '.');
    const fullSrcDir = path.resolve(rootDir, srcDirName);

    const detectedLayers = new Map<string, LayerDefinition>();
    const detectedComponents: ComponentDefinition[] = [];

    // Always include a shared utilities layer if present
    const defaultPresentation: LayerDefinition = {
      id: 'presentation',
      name: 'Presentation Layer',
      order: 1,
    };
    const defaultDomain: LayerDefinition = {
      id: 'domain',
      name: 'Business Domain Layer',
      order: 2,
    };
    const defaultInfra: LayerDefinition = {
      id: 'infrastructure',
      name: 'Infrastructure Layer',
      order: 3,
    };

    if (fs.existsSync(fullSrcDir)) {
      const entries = fs.readdirSync(fullSrcDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const lower = entry.name.toLowerCase();
          const match = LAYER_MATCHERS[lower];
          const layerId = match ? match.layerId : 'domain';
          const layerName = match ? match.layerName : 'Business Domain Layer';
          const order = match ? match.order : 2;

          if (!detectedLayers.has(layerId)) {
            detectedLayers.set(layerId, { id: layerId, name: layerName, order });
          }

          const compId = entry.name.charAt(0).toUpperCase() + entry.name.slice(1);
          const relPathPattern = srcDirName === '.' ? `${entry.name}/**` : `${srcDirName}/${entry.name}/**`;

          detectedComponents.push({
            id: compId,
            name: `${compId} Module`,
            layerId,
            paths: [relPathPattern],
          });
        }
      }
    }

    // Fallbacks if no structured folders found
    if (detectedLayers.size === 0) {
      detectedLayers.set('presentation', defaultPresentation);
      detectedLayers.set('domain', defaultDomain);
      detectedLayers.set('infrastructure', defaultInfra);

      detectedComponents.push({
        id: 'AppCore',
        name: 'Application Core',
        layerId: 'domain',
        paths: [srcDirName === '.' ? '**/*.ts' : `${srcDirName}/**/*.ts`],
      });
    }

    // Sort layers by order
    const layers = Array.from(detectedLayers.values()).sort((a, b) => a.order - b.order);

    // Build allowDependencies between consecutive layers
    const allowDependencies: AllowDependencyDefinition[] = [];
    for (let i = 0; i < layers.length - 1; i++) {
      allowDependencies.push({
        from: layers[i].id,
        to: layers[i + 1].id,
      });
    }

    // Project name from package.json if available
    let projectName = path.basename(rootDir);
    const pkgJsonPath = path.resolve(rootDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkg.name) projectName = pkg.name;
      } catch {
        // ignore
      }
    }

    const containers = layers.map((l) => ({
      id: l.id,
      name: l.name,
      order: l.order,
      technology: 'TypeScript Module',
      type: l.id === 'presentation' ? 'ui' : l.id === 'domain' ? 'service' : 'database',
    }));

    const sextantConfig = {
      $schema: 'https://raw.githubusercontent.com/blacktea1526/SextantDrift/main/schemas/sextant.schema.json',
      name: projectName,
      version: '1.0.0',
      description: `C4 Architecture boundary specification for ${projectName}`,
      containers,
      layers,
      components: detectedComponents.map((c) => ({
        ...c,
        technology: 'TypeScript',
        description: `${c.name} module`,
      })),
      allowDependencies: allowDependencies.map((d) => ({
        ...d,
        protocol: 'imports',
        description: `Allow calls from ${d.from} to ${d.to}`,
      })),
      invariants: [
        {
          id: 'NO_DIRECT_INFRA_IN_UI',
          severity: 'critical',
          desc: 'Presentation layer must not directly import infrastructure database or repositories',
          pattern: {
            forbid_import: ['@prisma/client', 'typeorm', 'pg', 'mysql2'],
            in_path: `${srcDirName}/controllers/**,${srcDirName}/views/**`,
          },
        },
      ],
    };

    fs.writeFileSync(sextantConfigPath, JSON.stringify(sextantConfig, null, 2), 'utf-8');

    // Generate companion ARCHITECTURE.md with clean C4 Model specification
    const archMdContent = `# ${projectName} — Architecture Specification (C4 Model)

> This document is automatically generated and synchronized by SextantDrift Reverse X-Ray.
> Single source of truth: \`sextant.json\`

## 1. C4 Architecture Overview

### Containers & Architectural Tiers
| Tier / Container | Order | Role / Type | Technology |
| :--- | :--- | :--- | :--- |
${layers.map((l) => `| **${l.id}** (${l.name}) | Layer ${l.order} | Tier | TypeScript Module |`).join('\n')}

### Component Topology & Physical Mapping
| Component ID | Container | Mapped Paths |
| :--- | :--- | :--- |
${detectedComponents.map((c) => `| \`${c.id}\` | ${c.layerId} | \`${c.paths.join(', ')}\` |`).join('\n')}

### Allowed Architectural Dependency Flow
| From | To | Protocol | Intent |
| :--- | :--- | :--- | :--- |
${allowDependencies.map((d) => `| \`${d.from}\` | \`${d.to}\` | imports | Cascades downward |`).join('\n')}

## 2. Invariants and Architectural Rules

- **Strict Layering**: Calls must cascade downwards through intermediate layers; direct layer bypasses are blocked.
- **Invariants**: Sensitive infrastructure modules cannot be bypassed directly from UI.
`;

    fs.writeFileSync(architectureMdPath, archMdContent, 'utf-8');

    if (options.json) {
      console.log(JSON.stringify({ sextantConfig, status: 'initialized' }, null, 2));
    } else {
      console.log(pc.green(`✔ Architecture initialized successfully (Reverse X-Ray):`));
      console.log(pc.cyan(`  - ${path.relative(process.cwd(), sextantConfigPath)} (Specification Single Source of Truth)`));
      console.log(pc.cyan(`  - ${path.relative(process.cwd(), architectureMdPath)} (Read-only C4 Architecture Document)`));
      console.log(pc.dim('\nRun "npx sextant-drift check" to verify code conformance.'));
    }

    return EXIT_CODE_SUCCESS;
  } catch (err: any) {
    if (options.json) {
      console.error(JSON.stringify({ error: err.message }));
    } else {
      console.error(pc.red(`\n✖ Fatal Error: ${err.message}`));
    }
    return EXIT_CODE_FATAL_ERROR;
  }
}
