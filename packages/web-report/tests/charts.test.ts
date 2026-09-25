import { describe, it, expect } from 'vitest';
import {
  REPORT_PALETTE,
  bucketViolations,
  buildVisibilitySegments,
  categorySegments,
  renderCategoryBars,
  renderCompositionBar,
  renderSeverityDonut,
  VIOLATION_TYPE_I18N,
} from '../src/charts.js';
import { C4_DARK_TOKEN_MAP, applyDarkTokensToSvg, getC4DarkTokenCss } from '../src/dark-theme.js';
import { getTranslations } from '../src/i18n.js';

const t = getTranslations('zh');

describe('@sextant/web-report chart primitives', () => {
  it('renders a severity donut with the total in the hole and an i18n hole label', () => {
    const svg = renderSeverityDonut(
      [
        { label: '阻断', value: 5, color: REPORT_PALETTE.critical, i18nKey: 'severityCriticalShort' },
        { label: '警告', value: 5, color: REPORT_PALETTE.warning, i18nKey: 'severityWarningShort' },
      ],
      'severityTotalLabel',
      '违规总数'
    );

    expect(svg).toContain('<svg');
    expect(svg).toContain('class="rpt-donut"');
    expect(svg).toContain('>10<');
    expect(svg).toContain('data-i18n="severityTotalLabel"');
    // Two arcs plus the track ring.
    expect(svg.match(/stroke-dasharray=/g)).toHaveLength(2);
  });

  it('degrades a zero-violation donut into a single compliant ring', () => {
    const svg = renderSeverityDonut(
      [{ label: '阻断', value: 0, color: REPORT_PALETTE.critical }],
      'severityTotalLabel',
      '违规总数'
    );
    expect(svg).toContain(REPORT_PALETTE.compliant);
    expect(svg).not.toContain('stroke-dasharray');
    expect(svg).toContain('>0<');
  });

  it('renders a composition bar with value-first percentages', () => {
    const html = renderCompositionBar(
      [
        { label: 'Critical', value: 3, color: REPORT_PALETTE.critical, i18nKey: 'severityCriticalShort' },
        { label: 'Warning', value: 1, color: REPORT_PALETTE.warning, i18nKey: 'severityWarningShort' },
      ],
      'Severity',
      'n/a'
    );
    expect(html).toContain('rpt-stack');
    expect(html).toContain('width:75.000%');
    expect(html).toContain('75.0%');
    expect(html).toContain('data-i18n="severityCriticalShort"');
  });

  it('renders an empty-state message instead of a broken bar when there is no data', () => {
    const html = renderCompositionBar([{ label: 'x', value: 0, color: '#000' }], 'aria', '零偏航，无需统计');
    expect(html).toBe('<div class="rpt-chart-empty">零偏航，无需统计</div>');
  });

  it('escapes hostile labels and preserves the incoming rank order', () => {
    const html = renderCategoryBars(
      [
        { label: '<script>alert(1)</script>', value: 4, color: REPORT_PALETTE.critical },
        { label: 'Small', value: 1, color: REPORT_PALETTE.warning },
      ],
      'none'
    );
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html.indexOf('&lt;script&gt;')).toBeLessThan(html.indexOf('Small'));
  });

  it('scales each bar against the largest category in the set', () => {
    const html = renderCategoryBars(
      [
        { label: 'big', value: 9, color: REPORT_PALETTE.critical },
        { label: 'small', value: 3, color: REPORT_PALETTE.warning },
      ],
      'none'
    );
    // Largest category occupies the full track, the second a third of it.
    expect(html).toContain('width:100.00%');
    expect(html).toContain('width:33.33%');
    expect(html.indexOf('>big<')).toBeLessThan(html.indexOf('>small<'));
  });

  it('never emits a zero-width bar for a present category', () => {
    const html = renderCategoryBars(
      [
        { label: 'big', value: 100, color: REPORT_PALETTE.critical },
        { label: 'tiny', value: 1, color: REPORT_PALETTE.warning },
      ],
      'none'
    );
    expect(html).toContain('width:4.00%');
  });
});

describe('@sextant/web-report violation bucketing', () => {
  it('groups by type and keeps the strongest severity', () => {
    const buckets = bucketViolations([
      { type: 'CRITICAL_BYPASS', severity: 'warning' },
      { type: 'CRITICAL_BYPASS', severity: 'critical' },
      { type: 'WARN_UNRESOLVED_IMPORT', severity: 'warning' },
    ]);

    expect(buckets).toHaveLength(2);
    expect(buckets[0]).toEqual({ type: 'CRITICAL_BYPASS', count: 2, severity: 'critical' });
    expect(buckets[1]).toEqual({ type: 'WARN_UNRESOLVED_IMPORT', count: 1, severity: 'warning' });
  });

  it('maps known core violation types onto translation keys', () => {
    const segments = categorySegments(
      [{ type: 'CRITICAL_INVERSION', count: 2, severity: 'critical' }],
      t
    );
    expect(segments[0].i18nKey).toBe('typeInversion');
    expect(segments[0].label).toBe('逆向依赖');
    expect(segments[0].color).toBe(REPORT_PALETTE.critical);
  });

  it('falls back to a title-cased label for an unknown violation type', () => {
    const segments = categorySegments(
      [{ type: 'FUTURE_UNKNOWN_RULE', count: 1, severity: 'warning' }],
      t
    );
    expect(segments[0].i18nKey).toBeUndefined();
    expect(segments[0].label).toBe('Future Unknown Rule');
  });

  it('caps the rendered categories while counting the remainder', () => {
    const buckets = Array.from({ length: 9 }, (_, i) => ({
      type: `T${i}`,
      count: 1,
      severity: 'warning' as const,
    }));
    expect(categorySegments(buckets, t, 6)).toHaveLength(6);
  });

  it('documents a translation key for every known core violation type', () => {
    expect(Object.keys(VIOLATION_TYPE_I18N).length).toBeGreaterThanOrEqual(19);
    for (const key of Object.values(VIOLATION_TYPE_I18N)) {
      expect(typeof (t as unknown as Record<string, string>)[key]).toBe('string');
    }
  });
});

describe('@sextant/web-report visibility composition', () => {
  it('splits scanned files into mapped, untraced and unresolved without estimating', () => {
    const segments = buildVisibilitySegments(
      {
        totalFiles: 210,
        totalDependencies: 648,
        mappedFiles: 62,
        coveragePercentage: 29.52,
        unresolvedImportCount: 2,
        partialBarrelCount: 5,
      },
      t
    );

    expect(segments.map((s) => s.value)).toEqual([62, 146, 2]);
    expect(segments.reduce((sum, s) => sum + s.value, 0)).toBe(210);
    expect(segments[0].color).toBe(REPORT_PALETTE.compliant);
  });

  it('never produces negative counts when the mapping over-reports', () => {
    const segments = buildVisibilitySegments(
      {
        totalFiles: 10,
        totalDependencies: 0,
        mappedFiles: 99,
        coveragePercentage: 990,
        unresolvedImportCount: 99,
        partialBarrelCount: 0,
      },
      t
    );
    for (const segment of segments) expect(segment.value).toBeGreaterThanOrEqual(0);
    expect(segments.reduce((sum, s) => sum + s.value, 0)).toBe(10);
  });
});

describe('@sextant/web-report dark canvas tokens', () => {
  it('swaps allow-listed literals for CSS variables with literal fallbacks', () => {
    const svg = '<rect fill="#F8FAFC" stroke="#CBD5E1"/><text fill="#0F172A">x</text>';
    const out = applyDarkTokensToSvg(svg);
    expect(out).toContain('fill="var(--c4-surface-alt, #F8FAFC)"');
    expect(out).toContain('stroke="var(--c4-border, #CBD5E1)"');
    expect(out).toContain('fill="var(--c4-text, #0F172A)"');
  });

  it('is case-insensitive and leaves unmapped colours untouched', () => {
    const out = applyDarkTokensToSvg('<rect fill="#ffffff"/><path fill="#DC2626"/>');
    expect(out).toContain('fill="var(--c4-surface, #ffffff)"');
    expect(out).toContain('fill="#DC2626"');
  });

  it('preserves drift semantics: the primary red/amber/green accents are never neutralised', () => {
    for (const semantic of ['#DC2626', '#16A34A', '#D97706']) {
      expect(C4_DARK_TOKEN_MAP[semantic]).toBeUndefined();
    }
  });

  it('returns the input untouched for empty or colourless input', () => {
    expect(applyDarkTokensToSvg('')).toBe('');
    expect(applyDarkTokensToSvg('<g></g>')).toBe('<g></g>');
  });

  it('defines a dark value for every mapped token', () => {
    const css = getC4DarkTokenCss();
    for (const token of Object.values(C4_DARK_TOKEN_MAP)) {
      expect(css).toContain(`${token}:`);
    }
    expect(css).toContain('.c4-canvas');
  });
});
