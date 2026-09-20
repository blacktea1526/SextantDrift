import { DriftReport } from '@sextant/core';
import { renderHtmlTemplate, RenderOptions } from './template.js';

export { SEXTANT_LOGO_SVG } from './assets/logo.js';
export { I18N_DICTIONARIES, getTranslations, type Lang } from './i18n.js';
export * from './template.js';

/**
 * Generates an offline-capable, self-contained dual-diagram HTML inspection report.
 * Supports native multi-language display (defaulting to Chinese 'zh').
 */
export function generateHtmlReport(report: DriftReport, options?: RenderOptions): string {
  return renderHtmlTemplate(report, options);
}
