export interface ReportScriptOptions {
  violationsJson: string;
  graphDataJson: string;
  contractCompIdsJson: string;
  dependencyMapJson: string;
  i18nJson: string;
  lang: string;
  passed: boolean;
}

/**
 * Generates the complete, self-contained client-side interactive JavaScript for the Web Report.
 */
export function getReportScript(options: ReportScriptOptions): string {
  const {
    violationsJson,
    graphDataJson,
    contractCompIdsJson,
    dependencyMapJson,
    i18nJson,
    lang,
    passed,
  } = options;

  return `
    const violationsData = ${violationsJson};
    const GRAPH_DATA = ${graphDataJson};
    const contractCompIds = ${contractCompIdsJson};
    const dependencyMap = ${dependencyMapJson};
    const I18N = ${i18nJson};
    let currentLang = '${lang}';
    let currentLayoutMode = 'unified';
    let isContractsHidden = false;
    let currentSeverityFilter = 'all';
    let currentC4Level = 'container';
    let selectedContainerFilter = '';

    const viewStates = {
      unified: { scale: 1.0, x: 20, y: 20, isDragging: false, startX: 0, startY: 0 },
      target: { scale: 1.0, x: 20, y: 20, isDragging: false, startX: 0, startY: 0 },
      actual: { scale: 1.0, x: 20, y: 20, isDragging: false, startX: 0, startY: 0 }
    };

    window.addEventListener('load', function() {
      initPanZoom('unified');
      initPanZoom('target');
      initPanZoom('actual');

      setC4Level('container');

      // Delegated event handling for locate & copy-ai buttons
      document.addEventListener('click', function(e) {
        const locateBtn = e.target.closest('[data-action="locate"]');
        if (locateBtn) {
          const src = locateBtn.getAttribute('data-source-component') || '';
          const dst = locateBtn.getAttribute('data-target-component') || '';
          locateInDiagram(src, dst);
          return;
        }

        const copyBtn = e.target.closest('[data-action="copy-ai"]');
        if (copyBtn) {
          const idx = parseInt(copyBtn.getAttribute('data-index') || '0', 10);
          copyAiFixPrompt(idx);
          return;
        }
      });
    });

    function setC4Level(level) {
      currentC4Level = level;
      const btnContainer = document.getElementById('btn-level-container');
      const btnComponent = document.getElementById('btn-level-component');
      const filterBar = document.getElementById('container-filter-bar');

      if (level === 'container') {
        if (btnContainer) btnContainer.classList.add('active');
        if (btnComponent) btnComponent.classList.remove('active');
        if (filterBar) filterBar.style.display = 'none';

        ['unified', 'target', 'actual'].forEach(k => {
          const cv = document.getElementById(k + '-container-view');
          const mv = document.getElementById(k + '-component-view');
          if (cv) cv.style.display = 'block';
          if (mv) mv.style.display = 'none';
          fitDiagram(k);
        });
      } else {
        if (btnComponent) btnComponent.classList.add('active');
        if (btnContainer) btnContainer.classList.remove('active');
        if (filterBar) filterBar.style.display = 'flex';

        ['unified', 'target', 'actual'].forEach(k => {
          const cv = document.getElementById(k + '-container-view');
          const mv = document.getElementById(k + '-component-view');
          if (cv) cv.style.display = 'none';
          if (mv) mv.style.display = 'block';
          fitDiagram(k);
        });
      }
    }

    function drillDownContainer(containerId) {
      setC4Level('component');
      filterByContainer(containerId);
    }

    function filterByContainer(containerId) {
      selectedContainerFilter = containerId;
      document.querySelectorAll('.filter-chip').forEach(el => el.classList.remove('active'));
      const activeChip = containerId ? document.getElementById('chip-container-' + containerId) : document.getElementById('chip-all-containers');
      if (activeChip) activeChip.classList.add('active');

      ['unified', 'target', 'actual'].forEach(mode => {
        const svg = document.getElementById(mode + '-c4-svg');
        if (!svg) return;

        svg.querySelectorAll('.c4-container-group').forEach(cg => {
          const cId = cg.id.replace(mode + '-container-', '');
          if (!containerId || cId === containerId) {
            cg.style.display = '';
          } else {
            cg.style.display = 'none';
          }
        });

        svg.querySelectorAll('.c4-node').forEach(node => {
          const nodeContainer = node.getAttribute('data-container-id');
          if (!containerId || nodeContainer === containerId) {
            node.style.display = '';
          } else {
            node.style.display = 'none';
          }
        });

        svg.querySelectorAll('.c4-edge-group').forEach(edge => {
          const from = edge.getAttribute('data-from');
          const to = edge.getAttribute('data-to');
          if (!containerId) {
            edge.style.display = '';
          } else {
            const fromComp = GRAPH_DATA.nodes.find(n => n.id === from);
            const toComp = GRAPH_DATA.nodes.find(n => n.id === to);
            const fromCont = fromComp ? (fromComp.containerId || fromComp.layerId) : from;
            const toCont = toComp ? (toComp.containerId || toComp.layerId) : to;
            if (fromCont === containerId || toCont === containerId) {
              edge.style.display = '';
            } else {
              edge.style.display = 'none';
            }
          }
        });
      });
    }

    function initPanZoom(key) {
      const viewport = document.getElementById(key + '-viewport');
      if (!viewport) return;
      const state = viewStates[key];

      viewport.addEventListener('mousedown', function(e) {
        if (e.target.closest('button') || e.target.closest('select')) return;
        state.isDragging = true;
        state.startX = e.clientX - state.x;
        state.startY = e.clientY - state.y;
      });

      window.addEventListener('mousemove', function(e) {
        if (!state.isDragging) return;
        state.x = e.clientX - state.startX;
        state.y = e.clientY - state.startY;
        applyTransform(key);
      });

      window.addEventListener('mouseup', function() {
        state.isDragging = false;
      });

      viewport.addEventListener('wheel', function(e) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const newScale = Math.min(Math.max(state.scale * factor, 0.15), 3.5);

        state.x = mouseX - (mouseX - state.x) * (newScale / state.scale);
        state.y = mouseY - (mouseY - state.y) * (newScale / state.scale);
        state.scale = newScale;

        applyTransform(key);
      }, { passive: false });
    }

    function applyTransform(key) {
      const canvas = document.getElementById(key + '-canvas');
      const hud = document.getElementById(key + '-hud');
      const state = viewStates[key];
      if (canvas) {
        canvas.style.transform = "translate(" + state.x + "px, " + state.y + "px) scale(" + state.scale + ")";
      }
      if (hud) {
        hud.textContent = Math.round(state.scale * 100) + "%";
      }
    }

    function zoom(key, factor) {
      const viewport = document.getElementById(key + '-viewport');
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const state = viewStates[key];
      const newScale = Math.min(Math.max(state.scale * factor, 0.15), 3.5);

      state.x = cx - (cx - state.x) * (newScale / state.scale);
      state.y = cy - (cy - state.y) * (newScale / state.scale);
      state.scale = newScale;

      applyTransform(key);
    }

    function zoomTo(key, targetScale) {
      const viewport = document.getElementById(key + '-viewport');
      if (!viewport) return;
      const state = viewStates[key];
      state.scale = targetScale;
      state.x = 20;
      state.y = 20;
      applyTransform(key);
    }

    function fitDiagram(key) {
      const viewport = document.getElementById(key + '-viewport');
      const isContainer = currentC4Level === 'container';
      const svg = (isContainer ? document.getElementById(key + '-c4-container-svg') : null) || document.getElementById(key + '-c4-svg');
      if (!viewport || !svg) return;

      const vRect = viewport.getBoundingClientRect();
      const naturalW = svg.viewBox?.baseVal?.width || 1240;
      const naturalH = svg.viewBox?.baseVal?.height || 800;

      if (naturalW === 0 || naturalH === 0) return;

      const pad = 40;
      const availW = Math.max(vRect.width - pad * 2, 200);
      const availH = Math.max(vRect.height - pad * 2, 200);

      const scaleX = availW / naturalW;
      const scaleY = availH / naturalH;
      let fitScale = Math.min(scaleX, scaleY);
      if (fitScale < 0.65) {
        fitScale = 0.75;
      } else if (fitScale > 1.2) {
        fitScale = 1.0;
      }

      const state = viewStates[key];
      state.scale = fitScale;
      state.x = Math.max((vRect.width - naturalW * fitScale) / 2, 20);
      state.y = 20;

      applyTransform(key);
    }

    function setLayoutMode(mode) {
      currentLayoutMode = mode;
      const unifiedContainer = document.getElementById('unified-panel-container');
      const grid = document.getElementById('diagrams-grid');
      if (!unifiedContainer || !grid) return;

      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById('btn-mode-' + mode);
      if (activeBtn) activeBtn.classList.add('active');

      if (mode === 'unified') {
        unifiedContainer.style.display = 'block';
        grid.style.display = 'none';
        fitDiagram('unified');
      } else if (mode === 'side-by-side') {
        unifiedContainer.style.display = 'none';
        grid.style.display = 'grid';
        grid.className = 'grid-2';
        setTimeout(() => {
          fitDiagram('target');
          fitDiagram('actual');
        }, 50);
      } else if (mode === 'target') {
        unifiedContainer.style.display = 'none';
        grid.style.display = 'grid';
        grid.className = 'grid-2 tab-target';
        setTimeout(() => fitDiagram('target'), 50);
      } else if (mode === 'actual') {
        unifiedContainer.style.display = 'none';
        grid.style.display = 'grid';
        grid.className = 'grid-2 tab-actual';
        setTimeout(() => fitDiagram('actual'), 50);
      }
    }

    function toggleFullscreen(panelId) {
      const panel = document.getElementById(panelId);
      if (!panel) return;
      panel.classList.toggle('fullscreen');

      const isFs = panel.classList.contains('fullscreen');
      const key = panelId.startsWith('unified') ? 'unified' : (panelId.startsWith('target') ? 'target' : 'actual');

      setTimeout(() => fitDiagram(key), 100);
      if (isFs) {
        showToast(currentLang === 'zh' ? '按 Esc 键退出全屏' : 'Press Escape to exit fullscreen');
      }
    }

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeInspector();
        document.querySelectorAll('.diagram-panel.fullscreen').forEach(p => {
          p.classList.remove('fullscreen');
          const key = p.id.startsWith('unified') ? 'unified' : (p.id.startsWith('target') ? 'target' : 'actual');
          setTimeout(() => fitDiagram(key), 50);
        });
      }
    });

    // C4 Node Inspector
    function selectC4Node(nodeId) {
      const node = (GRAPH_DATA.nodes || []).find(n => n.id === nodeId);
      if (!node) return;

      // Sync dropdowns
      const selU = document.getElementById('comp-isolate-select-unified');
      const selA = document.getElementById('comp-isolate-select-actual');
      if (selU) selU.value = nodeId;
      if (selA) selA.value = nodeId;

      // Highlight in SVG
      const svgs = document.querySelectorAll('.diagram-viewport svg');
      const incomingEdges = (GRAPH_DATA.edges || []).filter(e => e.to === nodeId);
      const outgoingEdges = (GRAPH_DATA.edges || []).filter(e => e.from === nodeId);
      const relatedCompIds = new Set([nodeId, ...incomingEdges.map(e => e.from), ...outgoingEdges.map(e => e.to)]);

      svgs.forEach(svg => {
        svg.querySelectorAll('.c4-node').forEach(n => {
          const id = n.getAttribute('data-node-id');
          if (id === nodeId) {
            n.classList.add('selected');
            n.classList.remove('dimmed');
          } else if (relatedCompIds.has(id)) {
            n.classList.remove('dimmed', 'selected');
          } else {
            n.classList.add('dimmed');
            n.classList.remove('selected');
          }
        });

        svg.querySelectorAll('.c4-edge-group').forEach(e => {
          const from = e.getAttribute('data-from');
          const to = e.getAttribute('data-to');
          if (from === nodeId || to === nodeId) {
            e.classList.remove('dimmed');
            e.classList.add('highlighted');
          } else {
            e.classList.add('dimmed');
            e.classList.remove('highlighted');
          }
        });
      });

      // Populate Inspector Drawer
      document.getElementById('insp-container').textContent = node.layerName || node.containerName || 'CONTAINER';
      document.getElementById('insp-name').textContent = node.name || node.id;
      document.getElementById('insp-tech').textContent = node.technology || 'TypeScript';
      document.getElementById('insp-paths').textContent = (node.paths || []).join(', ') || 'N/A';

      // Inbound
      const inEl = document.getElementById('insp-incoming');
      document.getElementById('insp-incoming-count').textContent = incomingEdges.length;
      inEl.innerHTML = incomingEdges.length === 0
        ? '<div style="color: #94A3B8; font-size: 12px;">(No incoming calls)</div>'
        : incomingEdges.map(e => \`<div class="insp-item-pill \${e.status}"><span>\${e.from}</span><span>\${e.status === 'drift' ? '⚠ DRIFT' : '✓ OK'}</span></div>\`).join('');

      // Outbound
      const outEl = document.getElementById('insp-outgoing');
      document.getElementById('insp-outgoing-count').textContent = outgoingEdges.length;
      outEl.innerHTML = outgoingEdges.length === 0
        ? '<div style="color: #94A3B8; font-size: 12px;">(No outgoing calls)</div>'
        : outgoingEdges.map(e => \`<div class="insp-item-pill \${e.status}"><span>\${e.to}</span><span>\${e.status === 'drift' ? '⚠ DRIFT' : '✓ OK'}</span></div>\`).join('');

      // Violations
      const vEl = document.getElementById('insp-violations');
      const nodeViolations = violationsData.filter(v => v.sourceComponent === nodeId || v.targetComponent === nodeId);
      document.getElementById('insp-violations-count').textContent = nodeViolations.length;
      vEl.innerHTML = nodeViolations.length === 0
        ? \`<div style="color: #16A34A; font-size: 12px; font-weight: 600;">\${I18N[currentLang].inspectorNoViolations}</div>\`
        : nodeViolations.map(v => \`
          <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 4px; padding: 8px; margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 11px; color: #991B1B;">
              <span>[\${v.type}]</span>
              <span>\${v.sourceFile}:\${v.line}</span>
            </div>
            <div style="font-size: 12px; color: #1E293B; margin-top: 4px;">\${v.message}</div>
          </div>
        \`).join('');

      document.getElementById('c4-inspector').classList.add('open');
    }

    function closeInspector() {
      const insp = document.getElementById('c4-inspector');
      if (insp) insp.classList.remove('open');
      resetDiagramHighlight();
    }

    function resetDiagramHighlight() {
      const svgs = document.querySelectorAll('.diagram-viewport svg');
      svgs.forEach(svg => {
        svg.querySelectorAll('.c4-node').forEach(n => n.classList.remove('dimmed', 'selected', 'active-highlight'));
        svg.querySelectorAll('.c4-edge-group').forEach(e => e.classList.remove('dimmed', 'highlighted'));
      });

      const selU = document.getElementById('comp-isolate-select-unified');
      const selA = document.getElementById('comp-isolate-select-actual');
      if (selU) selU.value = '';
      if (selA) selA.value = '';

      const searchInput = document.getElementById('violationSearch');
      if (searchInput) {
        searchInput.value = '';
        applyFilters();
      }
    }

    function isolateComponent(compId) {
      if (!compId) {
        resetDiagramHighlight();
        return;
      }
      selectC4Node(compId);
    }

    function toggleContractEdges() {
      isContractsHidden = !isContractsHidden;
      const dict = I18N[currentLang];

      const btnU = document.getElementById('btn-toggle-contracts-unified');
      const label = isContractsHidden ? dict.btnShowContracts : dict.btnHideContracts;
      if (btnU) btnU.textContent = label;

      const svgs = document.querySelectorAll('.diagram-viewport svg');
      svgs.forEach(svg => {
        svg.querySelectorAll('.c4-edge-group').forEach(edge => {
          const to = edge.getAttribute('data-to') || '';
          if (contractCompIds.includes(to)) {
            edge.style.display = isContractsHidden ? 'none' : '';
          }
        });
      });

      showToast(isContractsHidden
        ? (currentLang === 'zh' ? '已过滤底层契约连线，图表清爽聚焦' : 'Foundation edges hidden for decluttering')
        : (currentLang === 'zh' ? '已恢复底层契约连线' : 'Foundation edges restored'));
    }

    function locateInDiagram(sourceComp, targetComp) {
      if (currentLayoutMode !== 'unified') {
        setLayoutMode('unified');
      }

      resetDiagramHighlight();

      const svg = document.getElementById('unified-c4-svg') || document.querySelector('.diagram-viewport svg');
      if (!svg) return;

      const srcNode = svg.querySelector(\`.c4-node[data-node-id="\${sourceComp}"]\`);
      const dstNode = svg.querySelector(\`.c4-node[data-node-id="\${targetComp}"]\`);

      svg.querySelectorAll('.c4-node').forEach(n => {
        const id = n.getAttribute('data-node-id');
        if (id === sourceComp || id === targetComp) {
          n.classList.add('active-highlight');
          n.classList.remove('dimmed');
        } else {
          n.classList.add('dimmed');
        }
      });

      svg.querySelectorAll('.c4-edge-group').forEach(e => {
        const from = e.getAttribute('data-from');
        const to = e.getAttribute('data-to');
        if (from === sourceComp && to === targetComp) {
          e.classList.add('highlighted');
          e.classList.remove('dimmed');
        } else {
          e.classList.add('dimmed');
        }
      });

      if (srcNode || dstNode) {
        const targetElement = srcNode || dstNode;
        const viewport = document.getElementById('unified-viewport');
        if (viewport && targetElement) {
          const vRect = viewport.getBoundingClientRect();
          const nRect = targetElement.getBoundingClientRect();
          const state = viewStates.unified;

          const nodeRelX = (nRect.left - vRect.left - state.x) / state.scale;
          const nodeRelY = (nRect.top - vRect.top - state.y) / state.scale;

          state.scale = 1.15;
          state.x = vRect.width / 2 - nodeRelX * state.scale;
          state.y = vRect.height / 2 - nodeRelY * state.scale;
          applyTransform('unified');
        }

        const panel = document.getElementById('unified-panel');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }

      showToast(currentLang === 'zh'
        ? \`已定位偏航违规: \${sourceComp} ➔ \${targetComp}\`
        : \`Focused drift violation: \${sourceComp} ➔ \${targetComp}\`);
    }

    function toggleLanguage() {
      currentLang = currentLang === 'zh' ? 'en' : 'zh';
      const dict = I18N[currentLang];

      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
      });

      const searchInput = document.getElementById('violationSearch');
      if (searchInput && dict.searchPlaceholder) {
        searchInput.placeholder = dict.searchPlaceholder;
      }

      const langBtn = document.getElementById('btn-lang-toggle');
      if (langBtn) {
        langBtn.textContent = dict.langToggle;
      }

      const stamp = document.getElementById('status-stamp');
      if (stamp) {
        if (${passed}) {
          stamp.textContent = dict.statusVerified;
        } else {
          stamp.textContent = dict.statusDrift.replace('{n}', violationsData.length);
        }
      }

      const contractBtnUnified = document.getElementById('btn-toggle-contracts-unified');
      if (contractBtnUnified) {
        contractBtnUnified.textContent = isContractsHidden ? dict.btnShowContracts : dict.btnHideContracts;
      }

      showToast(currentLang === 'zh' ? '已切换为中文显示' : 'Language switched to English');
    }

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

      const isZh = currentLang === 'zh';
      const prompt = isZh ? [
        "请修复 SextantDrift 确凿检测到的以下架构违规偏航：",
        "",
        "## 架构违规详情",
        "- 违规类型: " + v.type + " (严重级别: " + v.severity + ")",
        "- 源码位置: " + v.sourceFile + ":" + v.line + ":" + v.column,
        "- 违规调用路径: " + (v.sourceComponent || 'N/A') + " -> " + (v.targetComponent || 'N/A'),
        "- 诊断原因: " + v.message,
        v.suggestion ? "- 修复指导: " + v.suggestion : "",
        "",
        "## 违规代码片段",
        "\`\`\`ts",
        v.snippet || "// (无可用代码片段)",
        "\`\`\`",
        "",
        "## 重构任务要求",
        "请严格依据项目 AGENTS.md / sextant.json 的 C4 分层架构约束进行重构。严禁跨层直接旁路或逆向依赖，必须通过指定的领域服务层解耦，确保重构后执行 npx sextant-drift check 零违规通过。",
      ].filter(Boolean).join('\\n') : [
        "Please fix the following architectural drift detected by SextantDrift:",
        "",
        "## Architectural Violation Details",
        "- Type: " + v.type + " (" + v.severity + ")",
        "- Location: " + v.sourceFile + ":" + v.line + ":" + v.column,
        "- Offending Flow: " + (v.sourceComponent || 'N/A') + " -> " + (v.targetComponent || 'N/A'),
        "- Diagnostic Message: " + v.message,
        v.suggestion ? "- Remediation: " + v.suggestion : "",
        "",
        "## Offending Code Snippet",
        "\`\`\`ts",
        v.snippet || "// (No snippet available)",
        "\`\`\`",
        "",
        "## Task Instructions",
        "Refactor this code to strictly eliminate the architectural bypass/inversion according to target architecture rules in AGENTS.md / sextant.json. Route dependencies through designated domain services.",
      ].filter(Boolean).join('\\n');

      navigator.clipboard.writeText(prompt).then(() => {
        showToast(isZh ? "✔ 已成功复制 AI 修复 Prompt 到剪贴板！" : "✔ AI Fix Prompt copied to clipboard!");
      }).catch(() => {
        promptFallback(prompt);
      });
    }

    function promptFallback(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand('copy');
        showToast(currentLang === 'zh' ? "✔ 已成功复制到剪贴板！" : "✔ Copied to clipboard!");
      } catch (err) {
        showToast(currentLang === 'zh' ? "请手动选中复制" : "Please copy manually");
      }
      document.body.removeChild(ta);
    }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2400);
    }

    // Expose functions globally for backward-compatibility with inline handlers
    window.setC4Level = setC4Level;
    window.drillDownContainer = drillDownContainer;
    window.filterByContainer = filterByContainer;
    window.zoom = zoom;
    window.zoomTo = zoomTo;
    window.fitDiagram = fitDiagram;
    window.setLayoutMode = setLayoutMode;
    window.toggleFullscreen = toggleFullscreen;
    window.selectC4Node = selectC4Node;
    window.closeInspector = closeInspector;
    window.resetDiagramHighlight = resetDiagramHighlight;
    window.isolateComponent = isolateComponent;
    window.toggleContractEdges = toggleContractEdges;
    window.locateInDiagram = locateInDiagram;
    window.toggleLanguage = toggleLanguage;
    window.setFilter = setFilter;
    window.applyFilters = applyFilters;
    window.copyAiFixPrompt = copyAiFixPrompt;
`;
}
