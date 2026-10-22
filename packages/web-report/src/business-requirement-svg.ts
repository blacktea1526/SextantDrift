/**
 * Read-only neighborhood diagrams for one business-requirement graph.
 * Each SVG is the focus entity plus its direct in- and out-neighbors.
 * Edge direction stays as declared. Column membership follows entity kind.
 * A graph the layout cannot place becomes a render error; relations are not dropped.
 */

export interface BusinessDiagram {
  body: string;
  entityCount: number;
  maxNeighbors: number;
}

interface Entity {
  id: string;
  kind: string;
  title: string;
  source?: string;
  checkId?: string;
  archComponentId?: string;
  questions: string[];
}

export interface BusinessDiagramOptions {
  /** Architecture components used to resolve CODE.source → component id. */
  components?: Array<{ id: string; paths: string[] }>;
}

interface Relation {
  from: string;
  to: string;
  type: string;
}

interface Graph {
  entities: Entity[];
  relations: Relation[];
}

interface PlacedNode {
  entity: Entity;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
  titleLines: string[];
  questionLines: string[];
  anchorLines: string[];
}

const KIND_ORDER = ['requirement', 'flow', 'rule', 'event', 'state', 'code', 'test'] as const;
const COLUMN_OF: Record<string, number> = {
  requirement: 0,
  flow: 1,
  rule: 1,
  event: 1,
  state: 2,
  code: 3,
  test: 3,
};
const COLUMN_KEY = ['requirement', 'activity', 'state', 'evidence'] as const;
const CARD_W = 240;
const TEXT_W = 208;
const GUTTER = 104;
const HEADER_H = 28;
const BUS_PITCH = 36;
const PAD = 28;

const KIND_STYLE: Record<string, { zh: string; en: string; color: string }> = {
  requirement: { zh: '需求', en: 'Requirement', color: '#101C8A' },
  flow: { zh: '流程', en: 'Flow', color: '#0F766E' },
  rule: { zh: '规则', en: 'Rule', color: '#B45309' },
  event: { zh: '事件', en: 'Event', color: '#6D28D9' },
  state: { zh: '状态', en: 'State', color: '#047857' },
  test: { zh: '验收', en: 'Acceptance', color: '#0369A1' },
  code: { zh: '代码', en: 'Code', color: '#0E7490' },
};

const RELATION_LABEL: Record<string, { zh: string; en: string }> = {
  includes: { zh: '包含', en: 'includes' },
  triggers: { zh: '触发', en: 'triggers' },
  constrains: { zh: '约束', en: 'constrains' },
  produces: { zh: '产生', en: 'produces' },
  affects: { zh: '影响', en: 'affects' },
  implemented_by: { zh: '实现', en: 'implemented by' },
  verified_by: { zh: '验收', en: 'verified by' },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericKey(id: string): number | null {
  const match = /(\d+)(?!.*\d)/.exec(id);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) ? value : null;
}

function compareEntities(a: Entity, b: Entity): number {
  const leftKind = KIND_ORDER.indexOf(a.kind as (typeof KIND_ORDER)[number]);
  const rightKind = KIND_ORDER.indexOf(b.kind as (typeof KIND_ORDER)[number]);
  const kindDelta = (leftKind === -1 ? KIND_ORDER.length : leftKind) - (rightKind === -1 ? KIND_ORDER.length : rightKind);
  if (kindDelta !== 0) return kindDelta;
  const leftNumber = numericKey(a.id);
  const rightNumber = numericKey(b.id);
  if (leftNumber === null && rightNumber !== null) return 1;
  if (leftNumber !== null && rightNumber === null) return -1;
  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) return leftNumber - rightNumber;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

function compareRelations(a: Relation, b: Relation): number {
  if (a.from < b.from) return -1;
  if (a.from > b.from) return 1;
  if (a.to < b.to) return -1;
  if (a.to > b.to) return 1;
  if (a.type < b.type) return -1;
  if (a.type > b.type) return 1;
  return 0;
}

function charWidth(char: string): number {
  return char.charCodeAt(0) > 255 ? 13 : 7;
}

function wrap(text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  let width = 0;
  for (const char of text) {
    const next = charWidth(char);
    if (line && width + next > maxWidth) {
      lines.push(line);
      line = char;
      width = next;
    } else {
      line += char;
      width += next;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

function relationLabel(type: string, lang: 'zh' | 'en'): string | null {
  const entry = RELATION_LABEL[type];
  return entry ? entry[lang] : null;
}

function dedupeRelations(relations: Relation[]): Relation[] {
  const seen = new Set<string>();
  const out: Relation[] = [];
  for (const relation of relations) {
    const key = `${relation.from}|${relation.to}|${relation.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(relation);
  }
  return out;
}

function matchesPathPattern(filePath: string, pattern: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const escaped = pattern
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<GLOBSTAR>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<GLOBSTAR>>/g, '.*');
  return new RegExp(`^${escaped}$`).test(normalized);
}

function resolveArchComponent(
  source: string | undefined,
  components: Array<{ id: string; paths: string[] }> | undefined,
): string | undefined {
  if (!source?.trim() || !components || components.length === 0) return undefined;
  const path = source.trim().replace(/\\/g, '/');
  for (const component of components) {
    if (component.paths.some((pattern) => matchesPathPattern(path, pattern))) {
      return component.id;
    }
  }
  return undefined;
}

function anchorText(entity: Entity, lang: 'zh' | 'en'): string | undefined {
  if (entity.kind === 'code') {
    const source = entity.source?.trim() || (lang === 'zh' ? '锚点缺失' : 'anchor missing');
    if (entity.archComponentId) {
      return lang === 'zh'
        ? `${source} · 架构 ${entity.archComponentId}`
        : `${source} · arch ${entity.archComponentId}`;
    }
    return source;
  }
  if (entity.kind === 'test') {
    return entity.checkId?.trim() || (lang === 'zh' ? '锚点缺失' : 'anchor missing');
  }
  return undefined;
}

function missingAnchor(entity: Entity): boolean {
  if (entity.kind === 'code') return !entity.source?.trim();
  if (entity.kind === 'test') return !entity.checkId?.trim();
  return false;
}

function readGraph(structured: string, lang: 'zh' | 'en'): Graph | string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(structured);
  } catch {
    return lang === 'zh' ? '业务需求图无法绘制：结构化投影不是合法 JSON。关系没有被删除。' : 'The business diagram cannot be drawn: the structured projection is not valid JSON. Relations were not removed.';
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.entities) || !Array.isArray(parsed.relations)) {
    return lang === 'zh' ? '业务需求图无法绘制：结构化投影缺少实体或关系。关系没有被删除。' : 'The business diagram cannot be drawn: the structured projection has no entity or relation list. Relations were not removed.';
  }
  const entities: Entity[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < parsed.entities.length; index++) {
    const raw = parsed.entities[index];
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim()) {
      return lang === 'zh'
        ? `业务需求图无法绘制：第 ${index + 1} 个实体没有 id。关系没有被删除。`
        : `The business diagram cannot be drawn: entity ${index + 1} has no id. Relations were not removed.`;
    }
    if (seen.has(raw.id)) {
      return lang === 'zh'
        ? `业务需求图无法绘制：实体「${raw.id}」的 id 重复。关系没有被删除。`
        : `The business diagram cannot be drawn: entity "${raw.id}" is duplicated. Relations were not removed.`;
    }
    seen.add(raw.id);
    if (raw.questions !== undefined && (!Array.isArray(raw.questions) || raw.questions.some((question) => typeof question !== 'string'))) {
      return lang === 'zh'
        ? `业务需求图无法绘制：实体「${raw.id}」的问题不是文本列表。关系没有被删除。`
        : `The business diagram cannot be drawn: entity "${raw.id}" questions are not a list of text. Relations were not removed.`;
    }
    if (raw.source !== undefined && typeof raw.source !== 'string') {
      return lang === 'zh'
        ? `业务需求图无法绘制：实体「${raw.id}」的 source 不是文本。关系没有被删除。`
        : `The business diagram cannot be drawn: entity "${raw.id}" source is not text. Relations were not removed.`;
    }
    if (raw.checkId !== undefined && typeof raw.checkId !== 'string') {
      return lang === 'zh'
        ? `业务需求图无法绘制：实体「${raw.id}」的 check id 不是文本。关系没有被删除。`
        : `The business diagram cannot be drawn: entity "${raw.id}" check id is not text. Relations were not removed.`;
    }
    const kind = typeof raw.kind === 'string' ? raw.kind : '';
    if (!Object.prototype.hasOwnProperty.call(COLUMN_OF, kind)) {
      return lang === 'zh'
        ? `业务需求图无法绘制：实体「${raw.id}」的类型「${kind}」没有对应的列。关系没有被删除。`
        : `The business diagram cannot be drawn: entity "${raw.id}" has kind "${kind}" with no column. Relations were not removed.`;
    }
    entities.push({
      id: raw.id,
      kind,
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : raw.id,
      source: typeof raw.source === 'string' ? raw.source : undefined,
      checkId: typeof raw.checkId === 'string' ? raw.checkId : undefined,
      questions: ((raw.questions as string[] | undefined) ?? []).map((question) => question.trim()).filter(Boolean),
    });
  }
  if (entities.length === 0) {
    return lang === 'zh' ? '业务需求图无法绘制：没有可绘制的实体。' : 'The business diagram cannot be drawn: there are no entities.';
  }
  const relations: Relation[] = [];
  for (let index = 0; index < parsed.relations.length; index++) {
    const raw = parsed.relations[index];
    if (!isRecord(raw) || typeof raw.from !== 'string' || typeof raw.to !== 'string' || typeof raw.type !== 'string') {
      return lang === 'zh'
        ? `业务需求图无法绘制：第 ${index + 1} 条关系缺少 from、to 或 type。这条关系没有被删除。`
        : `The business diagram cannot be drawn: relation ${index + 1} lacks from, to, or type. That relation was not removed.`;
    }
    if (!seen.has(raw.from) || !seen.has(raw.to)) {
      const missing = seen.has(raw.from) ? raw.to : raw.from;
      return lang === 'zh'
        ? `业务需求图无法绘制：关系指向未知实体「${missing}」。这条关系没有被删除。`
        : `The business diagram cannot be drawn: a relation names unknown entity "${missing}". That relation was not removed.`;
    }
    if (!Object.prototype.hasOwnProperty.call(RELATION_LABEL, raw.type)) {
      return lang === 'zh'
        ? `业务需求图无法绘制：关系 ${raw.from} → ${raw.to} 的类型「${raw.type}」无法标注。这条关系没有被删除。`
        : `The business diagram cannot be drawn: relation ${raw.from} → ${raw.to} has unlabeled type "${raw.type}". That relation was not removed.`;
    }
    relations.push({ from: raw.from, to: raw.to, type: raw.type });
  }
  entities.sort(compareEntities);
  const unique = dedupeRelations(relations);
  unique.sort(compareRelations);
  return { entities, relations: unique };
}

function incident(relations: Relation[], id: string): Relation[] {
  return relations.filter((relation) => relation.from === id || relation.to === id);
}

function neighborIds(entities: Map<string, Entity>, relations: Relation[], id: string): string[] {
  const ids = new Set<string>();
  for (const relation of incident(relations, id)) {
    const other = relation.from === id ? relation.to : relation.from;
    if (other !== id) ids.add(other);
  }
  return [...ids].sort((left, right) => compareEntities(entities.get(left)!, entities.get(right)!));
}

function maxNeighborCount(entities: Entity[], relations: Relation[]): number {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  return entities.reduce((max, entity) => Math.max(max, neighborIds(byId, relations, entity.id).length), 0);
}

function measure(entity: Entity, lang: 'zh' | 'en'): Pick<PlacedNode, 'titleLines' | 'questionLines' | 'anchorLines' | 'width' | 'height'> {
  const titleLines = wrap(entity.title, TEXT_W);
  const questionLines = entity.questions.flatMap((question) => wrap(question, TEXT_W));
  const anchor = anchorText(entity, lang);
  const anchorLines = anchor ? wrap(anchor, TEXT_W) : [];
  const height = 52 + titleLines.length * 18 + questionLines.length * 16 + anchorLines.length * 16 + 14;
  return { titleLines, questionLines, anchorLines, width: CARD_W, height };
}

function otherOf(edge: Relation, focus: Entity, members: Entity[]): Entity | undefined {
  const otherId = edge.from === focus.id ? edge.to : edge.from;
  return members.find((entity) => entity.id === otherId);
}

function place(focus: Entity, neighbors: Entity[], edges: Relation[], lang: 'zh' | 'en'): { nodes: PlacedNode[]; width: number; height: number } {
  const members = [focus, ...neighbors];
  const used = [0, 1, 2, 3].filter((column) => members.some((entity) => COLUMN_OF[entity.kind] === column));
  const sameColumnCount = edges.filter((edge) => {
    const other = otherOf(edge, focus, members);
    return other === undefined || COLUMN_OF[other.kind] === COLUMN_OF[focus.kind];
  }).length;
  const cross = edges.filter((edge) => {
    const other = otherOf(edge, focus, members);
    return other !== undefined && COLUMN_OF[other.kind] !== COLUMN_OF[focus.kind];
  });
  const leftPad = 72 + Math.max(0, sameColumnCount - 1) * 14;
  const columnX = new Map<number, number>();
  let cursor = leftPad;
  for (const column of used) {
    columnX.set(column, cursor);
    cursor += CARD_W + GUTTER;
  }
  const width = Math.max(cursor - GUTTER + PAD, leftPad + CARD_W + PAD);
  const busHeight = cross.length * BUS_PITCH;
  const nodes: PlacedNode[] = [];
  let bottom = PAD + busHeight + HEADER_H;
  for (const column of used) {
    const inColumn = members
      .filter((entity) => COLUMN_OF[entity.kind] === column)
      .sort(compareEntities);
    const gap = 20 + (column === COLUMN_OF[focus.kind] ? sameColumnCount * 12 : 0);
    let y = PAD + busHeight + HEADER_H;
    for (const entity of inColumn) {
      const box = measure(entity, lang);
      nodes.push({ entity, column, x: columnX.get(column)!, y, ...box });
      y += box.height + gap;
    }
    bottom = Math.max(bottom, y);
  }
  return { nodes, width, height: bottom - 20 + PAD };
}

function nodeMarkup(node: PlacedNode, lang: 'zh' | 'en', current: boolean): string {
  const style = KIND_STYLE[node.entity.kind];
  const label = lang === 'zh' ? style.zh : style.en;
  const stroke = current ? style.color : '#CBD5E1';
  const strokeWidth = current ? '2.4' : '1.2';
  let textY = node.y + 54;
  const title = node.titleLines
    .map((line) => {
      const markup = `<text x="${node.x + 16}" y="${textY}" font-size="13" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#0F172A">${escapeXml(line)}</text>`;
      textY += 18;
      return markup;
    })
    .join('');
  const questions = node.questionLines
    .map((line) => {
      const markup = `<text x="${node.x + 16}" y="${textY}" font-size="12" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#B45309">${escapeXml(line)}</text>`;
      textY += 16;
      return markup;
    })
    .join('');
  const anchor = node.anchorLines
    .map((line) => {
      const markup = `<text x="${node.x + 16}" y="${textY}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#991B1B">${escapeXml(line)}</text>`;
      textY += 16;
      return markup;
    })
    .join('');
  const archAttr = node.entity.archComponentId
    ? ` data-arch-component="${escapeXml(node.entity.archComponentId)}"`
    : '';
  return `
    <g class="br-node" data-focus="${escapeXml(node.entity.id)}" data-entity="${escapeXml(node.entity.id)}" data-column="${COLUMN_KEY[node.column]}" data-x="${node.x}" data-y="${node.y}" data-width="${node.width}" data-height="${node.height}" data-title="${escapeXml(node.entity.title)}"${archAttr}>
      <title>${escapeXml(node.entity.title)}</title>
      <desc>${escapeXml(node.entity.questions.join('\n'))}</desc>
      <rect class="br-card" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="10" fill="#FFFFFF" stroke="${stroke}" stroke-width="${strokeWidth}" />
      <rect x="${node.x}" y="${node.y}" width="4" height="${node.height}" rx="2" fill="${style.color}" />
      <text x="${node.x + 16}" y="${node.y + 20}" font-size="11" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="${style.color}">${escapeXml(label)}</text>
      <text x="${node.x + 16}" y="${node.y + 38}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#64748B">${escapeXml(node.entity.id)}</text>
      ${title}${questions}${anchor}
    </g>`;
}

function edgePath(
  from: PlacedNode,
  to: PlacedNode,
  route: 'side' | 'channel',
  lane: number,
  busY: number,
): { d: string; labelX: number; labelY: number } {
  const fromY = Math.round(from.y + from.height / 2);
  const toY = Math.round(to.y + to.height / 2);
  if (route === 'side') {
    const railX = from.x - 22 - lane * 14;
    return {
      d: `M ${from.x} ${fromY} L ${railX} ${fromY} L ${railX} ${toY} L ${to.x} ${toY}`,
      labelX: railX,
      labelY: Math.round((fromY + toY) / 2),
    };
  }
  const goingRight = to.x > from.x;
  const startX = goingRight ? from.x + from.width : from.x;
  const endX = goingRight ? to.x : to.x + to.width;
  const startRail = goingRight ? from.x + from.width + 36 : from.x - 36;
  const endRail = goingRight ? to.x - 36 : to.x + to.width + 36;
  return {
    d: `M ${startX} ${fromY} L ${startRail} ${fromY} L ${startRail} ${busY} L ${endRail} ${busY} L ${endRail} ${toY} L ${endX} ${toY}`,
    labelX: Math.round((startRail + endRail) / 2),
    labelY: busY - 12,
  };
}

function edgeMarkup(from: PlacedNode, to: PlacedNode, type: string, route: 'side' | 'channel', lane: number, busY: number, markerId: string, lang: 'zh' | 'en'): string {
  const label = relationLabel(type, lang);
  if (!label) {
    throw new Error(`unlabeled relation ${from.entity.id} → ${to.entity.id} (${type})`);
  }
  const { d, labelX, labelY } = edgePath(from, to, route, lane, busY);
  const pillWidth = Math.max(48, label.length * (lang === 'zh' ? 14 : 7) + 16);
  return `
    <g class="br-edge" data-from="${escapeXml(from.entity.id)}" data-to="${escapeXml(to.entity.id)}" data-type="${escapeXml(type)}" data-route="${route}" data-label-x="${labelX}" data-label-y="${labelY}">
      <path d="${d}" fill="none" stroke="#94A3B8" stroke-width="1.4" marker-end="url(#${markerId})" />
      <rect x="${labelX - pillWidth / 2}" y="${labelY - 9}" width="${pillWidth}" height="18" rx="4" fill="#FFFFFF" stroke="#CBD5E1" />
      <text x="${labelX}" y="${labelY + 4}" text-anchor="middle" font-size="10" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#475569">${escapeXml(label)}</text>
    </g>`;
}

function renderNeighborhood(graph: Graph, focus: Entity, lang: 'zh' | 'en'): string {
  const byId = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const edges = incident(graph.relations, focus.id);
  const neighbors = neighborIds(byId, graph.relations, focus.id).map((id) => byId.get(id)!);
  const { nodes, width, height } = place(focus, neighbors, edges, lang);
  const nodeById = new Map(nodes.map((node) => [node.entity.id, node]));
  const columns = [...new Set(nodes.map((node) => node.column))].sort((a, b) => a - b);
  const headers = columns
    .map((column) => {
      const x = nodes.find((node) => node.column === column)!.x;
      const y = nodes.find((node) => node.column === column)!.y - 12;
      const text = lang === 'zh'
        ? ['需求', '流程 / 规则 / 事件', '状态', '代码 / 验收'][column]
        : ['Requirements', 'Flows / rules / events', 'States', 'Code / acceptance'][column];
      return `<text class="br-column-label" data-column="${COLUMN_KEY[column]}" x="${x}" y="${y}" font-size="12" font-weight="700" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fill="#334155">${escapeXml(text)}</text>`;
    })
    .join('');
  const markerId = `br-arrow-${focus.id.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  let sideLane = 0;
  let busLane = 0;
  const edgeSvg = [...edges].sort(compareRelations).map((edge) => {
    const from = nodeById.get(edge.from)!;
    const to = nodeById.get(edge.to)!;
    const route = from.column === to.column ? 'side' : 'channel';
    const lane = route === 'side' ? sideLane++ : busLane++;
    const busY = PAD + 14 + lane * BUS_PITCH;
    return edgeMarkup(from, to, edge.type, route, route === 'side' ? lane : 0, busY, markerId, lang);
  }).join('');
  const stroked = nodes.map((node) => nodeMarkup(node, lang, node.entity.id === focus.id)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="c4-canvas br-canvas" role="img" aria-label="${escapeXml(lang === 'zh' ? `${focus.id} 的直接邻居` : `Direct neighbors of ${focus.id}`)}">
    <defs>
      <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 Z" fill="#94A3B8" />
      </marker>
    </defs>
    <rect width="${width}" height="${height}" fill="#F8FAFC" />
    ${headers}
    ${edgeSvg}
    ${stroked}
  </svg>`;
}

function neighborhoodLegend(members: Entity[], edges: Relation[], lang: 'zh' | 'en'): string {
  const kinds = [...new Set(members.map((entity) => entity.kind))]
    .sort((left, right) => KIND_ORDER.indexOf(left as (typeof KIND_ORDER)[number]) - KIND_ORDER.indexOf(right as (typeof KIND_ORDER)[number]));
  const types = [...new Set(edges.map((edge) => edge.type))].sort();
  const kindItems = kinds.map((kind) => {
    const style = KIND_STYLE[kind];
    const label = lang === 'zh' ? style.zh : style.en;
    return `<li data-legend-kind="${escapeXml(kind)}"><span class="br-legend-swatch" style="background:${style.color}"></span><span>${escapeXml(label)}</span></li>`;
  }).join('');
  const relItems = types.map((type) => {
    const label = relationLabel(type, lang) ?? type;
    return `<li data-legend-rel="${escapeXml(type)}"><span class="br-legend-rel">${escapeXml(label)}</span></li>`;
  }).join('');
  const kindTitle = lang === 'zh' ? '实体类型' : 'Entity kinds';
  const relTitle = lang === 'zh' ? '关系类型' : 'Relation types';
  return `<aside class="br-legend" aria-label="${escapeXml(lang === 'zh' ? '图例' : 'Legend')}">
    <div class="br-legend-group"><h4>${kindTitle}</h4><ul class="br-legend-kinds">${kindItems}</ul></div>
    <div class="br-legend-group"><h4>${relTitle}</h4><ul class="br-legend-rels">${relItems}</ul></div>
  </aside>`;
}

function relationList(edges: Relation[], focusId: string, lang: 'zh' | 'en'): string {
  if (edges.length === 0) {
    return `<p class="br-relations-empty">${lang === 'zh' ? '没有直接关系' : 'No direct relations'}</p>`;
  }
  const items = [...edges].sort(compareRelations).map((edge) => {
    const from = edge.from === focusId
      ? `<span>${escapeXml(edge.from)}</span>`
      : `<button type="button" class="br-relation" data-focus="${escapeXml(edge.from)}">${escapeXml(edge.from)}</button>`;
    const to = edge.to === focusId
      ? `<span>${escapeXml(edge.to)}</span>`
      : `<button type="button" class="br-relation" data-focus="${escapeXml(edge.to)}">${escapeXml(edge.to)}</button>`;
    const typeLabel = relationLabel(edge.type, lang) ?? edge.type;
    return `<li>${from}<span class="br-rel-type">${escapeXml(typeLabel)}</span>${to}</li>`;
  });
  return `<ul class="br-relations">${items.join('')}</ul>`;
}

function directory(graph: Graph, defaultId: string, lang: 'zh' | 'en'): string {
  const byId = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const requirements = graph.entities.filter((entity) => entity.kind === 'requirement');
  if (requirements.length === 0) {
    return `<p class="br-index-empty">${lang === 'zh' ? '没有需求实体' : 'No requirements'}</p>`;
  }
  const items = requirements.map((entity) => {
    const missing = neighborIds(byId, graph.relations, entity.id).filter((id) => missingAnchor(byId.get(id)!)).length;
    const meta = lang === 'zh'
      ? `${entity.questions.length} 个未关闭问题 · ${missing} 个邻居缺锚点`
      : `${entity.questions.length} open questions · ${missing} neighbors missing an anchor`;
    const current = entity.id === defaultId ? ' aria-current="true"' : '';
    return `<li><button type="button" data-focus="${escapeXml(entity.id)}"${current}><span class="br-index-id">${escapeXml(entity.id)}</span><span class="br-index-title">${escapeXml(entity.title)}</span><span class="br-index-meta">${escapeXml(meta)}</span></button></li>`;
  });
  return `<ol class="br-index">${items.join('')}</ol>`;
}

function article(graph: Graph, focus: Entity, hidden: boolean, lang: 'zh' | 'en'): string {
  const edges = incident(graph.relations, focus.id);
  const byId = new Map(graph.entities.map((entity) => [entity.id, entity]));
  const members = [focus, ...neighborIds(byId, graph.relations, focus.id).map((id) => byId.get(id)!)];
  const hint = lang === 'zh' ? '点击下面的邻居可切换焦点' : 'Choose a neighbor below to move the focus';
  const locate = members
    .filter((entity) => entity.archComponentId)
    .map((entity) => `<button type="button" class="br-arch-locate" data-action="locate" data-source-component="${escapeXml(entity.archComponentId!)}">${lang === 'zh' ? '定位' : 'Locate'} ${escapeXml(entity.archComponentId!)}</button>`)
    .join('');
  return `<article class="br-view" data-focus="${escapeXml(focus.id)}"${hidden ? ' hidden' : ''}>
    <p class="br-focus-label">${lang === 'zh' ? '焦点' : 'Focus'} · ${escapeXml(focus.id)} ${escapeXml(focus.title)}</p>
    <p class="br-focus-hint">${hint}</p>
    ${neighborhoodLegend(members, edges, lang)}
    <div class="br-svg-wrap">${renderNeighborhood(graph, focus, lang)}</div>
    ${locate ? `<p class="br-arch-links">${locate}</p>` : ''}
    <h3>${lang === 'zh' ? '直接关系' : 'Direct relations'}</h3>
    ${relationList(edges, focus.id, lang)}
  </article>`;
}

/** Renders the directory and one prebuilt neighborhood SVG per entity. */
export function renderBusinessRequirementDiagram(
  structured: string,
  lang: 'zh' | 'en' = 'zh',
  options: BusinessDiagramOptions = {},
): BusinessDiagram {
  const graph = readGraph(structured, lang);
  if (typeof graph === 'string') {
    let entityCount = 0;
    let maxNeighbors = 0;
    try {
      const parsed = JSON.parse(structured) as { entities?: unknown[]; relations?: Array<{ from?: string; to?: string }> };
      if (Array.isArray(parsed.entities)) entityCount = parsed.entities.length;
      if (Array.isArray(parsed.entities) && Array.isArray(parsed.relations)) {
        const ids = parsed.entities
          .filter((entity): entity is { id: string } => isRecord(entity) && typeof entity.id === 'string')
          .map((entity) => entity.id);
        maxNeighbors = ids.reduce((max, id) => {
          const count = new Set(
            parsed.relations!
              .filter((relation) => relation.from === id || relation.to === id)
              .map((relation) => (relation.from === id ? relation.to : relation.from))
              .filter((other): other is string => typeof other === 'string' && other !== id),
          ).size;
          return Math.max(max, count);
        }, 0);
      }
    } catch {
      entityCount = 0;
      maxNeighbors = 0;
    }
    return {
      body: `<p class="br-render-error" role="alert">${escapeXml(graph)}</p>`,
      entityCount,
      maxNeighbors,
    };
  }
  for (const entity of graph.entities) {
    if (entity.kind === 'code') {
      entity.archComponentId = resolveArchComponent(entity.source, options.components);
    }
  }
  const defaultId = graph.entities[0].id;
  const views = graph.entities.map((entity) => article(graph, entity, entity.id !== defaultId, lang)).join('');
  const heading = lang === 'zh' ? '目录' : 'Index';
  return {
    body: `<div class="br-layout"><div class="br-index-pane"><h3>${heading}</h3>${directory(graph, defaultId, lang)}</div><div class="br-stage">${views}</div></div>`,
    entityCount: graph.entities.length,
    maxNeighbors: maxNeighborCount(graph.entities, graph.relations),
  };
}
