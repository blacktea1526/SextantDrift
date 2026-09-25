export type Lang = 'zh' | 'en';

export interface Translations {
  appName: string;
  appSubtitle: string;
  metaReport: string;
  statusVerified: string;
  statusDrift: string;
  statViolations: string;
  statCritical: string;
  statWarning: string;
  statExemptions: string;
  statComponents: string;
  statLayers: string;
  statDuration: string;
  tabUnified: string;
  tabTarget: string;
  tabActual: string;
  tabSideBySide: string;
  unifiedHint: string;
  targetHint: string;
  actualHint: string;
  btnHideContracts: string;
  btnShowContracts: string;
  btnResetFocus: string;
  selectComponent: string;
  allComponents: string;
  filterAll: string;
  filterCritical: string;
  filterWarning: string;
  searchPlaceholder: string;
  violationsTitle: string;
  noViolations: string;
  ruleLabel: string;
  fixSuggestion: string;
  btnCopyEvidence: string;
  btnFocusGraph: string;
  copied: string;
  exportJson: string;
  langToggle: string;
  flowArrow: string;
  legendGreen: string;
  legendRed: string;
  legendGrey: string;
  inspectorTitle: string;
  inspectorClose: string;
  inspectorTech: string;
  inspectorContainer: string;
  inspectorPaths: string;
  inspectorIncoming: string;
  inspectorOutgoing: string;
  inspectorViolations: string;
  inspectorNoViolations: string;
  c4Badge: string;
  viewLevelL2: string;
  viewLevelL3: string;
  filterByContainer: string;
  allContainers: string;
  drillDownHint: string;
  btnMotion: string;
  btnMotionOn: string;
  btnMotionOff: string;
  motionToggledOn: string;
  motionToggledOff: string;
  /* Overview analytics */
  overviewTitle: string;
  overviewSeverity: string;
  overviewCategories: string;
  overviewVisibility: string;
  overviewVisibilityHint: string;
  statCoverage: string;
  severityTotalLabel: string;
  severityCriticalShort: string;
  severityWarningShort: string;
  noCategories: string;
  noSeverityData: string;
  visBlueprint: string;
  visUntraced: string;
  visUnresolved: string;
  /* Violation category labels */
  typeBypass: string;
  typeInversion: string;
  typeCycle: string;
  typeForbiddenImport: string;
  typeInvariantBroken: string;
  typeStateDeadlock: string;
  typeStateUnreachable: string;
  typeStateMissingFallback: string;
  typeDynamicOutOfOrder: string;
  typeDynamicUnexpectedCall: string;
  typeDynamicMissingCall: string;
  typeContractMissingEndpoint: string;
  typeContractShadowEndpoint: string;
  typeContractMissingParam: string;
  typeContractUnhandledStatus: string;
  typeContractLintError: string;
  typeWarnUnresolvedImport: string;
  typeWarnPartialBarrel: string;
  typeWarnRuleMissingTarget: string;
}

export const I18N_DICTIONARIES: Record<Lang, Translations> = {
  zh: {
    appName: 'SextantDrift 架构偏航罗盘',
    appSubtitle: '确定性 AST 依赖拓扑与语义不变量差分审查台',
    metaReport: '架构差分审查报告',
    statusVerified: '架构验证通过（零偏航）',
    statusDrift: '发现 {n} 处架构偏航与违规',
    statViolations: '条违规项',
    statCritical: '严重违规',
    statWarning: '警告提示',
    statExemptions: '豁免放行',
    statComponents: '组件总数',
    statLayers: '架构分层',
    statDuration: '分析耗时',
    tabUnified: '🌟 规划与现实同图差分',
    tabTarget: '📐 设计规划图 (Target)',
    tabActual: '⚡ 实际代码图 (Actual)',
    tabSideBySide: '双屏左右并排 (Side-by-Side)',
    viewLevelL2: '🏢 容器分层全景 (Level 2)',
    viewLevelL3: '🧩 组件拓扑下钻 (Level 3)',
    filterByContainer: '按容器分层隔离:',
    allContainers: '全部容器 (All)',
    drillDownHint: '💡 提示：点击容器卡片可一键下钻查看该容器内部组件与依赖关系',
    unifiedHint: '实线绿箭：符合规划链路 | 粗红虚线：越界偏航 (DRIFT!) | 细灰虚线：规划允许但代码未调用的链路',
    targetHint: '设计意图与合法调用流向规范（源自 sextant.json / AGENTS.md）',
    actualHint: '从 TypeScript AST 确凿静态分析提取出的客观代码依赖拓扑',
    btnHideContracts: '📐 过滤底层契约连线',
    btnShowContracts: '📐 显示底层契约连线',
    btnResetFocus: '↺ 重置拓扑聚焦',
    selectComponent: '🎯 聚焦指定组件...',
    allComponents: '全部组件',
    filterAll: '全部违规',
    filterCritical: '仅看严重 (Critical)',
    filterWarning: '仅看警告 (Warning)',
    searchPlaceholder: '快速搜索文件路径、组件、违规规则、提示...',
    violationsTitle: '偏航违规诊断与修复建议',
    noViolations: '✔ 所有代码模块依赖均严格符合目标架构拓扑与不变量规范。',
    ruleLabel: '违规规则',
    fixSuggestion: '修复建议与整改指引',
    btnCopyEvidence: '📋 复制证据',
    btnFocusGraph: '🎯 图中定位',
    copied: '已复制到剪贴板！',
    exportJson: '💾 导出审计证据 JSON',
    langToggle: '🌐 English',
    flowArrow: '➔',
    legendGreen: '合规允许链路',
    legendRed: '架构偏航违规',
    legendGrey: '规划中链路',
    inspectorTitle: 'C4 架构组件审查面板',
    inspectorClose: '关闭',
    inspectorTech: '技术栈',
    inspectorContainer: '所属容器 / 分层',
    inspectorPaths: '映射源码路径',
    inspectorIncoming: '入向调用 (被依赖)',
    inspectorOutgoing: '出向调用 (依赖)',
    inspectorViolations: '关联违规证据',
    inspectorNoViolations: '未检出任何架构违规 (合规)',
    c4Badge: 'C4 架构模型',
    btnMotion: '⚡ 动效',
    btnMotionOn: '⚡ 动效: 开启',
    btnMotionOff: '⚡ 动效: 暂停',
    motionToggledOn: '已启用架构动态流向与平滑运镜',
    motionToggledOff: '已切换为极简静态模式',
    overviewTitle: '架构体检总览',
    overviewSeverity: '违规严重度构成',
    overviewCategories: '违规类型分布',
    overviewVisibility: '代码可见度覆盖',
    overviewVisibilityHint: '按确凿 AST 映射结果统计，非估算值',
    statCoverage: '映射覆盖',
    severityTotalLabel: '违规总数',
    severityCriticalShort: '阻断',
    severityWarningShort: '警告',
    noCategories: '零违规，无需归类',
    noSeverityData: '零偏航，无需统计',
    visBlueprint: '已映射至蓝图',
    visUntraced: '未纳入架构追踪',
    visUnresolved: '导入未解析',
    typeBypass: '跨层旁路',
    typeInversion: '逆向依赖',
    typeCycle: '循环依赖',
    typeForbiddenImport: '违禁导入',
    typeInvariantBroken: '不变量违背',
    typeStateDeadlock: '状态机死锁',
    typeStateUnreachable: '状态孤岛不可达',
    typeStateMissingFallback: '缺失降级回路',
    typeDynamicOutOfOrder: '运行时时序倒置',
    typeDynamicUnexpectedCall: '运行时意外调用',
    typeDynamicMissingCall: '运行时缺失调用',
    typeContractMissingEndpoint: '契约缺失端点',
    typeContractShadowEndpoint: '契约影子端点',
    typeContractMissingParam: '契约缺失参数',
    typeContractUnhandledStatus: '契约未处理状态码',
    typeContractLintError: '契约校验错误',
    typeWarnUnresolvedImport: '导入未解析',
    typeWarnPartialBarrel: 'Barrel 部分解析',
    typeWarnRuleMissingTarget: '规则缺少目标',
  },
  en: {
    appName: 'SextantDrift Architecture Compass',
    appSubtitle: 'Deterministic AST Topology & Invariant Inspection Workbench',
    metaReport: 'Architecture Drift Report',
    statusVerified: 'ARCHITECTURE VERIFIED',
    statusDrift: '{n} ARCHITECTURAL DRIFT(S) DETECTED',
    statViolations: 'Violations',
    statCritical: 'Critical',
    statWarning: 'Warning',
    statExemptions: 'Exemptions',
    statComponents: 'Components',
    statLayers: 'Layers',
    statDuration: 'Duration',
    tabUnified: '🌟 Unified Overlay Diff',
    tabTarget: '📐 Target Architecture (Intent)',
    tabActual: '⚡ Actual Topology (Reality)',
    tabSideBySide: 'Side-by-Side Dual View',
    viewLevelL2: '🏢 Container Overview (Level 2)',
    viewLevelL3: '🧩 Component Detail (Level 3)',
    filterByContainer: 'Filter by Container:',
    allContainers: 'All Containers',
    drillDownHint: '💡 Tip: Click any container card to drill down into its internal components',
    unifiedHint: 'Solid Green: Compliant Path | Bold Red Dashed: Drift Violation | Grey Dashed: Planned but Unused Path',
    targetHint: 'Design intent and allowed flow specifications (defined by sextant.json / AGENTS.md)',
    actualHint: 'Objective component dependency topology extracted from TypeScript AST',
    btnHideContracts: '📐 Filter Foundation Edges',
    btnShowContracts: '📐 Show Foundation Edges',
    btnResetFocus: '↺ Reset Graph Focus',
    selectComponent: '🎯 Focus Component...',
    allComponents: 'All Components',
    filterAll: 'All Violations',
    filterCritical: 'Critical Only',
    filterWarning: 'Warning Only',
    searchPlaceholder: 'Filter by file, component, rule, message...',
    violationsTitle: 'Drift Violations & Guidance',
    noViolations: '✔ All modules and dependencies conform strictly to target topology and invariants.',
    ruleLabel: 'Rule',
    fixSuggestion: 'Fix Guidance',
    btnCopyEvidence: '📋 Copy Evidence',
    btnFocusGraph: '🎯 Focus in Graph',
    copied: 'Copied to clipboard!',
    exportJson: '💾 Export Evidence JSON',
    langToggle: '🌐 中文',
    flowArrow: '➔',
    legendGreen: 'Compliant Path',
    legendRed: 'Drift Violation',
    legendGrey: 'Planned Path',
    inspectorTitle: 'C4 Component Inspector',
    inspectorClose: 'Close',
    inspectorTech: 'Technology',
    inspectorContainer: 'Container / Layer',
    inspectorPaths: 'Mapped Paths',
    inspectorIncoming: 'Incoming Dependencies',
    inspectorOutgoing: 'Outgoing Dependencies',
    inspectorViolations: 'Related Violations',
    inspectorNoViolations: 'No architectural violations detected (Compliant)',
    c4Badge: 'C4 Model',
    btnMotion: '⚡ Motion',
    btnMotionOn: '⚡ Motion: ON',
    btnMotionOff: '⚡ Motion: OFF',
    motionToggledOn: 'Dynamic topology flow & smooth camera enabled',
    motionToggledOff: 'Static rendering mode enabled',
    overviewTitle: 'Architecture Health Overview',
    overviewSeverity: 'Severity Composition',
    overviewCategories: 'Violation Categories',
    overviewVisibility: 'Code Visibility Coverage',
    overviewVisibilityHint: 'Exact counts from AST mapping — never an estimate',
    statCoverage: 'Coverage',
    severityTotalLabel: 'Violations',
    severityCriticalShort: 'Critical',
    severityWarningShort: 'Warning',
    noCategories: 'Zero violations to classify',
    noSeverityData: 'Zero drift, nothing to plot',
    visBlueprint: 'Mapped into blueprint',
    visUntraced: 'Outside architecture tracing',
    visUnresolved: 'Unresolved imports',
    typeBypass: 'Layer Bypass',
    typeInversion: 'Layer Inversion',
    typeCycle: 'Circular Dependency',
    typeForbiddenImport: 'Forbidden Import',
    typeInvariantBroken: 'Invariant Broken',
    typeStateDeadlock: 'State Deadlock',
    typeStateUnreachable: 'Unreachable State',
    typeStateMissingFallback: 'Missing Fallback',
    typeDynamicOutOfOrder: 'Dynamic Out Of Order',
    typeDynamicUnexpectedCall: 'Dynamic Unexpected Call',
    typeDynamicMissingCall: 'Dynamic Missing Call',
    typeContractMissingEndpoint: 'Contract Missing Endpoint',
    typeContractShadowEndpoint: 'Contract Shadow Endpoint',
    typeContractMissingParam: 'Contract Missing Param',
    typeContractUnhandledStatus: 'Contract Unhandled Status',
    typeContractLintError: 'Contract Lint Error',
    typeWarnUnresolvedImport: 'Unresolved Import',
    typeWarnPartialBarrel: 'Partial Barrel Resolution',
    typeWarnRuleMissingTarget: 'Rule Missing Target',
  },
};

export function getTranslations(lang: Lang = 'zh'): Translations {
  return I18N_DICTIONARIES[lang] || I18N_DICTIONARIES.zh;
}
