declare module '@sextant/web-report' {
  import type { DriftReport } from '@sextant/core';

  export interface RenderOptions {
    lang?: 'zh' | 'en';
  }

  export function generateHtmlReport(report: DriftReport, options?: RenderOptions): string;
}
