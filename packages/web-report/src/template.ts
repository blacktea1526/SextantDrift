import { DriftReport } from '@sextant/core';

function buildTargetMermaid(arch: any): string {
  if (arch.mermaid) return arch.mermaid;
  const lines: string[] = ['flowchart TD'];
  const sortedLayers = [...(arch.layers || [])].sort((a: any, b: any) => a.order - b.order);
  for (const layer of sortedLayers) {
    lines.push(`    subgraph ${layer.id} ["${layer.name}"]`);
    const layerComps = (arch.components || []).filter((c: any) => c.layerId === layer.id);
    for (const comp of layerComps) {
      lines.push(`        ${comp.id}["${comp.name}"]`);
    }
    lines.push('    end');
  }
  for (const dep of (arch.allowDependencies || [])) {
    lines.push(`    ${dep.from} --> ${dep.to}`);
  }
  return lines.join('\n');
}

export function renderHtmlTemplate(report: DriftReport): string {
  const { summary, violations, exemptions, targetArchitecture, actualMermaid, passed, durationMs } = report;
  const projectName = targetArchitecture.name || 'Architecture Target';
  const targetMermaid = buildTargetMermaid(targetArchitecture);

  const statusColor = passed ? '#2B6E3F' : '#C92A2A';
  const statusBg = passed ? '#EEF7F1' : '#FDF2F2';
  const statusBorder = passed ? '#A3D9B5' : '#F09595';
  const statusText = passed ? 'ARCHITECTURE VERIFIED' : `${violations.length} ARCHITECTURAL DRIFT(S) DETECTED`;

  const violationsHtml = violations.length === 0
    ? `<div style="padding: 24px; text-align: center; color: #2B6E3F; background: #EEF7F1; border: 1px solid #A3D9B5; border-radius: 4px; font-family: monospace;">
         ✔ All modules and dependencies conform strictly to target topology and invariants.
       </div>`
    : violations.map((v, i) => {
        const badgeColor = v.severity === 'critical' ? '#C92A2A' : '#D97706';
        const badgeBg = v.severity === 'critical' ? '#FDF2F2' : '#FEF3C7';
        return `
        <div style="border: 1px solid #E5E2D6; border-left: 4px solid ${badgeColor}; border-radius: 4px; padding: 16px; margin-bottom: 12px; background: #FFFFFF;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 2px; font-family: monospace;">
                ${v.type}
              </span>
              <strong style="margin-left: 8px; font-family: monospace; font-size: 13px; color: #141416;">
                ${v.sourceFile}:${v.line}:${v.column}
              </strong>
            </div>
            <span style="font-size: 11px; color: #94949C; font-family: monospace;">#${i + 1}</span>
          </div>
          <div style="font-size: 13px; color: #38383C; margin-bottom: 8px;">${v.message}</div>
          ${v.snippet ? `<pre style="background: #F7F5EE; border: 1px solid #E5E2D6; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #141416; overflow-x: auto; margin: 0;">${escapeHtml(v.snippet)}</pre>` : ''}
        </div>
      `;
      }).join('\n');

  const exemptionsHtml = exemptions && exemptions.length > 0
    ? `<div style="margin-top: 24px;">
         <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #717178; margin-bottom: 12px;">
           Historical Exemptions (${exemptions.length} debts snapshot in baseline)
         </h3>
         ${exemptions.map((e) => `
           <div style="border: 1px dashed #D3CEBE; border-radius: 4px; padding: 10px 14px; margin-bottom: 8px; background: #FCFBF8; font-size: 12px; font-family: monospace; color: #525257;">
             <span style="color: #2563EB; font-weight: bold;">[EXEMPTED]</span> ${e.sourceFile}:${e.line} — ${escapeHtml(e.message)}
           </div>
         `).join('\n')}
       </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SextantDrift — Architecture Drift Report: ${escapeHtml(projectName)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F7F5EE;
      background-image:
        linear-gradient(to right, rgba(142, 136, 118, 0.12) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(142, 136, 118, 0.12) 1px, transparent 1px);
      background-size: 20px 20px;
      color: #141416;
    }
    .container {
      max-width: 1440px;
      margin: 0 auto;
      background: #FCFBF8;
      border: 1px solid #C8C3B1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 12px 36px -4px rgba(35,35,38,0.08);
      border-radius: 4px;
      padding: 32px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #D3CEBE;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .stamp {
      display: inline-block;
      padding: 6px 14px;
      border: 2px solid ${statusBorder};
      background: ${statusBg};
      color: ${statusColor};
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.08em;
      border-radius: 3px;
      font-family: monospace;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
    }
    @media (max-width: 1024px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .diagram-panel {
      background: #FFFFFF;
      border: 1px solid #E5E2D6;
      border-radius: 4px;
      padding: 20px;
      min-height: 400px;
    }
    .diagram-header {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #525257;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #EFEFF3;
      display: flex;
      justify-content: space-between;
    }
    .stats-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .stat-box {
      flex: 1;
      min-width: 140px;
      background: #FFFFFF;
      border: 1px solid #E5E2D6;
      border-radius: 4px;
      padding: 12px 16px;
    }
    .stat-label { font-size: 11px; color: #717178; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 700; font-family: monospace; color: #141416; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      if (window.mermaid) {
        mermaid.initialize({
          startOnLoad: true,
          theme: 'neutral',
          flowchart: { curve: 'linear', htmlLabels: true }
        });
      }
    });
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">
          🧭 SextantDrift Visual Inspection Report
        </h1>
        <div style="font-size: 13px; color: #717178; font-family: monospace;">
          Target: <strong>${escapeHtml(projectName)}</strong> | Generated at: ${new Date().toISOString()} | Scan time: ${durationMs}ms
        </div>
      </div>
      <div class="stamp">${statusText}</div>
    </div>

    <div class="stats-bar">
      <div class="stat-box">
        <div class="stat-label">Files Scanned</div>
        <div class="stat-value">${summary.totalFiles}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Dependencies</div>
        <div class="stat-value">${summary.totalDependencies}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">New Drifts</div>
        <div class="stat-value" style="color: ${violations.length > 0 ? '#C92A2A' : '#2B6E3F'};">${violations.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Historical Exemptions</div>
        <div class="stat-value">${summary.exemptedViolations || 0}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Scan Latency</div>
        <div class="stat-value">${durationMs}ms</div>
      </div>
    </div>

    <!-- Dual Diagram Split-Screen -->
    <div class="grid-2">
      <div class="diagram-panel">
        <div class="diagram-header">
          <span>Target Architecture (Design Intent)</span>
          <span style="color: #2B6E3F;">SPECIFICATION</span>
        </div>
        <pre class="mermaid" style="display: flex; justify-content: center;">
${targetMermaid}
        </pre>
      </div>

      <div class="diagram-panel">
        <div class="diagram-header">
          <span>Actual Code Topology (AST Extracted)</span>
          <span style="color: ${violations.length > 0 ? '#C92A2A' : '#2B6E3F'};">
            ${violations.length > 0 ? 'DRIFT HIGHLIGHTED' : 'IN COMPLIANCE'}
          </span>
        </div>
        <pre class="mermaid" style="display: flex; justify-content: center;">
${actualMermaid}
        </pre>
      </div>
    </div>

    <!-- Violation Evidence Drawer -->
    <div style="margin-top: 32px;">
      <h2 style="font-size: 16px; text-transform: uppercase; letter-spacing: 0.06em; color: #141416; margin-bottom: 16px; border-bottom: 1px solid #D3CEBE; padding-bottom: 8px;">
        Architectural Violations & Forensic Evidence (${violations.length})
      </h2>
      ${violationsHtml}
      ${exemptionsHtml}
    </div>

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E2D6; text-align: center; font-size: 12px; color: #94949C; font-family: monospace;">
      Generated deterministically by @sextant/web-report • Architecture X-Ray & Drift Compass
    </div>
  </div>
</body>
</html>
`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
