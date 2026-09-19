import { DriftReport, DriftViolation } from '@sextant/core';

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

  const criticalCount = violations.filter(v => v.severity === 'critical').length;
  const warningCount = violations.filter(v => v.severity === 'warning').length;

  const violationsJsonData = JSON.stringify(violations.map((v, i) => ({
    index: i + 1,
    id: v.id || `V${i + 1}`,
    type: v.type,
    severity: v.severity,
    sourceFile: v.sourceFile,
    line: v.line,
    column: v.column,
    message: v.message,
    snippet: v.snippet || '',
    sourceComponent: v.sourceComponent || '',
    targetComponent: v.targetComponent || '',
    rule: v.ruleDesc || v.ruleId || '',
    suggestion: v.suggestion || '',
  })));

  const violationsHtml = violations.length === 0
    ? `<div style="padding: 28px; text-align: center; color: #2B6E3F; background: #EEF7F1; border: 1px solid #A3D9B5; border-radius: 6px; font-family: monospace; font-size: 14px;">
         ✔ All modules and dependencies conform strictly to target topology and invariants.
       </div>`
    : violations.map((v, i) => {
        const badgeColor = v.severity === 'critical' ? '#C92A2A' : '#D97706';
        const badgeBg = v.severity === 'critical' ? '#FDF2F2' : '#FEF3C7';
        const flowLabel = (v.sourceComponent || v.targetComponent)
          ? `<span class="flow-pill">${escapeHtml(v.sourceComponent || '?')} ➔ ${escapeHtml(v.targetComponent || '?')}</span>`
          : '';

        return `
        <div class="violation-card" id="violation-card-${i + 1}"
             data-violation-id="${v.id || `V${i + 1}`}"
             data-index="${i + 1}"
             data-severity="${v.severity}"
             data-type="${v.type}"
             data-source-component="${escapeHtml(v.sourceComponent || '')}"
             data-target-component="${escapeHtml(v.targetComponent || '')}"
             data-file="${escapeHtml(v.sourceFile)}">
          <div class="card-header">
            <div class="card-title-group">
              <span class="severity-pill" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33;">
                ${v.type}
              </span>
              ${flowLabel}
              <strong class="file-loc">
                ${escapeHtml(v.sourceFile)}:${v.line}:${v.column}
              </strong>
            </div>
            <div class="card-actions">
              <button type="button" class="btn-action" onclick="locateInDiagram('${escapeHtml(v.sourceComponent || '')}', '${escapeHtml(v.targetComponent || '')}')" title="Highlight in diagram">
                🔍 Locate
              </button>
              <button type="button" class="btn-action btn-ai" onclick="copyAiFixPrompt(${i})" title="Copy AI prompt to clipboard">
                🤖 Copy AI Fix Prompt
              </button>
              <span class="card-index">#${i + 1}</span>
            </div>
          </div>
          <div class="card-message">${escapeHtml(v.message)}</div>
          ${v.suggestion ? `<div class="card-suggestion">💡 <strong>Remediation:</strong> ${escapeHtml(v.suggestion)}</div>` : ''}
          ${v.snippet ? `<pre class="code-snippet">${escapeHtml(v.snippet)}</pre>` : ''}
        </div>
      `;
      }).join('\n');

  const exemptionsHtml = exemptions && exemptions.length > 0
    ? `<div style="margin-top: 32px;">
         <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #717178; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
           <span>Historical Exemptions (${exemptions.length} debts snapshot in baseline)</span>
         </h3>
         ${exemptions.map((e) => `
           <div class="exemption-card">
             <span style="color: #2563EB; font-weight: 700;">[EXEMPTED]</span>
             <strong>${escapeHtml(e.sourceFile)}:${e.line}</strong>
             <span style="color: #525257;">— ${escapeHtml(e.message)}</span>
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
      padding: 32px 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F7F5EE;
      background-image:
        linear-gradient(to right, rgba(142, 136, 118, 0.12) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(142, 136, 118, 0.12) 1px, transparent 1px);
      background-size: 20px 20px;
      color: #141416;
    }
    .container {
      max-width: 1480px;
      margin: 0 auto;
      background: #FCFBF8;
      border: 1px solid #C8C3B1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 16px 40px -4px rgba(35,35,38,0.07);
      border-radius: 6px;
      padding: 36px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #D3CEBE;
      padding-bottom: 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
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
      border-radius: 4px;
      font-family: monospace;
    }
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .stat-box {
      background: #FFFFFF;
      border: 1px solid #E5E2D6;
      border-radius: 4px;
      padding: 14px 18px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .stat-label { font-size: 11px; color: #717178; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; font-weight: 600; }
    .stat-value { font-size: 22px; font-weight: 700; font-family: monospace; color: #141416; }

    /* Dual Diagram Split-Screen */
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
      border-radius: 6px;
      padding: 20px;
      min-height: 440px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .diagram-header {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #525257;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid #EFEFF3;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .diagram-content {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: auto;
      min-height: 360px;
    }

    /* Diagram Interactive Highlight Styles */
    svg .node {
      cursor: pointer;
      transition: opacity 0.2s, filter 0.2s;
    }
    svg .node:hover rect, svg .node:hover polygon, svg .node:hover circle {
      stroke: #2563EB !important;
      stroke-width: 2.5px !important;
    }
    svg .node.dimmed {
      opacity: 0.2 !important;
    }
    svg .node.active-highlight rect, svg .node.active-highlight polygon {
      stroke: #C92A2A !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 0 6px rgba(201, 42, 42, 0.4));
    }
    svg .flowchart-link.dimmed, svg .edgePath.dimmed {
      opacity: 0.15 !important;
    }

    /* Violations Toolbar & Filter */
    .toolbar-container {
      background: #FFFFFF;
      border: 1px solid #E5E2D6;
      border-radius: 6px;
      padding: 16px 20px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .filter-group {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-btn {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      background: #F7F5EE;
      border: 1px solid #D3CEBE;
      border-radius: 4px;
      cursor: pointer;
      color: #525257;
      transition: all 0.15s ease;
    }
    .filter-btn:hover {
      background: #EFECE1;
      color: #141416;
    }
    .filter-btn.active {
      background: #141416;
      color: #FFFFFF;
      border-color: #141416;
    }
    .search-input {
      padding: 6px 12px;
      font-size: 13px;
      border: 1px solid #D3CEBE;
      border-radius: 4px;
      background: #FFFFFF;
      min-width: 260px;
      font-family: inherit;
    }
    .search-input:focus {
      outline: none;
      border-color: #2563EB;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }

    /* Violation Cards */
    .violation-card {
      border: 1px solid #E5E2D6;
      border-left: 4px solid #C92A2A;
      border-radius: 4px;
      padding: 18px;
      margin-bottom: 14px;
      background: #FFFFFF;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .violation-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .violation-card.highlight-card {
      border-left-color: #2563EB;
      box-shadow: 0 0 0 2px #2563EB33, 0 4px 16px rgba(37,99,235,0.1);
      animation: pulse-card 1.5s infinite alternate;
    }
    @keyframes pulse-card {
      from { transform: translateY(0); }
      to { transform: translateY(-2px); }
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .card-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .severity-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 3px;
      font-family: monospace;
      letter-spacing: 0.04em;
    }
    .flow-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 3px;
      background: #F1EFE6;
      color: #38383C;
      font-family: monospace;
      border: 1px solid #D8D4C5;
    }
    .file-loc {
      font-family: monospace;
      font-size: 13px;
      color: #141416;
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-action {
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      background: #F7F5EE;
      border: 1px solid #D3CEBE;
      border-radius: 4px;
      color: #38383C;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
    }
    .btn-action:hover {
      background: #EBE8DB;
      color: #141416;
    }
    .btn-ai {
      background: #EEF2FF;
      border-color: #C7D2FE;
      color: #3730A3;
    }
    .btn-ai:hover {
      background: #E0E7FF;
      color: #312E81;
    }
    .card-index {
      font-size: 11px;
      color: #94949C;
      font-family: monospace;
      margin-left: 4px;
    }
    .card-message {
      font-size: 13px;
      color: #38383C;
      margin-bottom: 8px;
      line-height: 1.5;
    }
    .card-suggestion {
      font-size: 12px;
      color: #4B5563;
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 4px;
      padding: 8px 12px;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    .code-snippet {
      background: #F7F5EE;
      border: 1px solid #E5E2D6;
      padding: 10px 14px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      color: #141416;
      overflow-x: auto;
      margin: 0;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .exemption-card {
      border: 1px dashed #D3CEBE;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 8px;
      background: #FCFBF8;
      font-size: 12px;
      font-family: monospace;
      color: #525257;
    }
    .count-badge {
      font-size: 11px;
      background: #E5E2D6;
      color: #525257;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }

    /* Toast Notification */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #141416;
      color: #FFFFFF;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
      opacity: 0;
      transform: translateY(12px);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
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
        <div class="stat-label">Critical / Warning</div>
        <div class="stat-value" style="font-size: 18px;">
          <span style="color: #C92A2A;">${criticalCount}</span> / <span style="color: #D97706;">${warningCount}</span>
        </div>
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
      <div class="diagram-panel" id="target-panel">
        <div class="diagram-header">
          <span>Target Architecture (Design Intent)</span>
          <span style="color: #2B6E3F;">SPECIFICATION</span>
        </div>
        <div class="diagram-content">
          <pre class="mermaid" id="target-mermaid">
${targetMermaid}
          </pre>
        </div>
      </div>

      <div class="diagram-panel" id="actual-panel">
        <div class="diagram-header">
          <span>Actual Code Topology (AST Extracted)</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-action" style="padding: 2px 8px; font-size: 11px;" onclick="resetDiagramHighlight()">Reset Focus</button>
            <span style="color: ${violations.length > 0 ? '#C92A2A' : '#2B6E3F'};">
              ${violations.length > 0 ? 'DRIFT HIGHLIGHTED' : 'IN COMPLIANCE'}
            </span>
          </div>
        </div>
        <div class="diagram-content">
          <pre class="mermaid" id="actual-mermaid">
${actualMermaid}
          </pre>
        </div>
      </div>
    </div>

    <!-- Violation Forensic Evidence Drawer -->
    <div style="margin-top: 32px;" id="violations-section">
      <div class="toolbar-container">
        <div class="filter-group">
          <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #525257;">Filters:</span>
          <button type="button" class="filter-btn active" data-filter="all" onclick="setFilter('severity', 'all', this)">All (${violations.length})</button>
          <button type="button" class="filter-btn" data-filter="critical" onclick="setFilter('severity', 'critical', this)">Critical (${criticalCount})</button>
          <button type="button" class="filter-btn" data-filter="warning" onclick="setFilter('severity', 'warning', this)">Warning (${warningCount})</button>
        </div>
        <div>
          <input type="search" id="violationSearch" class="search-input" placeholder="Search violation message, file or component..." oninput="applyFilters()" />
        </div>
      </div>

      <div id="violations-list">
        ${violationsHtml}
      </div>

      ${exemptionsHtml}
    </div>

    <div style="margin-top: 36px; padding-top: 16px; border-top: 1px solid #E5E2D6; text-align: center; font-size: 12px; color: #94949C; font-family: monospace;">
      Generated deterministically by @sextant/web-report • Architecture X-Ray & Drift Compass
    </div>
  </div>

  <div id="toast" class="toast">✔ Copied to clipboard!</div>

  <script>
    const violationsData = ${violationsJsonData};
    let currentSeverityFilter = 'all';

    document.addEventListener("DOMContentLoaded", function() {
      if (window.mermaid) {
        mermaid.initialize({
          startOnLoad: true,
          theme: 'neutral',
          flowchart: { curve: 'linear', htmlLabels: true }
        });
      }
      setTimeout(bindDiagramInteractions, 600);
    });

    function setFilter(type, value, btnElem) {
      if (type === 'severity') {
        currentSeverityFilter = value;
        document.querySelectorAll('.filter-group .filter-btn').forEach(b => b.classList.remove('active'));
        if (btnElem) btnElem.classList.add('active');
      }
      applyFilters();
    }

    function applyFilters() {
      const searchVal = (document.getElementById('violationSearch')?.value || '').toLowerCase().trim();
      const cards = document.querySelectorAll('.violation-card');

      cards.forEach(card => {
        const sev = card.getAttribute('data-severity');
        const text = card.textContent.toLowerCase();

        const matchSev = (currentSeverityFilter === 'all' || sev === currentSeverityFilter);
        const matchSearch = !searchVal || text.includes(searchVal);

        card.style.display = (matchSev && matchSearch) ? 'block' : 'none';
      });
    }

    function copyAiFixPrompt(index) {
      const v = violationsData[index];
      if (!v) return;

      const prompt = [
        "Please fix the following architectural drift detected by SextantDrift:",
        "",
        "## Architectural Violation Details",
        "- Type: " + v.type + " (" + v.severity + ")",
        "- Location: " + v.sourceFile + ":" + v.line + ":" + v.column,
        "- Offending Component Flow: " + (v.sourceComponent || 'N/A') + " -> " + (v.targetComponent || 'N/A'),
        "- Diagnostic Message: " + v.message,
        v.suggestion ? "- Remediation: " + v.suggestion : "",
        "",
        "## Offending Code Snippet",
        "\`\`\`ts",
        v.snippet || "// (No code snippet available)",
        "\`\`\`",
        "",
        "## Task Instructions",
        "Refactor this code to strictly eliminate the architectural bypass/inversion according to the target architecture rules in AGENTS.md / sextant.json. Route dependencies through the designated domain service layer rather than directly coupling.",
      ].filter(Boolean).join('\\n');

      navigator.clipboard.writeText(prompt).then(() => {
        showToast("🤖 AI Fix Prompt copied! Paste to your AI assistant.");
      }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = prompt;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast("🤖 AI Fix Prompt copied! Paste to your AI assistant.");
      });
    }

    function locateInDiagram(sourceComp, targetComp) {
      const actualPanel = document.getElementById('actual-panel');
      if (actualPanel) {
        actualPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const svg = document.querySelector('#actual-mermaid svg');
      if (!svg) return;

      resetDiagramHighlight();

      const nodes = svg.querySelectorAll('.node');
      let found = false;

      nodes.forEach(node => {
        const text = node.textContent.trim();
        if ((sourceComp && text.includes(sourceComp)) || (targetComp && text.includes(targetComp))) {
          node.classList.add('active-highlight');
          found = true;
        } else {
          node.classList.add('dimmed');
        }
      });

      if (found) {
        showToast("Focused [" + (sourceComp || '') + " -> " + (targetComp || '') + "] in Actual Topology");
      }
    }

    function resetDiagramHighlight() {
      const svg = document.querySelector('#actual-mermaid svg');
      if (!svg) return;
      svg.querySelectorAll('.node').forEach(n => {
        n.classList.remove('active-highlight');
        n.classList.remove('dimmed');
      });
      svg.querySelectorAll('.flowchart-link, .edgePath').forEach(l => {
        l.classList.remove('dimmed');
      });
    }

    function bindDiagramInteractions() {
      const svg = document.querySelector('#actual-mermaid svg');
      if (!svg) return;

      svg.querySelectorAll('.node').forEach(node => {
        node.addEventListener('click', function(e) {
          e.stopPropagation();
          const nodeText = this.textContent.trim();
          filterViolationsByComponent(nodeText);
        });
      });
    }

    function filterViolationsByComponent(compName) {
      const searchInput = document.getElementById('violationSearch');
      if (searchInput) {
        searchInput.value = compName;
        applyFilters();
        const section = document.getElementById('violations-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        showToast("Filtered violations mentioning: " + compName);
      }
    }

    function showToast(message) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  </script>
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
