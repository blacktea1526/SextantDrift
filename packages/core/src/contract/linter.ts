import { TargetContractSpec, ContractLintIssue, HttpMethod } from './types.js';
import { ViolationEvidence } from '../types/report.js';

const STANDARD_HTTP_METHODS = new Set<string>([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
  'ALL',
]);

/**
 * Validates AI-generated or developer-written API contract specifications.
 * Detects duplicate routes, non-standard HTTP methods, invalid status codes, and malformed parameter lines.
 */
export function lintContractSpec(
  content: string,
  filePath: string,
  spec: TargetContractSpec
): ContractLintIssue[] {
  const issues: ContractLintIssue[] = [];
  const lines = content.split(/\r?\n/);

  // 1. Line-by-line syntax & semantic checks
  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNumber = idx + 1;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('<!--')) {
      continue;
    }

    // Check invalid HTTP methods in headers (e.g. "### UPDATE /api/v1/orders" or "## FETCH /api/v1/users")
    const headerMatch = trimmed.match(/^#{2,4}\s+(?:\[[^\]]+\]\s+)?([A-Za-z0-9_]+)\s+(\S+)/);
    if (headerMatch) {
      const verb = headerMatch[1].toUpperCase();
      if (!STANDARD_HTTP_METHODS.has(verb)) {
        issues.push({
          ruleId: 'INVALID_HTTP_METHOD',
          severity: 'critical',
          message: `Invalid HTTP method '${headerMatch[1]}' in '${trimmed}'. Supported methods: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD, ALL.`,
          specFile: filePath,
          specLine: lineNumber,
          endpointId: `${headerMatch[1]} ${headerMatch[2]}`,
          snippet: trimmed,
          suggestion: `Replace invalid HTTP method '${headerMatch[1]}' with standard HTTP method (GET, POST, PUT, DELETE, PATCH).`,
        });
      }
    }

    // Check invalid HTTP method in bullet form (e.g. "- [method] UPDATE /api/v1/orders")
    const methodBulletMatch = trimmed.match(/^[-*]\s+(?:\[method\]|method:)\s+([A-Za-z0-9_]+)\s+(\S+)/i);
    if (methodBulletMatch) {
      const verb = methodBulletMatch[1].toUpperCase();
      if (!STANDARD_HTTP_METHODS.has(verb)) {
        issues.push({
          ruleId: 'INVALID_HTTP_METHOD',
          severity: 'critical',
          message: `Invalid HTTP method '${methodBulletMatch[1]}' in bullet definition.`,
          specFile: filePath,
          specLine: lineNumber,
          endpointId: `${methodBulletMatch[1]} ${methodBulletMatch[2]}`,
          snippet: trimmed,
          suggestion: `Replace invalid HTTP method '${methodBulletMatch[1]}' with standard HTTP method (GET, POST, PUT, DELETE, PATCH).`,
        });
      }
    }

    // Check invalid status code (must be 3-digit numeric between 100 and 599)
    const statusMatch = trimmed.match(/^[-*]\s+(?:\[(?:status|response\.status)\]|status:)\s*([^\s(]+)/i);
    if (statusMatch) {
      const rawCode = statusMatch[1].trim();
      const numCode = parseInt(rawCode, 10);
      if (isNaN(numCode) || numCode < 100 || numCode > 599 || !/^\d{3}$/.test(rawCode)) {
        issues.push({
          ruleId: 'INVALID_STATUS_CODE',
          severity: 'critical',
          message: `Invalid HTTP status code '${rawCode}' at line ${lineNumber}. HTTP status codes must be 3-digit integers between 100 and 599.`,
          specFile: filePath,
          specLine: lineNumber,
          snippet: trimmed,
          suggestion: `Status code '${rawCode}' is invalid. Use standard HTTP status code in range 100-599 (e.g. 200, 201, 400, 404, 500).`,
        });
      }
    }

    // Check malformed param declarations
    const paramBulletMatch = trimmed.match(/^[-*]\s+(?:\[(?:param|body\.param|query\.param|path\.param)\]|param:)\s*(.*)$/i);
    if (paramBulletMatch) {
      const paramBody = paramBulletMatch[1].trim();
      if (!paramBody || paramBody.startsWith(':')) {
        issues.push({
          ruleId: 'MALFORMED_PARAM',
          severity: 'critical',
          message: `Malformed parameter specification at line ${lineNumber}: missing parameter name.`,
          specFile: filePath,
          specLine: lineNumber,
          snippet: trimmed,
          suggestion: `Provide a valid identifier for parameter name (e.g. '- [param] userId: string (required)').`,
        });
      } else {
        const firstToken = paramBody.split(/[:\s(]/)[0].trim();
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$.[\]]*$/.test(firstToken)) {
          issues.push({
            ruleId: 'MALFORMED_PARAM',
            severity: 'critical',
            message: `Malformed parameter identifier '${firstToken}' at line ${lineNumber}. Parameter name must begin with letter, underscore, or dollar sign.`,
            specFile: filePath,
            specLine: lineNumber,
            snippet: trimmed,
            suggestion: `Parameter name must be a valid identifier (alphanumeric and underscore, starting with letter).`,
          });
        }
      }
    }
  }

  // 2. Duplicate endpoint checks
  const seenEndpoints = new Map<string, number>();
  for (const ep of spec.endpoints) {
    const key = ep.id.toLowerCase();
    if (seenEndpoints.has(key)) {
      const firstLine = seenEndpoints.get(key)!;
      issues.push({
        ruleId: 'DUPLICATE_ENDPOINT',
        severity: 'critical',
        message: `Duplicate endpoint declaration: '${ep.id}' was declared at line ${ep.specLine}, but was already defined at line ${firstLine}.`,
        specFile: filePath,
        specLine: ep.specLine,
        endpointId: ep.id,
        snippet: `${ep.method} ${ep.path}`,
        suggestion: `Merge duplicate endpoint declarations for '${ep.id}' into a single definition to eliminate specification ambiguity.`,
      });
    } else {
      seenEndpoints.set(key, ep.specLine);
    }
  }

  // 3. Empty endpoint checks (warning)
  for (const ep of spec.endpoints) {
    if (ep.params.length === 0 && ep.statuses.length === 0) {
      issues.push({
        ruleId: 'EMPTY_ENDPOINT_SPEC',
        severity: 'warning',
        message: `Endpoint '${ep.id}' declared at line ${ep.specLine} has no parameters or response statuses specified.`,
        specFile: filePath,
        specLine: ep.specLine,
        endpointId: ep.id,
        snippet: `${ep.method} ${ep.path}`,
        suggestion: `Provide at least one expected status code (e.g. '- [status] 200 (OK)') or parameter for endpoint '${ep.id}'.`,
      });
    }
  }

  return issues;
}

/**
 * Converts contract lint issues into standard SextantDrift ViolationEvidence items.
 */
export function contractLintIssuesToViolations(issues: ContractLintIssue[]): ViolationEvidence[] {
  return issues.map((issue) => ({
    id: `CONTRACT_LINT_${issue.ruleId}_${issue.specLine}`,
    type: 'CONTRACT_LINT_ERROR',
    severity: issue.severity,
    message: issue.message,
    sourceFile: issue.specFile,
    line: issue.specLine,
    column: 1,
    snippet: issue.snippet || issue.endpointId || '',
    suggestion: issue.suggestion,
  }));
}
