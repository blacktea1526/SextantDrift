import { DriftReport } from '@sextant/core';

export interface HtmlReportOptions {
  lang?: 'zh' | 'en';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a clean, lightweight, self-contained HTML inspection report
 * without architecture diagram rendering (open source baseline reporter).
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
    ? (isZh ? '架构验证通过（零偏航）' : 'ARCHITECTURE VERIFIED')
    : (isZh ? `发现 ${violations.length} 处架构偏航与违规` : `${violations.length} DRIFT(S) DETECTED`);

  const statusColor = passed ? '#166534' : '#991B1B';
  const statusBg = passed ? '#F0FDF4' : '#FEF2F2';
  const statusBorder = passed ? '#86EFAC' : '#FCA5A5';

  const criticalCount = violations.filter((v) => v.severity === 'critical').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  const violationsHtml =
    violations.length === 0
      ? `<div style="padding: 24px; text-align: center; color: #166534; background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 6px; font-family: monospace;">
          ${isZh ? '✔ 完美合规：未发现任何跨层调用违规、循环依赖或语义不变量偏航。' : '✔ All checks passed: zero architectural drifts detected.'}
         </div>`
      : violations
          .map(
            (v, i) => `
        <div style="margin-bottom: 14px; padding: 14px 18px; border: 1px solid #E2E8F0; border-left: 4px solid ${v.severity === 'critical' ? '#DC2626' : '#D97706'}; background: #FFFFFF; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 700; font-size: 13px; color: ${v.severity === 'critical' ? '#DC2626' : '#D97706'};">
              [#${i + 1}] ${escapeHtml(v.type)}
            </span>
            <span style="font-family: monospace; font-size: 12px; color: #64748B;">
              ${escapeHtml(v.sourceFile)}:${v.line}
            </span>
          </div>
          <div style="font-size: 13px; color: #1E293B; margin-bottom: 8px;">
            ${escapeHtml(v.message)}
          </div>
          ${
            v.snippet
              ? `<pre style="margin: 0 0 8px 0; padding: 8px 12px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto;"><code>${escapeHtml(v.snippet)}</code></pre>`
              : ''
          }
          ${
            v.suggestion
              ? `<div style="font-size: 12px; color: #2563EB; font-family: monospace;">💡 ${isZh ? '修复建议' : 'Suggestion'}: ${escapeHtml(v.suggestion)}</div>`
              : ''
          }
        </div>`
          )
          .join('');

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #F8FAFC; color: #0F172A; padding: 32px 16px; }
    .container { max-width: 1080px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden; }
    .header { padding: 24px 32px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; background: #FAFAFA; }
    .title { font-size: 20px; font-weight: 800; color: #0F172A; }
    .subtitle { font-size: 12px; color: #64748B; margin-top: 4px; font-family: monospace; }
    .stamp { padding: 6px 14px; border-radius: 4px; font-weight: 700; font-size: 13px; font-family: monospace; border: 1px solid ${statusBorder}; background: ${statusBg}; color: ${statusColor}; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; padding: 20px 32px; background: #F1F5F9; border-bottom: 1px solid #E2E8F0; }
    .stat-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 16px; text-align: center; }
    .stat-label { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700; letter-spacing: 0.05em; }
    .stat-value { font-size: 22px; font-weight: 800; margin-top: 4px; color: #0F172A; }
    .content { padding: 28px 32px; }
    .section-title { font-size: 15px; font-weight: 700; color: #334155; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }
    .banner { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 12px 16px; font-size: 12px; color: #1E40AF; margin-bottom: 24px; line-height: 1.6; }
    .footer { padding: 16px 32px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #94A3B8; text-align: center; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="title">🧭 SextantDrift — ${isZh ? '架构差分审查报告' : 'Architecture Drift Report'}</div>
        <div class="subtitle">Target: ${escapeHtml(projectName)} • ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC • Duration: ${durationMs}ms</div>
      </div>
      <div class="stamp">${statusText}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">${isZh ? '偏航总数' : 'Violations'}</div>
        <div class="stat-value" style="color: ${violations.length > 0 ? '#DC2626' : '#16A34A'};">${violations.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${isZh ? '阻断级' : 'Critical'}</div>
        <div class="stat-value" style="color: ${criticalCount > 0 ? '#DC2626' : '#0F172A'};">${criticalCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${isZh ? '警告级' : 'Warning'}</div>
        <div class="stat-value" style="color: ${warningCount > 0 ? '#D97706' : '#0F172A'};">${warningCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${isZh ? '扫描文件' : 'Files'}</div>
        <div class="stat-value">${summary.totalFiles}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${isZh ? '核验依赖' : 'Dependencies'}</div>
        <div class="stat-value">${summary.totalDependencies}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${isZh ? '基线债务' : 'Exempted'}</div>
        <div class="stat-value">${exemptions.length}</div>
      </div>
    </div>

    <div class="content">
      <div class="banner">
        <strong>💡 ${isZh ? '扩展提示' : 'Extension Notice'}:</strong>
        ${
          isZh
            ? '本报告为轻量开源版诊断清单。如需启用 100% 零 CDN 原生矢量 C4 架构图交互画布、无级平移缩放、双图同屏红线差分与组件聚焦探针，请安装独立图渲染扩展包：<code>npm i -D @sextant/web-report</code>。'
            : 'This is a lightweight open-source diagnostic report. To enable interactive C4 SVG architecture canvas, infinite pan-zoom, and dual-diagram visual diffs, install the visual extension: <code>npm i -D @sextant/web-report</code>.'
        }
      </div>

      <div class="section-title">
        <span>🚨 ${isZh ? '违规详细诊断清单' : 'Detailed Violations'} (${violations.length})</span>
      </div>

      ${violationsHtml}
    </div>

    <div class="footer">
      Generated by SextantDrift Core & CLI • Open Source Edition • https://github.com/blacktea1526/SextantDrift
    </div>
  </div>
</body>
</html>`;
}
