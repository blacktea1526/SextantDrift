import { DriftReport } from '@sextant/core';
import { renderHtmlTemplate } from './template.js';

/**
 * Generates an offline-capable, self-contained dual-diagram HTML inspection report.
 */
export function generateHtmlReport(report: DriftReport): string {
  return renderHtmlTemplate(report);
}

export * from './template.js';
