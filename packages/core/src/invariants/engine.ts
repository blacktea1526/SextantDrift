import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { InvariantRule } from '../types/architecture.js';
import { ViolationEvidence } from '../types/report.js';
import { matchSequenceInvariants, matchesScope } from './sequence-matcher.js';
import { matchImportInvariants } from './import-matcher.js';
import { matchConfigInvariants } from './config-matcher.js';

export interface InvariantsEngineOptions {
  rootDir: string;
  filePaths: string[];
  rules: InvariantRule[];
  fileContentMap?: Map<string, string>;
  sourceFilesMap?: Map<string, ts.SourceFile>;
}

/**
 * Orchestrates invariant rule matching across source files.
 * Optimizes performance by parsing AST once per file and dispatching to
 * sequence-matcher, import-matcher, and config-matcher.
 */
export function executeInvariantsEngine(options: InvariantsEngineOptions): ViolationEvidence[] {
  const { rootDir, rules, fileContentMap, sourceFilesMap } = options;
  const filePaths = options.filePaths ?? (options as unknown as { files?: string[] }).files ?? [];

  if (!rules || rules.length === 0 || !filePaths || filePaths.length === 0) {
    return [];
  }

  // Group rules by capability
  const sequenceRules = rules.filter(
    (r) =>
      Boolean(r.pattern.must_precede && r.pattern.must_precede.length > 0 && r.pattern.target && r.pattern.target.length > 0)
  );
  const importRules = rules.filter(
    (r) => Boolean(r.pattern.forbid_import && r.pattern.forbid_import.length > 0)
  );
  const configRules = rules.filter(
    (r) => Boolean(r.pattern.require_config && r.pattern.require_config.length > 0)
  );

  // If no executable rules in any category, return early
  if (sequenceRules.length === 0 && importRules.length === 0 && configRules.length === 0) {
    return [];
  }

  const violations: ViolationEvidence[] = [];

  for (const relPath of filePaths) {
    // 0. Scope pre-filter: skip files that do not match ANY invariant rule
    const matchesAnyRule = rules.some((rule) => {
      if (rule.pattern.scope && !matchesScope(relPath, rule.pattern.scope)) {
        return false;
      }
      if (rule.pattern.in_path && !matchesScope(relPath, rule.pattern.in_path)) {
        return false;
      }
      return true;
    });

    if (!matchesAnyRule) {
      continue;
    }

    // Reuse cached AST if available in sourceFilesMap
    let sourceFile: ts.SourceFile | undefined = sourceFilesMap?.get(relPath);

    if (!sourceFile) {
      let content: string | undefined;

      if (fileContentMap?.has(relPath)) {
        content = fileContentMap.get(relPath);
      } else {
        const fullPath = path.isAbsolute(relPath) ? relPath : path.resolve(rootDir, relPath);
        if (!fs.existsSync(fullPath)) {
          continue;
        }
        try {
          content = fs.readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }
      }

      if (content === undefined) {
        continue;
      }

      sourceFile = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true);
      if (sourceFilesMap) {
        sourceFilesMap.set(relPath, sourceFile);
      }
    }

    // 1. AST Sequence invariants (must_precede)
    if (sequenceRules.length > 0) {
      const seqViolations = matchSequenceInvariants(sourceFile, relPath, sequenceRules);
      violations.push(...seqViolations);
    }

    // 2. AST Import invariants (forbid_import)
    if (importRules.length > 0) {
      const impViolations = matchImportInvariants(sourceFile, relPath, importRules);
      violations.push(...impViolations);
    }

    // 3. AST Config invariants (require_config)
    if (configRules.length > 0) {
      const cfgViolations = matchConfigInvariants(sourceFile, relPath, configRules);
      violations.push(...cfgViolations);
    }
  }

  return violations;
}
