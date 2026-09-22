export interface ReportCssOptions {
  statusBorder: string;
  statusBg: string;
  statusColor: string;
}

/**
 * Returns complete offline CSS stylesheet for SextantDrift HTML inspection report.
 */
export function getReportCss(options: ReportCssOptions): string {
  const { statusBorder, statusBg, statusColor } = options;

  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      background-image:
        linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
      background-size: 20px 20px;
      color: #0F172A;
    }
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 20px 40px -4px rgba(15, 23, 42, 0.08);
      border-radius: 8px;
      padding: 36px;
      transition: all 0.2s ease;
      position: relative;
    }

    /* Brand Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #E2E8F0;
      padding-bottom: 24px;
      margin-bottom: 28px;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .brand-logo-container {
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0F172A;
      border: 1px solid #1E293B;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
      padding: 5px;
    }
    .brand-logo-icon {
      width: 100%;
      height: 100%;
      display: block;
    }
    .brand-title {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-badge {
      font-size: 12px;
      font-weight: 700;
      background: #EEF2FF;
      color: #3730A3;
      border: 1px solid #C7D2FE;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .c4-badge-tag {
      font-size: 11px;
      font-weight: 700;
      background: #ECFDF5;
      color: #065F46;
      border: 1px solid #A7F3D0;
      padding: 2px 8px;
      border-radius: 4px;
      letter-spacing: 0.03em;
    }
    .brand-sub {
      font-size: 13px;
      color: #64748B;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .dot-sep {
      color: #CBD5E1;
    }
    .header-right-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stamp {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 800;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 6px;
      border: 1.5px solid ${statusBorder};
      background: ${statusBg};
      color: ${statusColor};
      letter-spacing: 0.04em;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
      transition: box-shadow 0.3s ease;
    }
    .stamp.alert-pulse {
      animation: stamp-alert-pulse 2.2s infinite ease-in-out;
    }
    .stamp.clean-shimmer {
      animation: stamp-clean-shimmer 3.2s infinite ease-in-out;
    }
    .btn-lang, .btn-motion {
      padding: 7px 14px;
      font-size: 12px;
      font-weight: 700;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      cursor: pointer;
      color: #334155;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-lang:hover, .btn-motion:hover {
      background: #E2E8F0;
      color: #0F172A;
      border-color: #94A3B8;
      transform: translateY(-1px);
    }
    .btn-motion.active {
      background: #EFF6FF;
      color: #1D4ED8;
      border-color: #93C5FD;
    }

    /* Stats Dashboard */
    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .stat-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 16px 20px;
      border-radius: 6px;
      position: relative;
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748B;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 800;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #0F172A;
    }

    /* View Controls Bar */
    .view-controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding: 12px 18px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .mode-group {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }
    .mode-btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      cursor: pointer;
      color: #334155;
      transition: all 0.15s ease;
    }
    .mode-btn:hover {
      background: #F1F5F9;
      color: #0F172A;
    }
    .mode-btn.active {
      background: #0F172A;
      color: #FFFFFF;
      border-color: #0F172A;
    }
    .pan-tip {
      font-size: 12px;
      color: #64748B;
      font-family: monospace;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Red/Green Diff Visual Legend Bar */
    .diff-legend-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 10px 18px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .legend-items {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-line-sample {
      display: inline-block;
      width: 24px;
      height: 3px;
      border-radius: 2px;
    }

    /* Diagram Panels & Split-Screen Grid */
    .unified-panel-container {
      margin-bottom: 32px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 32px;
      transition: grid-template-columns 0.2s ease;
    }
    .grid-2.stacked {
      grid-template-columns: 1fr !important;
    }
    .grid-2.tab-target #actual-panel {
      display: none !important;
    }
    .grid-2.tab-actual #target-panel {
      display: none !important;
    }
    .grid-2.tab-target #target-panel,
    .grid-2.tab-actual #actual-panel {
      grid-column: 1 / -1;
    }

    @media (max-width: 1024px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    .diagram-panel {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 16px 20px 20px 20px;
      min-height: 640px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      position: relative;
    }
    .diagram-panel.fullscreen {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 10000 !important;
      margin: 0 !important;
      border-radius: 0 !important;
      padding: 24px !important;
      background: #FFFFFF !important;
    }
    .diagram-header {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .diagram-toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    /* Pan & Zoom Viewport */
    .diagram-viewport {
      flex: 1;
      min-height: 560px;
      background: #F8FAFC;
      background-image:
        radial-gradient(circle, #CBD5E1 1px, transparent 1px);
      background-size: 16px 16px;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
      cursor: grab;
      user-select: none;
    }
    .diagram-viewport:active {
      cursor: grabbing;
    }
    .panzoom-canvas {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      transition: transform 0.05s ease-out;
      will-change: transform;
    }
    .panzoom-canvas.smooth-camera {
      transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    .c4-view-transition {
      animation: c4ViewEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes c4ViewEnter {
      from {
        opacity: 0;
        transform: scale(0.985);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .zoom-hud {
      position: absolute;
      bottom: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.88);
      color: #FFFFFF;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      font-weight: 700;
      pointer-events: none;
      letter-spacing: 0.05em;
    }

    /* C4 Canvas & Interactive Component Styles */
    .c4-canvas {
      display: block;
      user-select: none;
      shape-rendering: geometricPrecision;
      text-rendering: geometricPrecision;
    }
    .c4-node {
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s, filter 0.2s;
    }
    .c4-node:hover {
      transform: translateY(-2px);
    }
    .c4-node:hover .node-box {
      stroke: #2563EB !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 6px 16px rgba(37, 99, 235, 0.28)) !important;
    }
    .c4-node.selected .node-box {
      stroke: #2563EB !important;
      stroke-width: 3.5px !important;
      filter: drop-shadow(0 0 12px rgba(37, 99, 235, 0.55)) !important;
    }
    .c4-node.active-highlight .node-box {
      stroke: #DC2626 !important;
      stroke-width: 3.5px !important;
      filter: drop-shadow(0 0 14px rgba(220, 38, 38, 0.75)) !important;
    }
    .c4-container-node {
      cursor: pointer;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s;
    }
    .c4-container-node:hover {
      transform: translateY(-2px);
    }
    .c4-container-node:hover .container-box {
      stroke: #2563EB !important;
      stroke-width: 3px !important;
      filter: drop-shadow(0 6px 18px rgba(37, 99, 235, 0.25)) !important;
    }
    .c4-subcomponent-chip {
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .c4-subcomponent-chip:hover rect {
      fill: #EEF2FF !important;
      stroke: #6366F1 !important;
      filter: drop-shadow(0 2px 6px rgba(99, 102, 241, 0.25));
    }
    .c4-node.dimmed, .c4-edge-group.dimmed, .c4-container-edge.dimmed, .c4-container-node.dimmed {
      opacity: 0.1 !important;
    }
    .c4-edge-group.highlighted path {
      stroke-width: 4.5px !important;
      filter: drop-shadow(0 0 10px rgba(220, 38, 38, 0.8)) !important;
    }

    /* SVG Architecture Topology Edge Flow Motion */
    .c4-edge.compliant {
      stroke-dasharray: 6 4;
      animation: c4-flow-green 20s linear infinite;
    }
    .c4-edge.drift {
      stroke-dasharray: 8 5;
      animation: c4-flow-drift 1.6s linear infinite, c4-drift-glow 2s ease-in-out infinite;
    }
    .c4-edge.planned {
      stroke-dasharray: 4 4;
      animation: c4-flow-planned 26s linear infinite;
    }
    .c4-edge-pill.drift {
      transform-origin: center;
      animation: c4-badge-pulse 2s ease-in-out infinite;
    }

    /* Radar Beacon for Focused Architecture Violations */
    .c4-radar-beacon {
      fill: none;
      stroke: #DC2626;
      pointer-events: none;
      animation: c4-radar-ping 1.4s cubic-bezier(0, 0.2, 0.8, 1) infinite;
    }

    /* Violations Toolbar & Filter */
    .toolbar-container {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
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
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      cursor: pointer;
      color: #475569;
      transition: all 0.15s ease;
    }
    .filter-btn:hover {
      background: #F1F5F9;
      color: #0F172A;
    }
    .filter-btn.active {
      background: #0F172A;
      color: #FFFFFF;
      border-color: #0F172A;
    }
    .search-input {
      padding: 6px 12px;
      font-size: 13px;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      background: #FFFFFF;
      min-width: 280px;
      font-family: inherit;
    }
    .search-input:focus {
      outline: none;
      border-color: #2563EB;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }
    .select-comp {
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      background: #FFFFFF;
      color: #334155;
      cursor: pointer;
    }

    /* Violation Cards */
    .violation-card {
      border: 1px solid #E2E8F0;
      border-left: 4px solid #DC2626;
      border-radius: 6px;
      padding: 18px;
      margin-bottom: 14px;
      background: #FFFFFF;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s;
    }
    .violation-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.06);
    }
    .violation-card.card-flashing {
      animation: c4-card-flash 1.6s ease-in-out 2;
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
      background: #F1F5F9;
      color: #334155;
      font-family: monospace;
      border: 1px solid #E2E8F0;
    }
    .flow-arrow {
      color: #DC2626;
      font-weight: 800;
    }
    .file-loc {
      font-family: monospace;
      font-size: 13px;
      color: #0F172A;
    }
    .card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-action {
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      padding: 5px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-action:hover {
      background: #F1F5F9;
      color: #0F172A;
      border-color: #94A3B8;
      transform: translateY(-1px);
    }
    .btn-action:active {
      transform: translateY(1px) scale(0.97);
    }
    .btn-ai {
      background: #EEF2FF;
      color: #3730A3;
      border-color: #C7D2FE;
    }
    .btn-ai:hover {
      background: #E0E7FF;
      color: #312E81;
      border-color: #A5B4FC;
    }
    .btn-ai.copied-success {
      background: #DCFCE7 !important;
      color: #166534 !important;
      border-color: #86EFAC !important;
      transform: scale(1.04);
    }
    .card-index {
      font-family: monospace;
      font-size: 12px;
      color: #94A3B8;
      font-weight: 700;
    }
    .card-message {
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 8px;
      color: #1E293B;
    }
    .card-suggestion {
      font-size: 13px;
      color: #475569;
      background: #F8FAFC;
      border-left: 3px solid #3B82F6;
      padding: 8px 12px;
      border-radius: 0 4px 4px 0;
      margin-bottom: 8px;
      line-height: 1.4;
    }
    .code-snippet {
      background: #0F172A;
      color: #F8FAFC;
      padding: 12px 16px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      overflow-x: auto;
      margin: 8px 0 0 0;
      line-height: 1.4;
    }
    .exemption-card {
      padding: 10px 14px;
      background: #F8FAFC;
      border: 1px dashed #CBD5E1;
      border-radius: 4px;
      margin-bottom: 8px;
      font-size: 12px;
      font-family: monospace;
    }

    /* Interactive C4 Component Inspector Drawer */
    .c4-inspector {
      position: fixed;
      top: 0;
      right: -460px;
      width: 440px;
      height: 100vh;
      background: #FFFFFF;
      border-left: 1px solid #CBD5E1;
      box-shadow: -8px 0 32px rgba(15, 23, 42, 0.16);
      z-index: 10005;
      transition: right 0.28s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      flex-direction: column;
      padding: 28px;
      overflow-y: auto;
    }
    .c4-inspector.open {
      right: 0;
    }
    .insp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .insp-badge {
      font-size: 11px;
      font-weight: 700;
      background: #EEF2FF;
      color: #3730A3;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .insp-title {
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
      margin: 8px 0 0 0;
    }
    .btn-close-insp {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      color: #475569;
      transition: all 0.15s ease;
    }
    .btn-close-insp:hover {
      background: #E2E8F0;
      color: #0F172A;
    }
    .insp-section {
      margin-bottom: 20px;
    }
    .insp-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748B;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .insp-value {
      font-size: 13px;
      font-weight: 600;
      color: #0F172A;
    }
    .insp-code {
      font-family: monospace;
      font-size: 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      padding: 6px 10px;
      border-radius: 4px;
      color: #1E293B;
      word-break: break-all;
    }
    .insp-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }
    .insp-item-pill {
      font-family: monospace;
      font-size: 12px;
      padding: 6px 10px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .insp-item-pill.drift {
      background: #FEF2F2;
      border-color: #FCA5A5;
      color: #991B1B;
      font-weight: 700;
    }
    .insp-item-pill.compliant {
      background: #F0FDF4;
      border-color: #86EFAC;
      color: #166534;
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #0F172A;
      color: #FFFFFF;
      padding: 10px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* ==========================================================================
       Web Motion Keyframes & Dynamic Fluid Effects
       ========================================================================== */
    @keyframes c4-flow-green {
      from { stroke-dashoffset: 20; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes c4-flow-drift {
      from { stroke-dashoffset: 26; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes c4-flow-planned {
      from { stroke-dashoffset: 16; }
      to { stroke-dashoffset: 0; }
    }
    @keyframes c4-drift-glow {
      0%, 100% {
        filter: drop-shadow(0 0 3px rgba(220, 38, 38, 0.45));
      }
      50% {
        filter: drop-shadow(0 0 10px rgba(220, 38, 38, 0.85));
      }
    }
    @keyframes c4-badge-pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.06);
      }
    }
    @keyframes c4-radar-ping {
      0% {
        r: 12px;
        opacity: 0.95;
        stroke-width: 3.5px;
      }
      50% {
        opacity: 0.5;
      }
      100% {
        r: 56px;
        opacity: 0;
        stroke-width: 1px;
      }
    }
    @keyframes c4-card-flash {
      0%, 100% {
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        border-color: #E2E8F0;
      }
      25%, 75% {
        box-shadow: 0 0 0 4px rgba(220, 38, 38, 0.25), 0 8px 24px rgba(220, 38, 38, 0.15);
        border-color: #DC2626;
      }
    }
    @keyframes stamp-alert-pulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
      }
      50% {
        box-shadow: 0 0 0 7px rgba(220, 38, 38, 0);
      }
    }
    @keyframes stamp-clean-shimmer {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.3);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(22, 163, 74, 0);
      }
    }

    /* Motion FX Controls & Reduced Motion Accessibility */
    body.motion-disabled * {
      animation: none !important;
      transition: none !important;
    }
    body.motion-disabled .c4-edge {
      animation: none !important;
    }
    body.motion-disabled .c4-radar-beacon {
      display: none !important;
    }
    body.motion-disabled .stamp {
      animation: none !important;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
      .c4-edge {
        animation: none !important;
      }
      .c4-radar-beacon {
        display: none !important;
      }
      .stamp {
        animation: none !important;
      }
    }
`;
}
