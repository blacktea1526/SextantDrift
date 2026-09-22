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

function getComponentIcon(name: string, layerId?: string, tech?: string): string {
  const lower = (name + ' ' + (layerId || '') + ' ' + (tech || '')).toLowerCase();
  if (
    lower.includes('ctrl') ||
    lower.includes('controller') ||
    lower.includes('api') ||
    lower.includes('route') ||
    lower.includes('ui') ||
    lower.includes('cli')
  ) {
    return '⚡';
  }
  if (
    lower.includes('repo') ||
    lower.includes('database') ||
    lower.includes('infra') ||
    lower.includes('storage') ||
    lower.includes('store') ||
    lower.includes('db')
  ) {
    return '🗄️';
  }
  if (
    lower.includes('service') ||
    lower.includes('engine') ||
    lower.includes('domain') ||
    lower.includes('analyzer') ||
    lower.includes('comparator')
  ) {
    return '⚙️';
  }
  if (
    lower.includes('contract') ||
    lower.includes('error') ||
    lower.includes('types') ||
    lower.includes('spec') ||
    lower.includes('schema') ||
    lower.includes('baseline')
  ) {
    return '🛡️';
  }
  return '📦';
}

export function getContainerIcon(name: string, order?: number): string {
  const lower = name.toLowerCase();
  if (
    lower.includes('ui') ||
    lower.includes('presentation') ||
    lower.includes('view') ||
    lower.includes('frontend') ||
    lower.includes('client') ||
    lower.includes('cli')
  ) {
    return '🖥️';
  }
  if (
    lower.includes('api') ||
    lower.includes('gateway') ||
    lower.includes('controller') ||
    lower.includes('route')
  ) {
    return '⚡';
  }
  if (
    lower.includes('domain') ||
    lower.includes('service') ||
    lower.includes('biz') ||
    lower.includes('core')
  ) {
    return '⚙️';
  }
  if (
    lower.includes('infra') ||
    lower.includes('repo') ||
    lower.includes('database') ||
    lower.includes('db') ||
    lower.includes('data')
  ) {
    return '🗄️';
  }
  if (
    lower.includes('security') ||
    lower.includes('auth') ||
    lower.includes('guard')
  ) {
    return '🛡️';
  }
  if (order === 1) return '🖥️';
  if (order === 2) return '⚙️';
  if (order && order >= 3) return '🗄️';
  return '🏛️';
}

export function renderC4Svg(
  graphData: C4GraphData,
  mode: 'unified' | 'target' | 'actual',
  t: Translations
): C4RenderResult {
  const CANVAS_WIDTH = 1360;
  const CONTAINER_MARGIN_X = 64;
  const CONTAINER_GAP_Y = 84;
  const CONTAINER_PADDING_X = 28;
  const CONTAINER_PADDING_Y = 24;
  const CONTAINER_HEADER_HEIGHT = 48;

  const CARD_WIDTH = 274;
  const CARD_HEIGHT = 104;
  const CARD_GAP_X = 26;
  const CARD_GAP_Y = 24;

  const containers = [...(graphData.containers || [])].sort((a, b) => a.order - b.order);
  const nodes = graphData.nodes || [];

  const containerMap = new Map<string, C4GraphContainer>();
  for (const c of containers) {
    containerMap.set(c.id, c);
  }

  // 1. Calculate Layout for Containers and Components
  const layoutContainers: C4LayoutContainer[] = [];
  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  const nodeLayoutMap = new Map<string, C4LayoutNode>();

  let currentY = 36;

  for (const container of containers) {
    const containerNodes = nodes.filter(
      (n) => n.containerId === container.id || n.layerId === container.id
    );

    if (containerNodes.length === 0) continue;

    const cols = Math.min(Math.max(containerNodes.length, 1), 4);
    const rows = Math.ceil(containerNodes.length / cols);

    const contentWidth = cols * CARD_WIDTH + (cols - 1) * CARD_GAP_X;
    const contentHeight = rows * CARD_HEIGHT + (rows - 1) * CARD_GAP_Y;

    const containerWidth = CANVAS_WIDTH - 2 * CONTAINER_MARGIN_X;
    const containerHeight = CONTAINER_HEADER_HEIGHT + contentHeight + CONTAINER_PADDING_Y * 2;

    const containerX = CONTAINER_MARGIN_X;
    const containerY = currentY;

    const startX = containerX + (containerWidth - contentWidth) / 2;
    const layoutNodes: C4LayoutNode[] = [];

    for (let i = 0; i < containerNodes.length; i++) {
      const node = containerNodes[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cardX = startX + col * (CARD_WIDTH + CARD_GAP_X);
      const cardY =
        containerY + CONTAINER_HEADER_HEIGHT + CONTAINER_PADDING_Y + row * (CARD_HEIGHT + CARD_GAP_Y);

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
  const totalHeight = Math.max(currentY + 24, 640);

  // 2. Select Edges according to Mode
  let activeEdges: C4GraphEdge[] = [];
  if (mode === 'target') {
    activeEdges = graphData.targetEdges || [];
  } else if (mode === 'actual') {
    activeEdges = graphData.actualEdges || [];
  } else {
    activeEdges = graphData.edges || [];
  }

  // Multi-Port Indexing (group edges to stagger connection ports)
  const outEdgesBySrc = new Map<string, C4GraphEdge[]>();
  const inEdgesByDst = new Map<string, C4GraphEdge[]>();
  for (const edge of activeEdges) {
    if (!outEdgesBySrc.has(edge.from)) outEdgesBySrc.set(edge.from, []);
    outEdgesBySrc.get(edge.from)!.push(edge);
    if (!inEdgesByDst.has(edge.to)) inEdgesByDst.set(edge.to, []);
    inEdgesByDst.get(edge.to)!.push(edge);
  }

  // 3. Render SVG Output
  const svgLines: string[] = [];

  svgLines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" class="c4-canvas c4-mode-${mode}" id="${mode}-c4-svg" style="shape-rendering: geometricPrecision; text-rendering: geometricPrecision;">`
  );

  // SVG Defs (Markers, Filters, Patterns)
  svgLines.push(`  <defs>
    <!-- Arrowhead Markers -->
    <marker id="arrow-compliant-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#16A34A" />
    </marker>
    <marker id="arrow-drift-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#DC2626" />
    </marker>
    <marker id="arrow-planned-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94A3B8" />
    </marker>

    <!-- Drop Shadows & Glow Filters -->
    <filter id="drift-glow-${mode}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#DC2626" flood-opacity="0.65"/>
    </filter>
    <filter id="card-shadow-${mode}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.06"/>
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#0F172A" flood-opacity="0.03"/>
    </filter>
    <filter id="container-shadow-${mode}" x="-4%" y="-4%" width="108%" height="108%">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.03"/>
    </filter>
  </defs>`);

  // Background Grid Layer
  svgLines.push(`  <g class="c4-background-layer">
    <rect width="100%" height="100%" fill="#F8FAFC" />
  </g>`);

  // 4. Render Containers (Swimlanes)
  svgLines.push(`  <g class="c4-containers-layer">`);
  for (const lc of layoutContainers) {
    const isDrift = lc.container.status === 'drift';
    const containerBg = '#FFFFFF';
    const containerBorder = isDrift ? '#FCA5A5' : '#CBD5E1';
    const containerBorderWidth = isDrift ? 1.5 : 1;
    const containerDash = isDrift ? '6 4' : 'none';
    const headerBg = isDrift ? '#FEF2F2' : '#F8FAFC';
    const badgeBg = '#0F172A';
    const badgeColor = '#FFFFFF';

    svgLines.push(`    <g class="c4-container-group" id="${mode}-container-${escapeXml(lc.container.id)}">
      <!-- Container Background Box -->
      <rect x="${lc.x}" y="${lc.y}" width="${lc.width}" height="${lc.height}" rx="12" ry="12"
            fill="${containerBg}" stroke="${containerBorder}" stroke-width="${containerBorderWidth}"
            stroke-dasharray="${containerDash}" filter="url(#container-shadow-${mode})" class="container-backdrop" />

      <!-- Container Header Bar -->
      <path d="M ${lc.x + 1} ${lc.y + 1} H ${lc.x + lc.width - 1} V ${lc.y + 40} H ${lc.x + 1} Z"
            fill="${headerBg}" />
      <line x1="${lc.x}" y1="${lc.y + 40}" x2="${lc.x + lc.width}" y2="${lc.y + 40}" stroke="${containerBorder}" stroke-width="1" />

      <!-- Layer Badge (L1, L2, L3) & Legacy Token LAYER for tests -->
      <rect x="${lc.x + 16}" y="${lc.y + 9}" width="72" height="22" rx="4" fill="${badgeBg}" />
      <text x="${lc.x + 52}" y="${lc.y + 24}" text-anchor="middle" font-size="10" font-weight="800" font-family="monospace" fill="${badgeColor}">
        LAYER ${lc.container.order}
      </text>

      <!-- Container Title -->
      <text x="${lc.x + 98}" y="${lc.y + 25}" font-size="14.5" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(lc.container.name)}
      </text>

      <!-- Container Tech & Component Count -->
      <text x="${lc.x + lc.width - 18}" y="${lc.y + 24}" text-anchor="end" font-size="11" font-family="monospace" fill="#64748B">
        [${escapeXml(lc.container.technology || 'TypeScript Module')}] • ${lc.nodes.length} Components
      </text>
    </g>`);
  }
  svgLines.push(`  </g>`);

  // 5. Render Edges (Connections) with Intelligent Routing & Multi-Port Staggering
  svgLines.push(`  <g class="c4-edges-layer">`);
  for (const edge of activeEdges) {
    const src = nodeLayoutMap.get(edge.from);
    const dst = nodeLayoutMap.get(edge.to);
    if (!src || !dst) continue;

    const isDrift = edge.status === 'drift';
    const isPlanned = edge.status === 'planned';

    const srcContainer = containerMap.get(src.node.containerId || src.node.layerId);
    const dstContainer = containerMap.get(dst.node.containerId || dst.node.layerId);
    const srcOrder = srcContainer?.order ?? 0;
    const dstOrder = dstContainer?.order ?? 0;
    const orderDiff = dstOrder - srcOrder;

    const outList = outEdgesBySrc.get(edge.from) || [edge];
    const outIdx = Math.max(outList.indexOf(edge), 0);
    const totalOut = outList.length;
    const outFrac = totalOut === 1 ? 0.5 : 0.2 + 0.6 * (outIdx / (totalOut - 1));

    const inList = inEdgesByDst.get(edge.to) || [edge];
    const inIdx = Math.max(inList.indexOf(edge), 0);
    const totalIn = inList.length;
    const inFrac = totalIn === 1 ? 0.5 : 0.2 + 0.6 * (inIdx / (totalIn - 1));

    let pathD = '';
    let midX = 0;
    let midY = 0;

    // Check for Bypass flow (skipping intervening layers, e.g. L1 -> L3) or Inversion flow (L3 -> L1)
    const isBypass = Math.abs(orderDiff) > 1 || (orderDiff < 0 && src.centerY !== dst.centerY);

    if (isBypass) {
      // 🌟 Intelligent Bypass Routing via Outer Gutter (Never slicing through intermediate components!)
      const useRightGutter = (src.centerX + dst.centerX) / 2 >= CANVAS_WIDTH / 2;
      const gutterX = useRightGutter
        ? CANVAS_WIDTH - CONTAINER_MARGIN_X + 28 + outIdx * 14
        : CONTAINER_MARGIN_X - 28 - outIdx * 14;

      const x1 = useRightGutter ? src.x + src.width : src.x;
      const y1 = src.centerY;
      const x2 = useRightGutter ? dst.x + dst.width : dst.x;
      const y2 = dst.centerY;

      pathD = `M ${x1} ${y1} C ${gutterX} ${y1}, ${gutterX} ${y2}, ${x2} ${y2}`;
      midX = gutterX;
      midY = (y1 + y2) / 2;
    } else if (src.centerY < dst.centerY) {
      // Normal Downwards flow between adjacent tiers
      const x1 = src.x + src.width * outFrac;
      const y1 = src.y + src.height;
      const x2 = dst.x + dst.width * inFrac;
      const y2 = dst.y;
      const dy = y2 - y1;

      pathD = `M ${x1} ${y1} C ${x1} ${y1 + dy * 0.45}, ${x2} ${y2 - dy * 0.45}, ${x2} ${y2}`;
      midX = (x1 + x2) / 2;
      midY = (y1 + y2) / 2;
    } else if (src.centerY > dst.centerY) {
      // Upwards flow (Inversion)
      const x1 = src.x + src.width * outFrac;
      const y1 = src.y;
      const x2 = dst.x + dst.width * inFrac;
      const y2 = dst.y + dst.height;
      const dy = y1 - y2;

      pathD = `M ${x1} ${y1} C ${x1} ${y1 - dy * 0.45}, ${x2} ${y2 + dy * 0.45}, ${x2} ${y2}`;
      midX = (x1 + x2) / 2;
      midY = (y1 + y2) / 2;
    } else {
      // Same tier connection
      if (src.centerX < dst.centerX) {
        const x1 = src.x + src.width;
        const y1 = src.centerY;
        const x2 = dst.x;
        const y2 = dst.centerY;
        pathD = `M ${x1} ${y1} C ${x1 + 32} ${y1 - 36}, ${x2 - 32} ${y2 - 36}, ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = y1 - 36;
      } else {
        const x1 = src.x;
        const y1 = src.centerY;
        const x2 = dst.x + dst.width;
        const y2 = dst.centerY;
        pathD = `M ${x1} ${y1} C ${x1 - 32} ${y1 + 36}, ${x2 + 32} ${y2 + 36}, ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = y1 + 36;
      }
    }

    const edgeId = `${mode}-edge-${edge.from}-${edge.to}`;
    const strokeColor = isDrift ? '#DC2626' : isPlanned ? '#94A3B8' : '#16A34A';
    const strokeWidth = isDrift ? 3.2 : isPlanned ? 1.6 : 2.2;
    const strokeDash = isDrift ? '8 5' : isPlanned ? '4 4' : '6 4';
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
    if (isDrift) {
      const tagText = edge.type?.toUpperCase() || 'DRIFT!';
      svgLines.push(`      <g class="c4-edge-pill drift" transform="translate(${midX}, ${midY})">
        <rect x="-42" y="-11" width="84" height="22" rx="5" fill="#DC2626" stroke="#991B1B" stroke-width="1.2" filter="url(#card-shadow-${mode})" />
        <text x="0" y="4" text-anchor="middle" font-size="9.5" font-weight="800" font-family="monospace" fill="#FFFFFF">
          ⚠ ${escapeXml(tagText)}
        </text>
      </g>`);
    } else if (isPlanned) {
      svgLines.push(`      <g class="c4-edge-pill planned" transform="translate(${midX}, ${midY})">
        <rect x="-26" y="-10" width="52" height="20" rx="4" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
        <text x="0" y="4" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="#64748B">
          PLAN
        </text>
      </g>`);
    }

    svgLines.push(`    </g>`);
  }
  svgLines.push(`  </g>`);

  // 6. Render Components (Double-Bezel High-End Cards)
  svgLines.push(`  <g class="c4-components-layer">`);
  for (const lc of layoutContainers) {
    for (const ln of lc.nodes) {
      const node = ln.node;
      const isDrift = node.status === 'drift';
      const cardBg = '#FFFFFF';
      const border = isDrift ? '#DC2626' : '#E2E8F0';
      const borderWidth = isDrift ? 2.5 : 1.5;
      const borderDash = isDrift ? '5 3' : 'none';
      const accentColor = isDrift ? '#DC2626' : '#16A34A';
      const roleIcon = getComponentIcon(node.name, node.layerId, node.technology);
      const descText = node.description || node.paths[0] || '';

      svgLines.push(`    <g class="c4-node ${node.status}" id="${mode}-node-${escapeXml(node.id)}"
           data-node-id="${escapeXml(node.id)}" data-container-id="${escapeXml(node.containerId || '')}"
           onclick="selectC4Node('${escapeXml(node.id)}')">
      <!-- 1. Outer Card Shell with Double-Bezel Drop Shadow -->
      <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="10" ry="10"
            fill="${cardBg}" stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="${borderDash}"
            filter="url(#card-shadow-${mode})" class="node-box" />

      <!-- 2. Top Accent Stripe (Double-Bezel Top Indicator) -->
      <path d="M ${ln.x + 3} ${ln.y + 4} Q ${ln.x + 3} ${ln.y + 2}, ${ln.x + 10} ${ln.y + 2} L ${ln.x + ln.width - 10} ${ln.y + 2} Q ${ln.x + ln.width - 3} ${ln.y + 2}, ${ln.x + ln.width - 3} ${ln.y + 4} L ${ln.x + ln.width - 3} ${ln.y + 5} L ${ln.x + 3} ${ln.y + 5} Z"
            fill="${accentColor}" />

      <!-- 3. Icon & Component Name -->
      <text x="${ln.x + 14}" y="${ln.y + 28}" font-size="13.5" font-weight="800"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${roleIcon} ${escapeXml(truncate(node.name, 20))}
      </text>

      <!-- 4. Technology Tag Pill (Left) -->
      <rect x="${ln.x + 14}" y="${ln.y + 41}" width="96" height="20" rx="4" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1" />
      <text x="${ln.x + 62}" y="${ln.y + 55}" text-anchor="middle" font-size="9.5" font-weight="700" font-family="monospace" fill="#475569">
        ${escapeXml(truncate(node.technology || 'TypeScript', 12))}
      </text>`);

      // 5. Status Pill on right side
      if (isDrift) {
        svgLines.push(`      <rect x="${ln.x + ln.width - 100}" y="${ln.y + 41}" width="86" height="20" rx="4" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1" />
      <text x="${ln.x + ln.width - 57}" y="${ln.y + 55}" text-anchor="middle" font-size="9" font-weight="800" font-family="monospace" fill="#991B1B">
        ⚠ ${node.violationCount} DRIFT
      </text>`);
      } else {
        svgLines.push(`      <rect x="${ln.x + ln.width - 86}" y="${ln.y + 41}" width="72" height="20" rx="4" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1" />
      <text x="${ln.x + ln.width - 50}" y="${ln.y + 55}" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="#065F46">
        ✓ ${node.fileCount} files
      </text>`);
      }

      // 6. Path Footer Gutter
      svgLines.push(`      <!-- Path Footer Gutter -->
      <line x1="${ln.x + 1}" y1="${ln.y + 73}" x2="${ln.x + ln.width - 1}" y2="${ln.y + 73}" stroke="#F1F5F9" stroke-width="1" />
      <rect x="${ln.x + 1}" y="${ln.y + 74}" width="${ln.width - 2}" height="28" rx="0 0 9 9" fill="#F8FAFC" />
      <text x="${ln.x + 14}" y="${ln.y + 92}" font-size="10" font-family="monospace" fill="#64748B">
        📁 ${escapeXml(truncate(descText, 32))}
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
  const CANVAS_WIDTH = 1360;
  const CARD_WIDTH = 960;
  const CARD_HEIGHT = 118;
  const CARD_GAP_Y = 64;
  const START_Y = 48;
  const CARD_X = (CANVAS_WIDTH - CARD_WIDTH) / 2; // 200

  const containers = [...(graphData.containers || [])].sort((a, b) => a.order - b.order);

  // Group nodes by container
  const nodesByContainer = new Map<string, C4GraphNode[]>();
  for (const node of graphData.nodes || []) {
    const cId = node.containerId || node.layerId;
    if (cId) {
      const list = nodesByContainer.get(cId) || [];
      list.push(node);
      nodesByContainer.set(cId, list);
    }
  }

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

  // Allocate channel tracks for bypass (right gutter) and inversion (left gutter)
  const rightBypassEdges: C4GraphEdge[] = [];
  const leftInversionEdges: C4GraphEdge[] = [];

  for (const edge of activeEdges) {
    const src = containerLayoutMap.get(edge.from);
    const dst = containerLayoutMap.get(edge.to);
    if (!src || !dst) continue;
    if (dst.container.order > src.container.order + 1) {
      rightBypassEdges.push(edge);
    } else if (dst.container.order < src.container.order) {
      leftInversionEdges.push(edge);
    }
  }

  const rightBypassMap = new Map<string, number>();
  rightBypassEdges.forEach((edge, idx) => {
    rightBypassMap.set(`${edge.from}->${edge.to}`, idx);
  });

  const leftInversionMap = new Map<string, number>();
  leftInversionEdges.forEach((edge, idx) => {
    leftInversionMap.set(`${edge.from}->${edge.to}`, idx);
  });

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

  // Render Container Edges with outer gutter routing
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
      // Downwards Bypass! Route around right gutter cleanly without cutting through intermediate cards
      const channelIdx = rightBypassMap.get(`${edge.from}->${edge.to}`) || 0;
      const gx = CARD_X + CARD_WIDTH + 44 + channelIdx * 32;
      const srcY = src.y + 36 + (channelIdx % 3) * 16;
      const dstY = dst.y + 36 + (channelIdx % 3) * 16;
      const x1 = src.x + src.width;
      const x2 = dst.x + dst.width;

      pathD = `M ${x1} ${srcY} L ${gx - 12} ${srcY} Q ${gx} ${srcY}, ${gx} ${srcY + 12} L ${gx} ${dstY - 12} Q ${gx} ${dstY}, ${gx - 12} ${dstY} L ${x2} ${dstY}`;
      midX = gx;
      midY = (srcY + dstY) / 2;
    } else {
      // Upwards Inversion! Route around left gutter cleanly without cutting through intermediate cards
      const channelIdx = leftInversionMap.get(`${edge.from}->${edge.to}`) || 0;
      const gx = CARD_X - 44 - channelIdx * 32;
      const srcY = src.y + 36 + (channelIdx % 3) * 16;
      const dstY = dst.y + 36 + (channelIdx % 3) * 16;
      const x1 = src.x;
      const x2 = dst.x;

      pathD = `M ${x1} ${srcY} L ${gx + 12} ${srcY} Q ${gx} ${srcY}, ${gx} ${srcY - 12} L ${gx} ${dstY + 12} Q ${gx} ${dstY}, ${gx + 12} ${dstY} L ${x2} ${dstY}`;
      midX = gx;
      midY = (srcY + dstY) / 2;
    }

    const strokeColor = isDrift ? '#DC2626' : isPlanned ? '#94A3B8' : '#16A34A';
    const strokeWidth = isDrift ? 3.6 : isPlanned ? 1.8 : 2.6;
    const strokeDash = isDrift ? '8 5' : isPlanned ? '4 4' : '6 4';
    const marker = isDrift
      ? `url(#arrow-c-drift-${mode})`
      : isPlanned
      ? `url(#arrow-c-planned-${mode})`
      : `url(#arrow-c-compliant-${mode})`;
    const filter = isDrift ? `filter="url(#c-drift-glow-${mode})"` : '';

    svgLines.push(`    <g class="c4-container-edge ${edge.status}" id="${mode}-cedge-${edge.from}-${edge.to}"
           data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}">
      <path class="c4-edge ${edge.status}" d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"
            stroke-dasharray="${strokeDash}" marker-end="${marker}" ${filter} />`);

    if (isDrift) {
      const tag = edge.type?.toUpperCase() || 'DRIFT!';
      svgLines.push(`      <g class="c4-edge-pill drift" transform="translate(${midX}, ${midY})">
        <rect x="-46" y="-12" width="92" height="24" rx="5" fill="#DC2626" stroke="#991B1B" stroke-width="1.2" />
        <text x="0" y="4" text-anchor="middle" font-size="10" font-weight="800" font-family="monospace" fill="#FFFFFF">
          ⚠ ${escapeXml(tag)}
        </text>
      </g>`);
    } else if (isPlanned) {
      svgLines.push(`      <g class="c4-edge-pill planned" transform="translate(${midX}, ${midY})">
        <rect x="-26" y="-10" width="52" height="20" rx="4" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1" />
        <text x="0" y="4" text-anchor="middle" font-size="9.5" font-weight="700" font-family="monospace" fill="#64748B">
          PLAN
        </text>
      </g>`);
    }

    svgLines.push(`    </g>`);
  }
  svgLines.push(`  </g>`);

  // Render Container Tier Cards with Sub-Component Chips Gallery
  svgLines.push(`  <g class="c4-containers-card-layer">`);
  for (const [, lc] of containerLayoutMap.entries()) {
    const c = lc.container;
    const isDrift = c.status === 'drift';
    const cardBg = '#FFFFFF';
    const border = isDrift ? '#DC2626' : '#E2E8F0';
    const borderWidth = isDrift ? 2.5 : 1.5;
    const borderDash = isDrift ? '5 3' : 'none';
    const accentColor = isDrift ? '#DC2626' : '#16A34A';
    const tagBg = isDrift ? '#FEF2F2' : '#F0FDF4';
    const tagBorder = isDrift ? '#FCA5A5' : '#86EFAC';
    const tagColor = isDrift ? '#991B1B' : '#166534';
    const containerIcon = getContainerIcon(c.name, c.order);
    const compList = nodesByContainer.get(c.id) || [];
    const driftComps = compList.filter((n) => n.status === 'drift');

    svgLines.push(`    <g class="c4-container-node ${c.status}" id="${mode}-cnode-${escapeXml(c.id)}"
           data-container-id="${escapeXml(c.id)}" style="cursor: pointer;"
           onclick="drillDownContainer('${escapeXml(c.id)}')">
      <!-- 1. Outer Container Card Shell with Double-Bezel Drop Shadow -->
      <rect x="${lc.x}" y="${lc.y}" width="${lc.width}" height="${lc.height}" rx="10" ry="10"
            fill="${cardBg}" stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="${borderDash}"
            filter="url(#c-card-shadow-${mode})" class="container-box" />

      <!-- 2. Top Accent Stripe (Double-Bezel Top Indicator) -->
      <path d="M ${lc.x + 3} ${lc.y + 4} Q ${lc.x + 3} ${lc.y + 2}, ${lc.x + 10} ${lc.y + 2} L ${lc.x + lc.width - 10} ${lc.y + 2} Q ${lc.x + lc.width - 3} ${lc.y + 2}, ${lc.x + lc.width - 3} ${lc.y + 4} L ${lc.x + lc.width - 3} ${lc.y + 5} L ${lc.x + 3} ${lc.y + 5} Z"
            fill="${accentColor}" />

      <!-- 3. Layer Badge -->
      <rect x="${lc.x + 20}" y="${lc.y + 16}" width="78" height="22" rx="4" fill="${tagBg}" stroke="${tagBorder}" stroke-width="1" />
      <text x="${lc.x + 59}" y="${lc.y + 31}" text-anchor="middle" font-size="10.5" font-weight="800" font-family="monospace" fill="${tagColor}">
        LAYER ${c.order}
      </text>

      <!-- 4. Container Icon & Name -->
      <text x="${lc.x + 108}" y="${lc.y + 33}" font-size="16" font-weight="800"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${containerIcon} ${escapeXml(c.name)}
      </text>

      <!-- 5. Technology Pill -->
      <rect x="${lc.x + 320}" y="${lc.y + 16}" width="140" height="22" rx="4" fill="#F1F5F9" stroke="#E2E8F0" stroke-width="1" />
      <text x="${lc.x + 390}" y="${lc.y + 31}" text-anchor="middle" font-size="10" font-weight="600" font-family="monospace" fill="#475569">
        ${escapeXml(truncate(c.technology || 'Layer Module', 18))}
      </text>

      <!-- 6. Status Pill (Right) -->
      <rect x="${lc.x + lc.width - 280}" y="${lc.y + 16}" width="136" height="24" rx="4"
            fill="${tagBg}" stroke="${tagBorder}" stroke-width="1" />
      <text x="${lc.x + lc.width - 212}" y="${lc.y + 32}" text-anchor="middle" font-size="10.5" font-weight="800" font-family="monospace" fill="${tagColor}">
        ${isDrift ? `⚠ 存在架构偏航 (${driftComps.length})` : '✓ 架构分层合规'}
      </text>

      <!-- 7. Drill-down Hint Button -->
      <rect x="${lc.x + lc.width - 134}" y="${lc.y + 16}" width="118" height="24" rx="4"
            fill="#EEF2FF" stroke="#C7D2FE" stroke-width="1" />
      <text x="${lc.x + lc.width - 75}" y="${lc.y + 32}" text-anchor="middle" font-size="10" font-weight="700" font-family="sans-serif" fill="#4338CA">
        🔍 下钻组件 ➔
      </text>

      <!-- 8. Mid Divider Line & Bottom Section -->
      <line x1="${lc.x + 1}" y1="${lc.y + 48}" x2="${lc.x + lc.width - 1}" y2="${lc.y + 48}" stroke="#F1F5F9" stroke-width="1" />
      <rect x="${lc.x + 1}" y="${lc.y + 49}" width="${lc.width - 2}" height="68" rx="0 0 9 9" fill="#F8FAFC" />

      <!-- 9. Sub-Component Chips Gallery -->
      <text x="${lc.x + 20}" y="${lc.y + 78}" font-size="11" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#64748B">
        包含组件 (${compList.length}):
      </text>`);

    if (compList.length === 0) {
      svgLines.push(`      <text x="${lc.x + 124}" y="${lc.y + 78}" font-size="11" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#94A3B8">
        暂无映射的代码组件节点
      </text>`);
    } else {
      const maxDisplay = 4;
      const displayComps = compList.slice(0, maxDisplay);
      const overflowCount = compList.length - maxDisplay;

      displayComps.forEach((comp, idx) => {
        const chipX = lc.x + 124 + idx * 186;
        const chipY = lc.y + 60;
        const chipW = 176;
        const chipH = 30;
        const nodeDrift = comp.status === 'drift';
        const chipBorder = nodeDrift ? '#FCA5A5' : '#E2E8F0';
        const chipBg = nodeDrift ? '#FEF2F2' : '#FFFFFF';
        const dotColor = nodeDrift ? '#DC2626' : '#16A34A';
        const textColor = nodeDrift ? '#991B1B' : '#1E293B';
        const icon = getComponentIcon(comp.name, comp.layerId, comp.technology);

        svgLines.push(`      <!-- Sub-Component Chip ${idx + 1} -->
      <g class="c4-subcomponent-chip" onclick="event.stopPropagation(); setC4Level('component'); setTimeout(function(){ selectC4Node('${escapeXml(comp.id)}'); }, 120);" style="cursor: pointer;">
        <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="5" fill="${chipBg}" stroke="${chipBorder}" stroke-width="1" />
        <circle cx="${chipX + 14}" cy="${chipY + 15}" r="3.5" fill="${dotColor}" />
        <text x="${chipX + 25}" y="${chipY + 19}" font-size="10.5" font-weight="600" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="${textColor}">
          ${icon} ${escapeXml(truncate(comp.name, 14))}
        </text>
      </g>`);
      });

      if (overflowCount > 0) {
        const moreX = lc.x + 124 + maxDisplay * 186;
        const moreY = lc.y + 60;
        svgLines.push(`      <rect x="${moreX}" y="${moreY}" width="78" height="30" rx="5" fill="#F1F5F9" stroke="#CBD5E1" stroke-width="1" />
      <text x="${moreX + 39}" y="${moreY + 19}" text-anchor="middle" font-size="10" font-weight="700" font-family="monospace" fill="#64748B">
        +${overflowCount} 更多
      </text>`);
      }
    }

    svgLines.push(`    </g>`);
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
