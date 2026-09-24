import { TargetArchitecture, Layer, Component, AllowedDependency } from '../types/architecture.js';
import { ConfigValidationError } from '../errors/config-error.js';

/**
 * Extract Mermaid block from markdown string or return raw text if already Mermaid
 */
/**
 * Extract all Mermaid blocks from markdown string
 */
export function extractMermaidBlocksFromMarkdown(markdownText: string): string[] {
  const blocks: string[] = [];
  const codeBlockRegex = /```mermaid\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(markdownText)) !== null) {
    if (match[1] && match[1].trim()) {
      blocks.push(match[1].trim());
    }
  }

  if (blocks.length === 0) {
    if (
      markdownText.includes('graph ') ||
      markdownText.includes('flowchart ')
    ) {
      blocks.push(markdownText.trim());
    }
  }

  return blocks;
}

/**
 * Extract best-matching architecture Mermaid block from markdown string
 */
export function extractMermaidFromMarkdown(markdownText: string): string | null {
  const blocks = extractMermaidBlocksFromMarkdown(markdownText);
  if (blocks.length === 0) return null;
  // Prioritize blocks containing subgraphs (layers/components)
  const archBlock = blocks.find((b) => /subgraph\s+/i.test(b));
  return archBlock || blocks[0];
}

/**
 * Parses Mermaid flowchart/graph TD into TargetArchitecture
 */
export function parseMermaidArchitecture(mermaidCode: string): TargetArchitecture {
  const lines = mermaidCode
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !l.startsWith('%%') &&
        !l.startsWith('classDef ') &&
        !l.startsWith('linkStyle ')
    );

  const layers: Layer[] = [];
  const components: Component[] = [];
  const allowDependencies: AllowedDependency[] = [];

  let currentLayer: Layer | null = null;
  let layerOrder = 1;

  // Regex patterns supporting various labels, quotes and classDef annotations
  const subgraphRegex = /subgraph\s+([A-Za-z0-9_]+)(?:\s*\["([^"]+)"\]|\s*\[([^\]]+)\])?/i;
  const endRegex = /^end$/i;
  const nodeRegex =
    /^([A-Za-z0-9_]+)(?:\["([^"]+)"\]|\[([^\]]+)\]|\("([^"]+)"\)|\(([^\)]+)\))?(?::::([A-Za-z0-9_]+))?$/;
  const edgeRegex =
    /([A-Za-z0-9_]+)\s*(?:[-.=]+>\s*\|[^|]+\||[-.=]+(?:\s*\|[^|]+\|)?\s*[-.=]*>|[-.=]+>)\s*([A-Za-z0-9_]+)/;

  for (const line of lines) {
    if (line.startsWith('graph ') || line.startsWith('flowchart ')) {
      continue;
    }

    const subgraphMatch = line.match(subgraphRegex);
    if (subgraphMatch) {
      const id = subgraphMatch[1];
      const name = subgraphMatch[2] || subgraphMatch[3] || id;
      currentLayer = {
        id,
        name,
        order: layerOrder++,
      };
      layers.push(currentLayer);
      continue;
    }

    if (endRegex.test(line)) {
      currentLayer = null;
      continue;
    }

    const edgeMatch = line.match(edgeRegex);
    if (edgeMatch) {
      const from = edgeMatch[1];
      const to = edgeMatch[2];
      allowDependencies.push({ from, to });
      continue;
    }

    // Check if it's a node inside a subgraph
    if (currentLayer) {
      const nodeMatch = line.match(nodeRegex);
      if (nodeMatch) {
        const id = nodeMatch[1];
        const name = nodeMatch[2] || nodeMatch[3] || nodeMatch[4] || nodeMatch[5] || id;
        components.push({
          id,
          name,
          layerId: currentLayer.id,
          paths: [`src/${currentLayer.id.toLowerCase()}/**`, `src/${id.toLowerCase()}/**`],
        });
      }
    }
  }

  if (layers.length === 0) {
    throw new ConfigValidationError('No subgraphs (layers) found in Mermaid architecture diagram');
  }

  if (components.length === 0) {
    throw new ConfigValidationError('No components found inside subgraphs in Mermaid architecture diagram');
  }

  return {
    layers,
    components,
    allowDependencies,
    invariants: [],
  };
}

/**
 * Serializes TargetArchitecture into standard Mermaid flowchart TD
 */
export function toMermaid(arch: TargetArchitecture): string {
  const lines: string[] = ['flowchart TD'];

  // Sort layers by order
  const sortedLayers = [...arch.layers].sort((a, b) => a.order - b.order);

  for (const layer of sortedLayers) {
    lines.push(`    subgraph ${layer.id} ["${layer.name}"]`);
    const layerComps = arch.components.filter((c) => c.layerId === layer.id);
    for (const comp of layerComps) {
      lines.push(`        ${comp.id}["${comp.name}"]`);
    }
    lines.push('    end');
  }

  lines.push('');
  for (const dep of arch.allowDependencies) {
    lines.push(`    ${dep.from} --> ${dep.to}`);
  }

  return lines.join('\n');
}
