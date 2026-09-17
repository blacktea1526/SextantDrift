import fs from 'node:fs';
import path from 'node:path';
import {
  ViolationEvidence,
  BaselineData,
  BaselineFingerprint,
} from '../types/report.js';
import {
  computeViolationFingerprint,
  createBaselineFingerprint,
} from './fingerprint.js';
import { ConfigValidationError } from '../errors/config-error.js';

export const DEFAULT_BASELINE_FILENAME = '.sextant/baseline.json';

export interface BaselineDiffResult {
  newViolations: ViolationEvidence[];
  exemptions: ViolationEvidence[];
  resolvedFingerprints: string[];
}

/**
 * Loads baseline data from the specified path or returns null if the file does not exist.
 */
export function loadBaseline(baselineFilePath: string): BaselineData | null {
  const resolvedPath = path.resolve(baselineFilePath);
  if (!fs.existsSync(resolvedPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(resolvedPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.fingerprints)) {
      throw new ConfigValidationError(
        `Invalid baseline format in "${baselineFilePath}": expected "fingerprints" array.`,
        { field: 'fingerprints' }
      );
    }

    return {
      version: parsed.version || '1.0.0',
      generatedAt: parsed.generatedAt || new Date().toISOString(),
      totalExemptions: parsed.fingerprints.length,
      fingerprints: parsed.fingerprints,
    };
  } catch (err: any) {
    if (err instanceof ConfigValidationError) {
      throw err;
    }
    throw new ConfigValidationError(
      `Failed to parse baseline file "${baselineFilePath}": ${err.message}`
    );
  }
}

/**
 * Saves current violations into a baseline JSON file, computing semantic fingerprints.
 */
export function saveBaseline(
  baselineFilePath: string,
  violations: ViolationEvidence[]
): BaselineData {
  const resolvedPath = path.resolve(baselineFilePath);
  const dir = path.dirname(resolvedPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Deduplicate by hash
  const seenHashes = new Set<string>();
  const fingerprints: BaselineFingerprint[] = [];

  for (const v of violations) {
    const fp = createBaselineFingerprint(v);
    if (!seenHashes.has(fp.hash)) {
      seenHashes.add(fp.hash);
      fingerprints.push(fp);
    }
  }

  const baselineData: BaselineData = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalExemptions: fingerprints.length,
    fingerprints,
  };

  fs.writeFileSync(resolvedPath, JSON.stringify(baselineData, null, 2), 'utf-8');
  return baselineData;
}

/**
 * Evaluates current violations against baseline exemptions.
 * Partitions violations into new violations (drifts) and exempted violations.
 * Also detects any historical debts in baseline that have been resolved.
 */
export function diffWithBaseline(
  violations: ViolationEvidence[],
  baseline: BaselineData | null
): BaselineDiffResult {
  if (!baseline || baseline.fingerprints.length === 0) {
    // Ensure each violation has its fingerprint computed
    for (const v of violations) {
      if (!v.fingerprint) {
        v.fingerprint = computeViolationFingerprint(v);
      }
    }
    return {
      newViolations: violations,
      exemptions: [],
      resolvedFingerprints: [],
    };
  }

  const baselineMap = new Map<string, BaselineFingerprint>();
  for (const fp of baseline.fingerprints) {
    baselineMap.set(fp.hash, fp);
  }

  const matchedHashes = new Set<string>();
  const newViolations: ViolationEvidence[] = [];
  const exemptions: ViolationEvidence[] = [];

  for (const v of violations) {
    if (!v.fingerprint) {
      v.fingerprint = computeViolationFingerprint(v);
    }

    if (baselineMap.has(v.fingerprint)) {
      matchedHashes.add(v.fingerprint);
      exemptions.push(v);
    } else {
      newViolations.push(v);
    }
  }

  // Find baseline hashes that were not matched by any current violation
  const resolvedFingerprints: string[] = [];
  for (const hash of baselineMap.keys()) {
    if (!matchedHashes.has(hash)) {
      resolvedFingerprints.push(hash);
    }
  }

  return {
    newViolations,
    exemptions,
    resolvedFingerprints,
  };
}
