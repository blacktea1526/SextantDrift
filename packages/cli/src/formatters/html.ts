import { DriftReport, DriftViolation } from '@sextant/core';
import {
  DEFAULT_PALETTE,
  counterSegments,
  renderBreakdownBars,
  renderCompositionBar,
  renderCoverageGauge,
  renderSeverityDonut,
  type Segment,
} from './charts.js';

export interface HtmlReportOptions {
  lang?: 'zh' | 'en';
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Human-readable, bilingual labels for every deterministic violation category
 * emitted by `@sextant/core`. Keys mirror the `ViolationEvidence['type']` union.
 */
const TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  CRITICAL_BYPASS: { zh: '跨层旁路', en: 'Layer Bypass' },
  CRITICAL_INVERSION: { zh: '逆向依赖', en: 'Layer Inversion' },
  CRITICAL_CYCLE: { zh: '循环依赖', en: 'Circular Dependency' },
  CRITICAL_FORBIDDEN_IMPORT: { zh: '违禁导入', en: 'Forbidden Import' },
  INVARIANT_BROKEN: { zh: '不变量违背', en: 'Invariant Broken' },
  STATE_DEADLOCK: { zh: '状态机死锁', en: 'State Deadlock' },
  STATE_UNREACHABLE: { zh: '状态孤岛不可达', en: 'Unreachable State' },
  STATE_MISSING_FALLBACK: { zh: '缺失降级回路', en: 'Missing Fallback' },
  DYNAMIC_OUT_OF_ORDER: { zh: '运行时时序倒置', en: 'Dynamic Out Of Order' },
  DYNAMIC_UNEXPECTED_CALL: { zh: '运行时意外调用', en: 'Dynamic Unexpected Call' },
  DYNAMIC_MISSING_CALL: { zh: '运行时缺失调用', en: 'Dynamic Missing Call' },
  CONTRACT_MISSING_ENDPOINT: { zh: '契约缺失端点', en: 'Contract Missing Endpoint' },
  CONTRACT_SHADOW_ENDPOINT: { zh: '契约影子端点', en: 'Contract Shadow Endpoint' },
  CONTRACT_MISSING_PARAM: { zh: '契约缺失参数', en: 'Contract Missing Param' },
  CONTRACT_UNHANDLED_STATUS: { zh: '契约未处理状态码', en: 'Contract Unhandled Status' },
  CONTRACT_LINT_ERROR: { zh: '契约校验错误', en: 'Contract Lint Error' },
  WARN_UNRESOLVED_IMPORT: { zh: '导入未解析', en: 'Unresolved Import' },
  WARN_PARTIAL_BARREL_RESOLUTION: { zh: 'Barrel 部分解析', en: 'Partial Barrel Resolution' },
  WARN_RULE_MISSING_TARGET: { zh: '规则缺少目标', en: 'Rule Missing Target' },
};

/** Falls back to a title-cased rendering for unknown/newly added categories. */
function typeLabel(type: string, isZh: boolean): string {
  const entry = TYPE_LABELS[type];
  if (entry) return isZh ? entry.zh : entry.en;
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

type Severity = 'critical' | 'warning' | 'info';

function normalizeSeverity(severity: string): Severity {
  if (severity === 'critical') return 'critical';
  if (severity === 'info') return 'info';
  return 'warning';
}

interface TypeBucket {
  type: string;
  count: number;
  severity: Severity;
}

function bucketByType(violations: DriftViolation[]): TypeBucket[] {
  const rank: Record<Severity, number> = { critical: 3, warning: 2, info: 1 };
  const map = new Map<string, TypeBucket>();
  for (const violation of violations) {
    const severity = normalizeSeverity(violation.severity);
    const existing = map.get(violation.type);
    if (existing) {
      existing.count += 1;
      if (rank[severity] > rank[existing.severity]) existing.severity = severity;
    } else {
      map.set(violation.type, { type: violation.type, count: 1, severity });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.type.localeCompare(b.type)
  );
}

/** Formats a number for display inside a stat tile. */
function statNumber(value: number | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '0';
  return String(value);
}

/**
 * Formats a clean, lightweight, self-contained HTML inspection report.
 *
 * This is the open-source delivery surface: a deterministic diagnostic summary
 * with inline SVG charts and zero diagram-rendering machinery. The interactive
 * C4 dual-diagram X-ray lives in the optional `@sextant/web-report` extension.
 */
export function formatLightweightHtmlReport(
  report: DriftReport,
  options: HtmlReportOptions = {}
): string {
  const lang = options.lang || 'zh';
  const isZh = lang === 'zh';
  const { summary, violations, exemptions, targetArchitecture, passed, durationMs } = report;
  const projectName = targetArchitecture.name || targetArchitecture.systemName || 'Architecture Target';

  const title = isZh
    ? `SextantDrift — 架构差分审查报告: ${escapeHtml(projectName)}`
    : `SextantDrift — Architecture Drift Report: ${escapeHtml(projectName)}`;

  const statusText = passed
    ? isZh
      ? '架构验证通过（零偏航）'
      : 'ARCHITECTURE VERIFIED'
    : isZh
      ? `发现 ${violations.length} 处架构偏航与违规`
      : `${violations.length} DRIFT(S) DETECTED`;

  const criticalCount = violations.filter((v) => v.severity === 'critical').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const exemptionCount = exemptions ? exemptions.length : 0;
  const coverage = summary?.componentCoverage;
  const generatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

  /* ---------------------------------------------------------------- charts */

  const palette = DEFAULT_PALETTE;
  const severitySegments: Segment[] = [
    { label: isZh ? '阻断级 Critical' : 'Critical', value: criticalCount, color: palette.critical },
    { label: isZh ? '警告级 Warning' : 'Warning', value: warningCount, color: palette.warning },
  ];

  const donut = renderSeverityDonut(severitySegments, isZh ? '违规总数' : 'Violations', {
    palette,
    ariaLabel: isZh
      ? `违规严重度构成：阻断级 ${criticalCount}，警告级 ${warningCount}`
      : `Severity composition: ${criticalCount} critical, ${warningCount} warning`,
  });

  const severityComposition = renderCompositionBar(severitySegments, {
    palette,
    ariaLabel: isZh ? '严重度占比' : 'Severity share',
    emptyText: isZh ? '未发现违规' : 'No violations',
  });

  const buckets = bucketByType(violations);
  const breakdown = renderBreakdownBars(
    counterSegments(
      buckets.map((bucket) => ({
        label: typeLabel(bucket.type, isZh),
        value: bucket.count,
        color: bucket.severity === 'critical' ? palette.critical : palette.warning,
      }))
    ),
    {
      palette,
      emptyText: isZh ? '未发现违规，无需归类' : 'No violations to classify',
    }
  );

  const coverageChart = coverage
    ? renderCoverageGauge({
        label: isZh ? '架构映射覆盖率' : 'Architecture mapping coverage',
        value: coverage.mappedFiles,
        total: coverage.totalFiles,
        palette,
        suffix: isZh ? ' 文件已映射' : ' files mapped',
      })
    : '';

  /* ------------------------------------------------------------ violations */

  const typeChip = (type: string, severity: 'critical' | 'warning') =>
    `<span class="type-chip ${severity}">${escapeHtml(type)}</span>`;

  const violationsHtml =
    violations.length === 0
      ? `<div class="empty-state">
           <span class="empty-mark">✔</span>
           <strong>${isZh ? '完美合规：零架构偏航' : 'Fully compliant: zero architectural drift'}</strong>
           <span>${isZh ? '未发现跨层调用违规、循环依赖或语义不变量偏航。' : 'No layer bypass, circular dependency or invariant drift detected.'}</span>
         </div>`
      : violations
          .map((v, i) => {
            const severity = v.severity === 'critical' ? 'critical' : 'warning';
            const flow =
              v.sourceComponent || v.targetComponent
                ? `<span class="flow-pill">${escapeHtml(v.sourceComponent || '?')}<span class="flow-arrow">➔</span>${escapeHtml(v.targetComponent || '?')}</span>`
                : '';

            return `<article class="violation-card ${severity}"
              id="violation-${i + 1}"
              data-severity="${severity}"
              data-search="${escapeHtml(
                [v.type, v.message, v.sourceFile, v.sourceComponent, v.targetComponent]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()
              )}">
            <header class="vc-head">
              <span class="vc-index">#${i + 1}</span>
              ${typeChip(v.type, severity)}
              <span class="vc-severity ${severity}">${severity === 'critical' ? (isZh ? '阻断' : 'CRITICAL') : isZh ? '警告' : 'WARNING'}</span>
              ${flow}
              <span class="vc-loc">${escapeHtml(v.sourceFile)}:${v.line}:${v.column}</span>
            </header>
            <p class="vc-message">${escapeHtml(v.message)}</p>
            ${v.suggestion ? `<p class="vc-suggestion"><span class="vc-suggestion-tag">${isZh ? '修复建议' : 'Suggestion'}</span>${escapeHtml(v.suggestion)}</p>` : ''}
            ${v.snippet ? `<pre class="vc-snippet"><code>${escapeHtml(v.snippet)}</code></pre>` : ''}
          </article>`;
          })
          .join('\n');

  const exemptionsHtml =
    exemptionCount > 0
      ? `<section class="exemptions">
           <h3 class="section-subtitle">🛡️ ${isZh ? `历史豁免债务 (${exemptionCount})` : `Historical Exemptions (${exemptionCount})`}</h3>
           <p class="section-hint">${isZh ? '由 .sextant/baseline.json 基线快照豁免的存量债务，不参与本次门禁判定。' : 'Pre-existing debt grandfathered by .sextant/baseline.json; excluded from this gate.'}</p>
           <div class="exemption-list">
             ${exemptions!
               .map(
                 (e) => `<div class="exemption-card">
                    <span class="exemption-tag">EXEMPTED</span>
                    <span class="exemption-loc">${escapeHtml(e.sourceFile)}:${escapeHtml(String(e.line))}</span>
                    <span class="exemption-msg">${escapeHtml(e.message)}</span>
                  </div>`
               )
               .join('')}
           </div>
         </section>`
      : '';

  const extensionNotice = isZh
    ? '本报告为开源版确定性诊断清单，已内置离线 SVG 图表。如需 C4 双图交互画布、无级平移缩放、红线差分与组件聚焦探针，请安装可视化扩展包：<code>npm i -D @sextant/web-report</code>。'
    : 'This is the open-source deterministic diagnostic report with offline SVG charts. For the interactive C4 dual-diagram canvas, infinite pan-zoom, red-line diffing and component focus probes, install <code>npm i -D @sextant/web-report</code>.';

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="generator" content="SextantDrift Lightweight Report" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #F1F5F9;
      --surface: #FFFFFF;
      --surface-alt: #F8FAFC;
      --border: #E2E8F0;
      --border-strong: #CBD5E1;
      --text: #0F172A;
      --text-muted: #64748B;
      --text-soft: #94A3B8;
      --critical: #DC2626;
      --critical-soft: #FEF2F2;
      --critical-border: #FCA5A5;
      --warning: #D97706;
      --warning-soft: #FFFBEB;
      --warning-border: #FCD34D;
      --ok: #16A34A;
      --ok-soft: #F0FDF4;
      --accent: #2563EB;
      --accent-soft: #EFF6FF;
      --code-bg: #0F172A;
      --code-fg: #E2E8F0;
      --shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -12px rgba(15, 23, 42, 0.14);
      --radius: 10px;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #070B14;
        --surface: #101827;
        --surface-alt: #151F31;
        --border: #22304A;
        --border-strong: #33445F;
        --text: #E8EEF8;
        --text-muted: #93A4BF;
        --text-soft: #6B7C99;
        --critical-soft: #2A1319;
        --critical-border: #7F2C3A;
        --warning-soft: #2A1F0D;
        --warning-border: #7C5A1B;
        --ok-soft: #0D2318;
        --accent-soft: #11203C;
        --code-bg: #060A12;
        --code-fg: #D6E0F0;
        --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 18px 40px -18px rgba(0, 0, 0, 0.7);
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 36px 24px 64px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    .container {
      max-width: 1080px;
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    /* ------------------------------------------------------------ header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding: 22px 32px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, var(--surface-alt), var(--surface));
    }
    .brand-title { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; margin: 0; display: flex; align-items: center; gap: 9px; }
    .brand-mark { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border-radius: 7px; background: var(--text); color: var(--surface); font-size: 16px; }
    .brand-sub { font-size: 12px; color: var(--text-muted); margin-top: 5px; font-family: var(--mono); display: flex; gap: 8px; flex-wrap: wrap; }
    .brand-sub b { color: var(--text); font-weight: 700; }
    .edition-tag {
      font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 2px 7px; border-radius: 4px; background: var(--accent-soft); color: var(--accent);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
    }
    .stamp {
      padding: 9px 16px; border-radius: 8px; font-weight: 800; font-size: 13px;
      font-family: var(--mono); letter-spacing: 0.02em; white-space: nowrap;
    }
    .stamp.pass { background: var(--ok-soft); color: var(--ok); border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent); }
    .stamp.fail { background: var(--critical-soft); color: var(--critical); border: 1px solid var(--critical-border); }

    /* ------------------------------------------------------- stats ruler */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
      gap: 1px;
      background: var(--border);
      border-bottom: 1px solid var(--border);
    }
    .stat-box { background: var(--surface); padding: 14px 18px; }
    .stat-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
    .stat-value { font-size: 22px; font-weight: 800; margin-top: 3px; font-family: var(--mono); color: var(--text); line-height: 1.15; }
    .stat-value.is-critical { color: var(--critical); }
    .stat-value.is-warning { color: var(--warning); }
    .stat-value.is-ok { color: var(--ok); }
    .stat-unit { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-left: 2px; }

    /* ------------------------------------------------------------ charts */
    .charts-grid {
      display: grid;
      grid-template-columns: minmax(220px, 260px) 1.4fr 1fr;
      gap: 22px;
      padding: 22px 32px;
      background: var(--surface-alt);
      border-bottom: 1px solid var(--border);
      align-items: stretch;
    }
    @media (max-width: 900px) { .charts-grid { grid-template-columns: 1fr; } }
    .chart-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      min-width: 0;
    }
    .chart-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 12px; }
    .chart-donut-wrap { display: flex; align-items: center; justify-content: center; }
    .chart-svg { display: block; }
    .chart-donut-value { font-family: var(--mono); font-size: 30px; font-weight: 800; }
    .chart-donut-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .chart-rows { display: flex; flex-direction: column; gap: 9px; }
    .chart-row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 4px; }
    .chart-row-label { font-size: 12px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chart-row-value { font-family: var(--mono); font-size: 12px; font-weight: 800; color: var(--text-muted); }
    .chart-row-track { height: 7px; border-radius: 999px; background: var(--border); overflow: hidden; }
    .chart-row-fill { display: block; height: 100%; border-radius: 999px; transition: width 0.4s ease; }
    .chart-composition { display: flex; flex-direction: column; gap: 12px; }
    .chart-stack { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: var(--border); }
    .chart-stack-seg { display: block; height: 100%; }
    .chart-legend { display: flex; flex-direction: column; gap: 7px; }
    .chart-legend-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-muted); }
    .chart-legend-dot { width: 9px; height: 9px; border-radius: 3px; flex: 0 0 auto; }
    .chart-legend-label { color: var(--text); font-weight: 600; }
    .chart-legend-value { font-family: var(--mono); color: var(--text); margin-left: auto; }
    .chart-legend-pct { font-family: var(--mono); font-size: 11px; color: var(--text-soft); min-width: 46px; text-align: right; }
    .chart-empty { font-size: 12px; color: var(--text-soft); font-style: italic; padding: 6px 0; }
    .chart-gauge-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
    .chart-gauge-percent { font-family: var(--mono); font-size: 24px; font-weight: 800; }
    .chart-gauge-unit { font-size: 13px; }
    .chart-gauge-frac { font-family: var(--mono); font-size: 11px; color: var(--text-muted); }
    .chart-gauge-track { height: 9px; }
    .chart-gauge-label { font-size: 11px; color: var(--text-muted); margin-top: 8px; }

    /* ----------------------------------------------------------- content */
    .content { padding: 26px 32px 32px; }
    .notice {
      display: flex; gap: 10px; align-items: flex-start;
      background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      border-radius: 8px; padding: 12px 16px; font-size: 12px; color: var(--text); margin-bottom: 26px; line-height: 1.6;
    }
    .notice code { font-family: var(--mono); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); }
    .section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 14px; }
    .section-title { font-size: 15px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
    .section-count { font-family: var(--mono); font-size: 12px; color: var(--text-muted); }

    .filter-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
    .filter-chip {
      font: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
      padding: 5px 11px; border-radius: 999px; border: 1px solid var(--border-strong);
      background: var(--surface); color: var(--text-muted); transition: all 0.15s ease;
    }
    .filter-chip:hover { color: var(--text); border-color: var(--text-soft); }
    .filter-chip.active { background: var(--text); color: var(--surface); border-color: var(--text); }
    .search-input {
      font: inherit; font-size: 12px; padding: 6px 12px; border-radius: 999px;
      border: 1px solid var(--border-strong); background: var(--surface); color: var(--text);
      min-width: 220px; flex: 1; max-width: 320px;
    }
    .search-input:focus { outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 1px; border-color: var(--accent); }

    /* ------------------------------------------------------- violations */
    .violation-card {
      border: 1px solid var(--border);
      border-left: 3px solid var(--critical);
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 10px;
      background: var(--surface);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .violation-card.warning { border-left-color: var(--warning); }
    .violation-card:hover { box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.25); }
    .violation-card.filtered-out { display: none; }
    .vc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .vc-index { font-family: var(--mono); font-size: 12px; font-weight: 800; color: var(--text-soft); }
    .type-chip {
      font-family: var(--mono); font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
      background: var(--critical-soft); color: var(--critical); border: 1px solid var(--critical-border);
    }
    .type-chip.warning { background: var(--warning-soft); color: var(--warning); border-color: var(--warning-border); }
    .vc-severity {
      font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
      padding: 2px 7px; border-radius: 4px; background: var(--critical-soft); color: var(--critical);
    }
    .vc-severity.warning { background: var(--warning-soft); color: var(--warning); }
    .flow-pill {
      display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 11px;
      color: var(--text-muted); background: var(--surface-alt); border: 1px solid var(--border);
      padding: 2px 8px; border-radius: 4px;
    }
    .flow-arrow { color: var(--critical); font-weight: 800; }
    .vc-loc { font-family: var(--mono); font-size: 12px; color: var(--text-muted); margin-left: auto; }
    .vc-message { font-size: 13px; color: var(--text); margin: 0 0 8px; }
    .vc-suggestion {
      font-size: 12px; color: var(--text); margin: 0 0 8px;
      background: var(--surface-alt); border-left: 3px solid var(--accent); border-radius: 0 6px 6px 0; padding: 8px 12px;
    }
    .vc-suggestion-tag { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent); margin-right: 8px; }
    .vc-snippet {
      margin: 0; padding: 11px 14px; background: var(--code-bg); color: var(--code-fg);
      border-radius: 6px; font-family: var(--mono); font-size: 12px; line-height: 1.5; overflow-x: auto;
    }
    .vc-snippet code { font-family: inherit; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
      padding: 34px 20px; border-radius: 8px; background: var(--ok-soft);
      border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent); color: var(--text);
    }
    .empty-mark { font-size: 26px; color: var(--ok); line-height: 1; }
    .empty-state strong { font-size: 14px; }
    .empty-state span:last-child { font-size: 12px; color: var(--text-muted); }

    /* -------------------------------------------------------- exemptions */
    .exemptions { margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--border); }
    .section-subtitle { font-size: 13px; font-weight: 800; margin: 0 0 4px; }
    .section-hint { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; }
    .exemption-list { display: flex; flex-direction: column; gap: 6px; }
    .exemption-card {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 9px 13px; border-radius: 6px; background: var(--surface-alt);
      border: 1px dashed var(--border-strong); font-size: 12px;
    }
    .exemption-tag { font-family: var(--mono); font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 0.06em; }
    .exemption-loc { font-family: var(--mono); font-weight: 700; color: var(--text); }
    .exemption-msg { color: var(--text-muted); }

    /* ------------------------------------------------------------ footer */
    .footer {
      padding: 15px 32px; border-top: 1px solid var(--border); background: var(--surface-alt);
      font-size: 11px; color: var(--text-soft); font-family: var(--mono); text-align: center;
    }

    @media print {
      :root { --bg: #FFFFFF; --surface: #FFFFFF; --surface-alt: #FFFFFF; }
      body { padding: 0; background: #FFFFFF; }
      .container { box-shadow: none; border: none; max-width: none; }
      .violation-card { break-inside: avoid; }
      .filter-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div>
        <h1 class="brand-title">
          <span class="brand-mark">🧭</span>
          <span>SextantDrift</span>
          <span class="edition-tag">${isZh ? '开源版 · 轻量诊断' : 'Open Source · Lite'}</span>
        </h1>
        <div class="brand-sub">
          <span>${isZh ? '架构差分审查报告' : 'Architecture Drift Report'}</span>
          <span>•</span>
          <span>Target: <b>${escapeHtml(projectName)}</b></span>
          <span>•</span>
          <span>${generatedAt} UTC</span>
        </div>
      </div>
      <div class="stamp ${passed ? 'pass' : 'fail'}">${statusText}</div>
    </header>

    <div class="stats-bar">
      <div class="stat-box">
        <div class="stat-label">${isZh ? '偏航总数' : 'Violations'}</div>
        <div class="stat-value ${violations.length > 0 ? 'is-critical' : 'is-ok'}">${statNumber(violations.length)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">${isZh ? '阻断级' : 'Critical'}</div>
        <div class="stat-value ${criticalCount > 0 ? 'is-critical' : ''}">${statNumber(criticalCount)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">${isZh ? '警告级' : 'Warning'}</div>
        <div class="stat-value ${warningCount > 0 ? 'is-warning' : ''}">${statNumber(warningCount)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">${isZh ? '扫描文件' : 'Files'}</div>
        <div class="stat-value">${statNumber(summary?.totalFiles)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">${isZh ? '核验依赖' : 'Dependencies'}</div>
        <div class="stat-value">${statNumber(summary?.totalDependencies)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">${isZh ? '基线债务' : 'Exempted'}</div>
        <div class="stat-value">${statNumber(exemptionCount)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">${isZh ? '耗时' : 'Duration'}</div>
        <div class="stat-value">${statNumber(durationMs)}<span class="stat-unit">ms</span></div>
      </div>
    </div>

    <section class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">${isZh ? '严重度构成' : 'Severity Mix'}</div>
        <div class="chart-donut-wrap">${donut}</div>
      </div>
      <div class="chart-card">
        <div class="chart-title">${isZh ? '违规类型分布' : 'Violation Categories'}</div>
        ${breakdown}
      </div>
      <div class="chart-card">
        <div class="chart-title">${isZh ? '门禁构成' : 'Gate Composition'}</div>
        ${severityComposition}
        ${coverageChart}
      </div>
    </section>

    <div class="content">
      <div class="notice">
        <span>💡</span>
        <span><strong>${isZh ? '扩展提示' : 'Extension Notice'}:</strong> ${extensionNotice}</span>
      </div>

      <div class="section-head">
        <h2 class="section-title">${isZh ? '违规详细诊断清单' : 'Detailed Violations'}</h2>
        <span class="section-count">${violations.length} ${isZh ? '条' : 'items'}</span>
      </div>

      ${
        violations.length > 0
          ? `<div class="filter-bar">
               <button type="button" class="filter-chip active" data-filter="all">${isZh ? '全部' : 'All'} (${violations.length})</button>
               <button type="button" class="filter-chip" data-filter="critical">${isZh ? '阻断' : 'Critical'} (${criticalCount})</button>
               <button type="button" class="filter-chip" data-filter="warning">${isZh ? '警告' : 'Warning'} (${warningCount})</button>
               <input type="search" class="search-input" id="violation-search" placeholder="${isZh ? '搜索文件、消息或组件…' : 'Search file, message or component…'}" aria-label="${isZh ? '搜索违规' : 'Search violations'}" />
             </div>`
          : ''
      }

      <div id="violations-list">
        ${violationsHtml}
      </div>

      ${exemptionsHtml}
    </div>

    <div class="footer">
      Generated by SextantDrift Core &amp; CLI · Open Source Edition · https://github.com/blacktea1526/SextantDrift
    </div>
  </div>

  ${
    violations.length > 0
      ? `<script>
  (function () {
    var chips = Array.prototype.slice.call(document.querySelectorAll('.filter-chip'));
    var search = document.getElementById('violation-search');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.violation-card'));
    var active = 'all';

    function apply() {
      var term = (search && search.value ? search.value : '').trim().toLowerCase();
      cards.forEach(function (card) {
        var okSeverity = active === 'all' || card.getAttribute('data-severity') === active;
        var okTerm = !term || (card.getAttribute('data-search') || '').indexOf(term) !== -1;
        card.classList.toggle('filtered-out', !(okSeverity && okTerm));
      });
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        active = chip.getAttribute('data-filter') || 'all';
        chips.forEach(function (c) { c.classList.toggle('active', c === chip); });
        apply();
      });
    });
    if (search) search.addEventListener('input', apply);
  })();
  </script>`
      : ''
  }
</body>
</html>`;
}
