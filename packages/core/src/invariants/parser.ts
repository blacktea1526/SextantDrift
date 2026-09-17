import YAML from 'yaml';
import { InvariantRule, InvariantPattern } from '../types/architecture.js';
import { ConfigSyntaxError, ConfigValidationError } from '../errors/config-error.js';

function parseStringOrStringArray(
  val: unknown,
  fieldName: string,
  ruleId: string,
  fieldPath: string
): string[] {
  if (typeof val === 'string' && val.trim()) {
    return [val.trim()];
  }
  if (
    Array.isArray(val) &&
    val.length > 0 &&
    val.every((item) => typeof item === 'string' && item.trim())
  ) {
    return val.map((item) => (item as string).trim());
  }
  throw new ConfigValidationError(
    `Invariant rule "${ruleId}" pattern.${fieldName} must be a non-empty string or non-empty array of strings`,
    { field: fieldPath }
  );
}

/**
 * Validates and normalizes an array of raw invariant rules.
 * Throws ConfigValidationError if any rule violates the schema.
 */
export function parseInvariantRules(rules: unknown): InvariantRule[] {
  if (!Array.isArray(rules)) {
    throw new ConfigValidationError('Invariants spec must be an array of rules', {
      field: 'invariants',
    });
  }

  const seenIds = new Set<string>();
  const validSeverities = new Set(['critical', 'warning', 'info']);
  const result: InvariantRule[] = [];

  for (let i = 0; i < rules.length; i++) {
    const item = rules[i];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ConfigValidationError(`Invariant rule at index ${i} must be an object`, {
        field: `invariants[${i}]`,
      });
    }

    const { id, severity, desc, pattern } = item as Record<string, unknown>;

    if (typeof id !== 'string' || !id.trim()) {
      throw new ConfigValidationError(
        `Invariant rule at index ${i} must have a non-empty string "id"`,
        { field: `invariants[${i}].id` }
      );
    }
    const trimmedId = id.trim();
    if (seenIds.has(trimmedId)) {
      throw new ConfigValidationError(`Duplicate invariant rule id "${trimmedId}" found`, {
        field: `invariants[${i}].id`,
      });
    }
    seenIds.add(trimmedId);

    if (typeof severity !== 'string' || !validSeverities.has(severity)) {
      throw new ConfigValidationError(
        `Invariant rule "${trimmedId}" must have severity of 'critical', 'warning', or 'info'`,
        { field: `invariants[${i}].severity` }
      );
    }

    if (typeof desc !== 'string' || !desc.trim()) {
      throw new ConfigValidationError(
        `Invariant rule "${trimmedId}" must have a non-empty string "desc"`,
        { field: `invariants[${i}].desc` }
      );
    }

    if (typeof pattern !== 'object' || pattern === null || Array.isArray(pattern)) {
      throw new ConfigValidationError(
        `Invariant rule "${trimmedId}" must define a "pattern" object`,
        { field: `invariants[${i}].pattern` }
      );
    }

    const pat = pattern as Record<string, unknown>;
    const hasMustPrecede = pat.must_precede !== undefined;
    const hasForbidImport = pat.forbid_import !== undefined;
    const hasRequireConfig = pat.require_config !== undefined;

    if (!hasMustPrecede && !hasForbidImport && !hasRequireConfig) {
      throw new ConfigValidationError(
        `Invariant rule "${trimmedId}" pattern must specify at least one of "must_precede", "forbid_import", or "require_config"`,
        { field: `invariants[${i}].pattern` }
      );
    }

    const invariantPattern: InvariantPattern = {};

    if (hasMustPrecede) {
      invariantPattern.must_precede = parseStringOrStringArray(
        pat.must_precede,
        'must_precede',
        trimmedId,
        `invariants[${i}].pattern.must_precede`
      );
    }

    if (pat.target !== undefined) {
      invariantPattern.target = parseStringOrStringArray(
        pat.target,
        'target',
        trimmedId,
        `invariants[${i}].pattern.target`
      );
    }

    if (pat.scope !== undefined) {
      if (typeof pat.scope !== 'string' || !pat.scope.trim()) {
        throw new ConfigValidationError(
          `Invariant rule "${trimmedId}" pattern.scope must be a non-empty string`,
          { field: `invariants[${i}].pattern.scope` }
        );
      }
      invariantPattern.scope = pat.scope.trim();
    }

    if (hasForbidImport) {
      invariantPattern.forbid_import = parseStringOrStringArray(
        pat.forbid_import,
        'forbid_import',
        trimmedId,
        `invariants[${i}].pattern.forbid_import`
      );
    }

    if (pat.in_path !== undefined) {
      if (typeof pat.in_path !== 'string' || !pat.in_path.trim()) {
        throw new ConfigValidationError(
          `Invariant rule "${trimmedId}" pattern.in_path must be a non-empty string`,
          { field: `invariants[${i}].pattern.in_path` }
        );
      }
      invariantPattern.in_path = pat.in_path.trim();
    }

    if (hasRequireConfig) {
      invariantPattern.require_config = parseStringOrStringArray(
        pat.require_config,
        'require_config',
        trimmedId,
        `invariants[${i}].pattern.require_config`
      );
    }

    result.push({
      id: trimmedId,
      severity: severity as 'critical' | 'warning' | 'info',
      desc: desc.trim(),
      pattern: invariantPattern,
    });
  }

  return result;
}

/**
 * Parses raw YAML text into an array of validated InvariantRule objects.
 */
export function parseInvariantsYaml(rawYaml: string): InvariantRule[] {
  if (!rawYaml || !rawYaml.trim()) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(rawYaml);
  } catch (err: unknown) {
    const error = err as Error & { linePos?: Array<{ line: number; col: number }> };
    const line = error.linePos?.[0]?.line;
    const column = error.linePos?.[0]?.col;
    throw new ConfigSyntaxError(`Failed to parse YAML invariants: ${error.message}`, {
      line,
      column,
    });
  }

  if (parsed === null || parsed === undefined) {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parseInvariantRules(parsed);
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (obj.invariants !== undefined) {
      return parseInvariantRules(obj.invariants);
    }
    if (typeof obj.id === 'string' && typeof obj.pattern === 'object') {
      return parseInvariantRules([obj]);
    }
    throw new ConfigValidationError(
      'YAML invariants root must be an array of rules or contain an "invariants" property',
      { field: 'invariants' }
    );
  }

  throw new ConfigValidationError('YAML invariants root must be an object or array', {
    field: 'invariants',
  });
}

/**
 * Extracts and parses all ```yaml / ```yml blocks containing `invariants:` from markdown text.
 */
export function extractInvariantsFromMarkdown(markdownText: string): InvariantRule[] {
  const codeBlockRegex = /```(?:yaml|yml)\s*([\s\S]*?)```/gi;
  const rules: InvariantRule[] = [];
  const seenIds = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(markdownText)) !== null) {
    const blockContent = match[1];
    if (/\binvariants\s*:/i.test(blockContent)) {
      const parsedRules = parseInvariantsYaml(blockContent);
      for (const rule of parsedRules) {
        if (seenIds.has(rule.id)) {
          throw new ConfigValidationError(
            `Duplicate invariant rule id "${rule.id}" found across markdown blocks`,
            { field: 'invariants' }
          );
        }
        seenIds.add(rule.id);
        rules.push(rule);
      }
    }
  }

  return rules;
}
