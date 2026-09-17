import crypto from 'node:crypto';
import { ViolationEvidence, BaselineFingerprint } from '../types/report.js';

/**
 * Normalizes code snippets or expressions by collapsing multiple whitespace
 * characters, trims leading/trailing spaces, and removes line breaks.
 * Ensures formatting changes (e.g. Prettier, single vs double spaces)
 * do not alter the semantic fingerprint.
 */
export function normalizeSnippet(snippet: string): string {
  if (!snippet) return '';
  return snippet
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes relative file paths to standard POSIX style forward slashes.
 */
export function normalizeFilePath(filePath: string): string {
  if (!filePath) return '';
  return filePath.split('\\').join('/').replace(/^(\.\/|\/)/, '');
}

/**
 * Computes a deterministic, formatting-immune SHA-256 AST semantic fingerprint
 * according to ADR-006:
 *
 * 1. Module / Component violations (Bypass, Inversion, Cycle):
 *    Fingerprint = SHA256(CallerComponent + "->" + CalleeComponent + ":" + NormalizedSnippet + ":" + ViolationType)
 *
 * 2. Invariant violations (must_precede, require_config, forbid_import):
 *    Fingerprint = SHA256(NormalizedFilePath + ":" + EnclosingFunction + ":" + TargetCall + ":" + RuleId)
 */
export function computeViolationFingerprint(violation: ViolationEvidence): string {
  const normFile = normalizeFilePath(violation.sourceFile);
  const normSnippet = normalizeSnippet(violation.snippet);

  let rawKey: string;

  if (violation.type === 'INVARIANT_BROKEN') {
    const enclosing = violation.enclosingFunction || '<top_level>';
    const target = violation.targetCall || normSnippet;
    const rule = violation.ruleId || 'INVARIANT';
    rawKey = `INVARIANT:${normFile}:${enclosing}:${target}:${rule}`;
  } else if (violation.type === 'CRITICAL_BYPASS' || violation.type === 'CRITICAL_INVERSION') {
    const caller = violation.sourceComponent || 'UNKNOWN';
    const callee = violation.targetComponent || 'UNKNOWN';
    rawKey = `${violation.type}:${caller}->${callee}:${normSnippet}`;
  } else if (violation.type === 'CRITICAL_CYCLE') {
    const cycleNodes = violation.cycle && violation.cycle.length > 0
      ? violation.cycle.join('->')
      : violation.message;
    rawKey = `CRITICAL_CYCLE:${cycleNodes}`;
  } else if (violation.type === 'CRITICAL_FORBIDDEN_IMPORT') {
    rawKey = `CRITICAL_FORBIDDEN_IMPORT:${normFile}:${normSnippet}`;
  } else {
    rawKey = `${violation.type}:${normFile}:${normSnippet}`;
  }

  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Creates a structured BaselineFingerprint object ready for persistence in baseline.json.
 */
export function createBaselineFingerprint(violation: ViolationEvidence): BaselineFingerprint {
  const hash = violation.fingerprint || computeViolationFingerprint(violation);
  return {
    hash,
    type: violation.type,
    sourceComponent: violation.sourceComponent,
    targetComponent: violation.targetComponent,
    sourceFile: normalizeFilePath(violation.sourceFile),
    enclosingFunction: violation.enclosingFunction,
    targetCall: violation.targetCall,
    ruleId: violation.ruleId,
    description: violation.message,
  };
}
