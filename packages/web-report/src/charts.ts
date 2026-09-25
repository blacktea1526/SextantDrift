/**
 * Inline SVG chart primitives for the Pro C4 inspection report.
 *
 * Kept intentionally DOM-free and dependency-free: every renderer is a pure
 * function returning a self-contained SVG/HTML string so the report stays
 * 100% offline and the charts can be unit-tested without a browser.
 *
 * Unlike the lightweight CLI reporter, these renderers take an explicit theme
 * palette so the Pro report can drive them from a single design token set.
 */
import type { Translations } from './i18n.js';

export interface ReportPalette {
  critical: string;
  warning: string;
  compliant: string;
  track: string;
  text: string;
  muted: string;
  accent: string;
}

export const REPORT_PALETTE: ReportPalette = {
  critical: '#DC2626',
  warning: '#D97706',
  compliant: '#16A34A',
  track: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  accent: '#2563EB',
};

export interface ChartSegment {
  label: string;
  value: number;
  color: string;
  /** Optional i18n key so the label can follow the language toggle. */
  i18nKey?: string;
}

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str: string): string {
  return escapeXml(str);
}

/** Maps a core `ViolationEvidence['type']` onto its translation key. */
export const VIOLATION_TYPE_I18N: Record<string, string> = {
  CRITICAL_BYPASS: 'typeBypass',
  CRITICAL_INVERSION: 'typeInversion',
  CRITICAL_CYCLE: 'typeCycle',
  CRITICAL_FORBIDDEN_IMPORT: 'typeForbiddenImport',
  INVARIANT_BROKEN: 'typeInvariantBroken',
  STATE_DEADLOCK: 'typeStateDeadlock',
  STATE_UNREACHABLE: 'typeStateUnreachable',
  STATE_MISSING_FALLBACK: 'typeStateMissingFallback',
  DYNAMIC_OUT_OF_ORDER: 'typeDynamicOutOfOrder',
  DYNAMIC_UNEXPECTED_CALL: 'typeDynamicUnexpectedCall',
  DYNAMIC_MISSING_CALL: 'typeDynamicMissingCall',
  CONTRACT_MISSING_ENDPOINT: 'typeContractMissingEndpoint',
  CONTRACT_SHADOW_ENDPOINT: 'typeContractShadowEndpoint',
  CONTRACT_MISSING_PARAM: 'typeContractMissingParam',
  CONTRACT_UNHANDLED_STATUS: 'typeContractUnhandledStatus',
  CONTRACT_LINT_ERROR: 'typeContractLintError',
  WARN_UNRESOLVED_IMPORT: 'typeWarnUnresolvedImport',
  WARN_PARTIAL_BARREL_RESOLUTION: 'typeWarnPartialBarrel',
  WARN_RULE_MISSING_TARGET: 'typeWarnRuleMissingTarget',
};

/**
 * Compact severity donut with the total count in the hole.
 * `centerLabelKey` is emitted as `data-i18n` so the language toggle localises it.
 */
export function renderSeverityDonut(
  segments: ChartSegment[],
  centerLabelKey: string,
  centerLabelText: string,
  size = 132
): string {
  const palette = REPORT_PALETTE;
  const strokeWidth = 15;
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const nonZero = segments.filter((segment) => safeCount(segment.value) > 0);
  const total = nonZero.reduce((sum, segment) => sum + safeCount(segment.value), 0);

  let offset = 0;
  const arcs =
    total === 0
      ? `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${palette.compliant}" stroke-width="${strokeWidth}" />`
      : nonZero
          .map((segment) => {
            const length = (safeCount(segment.value) / total) * circumference;
            const arc = `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="${strokeWidth}" stroke-linecap="butt" stroke-dasharray="${length.toFixed(3)} ${(circumference - length).toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 ${center} ${center})"><title>${escapeXml(segment.label)}: ${safeCount(segment.value)}</title></circle>`;
            offset += length;
            return arc;
          })
          .join('');

  return `<svg class="rpt-donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeAttr(centerLabelText)} ${total}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${palette.track}" stroke-width="${strokeWidth}" />
      ${arcs}
      <text x="${center}" y="${center - 3}" text-anchor="middle" dominant-baseline="middle" class="rpt-donut-value">${total}</text>
      <text x="${center}" y="${center + 17}" text-anchor="middle" dominant-baseline="middle" class="rpt-donut-label" data-i18n="${escapeAttr(centerLabelKey)}">${escapeXml(centerLabelText)}</text>
    </svg>`;
}

/** Stacked composition bar with a value-first legend underneath. */
export function renderCompositionBar(
  segments: ChartSegment[],
  ariaLabel: string,
  emptyText: string
): string {
  const nonZero = segments.filter((segment) => safeCount(segment.value) > 0);
  const total = nonZero.reduce((sum, segment) => sum + safeCount(segment.value), 0);
  if (total === 0) return `<div class="rpt-chart-empty">${escapeXml(emptyText)}</div>`;

  const bar = nonZero
    .map((segment) => {
      const width = (safeCount(segment.value) / total) * 100;
      return `<span class="rpt-stack-seg" style="width:${width.toFixed(3)}%;background:${segment.color};" title="${escapeAttr(segment.label)}: ${safeCount(segment.value)} (${width.toFixed(1)}%)"></span>`;
    })
    .join('');

  const legend = segments
    .map((segment) => {
      const value = safeCount(segment.value);
      const pctText = ((value / total) * 100).toFixed(1);
      const label = segment.i18nKey
        ? `<span data-i18n="${escapeAttr(segment.i18nKey)}">${escapeXml(segment.label)}</span>`
        : escapeXml(segment.label);
      return `<span class="rpt-legend-item">
          <span class="rpt-legend-dot" style="background:${segment.color};"></span>
          <span class="rpt-legend-label">${label}</span>
          <strong class="rpt-legend-value">${value}</strong>
          <span class="rpt-legend-pct">${pctText}%</span>
        </span>`;
    })
    .join('');

  return `<div class="rpt-composition">
      <div class="rpt-stack" role="img" aria-label="${escapeAttr(ariaLabel)}">${bar}</div>
      <div class="rpt-legend">${legend}</div>
    </div>`;
}

/** Ranked horizontal bars, one per violation category. */
export function renderCategoryBars(items: ChartSegment[], emptyText: string): string {
  const usable = items.filter((item) => safeCount(item.value) > 0);
  if (usable.length === 0) return `<div class="rpt-chart-empty">${escapeXml(emptyText)}</div>`;

  const max = usable.reduce((best, item) => Math.max(best, safeCount(item.value)), 0);
  const rows = usable
    .map((item) => {
      const value = safeCount(item.value);
      const width = max > 0 ? Math.max((value / max) * 100, 4) : 0;
      const label = item.i18nKey
        ? `<span class="rpt-bar-label" data-i18n="${escapeAttr(item.i18nKey)}">${escapeXml(item.label)}</span>`
        : `<span class="rpt-bar-label" title="${escapeAttr(item.label)}">${escapeXml(item.label)}</span>`;
      return `<div class="rpt-bar-row">
          <div class="rpt-bar-head">${label}<span class="rpt-bar-value">${value}</span></div>
          <div class="rpt-bar-track"><span class="rpt-bar-fill" style="width:${width.toFixed(2)}%;background:${item.color};"></span></div>
        </div>`;
    })
    .join('');

  return `<div class="rpt-bars">${rows}</div>`;
}

export interface VisibilityStats {
  totalFiles: number;
  totalDependencies: number;
  mappedFiles: number;
  coveragePercentage: number;
  unresolvedImportCount: number;
  partialBarrelCount: number;
}

/**
 * Turns the deterministic summary counters into the blueprint/grey-zone/untraced
 * split of the scanned codebase. Reported as exact counts, never an estimate.
 */
export function buildVisibilitySegments(
  stats: VisibilityStats,
  t: Translations
): ChartSegment[] {
  const total = safeCount(stats.totalFiles);
  const mapped = Math.min(safeCount(stats.mappedFiles), total);
  const unresolved = Math.min(safeCount(stats.unresolvedImportCount), total - mapped);
  const untraced = Math.max(total - mapped - unresolved, 0);

  return [
    { label: t.visBlueprint, value: mapped, color: REPORT_PALETTE.compliant, i18nKey: 'visBlueprint' },
    { label: t.visUntraced, value: untraced, color: REPORT_PALETTE.track, i18nKey: 'visUntraced' },
    { label: t.visUnresolved, value: unresolved, color: REPORT_PALETTE.warning, i18nKey: 'visUnresolved' },
  ];
}

export interface CategoryBucket {
  type: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
}

const SEVERITY_RANK: Record<CategoryBucket['severity'], number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/** Groups violations by deterministic category, ranked by severity then count. */
export function bucketViolations(
  violations: Array<{ type: string; severity: string }>
): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>();
  for (const violation of violations) {
    const severity: CategoryBucket['severity'] =
      violation.severity === 'critical'
        ? 'critical'
        : violation.severity === 'info'
          ? 'info'
          : 'warning';
    const existing = map.get(violation.type);
    if (existing) {
      existing.count += 1;
      if (SEVERITY_RANK[severity] > SEVERITY_RANK[existing.severity]) existing.severity = severity;
    } else {
      map.set(violation.type, { type: violation.type, count: 1, severity });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      b.count - a.count ||
      a.type.localeCompare(b.type)
  );
}

/** Converts category buckets into chart segments using the report palette. */
export function categorySegments(
  buckets: CategoryBucket[],
  t: Translations,
  limit = 6
): ChartSegment[] {
  return buckets.slice(0, limit).map((bucket) => {
    const i18nKey = VIOLATION_TYPE_I18N[bucket.type];
    const fallbackLabel = bucket.type
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    return {
      label: i18nKey ? (t as unknown as Record<string, string>)[i18nKey] || fallbackLabel : fallbackLabel,
      value: bucket.count,
      color: bucket.severity === 'critical' ? REPORT_PALETTE.critical : REPORT_PALETTE.warning,
      i18nKey,
    };
  });
}

/** Percentage helper shared by the templates. */
export function formatPercent(value: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}
