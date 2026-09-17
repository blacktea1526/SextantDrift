import { DriftReport } from '@sextant/core';

/**
 * Formats DriftReport into a clean, machine-readable JSON string.
 */
export function formatJsonReport(report: DriftReport): string {
  return JSON.stringify(report, null, 2);
}
