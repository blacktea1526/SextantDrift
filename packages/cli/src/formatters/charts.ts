/**
 * Zero-dependency inline SVG charts for the lightweight (open source) HTML report.
 *
 * Constraints honoured by this module:
 *  - Pure functions: data in, SVG string out. No DOM, no browser host, no I/O.
 *  - 100% self-contained: no CDN, no <script>, no external font or image request.
 *  - Themed through `currentColor` / explicit palette so a single stylesheet can
 *    drive both the light and dark presentation.
 *  - Never throws on empty or partial data: an empty dataset degrades into an
 *    explicit "no data" plot rather than a broken chart.
 */

export interface ChartPalette {
  critical: string;
  warning: string;
  info: string;
  compliant: string;
  track: string;
  axis: string;
  text: string;
  muted: string;
}

export const DEFAULT_PALETTE: ChartPalette = {
  critical: '#DC2626',
  warning: '#D97706',
  info: '#2563EB',
  compliant: '#16A34A',
  track: '#E2E8F0',
  axis: '#94A3B8',
  text: '#0F172A',
  muted: '#64748B',
};

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Renders a `0` value safely even when the caller passes a non-finite number. */
function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

/** Formats a number for SVG text: integers stay clean, fractions keep one decimal. */
function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Donut chart with a large centred total.
 * `segments` are drawn clockwise starting at 12 o'clock using stroke-dasharray,
 * which keeps the markup tiny and avoids path-arc maths.
 */
export function renderSeverityDonut(
  segments: Segment[],
  centerLabel: string,
  options: { size?: number; palette?: ChartPalette; ariaLabel?: string } = {}
): string {
  const palette = options.palette || DEFAULT_PALETTE;
  const size = options.size || 168;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const nonZero = segments.filter((s) => safeCount(s.value) > 0);
  const total = nonZero.reduce((sum, s) => sum + safeCount(s.value), 0);

  const arcs =
    total === 0
      ? `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${palette.compliant}" stroke-width="${strokeWidth}" />`
      : (() => {
          let offset = 0;
          return nonZero
            .map((segment) => {
              const length = (safeCount(segment.value) / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const arc = `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${segment.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${center} ${center})"><title>${escapeXml(segment.label)}: ${safeCount(segment.value)}</title></circle>`;
              offset += length;
              return arc;
            })
            .join('');
        })();

  const aria = options.ariaLabel || centerLabel;

  return `<svg class="chart-svg chart-donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${escapeXml(aria)}" focusable="false">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${palette.track}" stroke-width="${strokeWidth}" />
      ${arcs}
      <text x="${center}" y="${center - 2}" text-anchor="middle" dominant-baseline="middle" class="chart-donut-value" fill="${palette.text}">${escapeXml(String(total))}</text>
      <text x="${center}" y="${center + 20}" text-anchor="middle" dominant-baseline="middle" class="chart-donut-label" fill="${palette.muted}">${escapeXml(centerLabel)}</text>
    </svg>`;
}

/** Horizontal ranked bars for a categorical breakdown (one row per category). */
export function renderBreakdownBars(
  items: Segment[],
  options: { palette?: ChartPalette; emptyText?: string } = {}
): string {
  const palette = options.palette || DEFAULT_PALETTE;
  const usable = items.filter((item) => safeCount(item.value) > 0);

  if (usable.length === 0) {
    return `<div class="chart-empty">${escapeXml(options.emptyText || 'No violations to break down')}</div>`;
  }

  const max = usable.reduce((best, item) => Math.max(best, safeCount(item.value)), 0);

  const rows = usable
    .map((item) => {
      const value = safeCount(item.value);
      const width = max > 0 ? Math.max((value / max) * 100, 3) : 0;
      return `<div class="chart-row">
        <div class="chart-row-head">
          <span class="chart-row-label" title="${escapeXml(item.label)}">${escapeXml(item.label)}</span>
          <span class="chart-row-value">${value}</span>
        </div>
        <div class="chart-row-track" role="img" aria-label="${escapeXml(item.label)}: ${value}">
          <span class="chart-row-fill" style="width:${width.toFixed(2)}%;background:${item.color};"></span>
        </div>
      </div>`;
    })
    .join('');

  return `<div class="chart-rows" style="--chart-axis:${palette.axis};">${rows}</div>`;
}

/**
 * Stacked composition bar (e.g. critical vs warning, or scanned file coverage).
 * Renders a single tracked bar plus a legend, keeping the reading order
 * value-first: label, then magnitude.
 */
export function renderCompositionBar(
  segments: Segment[],
  options: { palette?: ChartPalette; ariaLabel?: string; emptyText?: string } = {}
): string {
  const palette = options.palette || DEFAULT_PALETTE;
  const nonZero = segments.filter((segment) => safeCount(segment.value) > 0);
  const total = nonZero.reduce((sum, segment) => sum + safeCount(segment.value), 0);

  if (total === 0) {
    return `<div class="chart-empty">${escapeXml(options.emptyText || 'No data')}</div>`;
  }

  const bar = nonZero
    .map((segment) => {
      const width = pct(safeCount(segment.value), total);
      return `<span class="chart-stack-seg" style="width:${width.toFixed(3)}%;background:${segment.color};" title="${escapeXml(segment.label)}: ${safeCount(segment.value)} (${width.toFixed(1)}%)"></span>`;
    })
    .join('');

  const legend = segments
    .map((segment) => {
      const value = safeCount(segment.value);
      return `<span class="chart-legend-item">
          <span class="chart-legend-dot" style="background:${segment.color};"></span>
          <span class="chart-legend-label">${escapeXml(segment.label)}</span>
          <strong class="chart-legend-value">${value}</strong>
          <span class="chart-legend-pct">${pct(value, total).toFixed(1)}%</span>
        </span>`;
    })
    .join('');

  return `<div class="chart-composition">
      <div class="chart-stack" role="img" aria-label="${escapeXml(options.ariaLabel || 'Composition')}">${bar}</div>
      <div class="chart-legend">${legend}</div>
    </div>`;
}

export interface GaugeOptions {
  label: string;
  value: number;
  total: number;
  palette?: ChartPalette;
  /** Below this percentage the gauge is rated "warning" (default 60). */
  warnBelow?: number;
  /** Below this percentage the gauge is rated "critical" (default 30). */
  criticalBelow?: number;
  suffix?: string;
}

/** Compact coverage gauge: a filled track plus a headline percentage. */
export function renderCoverageGauge(options: GaugeOptions): string {
  const palette = options.palette || DEFAULT_PALETTE;
  const total = safeCount(options.total);
  const value = Math.min(safeCount(options.value), total);
  const percentage = total > 0 ? (value / total) * 100 : 0;

  const criticalBelow = options.criticalBelow ?? 30;
  const warnBelow = options.warnBelow ?? 60;
  const color =
    percentage < criticalBelow
      ? palette.critical
      : percentage < warnBelow
        ? palette.warning
        : palette.compliant;

  return `<div class="chart-gauge">
      <div class="chart-gauge-head">
        <span class="chart-gauge-percent" style="color:${color};">${fmt(percentage)}<span class="chart-gauge-unit">%</span></span>
        <span class="chart-gauge-frac">${value} / ${total}${options.suffix ? escapeXml(options.suffix) : ''}</span>
      </div>
      <div class="chart-row-track chart-gauge-track" role="img" aria-label="${escapeXml(options.label)}: ${fmt(percentage)}%">
        <span class="chart-row-fill" style="width:${percentage.toFixed(2)}%;background:${color};"></span>
      </div>
      <div class="chart-gauge-label">${escapeXml(options.label)}</div>
    </div>`;
}

/** Turns raw summary counters into ranked chart segments (descending). */
export function counterSegments(
  entries: Array<{ label: string; value: number; color: string }>
): Segment[] {
  return [...entries].sort((a, b) => safeCount(b.value) - safeCount(a.value));
}
