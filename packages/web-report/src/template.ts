import { DriftReport, C4GraphData, buildC4GraphData, DirectedGraph } from '@sextant/core';
import { SEXTANT_LOGO_SVG } from './assets/logo.js';
import { getTranslations, I18N_DICTIONARIES, Lang, Translations } from './i18n.js';
import { renderC4Svg, renderC4ContainerSvg } from './c4-svg-renderer.js';
import { getReportCss } from './styles/report.css.js';
import { getReportScript } from './scripts/report.js.js';
import { escapeHtml, safeJsonStringify } from './utils/security.js';

export { escapeHtml, safeJsonStringify };

export interface RenderOptions {
  lang?: Lang;
}

export function renderHtmlTemplate(report: DriftReport, options?: RenderOptions): string {
  const lang = options?.lang || 'zh';
  const t: Translations = getTranslations(lang);

  const { summary, violations, exemptions, targetArchitecture, passed, durationMs } = report;
  const projectName = targetArchitecture.name || targetArchitecture.systemName || 'Architecture Target';

  // Ensure graphData is available; compute via builder if absent
  let graphData: C4GraphData = report.graphData;
  if (!graphData) {
    const dummyGraph = new DirectedGraph();
    graphData = buildC4GraphData(targetArchitecture, dummyGraph, violations);
  }

  // Generate Native SVG C4 Diagrams (100% Self-Contained, Zero External CDN)
  // Level 3: Detailed Component SVGs
  const unifiedComponentResult = renderC4Svg(graphData, 'unified', t);
  const targetComponentResult = renderC4Svg(graphData, 'target', t);
  const actualComponentResult = renderC4Svg(graphData, 'actual', t);

  // Level 2: Macro Container Architecture SVGs (0 Component Clutter)
  const unifiedContainerResult = renderC4ContainerSvg(graphData, 'unified', t);
  const targetContainerResult = renderC4ContainerSvg(graphData, 'target', t);
  const actualContainerResult = renderC4ContainerSvg(graphData, 'actual', t);

  const statusColor = passed ? '#166534' : '#991B1B';
  const statusBg = passed ? '#F0FDF4' : '#FEF2F2';
  const statusBorder = passed ? '#86EFAC' : '#FCA5A5';
  const statusText = passed
    ? (lang === 'zh' ? '架构验证通过（零偏航）' : 'ARCHITECTURE VERIFIED')
    : (lang === 'zh'
        ? `发现 ${violations.length} 处架构偏航与违规`
        : `${violations.length} ARCHITECTURAL DRIFT(S) DETECTED`);

  const criticalCount = violations.filter((v) => v.severity === 'critical').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  const componentsList = targetArchitecture.components || [];
  const sortedComponents = [...componentsList].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

  // Determine contract/foundation components (for clutter filtering)
  const maxLayerOrder = Math.max(...(targetArchitecture.layers || []).map((l) => l.order || 0), 0);
  const contractCompIds = componentsList
    .filter((c) => {
      const layer = (targetArchitecture.layers || []).find((l) => l.id === c.layerId);
      return (
        layer?.id === 'contracts' ||
        layer?.order === maxLayerOrder ||
        c.id.toLowerCase().includes('contract') ||
        c.id.toLowerCase().includes('error')
      );
    })
    .map((c) => c.id);

  // Build dependency map for component isolation
  const dependencyMap: Record<string, string[]> = {};
  for (const dep of targetArchitecture.allowDependencies || []) {
    if (!dependencyMap[dep.from]) dependencyMap[dep.from] = [];
    dependencyMap[dep.from].push(dep.to);
  }

  const violationsJsonData = safeJsonStringify(
    violations.map((v, i) => ({
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
    }))
  );

  const violationsHtml =
    violations.length === 0
      ? `<div style="padding: 28px; text-align: center; color: #166534; background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 6px; font-family: monospace; font-size: 14px;" data-i18n="noViolations">
           ${t.noViolations}
         </div>`
      : violations
          .map((v, i) => {
            const badgeColor = v.severity === 'critical' ? '#991B1B' : '#D97706';
            const badgeBg = v.severity === 'critical' ? '#FEF2F2' : '#FEF3C7';
            const flowLabel =
              v.sourceComponent || v.targetComponent
                ? `<span class="flow-pill">${escapeHtml(v.sourceComponent || '?')} <span class="flow-arrow">➔</span> ${escapeHtml(v.targetComponent || '?')}</span>`
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
              <button type="button" class="btn-action" data-action="locate" data-source-component="${escapeHtml(v.sourceComponent || '')}" data-target-component="${escapeHtml(v.targetComponent || '')}" onclick="locateInDiagram('${escapeHtml(v.sourceComponent || '')}', '${escapeHtml(v.targetComponent || '')}')" title="${lang === 'zh' ? '在 C4 架构图中聚焦定位' : 'Locate in C4 diagram'}">
                🎯 <span data-i18n="btnFocusGraph">${t.btnFocusGraph}</span>
              </button>
              <button type="button" class="btn-action btn-ai" data-action="copy-ai" data-index="${i}" onclick="copyAiFixPrompt(${i})" title="${lang === 'zh' ? '复制 AI 修复 Prompt 到剪贴板' : 'Copy AI fix prompt'}">
                🤖 Copy AI Fix Prompt
              </button>
              <span class="card-index">#${i + 1}</span>
            </div>
          </div>
          <div class="card-message">${escapeHtml(v.message)}</div>
          ${v.suggestion ? `<div class="card-suggestion">💡 <strong data-i18n="fixSuggestion">${t.fixSuggestion}:</strong> ${escapeHtml(v.suggestion)}</div>` : ''}
          ${v.snippet ? `<pre class="code-snippet">${escapeHtml(v.snippet)}</pre>` : ''}
        </div>`;
          })
          .join('\n');

  const exemptionsHtml =
    exemptions && exemptions.length > 0
      ? `
      <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid #E2E8F0;">
        <h3 style="font-size: 14px; font-weight: 700; color: #475569; margin-bottom: 10px;">
          🛡️ <span>Historical Exemptions (${exemptions.length} debts snapshot in baseline)</span>
        </h3>
        <div style="font-size: 12px; color: #64748B; margin-bottom: 8px;">
          Historical debts grandfathered by .sextant/baseline.json.
        </div>
        ${exemptions
          .map(
            (e) => `
             <div class="exemption-card">
               <span style="color: #64748B;">[EXEMPTED]</span>
               <strong>${escapeHtml(e.sourceFile)}:${e.line}</strong>
               <span style="color: #525257;">— ${escapeHtml(e.message)}</span>
             </div>`
          )
          .join('')}
      </div>`
      : '';


  const reportCss = getReportCss({ statusBorder, statusBg, statusColor });
  const reportScript = getReportScript({
    violationsJson: violationsJsonData,
    graphDataJson: safeJsonStringify(graphData),
    contractCompIdsJson: safeJsonStringify(contractCompIds),
    dependencyMapJson: safeJsonStringify(dependencyMap),
    i18nJson: safeJsonStringify(I18N_DICTIONARIES),
    lang,
    passed,
  });

  const htmlLang = lang === 'zh' ? 'zh-CN' : 'en';

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SextantDrift — ${lang === 'zh' ? '架构偏航检测报告' : 'Architecture Drift Report'}: ${escapeHtml(projectName)}</title>
  <style>
${reportCss}
  </style>
</head>
<body>
  <div class="container">
    <!-- Brand Header with Vector SVG Logo -->
    <div class="header">
      <div class="brand-wrap">
        <div class="brand-logo-container" title="SextantDrift Official Logo">
          ${SEXTANT_LOGO_SVG}
        </div>
        <div>
          <h1 class="brand-title">
            <span>SextantDrift</span>
            <span class="brand-badge" data-i18n="metaReport">${t.metaReport}</span>
            <span class="c4-badge-tag">${t.c4Badge}</span>
          </h1>
          <div class="brand-sub">
            <span data-i18n="appSubtitle">${t.appSubtitle}</span>
            <span class="dot-sep">•</span>
            <span>Target: <strong>${escapeHtml(projectName)}</strong></span>
            <span class="dot-sep">•</span>
            <span>${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
          </div>
        </div>
      </div>
      <div class="header-right-actions">
        <div class="stamp" id="status-stamp">${statusText}</div>
        <button type="button" class="btn-motion active" id="btn-toggle-motion" onclick="toggleMotionFx()" title="Toggle Web Motion FX">
          ${t.btnMotionOn}
        </button>
        <button type="button" class="btn-lang" id="btn-lang-toggle" onclick="toggleLanguage()" title="Switch Language">
          ${t.langToggle}
        </button>
      </div>
    </div>

    <!-- Stats Dashboard -->
    <div class="stats-bar">
      <div class="stat-box">
        <div class="stat-label" data-i18n="statViolations">${t.statViolations}</div>
        <div class="stat-value" style="color: ${violations.length > 0 ? '#DC2626' : '#16A34A'};">
          ${violations.length}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-label" data-i18n="statCritical">${t.statCritical}</div>
        <div class="stat-value" style="color: ${criticalCount > 0 ? '#DC2626' : '#0F172A'};">
          ${criticalCount}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-label" data-i18n="statWarning">${t.statWarning}</div>
        <div class="stat-value" style="color: ${warningCount > 0 ? '#D97706' : '#0F172A'};">
          ${warningCount}
        </div>
      </div>
      <div class="stat-box">
        <div class="stat-label" data-i18n="statComponents">${t.statComponents}</div>
        <div class="stat-value">${componentsList.length}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label" data-i18n="statLayers">${t.statLayers}</div>
        <div class="stat-value">${targetArchitecture.layers ? targetArchitecture.layers.length : 0}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label" data-i18n="statDuration">${t.statDuration}</div>
        <div class="stat-value">${durationMs}<span style="font-size: 14px; font-weight: 500; color: #64748B;">ms</span></div>
      </div>
    </div>

    <!-- C4 Level Switcher (L2 Containers vs L3 Components) -->
    <div class="c4-level-bar" style="margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; background: #FFFFFF; border: 1px solid #E2E8F0; padding: 10px 18px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
      <div style="display: flex; align-items: center; gap: 14px;">
        <span style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">C4 视图层级:</span>
        <div class="mode-group" style="margin-bottom: 0;">
          <button type="button" class="mode-btn active" id="btn-level-container" onclick="setC4Level('container')" data-i18n="viewLevelL2">
            ${t.viewLevelL2}
          </button>
          <button type="button" class="mode-btn" id="btn-level-component" onclick="setC4Level('component')" data-i18n="viewLevelL3">
            ${t.viewLevelL3}
          </button>
        </div>
      </div>
      <div id="c4-level-tip" style="font-size: 12px; color: #64748B; font-family: monospace;">
        ${t.drillDownHint}
      </div>
    </div>

    <!-- Container Isolation Filter Bar (Shown in L3) -->
    <div class="container-filter-bar" id="container-filter-bar" style="display: none; margin-bottom: 12px; align-items: center; gap: 8px; flex-wrap: wrap; background: #F8FAFC; border: 1px dashed #CBD5E1; padding: 8px 16px; border-radius: 6px;">
      <span style="font-size: 12px; font-weight: 700; color: #334155;" data-i18n="filterByContainer">${t.filterByContainer}</span>
      <button type="button" class="btn-action filter-chip active" id="chip-all-containers" onclick="filterByContainer('')" data-i18n="allContainers">${t.allContainers}</button>
      ${(graphData.containers || []).map((c) => `
        <button type="button" class="btn-action filter-chip" id="chip-container-${escapeHtml(c.id)}" onclick="filterByContainer('${escapeHtml(c.id)}')">
          ${escapeHtml(c.name)} <span style="font-size: 10px; opacity: 0.8;">(${c.componentIds.length})</span>
        </button>
      `).join('')}
    </div>

    <!-- View Controls Bar -->
    <div class="view-controls-bar">
      <div class="mode-group">
        <button type="button" class="mode-btn active" id="btn-mode-unified" onclick="setLayoutMode('unified')" data-i18n="tabUnified">
          ${t.tabUnified}
        </button>
        <button type="button" class="mode-btn" id="btn-mode-target" onclick="setLayoutMode('target')" data-i18n="tabTarget">
          ${t.tabTarget}
        </button>
        <button type="button" class="mode-btn" id="btn-mode-actual" onclick="setLayoutMode('actual')" data-i18n="tabActual">
          ${t.tabActual}
        </button>
        <button type="button" class="mode-btn" id="btn-mode-side-by-side" onclick="setLayoutMode('side-by-side')" data-i18n="tabSideBySide">
          ${t.tabSideBySide}
        </button>
      </div>

      <div class="pan-tip">
        <span>💡 ${lang === 'zh' ? '点击 C4 组件卡片查看详细依赖属性；滚轮缩放 / 拖拽平移' : 'Click component to inspect; Drag to pan / Scroll to zoom'}</span>
      </div>
    </div>

    <!-- Red/Green Architecture Diff Visual Legend Bar -->
    <div class="diff-legend-bar">
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-line-sample" style="background: #16A34A;"></span>
          <strong style="color: #166534;" data-i18n="legendGreen">${t.legendGreen}</strong>
          <span style="color: #64748B;">(Compliant Path)</span>
        </div>
        <div class="legend-item">
          <span class="legend-line-sample" style="background: #DC2626; height: 4px; border: 1px dashed #991B1B;"></span>
          <strong style="color: #991B1B;" data-i18n="legendRed">${t.legendRed}</strong>
          <span style="color: #DC2626; font-weight: 700; font-family: monospace;">[DRIFT ALERT]</span>
        </div>
        <div class="legend-item">
          <span class="legend-line-sample" style="background: #94A3B8; border-top: 1px dashed #94A3B8; height: 2px;"></span>
          <strong style="color: #475569;" data-i18n="legendGrey">${t.legendGrey}</strong>
          <span style="color: #64748B;">(Planned Path)</span>
        </div>
      </div>

      <div style="display: flex; gap: 8px; align-items: center;">
        <button type="button" class="btn-action" id="btn-toggle-contracts-unified" onclick="toggleContractEdges()" title="过滤底层契约连线">
          ${t.btnHideContracts}
        </button>
        <button type="button" class="btn-action" onclick="resetDiagramHighlight()" title="重置聚焦">
          ${t.btnResetFocus}
        </button>
      </div>
    </div>

    <!-- Mode 1: Unified Flagship Overlay Diff Panel (Default) -->
    <div class="unified-panel-container" id="unified-panel-container">
      <div class="diagram-panel" id="unified-panel">
        <div class="diagram-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; color: #0F172A;" data-i18n="tabUnified">${t.tabUnified}</span>
            <span style="color: #2563EB; font-size: 11px; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-weight: 700;">
              C4 ARCHITECTURE X-RAY
            </span>
          </div>
          <div class="diagram-toolbar">
            <!-- Component Isolation Dropdown -->
            <select id="comp-isolate-select-unified" class="select-comp" onchange="isolateComponent(this.value)">
              <option value="" data-i18n="selectComponent">${t.selectComponent}</option>
              ${sortedComponents.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('')}
            </select>

            <!-- Zoom & Viewport Controls -->
            <button type="button" class="btn-action btn-zoom" onclick="zoom('unified', 1.25)" title="放大">+</button>
            <button type="button" class="btn-action btn-zoom" onclick="zoom('unified', 0.8)" title="缩小">−</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="zoomTo('unified', 1.0)" title="100% Scale">1:1</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="fitDiagram('unified')" title="Fit to Viewport">Fit</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="toggleFullscreen('unified-panel')" title="Fullscreen">⛶ Fullscreen</button>
          </div>
        </div>
        <div class="diagram-viewport" id="unified-viewport">
          <div class="panzoom-canvas" id="unified-canvas">
            <div id="unified-container-view">${unifiedContainerResult.svg}</div>
            <div id="unified-component-view" style="display: none;">${unifiedComponentResult.svg}</div>
          </div>
          <div class="zoom-hud" id="unified-hud">100%</div>
        </div>
      </div>
    </div>

    <!-- Mode 2: Dual Diagram Split-Screen Grid (Side-by-Side, Target Only, Actual Only) -->
    <div class="grid-2" id="diagrams-grid" style="display: none;">
      <!-- Target Diagram Panel -->
      <div class="diagram-panel" id="target-panel">
        <div class="diagram-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700;" data-i18n="tabTarget">${t.tabTarget}</span>
            <span style="color: #166534; font-size: 11px; background: #F0FDF4; border: 1px solid #86EFAC; padding: 2px 6px; border-radius: 3px; font-family: monospace;">C4 DESIGN INTENT</span>
          </div>
          <div class="diagram-toolbar">
            <button type="button" class="btn-action btn-zoom" onclick="zoom('target', 1.25)" title="Zoom In">+</button>
            <button type="button" class="btn-action btn-zoom" onclick="zoom('target', 0.8)" title="Zoom Out">−</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="zoomTo('target', 1.0)" title="100% Scale">1:1</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="fitDiagram('target')" title="Fit to Viewport">Fit</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="toggleFullscreen('target-panel')" title="Fullscreen">⛶ Fullscreen</button>
          </div>
        </div>
        <div class="diagram-viewport" id="target-viewport">
          <div class="panzoom-canvas" id="target-canvas">
            <div id="target-container-view">${targetContainerResult.svg}</div>
            <div id="target-component-view" style="display: none;">${targetComponentResult.svg}</div>
          </div>
          <div class="zoom-hud" id="target-hud">100%</div>
        </div>
      </div>

      <!-- Actual Diagram Panel -->
      <div class="diagram-panel" id="actual-panel">
        <div class="diagram-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700;" data-i18n="tabActual">${t.tabActual}</span>
            <span style="color: ${violations.length > 0 ? '#991B1B' : '#166534'}; font-size: 11px; background: ${violations.length > 0 ? '#FEF2F2' : '#F0FDF4'}; border: 1px solid ${violations.length > 0 ? '#FCA5A5' : '#86EFAC'}; padding: 2px 6px; border-radius: 3px; font-family: monospace;">
              ${violations.length > 0 ? 'ACTUAL DRIFT' : 'IN COMPLIANCE'}
            </span>
          </div>
          <div class="diagram-toolbar">
            <!-- Component Isolation Dropdown -->
            <select id="comp-isolate-select-actual" class="select-comp" onchange="isolateComponent(this.value)">
              <option value="" data-i18n="selectComponent">${t.selectComponent}</option>
              ${sortedComponents.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('')}
            </select>
            <button type="button" class="btn-action btn-zoom" onclick="zoom('actual', 1.25)" title="Zoom In">+</button>
            <button type="button" class="btn-action btn-zoom" onclick="zoom('actual', 0.8)" title="Zoom Out">−</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="zoomTo('actual', 1.0)" title="100% Scale">1:1</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="fitDiagram('actual')" title="Fit to Viewport">Fit</button>
            <button type="button" class="btn-action" style="padding: 3px 8px; font-size: 11px;" onclick="toggleFullscreen('actual-panel')" title="Fullscreen">⛶ Fullscreen</button>
          </div>
        </div>
        <div class="diagram-viewport" id="actual-viewport">
          <div class="panzoom-canvas" id="actual-canvas">
            <div id="actual-container-view">${actualContainerResult.svg}</div>
            <div id="actual-component-view" style="display: none;">${actualComponentResult.svg}</div>
          </div>
          <div class="zoom-hud" id="actual-hud">100%</div>
        </div>
      </div>
    </div>

    <!-- Violations Section -->
    <div id="violations-section">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
        <h2 style="font-size: 18px; font-weight: 800; margin: 0; color: #0F172A;" data-i18n="violationsTitle">
          ${t.violationsTitle}
        </h2>
        <div style="font-size: 13px; color: #64748B;">
          ${violations.length > 0 ? (lang === 'zh' ? '共检测到 ' : 'Found ') + violations.length + (lang === 'zh' ? ' 处违规' : ' violations') : ''}
        </div>
      </div>

      <!-- Violations Filter Bar -->
      <div class="toolbar-container">
        <div class="filter-group">
          <button type="button" class="filter-btn active" onclick="setFilter('severity', 'all', this)" data-i18n="filterAll">
            ${t.filterAll} (${violations.length})
          </button>
          <button type="button" class="filter-btn" onclick="setFilter('severity', 'critical', this)" data-i18n="filterCritical">
            ${t.filterCritical} (${criticalCount})
          </button>
          <button type="button" class="filter-btn" onclick="setFilter('severity', 'warning', this)" data-i18n="filterWarning">
            ${t.filterWarning} (${warningCount})
          </button>
        </div>
        <input type="text" id="violationSearch" class="search-input" placeholder="${t.searchPlaceholder}" oninput="applyFilters()" />
      </div>

      <!-- Violation Cards List -->
      <div id="violations-list">
        ${violationsHtml}
      </div>

      <!-- Historical Baseline Exemptions -->
      ${exemptionsHtml}
    </div>
  </div>

  <!-- Interactive C4 Component Inspector Drawer -->
  <div id="c4-inspector" class="c4-inspector">
    <div class="insp-header">
      <div>
        <span class="insp-badge" id="insp-container">C4 Component Inspector</span>
        <h3 class="insp-title" id="insp-name">Component Name</h3>
      </div>

      <button type="button" class="btn-close-insp" onclick="closeInspector()" title="${t.inspectorClose}">✕</button>
    </div>
    <div class="insp-body">
      <div class="insp-section">
        <div class="insp-label">${t.inspectorTech}</div>
        <div class="insp-value" id="insp-tech">TypeScript</div>
      </div>
      <div class="insp-section">
        <div class="insp-label">${t.inspectorPaths}</div>
        <div class="insp-code" id="insp-paths">src/**</div>
      </div>
      <div class="insp-section">
        <div class="insp-label">${t.inspectorIncoming} (<span id="insp-incoming-count">0</span>)</div>
        <div class="insp-list" id="insp-incoming"></div>
      </div>
      <div class="insp-section">
        <div class="insp-label">${t.inspectorOutgoing} (<span id="insp-outgoing-count">0</span>)</div>
        <div class="insp-list" id="insp-outgoing"></div>
      </div>
      <div class="insp-section">
        <div class="insp-label">${t.inspectorViolations} (<span id="insp-violations-count">0</span>)</div>
        <div class="insp-list" id="insp-violations"></div>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast" class="toast">✔ Copied</div>

  <script>
${reportScript}
  </script>
</body>
</html>`;
}
