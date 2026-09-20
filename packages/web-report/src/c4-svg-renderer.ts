import { C4GraphData, C4GraphNode, C4GraphEdge, C4GraphContainer } from '@sextant/core';
import { Translations } from './i18n.js';

export interface C4LayoutNode {
  node: C4GraphNode;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface C4LayoutContainer {
  container: C4GraphContainer;
  x: number;
  y: number;
  width: number;
  height: number;
  nodes: C4LayoutNode[];
}

export interface C4RenderResult {
  svg: string;
  width: number;
  height: number;
  nodePositions: Record<string, { x: number; y: number; width: number; height: number }>;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

export function renderC4Svg(
  graphData: C4GraphData,
  mode: 'unified' | 'target' | 'actual',
  t: Translations
): C4RenderResult {
  const CANVAS_WIDTH = 1240;
  const CONTAINER_MARGIN_X = 20;
  const CONTAINER_GAP_Y = 56;
  const CONTAINER_PADDING_X = 28;
  const CONTAINER_PADDING_Y = 24;
  const CONTAINER_HEADER_HEIGHT = 48;

  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 92;
  const CARD_GAP_X = 24;
  const CARD_GAP_Y = 22;

  const containers = [...(graphData.containers || [])].sort((a, b) => a.order - b.order);
  const nodes = graphData.nodes || [];

  const nodeMap = new Map<string, C4GraphNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  // 1. Calculate Layout for Containers and Components
  const layoutContainers: C4LayoutContainer[] = [];
  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  const nodeLayoutMap = new Map<string, C4LayoutNode>();

  let currentY = 32;

  for (const container of containers) {
    const containerNodes = nodes.filter(
      (n) => n.containerId === container.id || n.layerId === container.id
    );

    if (containerNodes.length === 0) continue;

    // Calculate columns: 1 to 4 columns depending on count
    const cols = Math.min(Math.max(containerNodes.length, 1), 4);
    const rows = Math.ceil(containerNodes.length / cols);

    const contentWidth = cols * CARD_WIDTH + (cols - 1) * CARD_GAP_X;
    const contentHeight = rows * CARD_HEIGHT + (rows - 1) * CARD_GAP_Y;

    const containerWidth = CANVAS_WIDTH - 2 * CONTAINER_MARGIN_X;
    const containerHeight = CONTAINER_HEADER_HEIGHT + contentHeight + CONTAINER_PADDING_Y * 2;

    const containerX = CONTAINER_MARGIN_X;
    const containerY = currentY;

    // Center component cards horizontally inside container
    const startX = containerX + (containerWidth - contentWidth) / 2;

    const layoutNodes: C4LayoutNode[] = [];

    for (let i = 0; i < containerNodes.length; i++) {
      const node = containerNodes[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cardX = startX + col * (CARD_WIDTH + CARD_GAP_X);
      const cardY = containerY + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING_Y + row * (CARD_HEIGHT + CARD_GAP_Y);

      const layoutNode: C4LayoutNode = {
        node,
        x: cardX,
        y: cardY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        centerX: cardX + CARD_WIDTH / 2,
        centerY: cardY + CARD_HEIGHT / 2,
      };

      layoutNodes.push(layoutNode);
      nodePositions[node.id] = { x: cardX, y: cardY, width: CARD_WIDTH, height: CARD_HEIGHT };
      nodeLayoutMap.set(node.id, layoutNode);
    }

    layoutContainers.push({
      container,
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      nodes: layoutNodes,
    });

    currentY += containerHeight + CONTAINER_GAP_Y;
  }

  const totalWidth = CANVAS_WIDTH;
  const totalHeight = Math.max(currentY + 20, 600);

  // 2. Select Edges according to Mode
  let activeEdges: C4GraphEdge[] = [];
  if (mode === 'target') {
    activeEdges = graphData.targetEdges || [];
  } else if (mode === 'actual') {
    activeEdges = graphData.actualEdges || [];
  } else {
    // unified mode
    activeEdges = graphData.edges || [];
  }

  // 3. Render SVG Output
  const svgLines: string[] = [];

  svgLines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" class="c4-canvas c4-mode-${mode}" id="${mode}-c4-svg">`
  );

  // SVG Defs (Markers, Filters, Patterns)
  svgLines.push(`  <defs>
    <!-- Arrowhead Markers -->
    <marker id="arrow-compliant-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16A34A" />
    </marker>
    <marker id="arrow-drift-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#DC2626" />
    </marker>
    <marker id="arrow-planned-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
    </marker>

    <!-- Glow & Shadow Filters -->
    <filter id="drift-glow-${mode}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#DC2626" flood-opacity="0.6"/>
    </filter>
    <filter id="card-shadow-${mode}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.06"/>
    </filter>
  </defs>`);

  // Background Grid Layer
  svgLines.push(`  <g class="c4-background-layer">
    <rect width="100%" height="100%" fill="#F8FAFC" />
  </g>`);

  // 4. Render Containers
  svgLines.push(`  <g class="c4-containers-layer">`);
  for (const lc of layoutContainers) {
    const isDrift = lc.container.status === 'drift';
    const containerBg = isDrift ? '#FFFBFB' : '#F4FAF6';
    const containerBorder = isDrift ? '#FCA5A5' : '#86EFAC';
    const tagBg = isDrift ? '#FEF2F2' : '#ECFDF5';
    const tagColor = isDrift ? '#991B1B' : '#065F46';

    svgLines.push(`    <g class="c4-container-group" id="${mode}-container-${escapeXml(lc.container.id)}">
      <!-- Container Background Box -->
      <rect x="${lc.x}" y="${lc.y}" width="${lc.width}" height="${lc.height}" rx="10" ry="10"
            fill="${containerBg}" stroke="${containerBorder}" stroke-width="1.5" stroke-dasharray="6 4" />

      <!-- Container Header Bar -->
      <path d="M ${lc.x} ${lc.y + 38} L ${lc.x + lc.width} ${lc.y + 38}" stroke="${containerBorder}" stroke-width="1" stroke-dasharray="2 2" />

      <!-- Container Badge & Title -->
      <rect x="${lc.x + 16}" y="${lc.y + 10}" width="60" height="20" rx="4" fill="${tagBg}" stroke="${containerBorder}" stroke-width="1" />
      <text x="${lc.x + 46}" y="${lc.y + 24}" text-anchor="middle" font-size="10" font-weight="700" font-family="monospace" fill="${tagColor}">
        LAYER ${lc.container.order}
      </text>

      <text x="${lc.x + 86}" y="${lc.y + 25}" font-size="14" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(lc.container.name)}
      </text>

      <text x="${lc.x + lc.width - 16}" y="${lc.y + 24}" text-anchor="end" font-size="11" font-family="monospace" fill="#64748B">
        [${escapeXml(lc.container.technology || 'TypeScript Module')}]
      </text>
    </g>`);
  }
  svgLines.push(`  </g>`);

  // 5. Render Edges (Connections)
  svgLines.push(`  <g class="c4-edges-layer">`);
  for (const edge of activeEdges) {
    const src = nodeLayoutMap.get(edge.from);
    const dst = nodeLayoutMap.get(edge.to);
    if (!src || !dst) continue;

    const isDrift = edge.status === 'drift';
    const isPlanned = edge.status === 'planned';

    let x1 = src.centerX;
    let y1 = src.centerY;
    let x2 = dst.centerX;
    let y2 = dst.centerY;

    if (src.centerY < dst.centerY) {
      // Downwards
      x1 = src.centerX;
      y1 = src.y + src.height;
      x2 = dst.centerX;
      y2 = dst.y;
    } else if (src.centerY > dst.centerY) {
      // Upwards (e.g. Inversion violation)
      x1 = src.centerX;
      y1 = src.y;
      x2 = dst.centerX;
      y2 = dst.y + dst.height;
    } else {
      // Same tier
      if (src.centerX < dst.centerX) {
        x1 = src.x + src.width;
        y1 = src.centerY;
        x2 = dst.x;
        y2 = dst.centerY;
      } else {
        x1 = src.x;
        y1 = src.centerY;
        x2 = dst.x + dst.width;
        y2 = dst.centerY;
      }
    }

    // Bezier control points
    const dy = y2 - y1;
    let pathD = '';
    if (Math.abs(dy) < 30) {
      // Horizontal arc
      const arcOffset = 40;
      pathD = `M ${x1} ${y1} C ${x1 + 30} ${y1 - arcOffset}, ${x2 - 30} ${y2 - arcOffset}, ${x2} ${y2}`;
    } else {
      const cpY1 = y1 + dy * 0.45;
      const cpY2 = y1 + dy * 0.55;
      pathD = `M ${x1} ${y1} C ${x1} ${cpY1}, ${x2} ${cpY2}, ${x2} ${y2}`;
    }

    const edgeId = `${mode}-edge-${edge.from}-${edge.to}`;
    const strokeColor = isDrift ? '#DC2626' : isPlanned ? '#94A3B8' : '#16A34A';
    const strokeWidth = isDrift ? 3.2 : isPlanned ? 1.6 : 2.2;
    const strokeDash = isDrift ? '6 4' : isPlanned ? '4 4' : 'none';
    const marker = isDrift
      ? `url(#arrow-drift-${mode})`
      : isPlanned
      ? `url(#arrow-planned-${mode})`
      : `url(#arrow-compliant-${mode})`;
    const filter = isDrift ? `filter="url(#drift-glow-${mode})"` : '';

    svgLines.push(`    <g class="c4-edge-group ${edge.status}" id="${edgeId}"
           data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}" data-status="${edge.status}">
      <path class="c4-edge ${edge.status}" d="${pathD}"
            fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
            stroke-dasharray="${strokeDash}" marker-end="${marker}" ${filter} />`);

    // Midpoint Alert Tag for Drift or Planned Edges
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    if (isDrift) {
      const tagText = edge.type?.toUpperCase() || 'DRIFT!';
      svgLines.push(`      <g class="c4-edge-pill" transform="translate(${midX}, ${midY})">
        <rect x="-38" y="-10" width="76" height="20" rx="4" fill="#DC2626" stroke="#991B1B" stroke-width="1" />
        <text x="0" y="3" text-anchor="middle" font-size="9" font-weight="800" font-family="monospace" fill="#FFFFFF">
          ⚠ ${escapeXml(tagText)}
        </text>
      </g>`);
    } else if (isPlanned) {
      svgLines.push(`      <g class="c4-edge-pill" transform="translate(${midX}, ${midY})">
        <rect x="-24" y="-9" width="48" height="18" rx="3" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1" />
        <text x="0" y="3" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="#64748B">
          PLAN
        </text>
      </g>`);
    }

    svgLines.push(`    </g>`);
  }
  svgLines.push(`  </g>`);

  // 6. Render Components (Cards)
  svgLines.push(`  <g class="c4-components-layer">`);
  for (const lc of layoutContainers) {
    for (const ln of lc.nodes) {
      const node = ln.node;
      const isDrift = node.status === 'drift';
      const cardBg = '#FFFFFF';
      const border = isDrift ? '#DC2626' : '#16A34A';
      const borderWidth = isDrift ? 2.5 : 1.8;
      const borderDash = isDrift ? '4 3' : 'none';

      svgLines.push(`    <g class="c4-node ${node.status}" id="${mode}-node-${escapeXml(node.id)}"
           data-node-id="${escapeXml(node.id)}" data-container-id="${escapeXml(node.containerId || '')}"
           onclick="selectC4Node('${escapeXml(node.id)}')">
      <!-- Card Box -->
      <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="8" ry="8"
            fill="${cardBg}" stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="${borderDash}"
            filter="url(#card-shadow-${mode})" class="node-box" />

      <!-- Node Title -->
      <text x="${ln.x + 14}" y="${ln.y + 24}" font-size="13" font-weight="700"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(truncate(node.name, 24))}
      </text>

      <!-- Technology Tag Pill -->
      <rect x="${ln.x + 14}" y="${ln.y + 36}" width="120" height="18" rx="3" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1" />
      <text x="${ln.x + 74}" y="${ln.y + 49}" text-anchor="middle" font-size="9.5" font-weight="700" font-family="monospace" fill="#3730A3">
        ${escapeXml(truncate(node.technology || 'TypeScript', 16))}
      </text>`);

      // Status Pill on right side
      if (isDrift) {
        svgLines.push(`      <rect x="${ln.x + ln.width - 92}" y="${ln.y + 36}" width="78" height="18" rx="3" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1" />
      <text x="${ln.x + ln.width - 53}" y="${ln.y + 49}" text-anchor="middle" font-size="9" font-weight="800" font-family="monospace" fill="#991B1B">
        ⚠ ${node.violationCount} DRIFT
      </text>`);
      } else {
        svgLines.push(`      <rect x="${ln.x + ln.width - 76}" y="${ln.y + 36}" width="62" height="18" rx="3" fill="#F0FDF4" stroke="#86EFAC" stroke-width="1" />
      <text x="${ln.x + ln.width - 45}" y="${ln.y + 49}" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="#166534">
        ✓ ${node.fileCount} files
      </text>`);
      }

      // Path / Description snippet
      const descText = node.description || node.paths[0] || '';
      svgLines.push(`      <text x="${ln.x + 14}" y="${ln.y + 76}" font-size="10.5" font-family="monospace" fill="#64748B">
        ${escapeXml(truncate(descText, 32))}
      </text>
    </g>`);
    }
  }
  svgLines.push(`  </g>`);

  svgLines.push(`</svg>`);

  return {
    svg: svgLines.join('\n'),
    width: totalWidth,
    height: totalHeight,
    nodePositions,
  };
}

export function renderC4ContainerSvg(
  graphData: C4GraphData,
  mode: 'unified' | 'target' | 'actual',
  t: Translations
): C4RenderResult {
  const CANVAS_WIDTH = 1100;
  const CARD_WIDTH = 600;
  const CARD_HEIGHT = 88;
  const CARD_GAP_Y = 66;
  const START_Y = 46;
  const CARD_X = (CANVAS_WIDTH - CARD_WIDTH) / 2;

  const containers = [...(graphData.containers || [])].sort((a, b) => a.order - b.order);

  const containerLayoutMap = new Map<
    string,
    {
      container: C4GraphContainer;
      x: number;
      y: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
    }
  >();

  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};

  let currentY = START_Y;
  for (const c of containers) {
    const layout = {
      container: c,
      x: CARD_X,
      y: currentY,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      centerX: CARD_X + CARD_WIDTH / 2,
      centerY: currentY + CARD_HEIGHT / 2,
    };
    containerLayoutMap.set(c.id, layout);
    nodePositions[c.id] = { x: CARD_X, y: currentY, width: CARD_WIDTH, height: CARD_HEIGHT };
    currentY += CARD_HEIGHT + CARD_GAP_Y;
  }

  const totalWidth = CANVAS_WIDTH;
  const totalHeight = Math.max(currentY + 20, 500);

  // Active container-level edges
  let activeEdges: C4GraphEdge[] = [];
  if (mode === 'target') {
    activeEdges = graphData.targetContainerEdges || [];
  } else if (mode === 'actual') {
    activeEdges = graphData.actualContainerEdges || [];
  } else {
    activeEdges = graphData.containerEdges || [];
  }

  const svgLines: string[] = [];

  svgLines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" class="c4-canvas c4-container-canvas c4-mode-${mode}" id="${mode}-c4-container-svg">`
  );

  // SVG Defs
  svgLines.push(`  <defs>
    <marker id="arrow-c-compliant-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16A34A" />
    </marker>
    <marker id="arrow-c-drift-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#DC2626" />
    </marker>
    <marker id="arrow-c-planned-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
    </marker>

    <filter id="c-drift-glow-${mode}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#DC2626" flood-opacity="0.6"/>
    </filter>
    <filter id="c-card-shadow-${mode}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.08"/>
    </filter>
  </defs>`);

  // Background Grid Layer
  svgLines.push(`  <g class="c4-background-layer">
    <rect width="100%" height="100%" fill="#F8FAFC" />
  </g>`);

  // Render Container Edges
  svgLines.push(`  <g class="c4-container-edges-layer">`);
  for (const edge of activeEdges) {
    const src = containerLayoutMap.get(edge.from);
    const dst = containerLayoutMap.get(edge.to);
    if (!src || !dst) continue;

    const isDrift = edge.status === 'drift';
    const isPlanned = edge.status === 'planned';

    let pathD = '';
    let midX = (src.centerX + dst.centerX) / 2;
    let midY = (src.centerY + dst.centerY) / 2;

    if (dst.container.order === src.container.order + 1) {
      // Direct vertical adjacent layer
      const x1 = src.centerX;
      const y1 = src.y + src.height;
      const x2 = dst.centerX;
      const y2 = dst.y;
      pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      midX = x1;
      midY = (y1 + y2) / 2;
    } else if (dst.container.order > src.container.order + 1) {
      // Downwards Bypass! Route around right side
      const arcSpan = Math.min((dst.container.order - src.container.order) * 45 + 30, 200);
      const x1 = src.x + src.width;
      const y1 = src.centerY;
      const x2 = dst.x + dst.width;
      const y2 = dst.centerY;
      const ctrlX = x1 + arcSpan;
      pathD = `M ${x1} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${x2} ${y2}`;
      midX = ctrlX - 10;
      midY = (y1 + y2) / 2;
    } else {
      // Upwards Inversion! Route around left side
      const arcSpan = Math.min((src.container.order - dst.container.order) * 45 + 30, 200);
      const x1 = src.x;
      const y1 = src.centerY;
      const x2 = dst.x;
      const y2 = dst.centerY;
      const ctrlX = x1 - arcSpan;
      pathD = `M ${x1} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${x2} ${y2}`;
      midX = ctrlX + 10;
      midY = (y1 + y2) / 2;
    }

    const strokeColor = isDrift ? '#DC2626' : isPlanned ? '#94A3B8' : '#16A34A';
    const strokeWidth = isDrift ? 3.6 : isPlanned ? 1.8 : 2.6;
    const strokeDash = isDrift ? '6 4' : isPlanned ? '4 4' : 'none';
    const marker = isDrift
      ? `url(#arrow-c-drift-${mode})`
      : isPlanned
      ? `url(#arrow-c-planned-${mode})`
      : `url(#arrow-c-compliant-${mode})`;
    const filter = isDrift ? `filter="url(#c-drift-glow-${mode})"` : '';

    svgLines.push(`    <g class="c4-container-edge ${edge.status}" id="${mode}-cedge-${edge.from}-${edge.to}"
           data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}">
      <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
            stroke-dasharray="${strokeDash}" marker-end="${marker}" ${filter} />`);

    if (isDrift) {
      const tag = edge.type?.toUpperCase() || 'DRIFT!';
      svgLines.push(`      <g class="c4-edge-pill" transform="translate(${midX}, ${midY})">
        <rect x="-46" y="-12" width="92" height="24" rx="5" fill="#DC2626" stroke="#991B1B" stroke-width="1.2" />
        <text x="0" y="4" text-anchor="middle" font-size="10" font-weight="800" font-family="monospace" fill="#FFFFFF">
          ⚠ ${escapeXml(tag)}
        </text>
      </g>`);
    } else if (isPlanned) {
      svgLines.push(`      <g class="c4-edge-pill" transform="translate(${midX}, ${midY})">
        <rect x="-26" y="-10" width="52" height="20" rx="4" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1" />
        <text x="0" y="4" text-anchor="middle" font-size="9.5" font-weight="700" font-family="monospace" fill="#64748B">
          PLAN
        </text>
      </g>`);
    }

    svgLines.push(`    </g>`);
  }
  svgLines.push(`  </g>`);

  // Render Container Tier Cards
  svgLines.push(`  <g class="c4-containers-card-layer">`);
  for (const [, lc] of containerLayoutMap.entries()) {
    const c = lc.container;
    const isDrift = c.status === 'drift';
    const cardBg = '#FFFFFF';
    const border = isDrift ? '#DC2626' : '#16A34A';
    const borderWidth = isDrift ? 2.5 : 2.0;
    const tagBg = isDrift ? '#FEF2F2' : '#F0FDF4';
    const tagBorder = isDrift ? '#FCA5A5' : '#86EFAC';
    const tagColor = isDrift ? '#991B1B' : '#166534';

    svgLines.push(`    <g class="c4-container-node ${c.status}" id="${mode}-cnode-${escapeXml(c.id)}"
           data-container-id="${escapeXml(c.id)}" style="cursor: pointer;"
           onclick="drillDownContainer('${escapeXml(c.id)}')">
      <!-- Container Outer Card -->
      <rect x="${lc.x}" y="${lc.y}" width="${lc.width}" height="${lc.height}" rx="10" ry="10"
            fill="${cardBg}" stroke="${border}" stroke-width="${borderWidth}"
            filter="url(#c-card-shadow-${mode})" class="container-box" />

      <!-- Layer Badge -->
      <rect x="${lc.x + 18}" y="${lc.y + 16}" width="72" height="22" rx="4" fill="${tagBg}" stroke="${tagBorder}" stroke-width="1" />
      <text x="${lc.x + 54}" y="${lc.y + 31}" text-anchor="middle" font-size="10.5" font-weight="800" font-family="monospace" fill="${tagColor}">
        LAYER ${c.order}
      </text>

      <!-- Container Name -->
      <text x="${lc.x + 100}" y="${lc.y + 33}" font-size="15" font-weight="800"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(c.name)}
      </text>

      <!-- Technology Tag -->
      <text x="${lc.x + 100}" y="${lc.y + 54}" font-size="11.5" font-family="monospace" fill="#475569">
        [${escapeXml(c.technology || 'Module')}] • Type: ${escapeXml(c.type || 'layer')}
      </text>

      <!-- Component Summary Snippet -->
      <text x="${lc.x + 100}" y="${lc.y + 73}" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#64748B">
        📦 ${c.componentIds.length} 组件 (${escapeXml(truncate(c.componentIds.join(', '), 36))})
      </text>

      <!-- Status Pill -->
      <rect x="${lc.x + lc.width - 138}" y="${lc.y + 18}" width="120" height="24" rx="4"
            fill="${tagBg}" stroke="${tagBorder}" stroke-width="1" />
      <text x="${lc.x + lc.width - 78}" y="${lc.y + 34}" text-anchor="middle" font-size="10.5" font-weight="800" font-family="monospace" fill="${tagColor}">
        ${isDrift ? '⚠ 存在架构偏航' : '✓ 架构分层合规'}
      </text>

      <!-- Drill-down Hint Button -->
      <rect x="${lc.x + lc.width - 138}" y="${lc.y + 50}" width="120" height="22" rx="4"
            fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1" />
      <text x="${lc.x + lc.width - 78}" y="${lc.y + 65}" text-anchor="middle" font-size="10" font-weight="700" font-family="sans-serif" fill="#4338CA">
        🔍 下钻组件拓扑 ➔
      </text>
    </g>`);
  }
  svgLines.push(`  </g>`);

  svgLines.push(`</svg>`);

  return {
    svg: svgLines.join('\n'),
    width: totalWidth,
    height: totalHeight,
    nodePositions,
  };
}
