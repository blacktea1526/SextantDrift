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
  const CARD_HEIGHT = 88;
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
    <marker id="arrow-compliant-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M 0 1.8 L 7.6 5 L 0 8.2 z" fill="#16A34A" />
    </marker>
    <marker id="arrow-drift-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.3 L 8.6 5 L 0 8.7 z" fill="#DC2626" />
    </marker>
    <marker id="arrow-planned-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M 0 1.8 L 7.6 5 L 0 8.2 z" fill="#94A3B8" />
    </marker>

    <!-- Drop Shadows & Glow Filters -->
    <filter id="drift-glow-${mode}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#DC2626" flood-opacity="0.65"/>
    </filter>
    <filter id="card-shadow-${mode}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="#0F172A" flood-opacity="0.05"/>
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#0F172A" flood-opacity="0.025"/>
    </filter>
    <filter id="container-shadow-${mode}" x="-4%" y="-4%" width="108%" height="108%">
      <feDropShadow dx="0" dy="1" stdDeviation="3" flood-color="#0F172A" flood-opacity="0.025"/>
    </filter>
  </defs>`);

  // Background Grid Layer
  svgLines.push(`  <g class="c4-background-layer">
    <rect width="100%" height="100%" fill="none" />
  </g>`);

  // 4. Render Containers (Swimlanes)
  svgLines.push(`  <g class="c4-containers-layer">`);
  for (const lc of layoutContainers) {
    const isDrift = lc.container.status === 'drift';
    const containerBg = isDrift ? '#FEF2F2' : '#EEF2FF';
    const containerBorder = isDrift ? '#FCA5A5' : '#C7D2FE';
    const containerBorderWidth = isDrift ? 1.5 : 1;
    const containerDash = isDrift ? '6 4' : 'none';
    const badgeBg = isDrift ? '#FFFFFF' : '#FFFFFF';
    const badgeBorder = isDrift ? '#FCA5A5' : '#C7D2FE';
    const badgeColor = isDrift ? '#991B1B' : '#4338CA';

    svgLines.push(`    <g class="c4-container-group" id="${mode}-container-${escapeXml(lc.container.id)}">
      <!-- Container Background Box -->
      <rect x="${lc.x}" y="${lc.y}" width="${lc.width}" height="${lc.height}" rx="14" ry="14"
            fill="${containerBg}" stroke="${containerBorder}" stroke-width="${containerBorderWidth}"
            stroke-dasharray="${containerDash}" filter="url(#container-shadow-${mode})" class="container-backdrop" />

      <!-- Layer Badge (L1, L2, L3) & Legacy Token LAYER for tests -->
      <rect x="${lc.x + 18}" y="${lc.y + 13}" width="42" height="22" rx="6" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1" />
      <desc>LAYER ${lc.container.order}</desc>
      <text x="${lc.x + 39}" y="${lc.y + 28}" text-anchor="middle" font-size="10" font-weight="800" font-family="monospace" fill="${badgeColor}">
        L${lc.container.order}
      </text>

      <!-- Container Title -->
      <text x="${lc.x + 74}" y="${lc.y + 29}" font-size="14" font-weight="800" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(lc.container.name)}
      </text>

      <!-- Container Tech & Component Count -->
      <text x="${lc.x + lc.width - 22}" y="${lc.y + 28}" text-anchor="end" font-size="11" font-family="monospace" fill="#64748B">
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
    let portStartX = 0;
    let portStartY = 0;
    let portEndX = 0;
    let portEndY = 0;

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

      const bend = useRightGutter ? -10 : 10;
      const yDir = y2 >= y1 ? 1 : -1;
      pathD = `M ${x1} ${y1} L ${gutterX + bend} ${y1} Q ${gutterX} ${y1}, ${gutterX} ${y1 + yDir * 10} L ${gutterX} ${y2 - yDir * 10} Q ${gutterX} ${y2}, ${gutterX + bend} ${y2} L ${x2} ${y2}`;
      midX = gutterX;
      midY = (y1 + y2) / 2;
      portStartX = x1;
      portStartY = y1;
      portEndX = x2;
      portEndY = y2;
    } else if (src.centerY < dst.centerY) {
      // Normal Downwards flow between adjacent tiers
      const x1 = src.x + src.width * outFrac;
      const y1 = src.y + src.height;
      const x2 = dst.x + dst.width * inFrac;
      const y2 = dst.y;
      const dy = y2 - y1;

      const mid = y1 + dy / 2;
      const xDir = x2 >= x1 ? 1 : -1;
      pathD = `M ${x1} ${y1} L ${x1} ${mid - 8} Q ${x1} ${mid}, ${x1 + xDir * 8} ${mid} L ${x2 - xDir * 8} ${mid} Q ${x2} ${mid}, ${x2} ${mid + 8} L ${x2} ${y2}`;
      midX = (x1 + x2) / 2;
      midY = (y1 + y2) / 2;
      portStartX = x1;
      portStartY = y1;
      portEndX = x2;
      portEndY = y2;
    } else if (src.centerY > dst.centerY) {
      // Upwards flow (Inversion)
      const x1 = src.x + src.width * outFrac;
      const y1 = src.y;
      const x2 = dst.x + dst.width * inFrac;
      const y2 = dst.y + dst.height;
      const dy = y1 - y2;

      const mid = y2 + dy / 2;
      const xDir = x2 >= x1 ? 1 : -1;
      pathD = `M ${x1} ${y1} L ${x1} ${mid + 8} Q ${x1} ${mid}, ${x1 + xDir * 8} ${mid} L ${x2 - xDir * 8} ${mid} Q ${x2} ${mid}, ${x2} ${mid - 8} L ${x2} ${y2}`;
      midX = (x1 + x2) / 2;
      midY = (y1 + y2) / 2;
      portStartX = x1;
      portStartY = y1;
      portEndX = x2;
      portEndY = y2;
    } else {
      // Same tier connection
      if (src.centerX < dst.centerX) {
        const x1 = src.x + src.width;
        const y1 = src.centerY;
        const x2 = dst.x;
        const y2 = dst.centerY;
        const mid = (x1 + x2) / 2;
        const channelY = y1 - 36;
        pathD = `M ${x1} ${y1} L ${mid - 8} ${y1} Q ${mid} ${y1}, ${mid} ${y1 - 8} L ${mid} ${channelY + 8} Q ${mid} ${channelY}, ${mid + 8} ${channelY} L ${x2 - 8} ${channelY} Q ${x2} ${channelY}, ${x2} ${channelY + 8} L ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = channelY;
        portStartX = x1;
        portStartY = y1;
        portEndX = x2;
        portEndY = y2;
      } else {
        const x1 = src.x;
        const y1 = src.centerY;
        const x2 = dst.x + dst.width;
        const y2 = dst.centerY;
        const mid = (x1 + x2) / 2;
        const channelY = y1 + 36;
        pathD = `M ${x1} ${y1} L ${mid + 8} ${y1} Q ${mid} ${y1}, ${mid} ${y1 + 8} L ${mid} ${channelY - 8} Q ${mid} ${channelY}, ${mid - 8} ${channelY} L ${x2 + 8} ${channelY} Q ${x2} ${channelY}, ${x2} ${channelY - 8} L ${x2} ${y2}`;
        midX = (x1 + x2) / 2;
        midY = channelY;
        portStartX = x1;
        portStartY = y1;
        portEndX = x2;
        portEndY = y2;
      }
    }

    const edgeId = `${mode}-edge-${edge.from}-${edge.to}`;
    const strokeColor = isDrift ? '#DC2626' : isPlanned ? '#94A3B8' : '#16A34A';
    const strokeWidth = isDrift ? 2.4 : isPlanned ? 1.4 : 1.8;
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
            stroke-dasharray="${strokeDash}" stroke-linecap="round" stroke-linejoin="round"
            marker-end="${marker}" ${filter} />
      <circle class="node-port source-port ${edge.status}" cx="${portStartX}" cy="${portStartY}" r="3.5" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.6" />
      <circle class="node-port target-port ${edge.status}" cx="${portEndX}" cy="${portEndY}" r="3.5" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.6" />`);

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

  // 6. Render Components (Compact Node Cards)
  svgLines.push(`  <g class="c4-components-layer">`);
  for (const lc of layoutContainers) {
    for (const ln of lc.nodes) {
      const node = ln.node;
      const isDrift = node.status === 'drift';
      const cardBg = '#FFFFFF';
      const border = isDrift ? '#DC2626' : '#CBD5E1';
      const borderWidth = isDrift ? 2 : 1;
      const borderDash = isDrift ? '5 3' : 'none';
      const accentColor = isDrift ? '#DC2626' : '#7C3AED';
      const roleIcon = getComponentIcon(node.name, node.layerId, node.technology);
      const descText = node.description || node.paths[0] || '';

      svgLines.push(`    <g class="c4-node ${node.status}" id="${mode}-node-${escapeXml(node.id)}"
           data-node-id="${escapeXml(node.id)}" data-container-id="${escapeXml(node.containerId || '')}"
           onclick="selectC4Node('${escapeXml(node.id)}')">
      <!-- 1. Compact Card Shell -->
      <rect x="${ln.x}" y="${ln.y}" width="${ln.width}" height="${ln.height}" rx="8" ry="8"
            fill="${cardBg}" stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="${borderDash}"
            filter="url(#card-shadow-${mode})" class="node-box" />

      <!-- 2. Icon & Component Name -->
      <circle class="node-icon-disc" cx="${ln.x + 24}" cy="${ln.y + 25}" r="11" fill="#F5F3FF" stroke="${accentColor}" stroke-width="1" />
      <text x="${ln.x + 24}" y="${ln.y + 29}" text-anchor="middle" font-size="10.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI Emoji, sans-serif" fill="#4338CA">
        ${roleIcon}
      </text>
      <text x="${ln.x + 44}" y="${ln.y + 30}" font-size="13" font-weight="800"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(truncate(node.name, 22))}
      </text>

      <!-- 3. Technology Tag Pill (Left) -->
      <rect x="${ln.x + 14}" y="${ln.y + 44}" width="92" height="18" rx="5" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" />
      <text x="${ln.x + 60}" y="${ln.y + 56}" text-anchor="middle" font-size="9" font-weight="700" font-family="monospace" fill="#475569">
        ${escapeXml(truncate(node.technology || 'TypeScript', 12))}
      </text>`);

      // 5. Status Pill on right side
      if (isDrift) {
        svgLines.push(`      <rect x="${ln.x + ln.width - 94}" y="${ln.y + 44}" width="80" height="18" rx="5" fill="#FEF2F2" stroke="#FCA5A5" stroke-width="1" />
      <text x="${ln.x + ln.width - 54}" y="${ln.y + 56}" text-anchor="middle" font-size="8.5" font-weight="800" font-family="monospace" fill="#991B1B">
        ⚠ ${node.violationCount} DRIFT
      </text>`);
      } else {
        svgLines.push(`      <rect x="${ln.x + ln.width - 82}" y="${ln.y + 44}" width="68" height="18" rx="5" fill="#ECFDF5" stroke="#A7F3D0" stroke-width="1" />
      <text x="${ln.x + ln.width - 48}" y="${ln.y + 56}" text-anchor="middle" font-size="8.5" font-weight="700" font-family="monospace" fill="#065F46">
        ✓ ${node.fileCount} files
      </text>`);
      }

      // 5. Path Footer Gutter
      svgLines.push(`      <!-- Path Footer Gutter -->
      <line x1="${ln.x + 1}" y1="${ln.y + 68}" x2="${ln.x + ln.width - 1}" y2="${ln.y + 68}" stroke="#F1F5F9" stroke-width="1" />
      <rect x="${ln.x + 1}" y="${ln.y + 69}" width="${ln.width - 2}" height="18" rx="0 0 7 7" fill="#F8FAFC" />
      <text x="${ln.x + 14}" y="${ln.y + 82}" font-size="9" font-family="monospace" fill="#64748B">
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
    <marker id="arrow-c-compliant-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M 0 1.8 L 7.6 5 L 0 8.2 z" fill="#16A34A" />
    </marker>
    <marker id="arrow-c-drift-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M 0 1.3 L 8.6 5 L 0 8.7 z" fill="#DC2626" />
    </marker>
    <marker id="arrow-c-planned-${mode}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse">
      <path d="M 0 1.8 L 7.6 5 L 0 8.2 z" fill="#94A3B8" />
    </marker>

    <filter id="c-drift-glow-${mode}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#DC2626" flood-opacity="0.6"/>
    </filter>
    <filter id="c-card-shadow-${mode}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="#0F172A" flood-opacity="0.05"/>
      <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#0F172A" flood-opacity="0.025"/>
    </filter>
  </defs>`);

  // Background Grid Layer
  svgLines.push(`  <g class="c4-background-layer">
    <rect width="100%" height="100%" fill="none" />
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
    let portStartX = 0;
    let portStartY = 0;
    let portEndX = 0;
    let portEndY = 0;

    if (dst.container.order === src.container.order + 1) {
      // Direct vertical adjacent layer
      const x1 = src.centerX;
      const y1 = src.y + src.height;
      const x2 = dst.centerX;
      const y2 = dst.y;
      pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
      midX = x1;
      midY = (y1 + y2) / 2;
      portStartX = x1;
      portStartY = y1;
      portEndX = x2;
      portEndY = y2;
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
      portStartX = x1;
      portStartY = srcY;
      portEndX = x2;
      portEndY = dstY;
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
      portStartX = x1;
      portStartY = srcY;
      portEndX = x2;
      portEndY = dstY;
    }

    const strokeColor = isDrift ? '#DC2626' : isPlanned ? '#94A3B8' : '#16A34A';
    const strokeWidth = isDrift ? 2.4 : isPlanned ? 1.4 : 1.8;
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
            stroke-dasharray="${strokeDash}" stroke-linecap="round" stroke-linejoin="round"
            marker-end="${marker}" ${filter} />
      <circle class="container-port source-port ${edge.status}" cx="${portStartX}" cy="${portStartY}" r="3.5" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.6" />
      <circle class="container-port target-port ${edge.status}" cx="${portEndX}" cy="${portEndY}" r="3.5" fill="#FFFFFF" stroke="${strokeColor}" stroke-width="1.6" />`);

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
    const cardBg = isDrift ? '#FEF2F2' : '#EEF2FF';
    const border = isDrift ? '#DC2626' : '#C7D2FE';
    const borderWidth = isDrift ? 2 : 1;
    const borderDash = isDrift ? '5 3' : 'none';
    const accentColor = isDrift ? '#DC2626' : '#7C3AED';
    const tagBg = '#FFFFFF';
    const tagBorder = isDrift ? '#FCA5A5' : '#C7D2FE';
    const tagColor = isDrift ? '#991B1B' : '#4338CA';
    const containerIcon = getContainerIcon(c.name, c.order);
    const compList = nodesByContainer.get(c.id) || [];
    const driftComps = compList.filter((n) => n.status === 'drift');

    svgLines.push(`    <g class="c4-container-node ${c.status}" id="${mode}-cnode-${escapeXml(c.id)}"
           data-container-id="${escapeXml(c.id)}" style="cursor: pointer;"
           onclick="drillDownContainer('${escapeXml(c.id)}')">
      <!-- 1. Lightweight Container Card Shell -->
      <rect x="${lc.x}" y="${lc.y}" width="${lc.width}" height="${lc.height}" rx="12" ry="12"
            fill="${cardBg}" stroke="${border}" stroke-width="${borderWidth}" stroke-dasharray="${borderDash}"
            filter="url(#c-card-shadow-${mode})" class="container-box" />

      <!-- 2. Layer Badge -->
      <rect x="${lc.x + 20}" y="${lc.y + 15}" width="42" height="22" rx="6" fill="${tagBg}" stroke="${tagBorder}" stroke-width="1" />
      <desc>LAYER ${c.order}</desc>
      <text x="${lc.x + 41}" y="${lc.y + 30}" text-anchor="middle" font-size="10" font-weight="800" font-family="monospace" fill="${tagColor}">
        L${c.order}
      </text>

      <!-- 3. Container Icon & Name -->
      <circle class="container-icon-disc" cx="${lc.x + 88}" cy="${lc.y + 27}" r="11" fill="#F5F3FF" stroke="${accentColor}" stroke-width="1" />
      <text x="${lc.x + 88}" y="${lc.y + 31}" text-anchor="middle" font-size="10.5" font-family="-apple-system, BlinkMacSystemFont, Segoe UI Emoji, sans-serif" fill="#4338CA">
        ${containerIcon}
      </text>
      <text x="${lc.x + 108}" y="${lc.y + 32}" font-size="15" font-weight="800"
            font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fill="#0F172A">
        ${escapeXml(c.name)}
      </text>

      <!-- 4. Technology Pill -->
      <rect x="${lc.x + 292}" y="${lc.y + 17}" width="132" height="20" rx="5" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1" />
      <text x="${lc.x + 358}" y="${lc.y + 31}" text-anchor="middle" font-size="9.5" font-weight="600" font-family="monospace" fill="#475569">
        ${escapeXml(truncate(c.technology || 'Layer Module', 18))}
      </text>

      <!-- 5. Status Pill (Right) -->
      <rect x="${lc.x + lc.width - 244}" y="${lc.y + 17}" width="112" height="20" rx="5"
            fill="${tagBg}" stroke="${tagBorder}" stroke-width="1" />
      <text x="${lc.x + lc.width - 188}" y="${lc.y + 31}" text-anchor="middle" font-size="9" font-weight="800" font-family="monospace" fill="${tagColor}">
        ${isDrift ? `⚠ DRIFT ${driftComps.length}` : `✓ ${compList.length} nodes`}
      </text>

      <!-- 6. Drill-down Hint Button -->
      <rect x="${lc.x + lc.width - 120}" y="${lc.y + 17}" width="100" height="20" rx="5"
            fill="#FFFFFF" stroke="#C7D2FE" stroke-width="1" />
      <text x="${lc.x + lc.width - 70}" y="${lc.y + 31}" text-anchor="middle" font-size="9.5" font-weight="700" font-family="sans-serif" fill="#4338CA">
        组件详情
      </text>

      <!-- 7. Mid Divider Line & Bottom Section -->
      <line x1="${lc.x + 1}" y1="${lc.y + 48}" x2="${lc.x + lc.width - 1}" y2="${lc.y + 48}" stroke="#DED7FE" stroke-width="1" />
      <rect x="${lc.x + 1}" y="${lc.y + 49}" width="${lc.width - 2}" height="68" rx="0 0 11 11" fill="#FFFFFF" fill-opacity="0.62" />

      <!-- 8. Sub-Component Chips Gallery -->
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
        const chipBorder = nodeDrift ? '#FCA5A5' : '#CBD5E1';
        const chipBg = nodeDrift ? '#FEF2F2' : '#FFFFFF';
        const dotColor = nodeDrift ? '#DC2626' : '#16A34A';
        const textColor = nodeDrift ? '#991B1B' : '#1E293B';
        const icon = getComponentIcon(comp.name, comp.layerId, comp.technology);

        svgLines.push(`      <!-- Sub-Component Chip ${idx + 1} -->
      <g class="c4-subcomponent-chip" onclick="event.stopPropagation(); setC4Level('component'); setTimeout(function(){ selectC4Node('${escapeXml(comp.id)}'); }, 120);" style="cursor: pointer;">
        <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="6" fill="${chipBg}" stroke="${chipBorder}" stroke-width="1" />
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
