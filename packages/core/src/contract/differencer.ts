import { ViolationEvidence } from '../types/report.js';
import { TargetContractSpec, ActualEndpoint, ContractEndpoint } from './types.js';
import { normalizeHttpPath } from './markdown-parser.js';

/**
 * Checks if target path and actual path match, treating route parameters (:id or {id}) as wildcards.
 */
function arePathsEquivalent(targetPath: string, actualPath: string): boolean {
  const normTarget = normalizeHttpPath(targetPath);
  const normActual = normalizeHttpPath(actualPath);

  if (normTarget === normActual) {
    return true;
  }

  // Convert :param and {param} into [^/]+ regex
  const targetRegexStr = '^' + normTarget.replace(/:[a-zA-Z0-9_$]+|\{[a-zA-Z0-9_$]+\}/g, '[^/]+') + '$';
  try {
    const regex = new RegExp(targetRegexStr);
    return regex.test(normActual);
  } catch {
    return normTarget === normActual;
  }
}

function findMatchingActualEndpoint(
  target: ContractEndpoint,
  actualList: ActualEndpoint[]
): ActualEndpoint | undefined {
  return actualList.find(
    (act) =>
      (target.method === 'ALL' || act.method === 'ALL' || act.method === target.method) &&
      arePathsEquivalent(target.path, act.path)
  );
}

function findMatchingTargetEndpoint(
  actual: ActualEndpoint,
  targetList: ContractEndpoint[]
): ContractEndpoint | undefined {
  return targetList.find(
    (tgt) =>
      (tgt.method === 'ALL' || actual.method === 'ALL' || actual.method === tgt.method) &&
      arePathsEquivalent(tgt.path, actual.path)
  );
}

/**
 * Pure diff engine for checking alignment between Target Contract Specification and Actual Controllers.
 */
export function diffContractAlignment(
  targetSpec: TargetContractSpec,
  actualEndpoints: ActualEndpoint[]
): ViolationEvidence[] {
  const violations: ViolationEvidence[] = [];

  // 1. Target \ Actual -> Missing Endpoints
  for (const target of targetSpec.endpoints) {
    const actual = findMatchingActualEndpoint(target, actualEndpoints);

    if (!actual) {
      violations.push({
        id: `CONTRACT_MISSING_${target.method}_${target.path.replace(/\//g, '_')}`,
        type: 'CONTRACT_MISSING_ENDPOINT',
        severity: 'critical',
        message: `Contract alignment broken: Endpoint "${target.id}" declared in spec (${targetSpec.sourceFile}:${target.specLine}) is missing from controller implementations.`,
        sourceFile: targetSpec.sourceFile,
        line: target.specLine,
        column: 1,
        snippet: `${target.method} ${target.path}`,
        suggestion: `Implement route "${target.id}" in a controller or remove it from ${targetSpec.sourceFile} if deprecated.`,
      });
      continue;
    }

    // 2. Missing Required Parameters
    for (const param of target.params) {
      if (param.required) {
        const hasParam = actual.extractedParams.includes(param.name);
        if (!hasParam) {
          violations.push({
            id: `CONTRACT_PARAM_${target.method}_${target.path.replace(/\//g, '_')}_${param.name}`,
            type: 'CONTRACT_MISSING_PARAM',
            severity: 'critical',
            message: `Contract alignment broken: Required parameter "${param.name}" for "${target.id}" (defined in ${targetSpec.sourceFile}:${param.specLine}) is missing in controller handler (${actual.sourceFile}:${actual.line}).`,
            sourceFile: targetSpec.sourceFile,
            line: param.specLine,
            column: 1,
            snippet: `- [param] ${param.name}: ${param.type || 'string'} (required)`,
            suggestion: `Add and destructure required parameter "${param.name}" in ${actual.sourceFile}:${actual.line} or declare it in the request DTO.`,
          });
        }
      }
    }

    // 3. Unhandled Status Codes
    for (const status of target.statuses) {
      // Check if code exists in actual.extractedStatuses (as number or string)
      const codeNum = typeof status.code === 'number' ? status.code : parseInt(status.code, 10);
      const hasStatus = actual.extractedStatuses.some((s) => s === status.code || s === codeNum);

      if (!hasStatus) {
        const descSuffix = status.description ? ` (${status.description})` : '';
        violations.push({
          id: `CONTRACT_STATUS_${target.method}_${target.path.replace(/\//g, '_')}_${status.code}`,
          type: 'CONTRACT_UNHANDLED_STATUS',
          severity: 'warning',
          message: `Contract alignment broken: HTTP status "${status.code}${descSuffix}" specified for "${target.id}" (defined in ${targetSpec.sourceFile}:${status.specLine}) is not handled or returned in controller handler (${actual.sourceFile}:${actual.line}).`,
          sourceFile: targetSpec.sourceFile,
          line: status.specLine,
          column: 1,
          snippet: `- [status] ${status.code}${descSuffix}`,
          suggestion: `Add response or error handling for status ${status.code} (e.g. throw appropriate HttpException or return res.status(${status.code})) in ${actual.sourceFile}:${actual.line}.`,
        });
      }
    }
  }

  // 4. Actual \ Target -> Shadow Endpoints
  for (const actual of actualEndpoints) {
    const target = findMatchingTargetEndpoint(actual, targetSpec.endpoints);
    if (!target) {
      violations.push({
        id: `CONTRACT_SHADOW_${actual.method}_${actual.path.replace(/\//g, '_')}_${actual.line}`,
        type: 'CONTRACT_SHADOW_ENDPOINT',
        severity: 'critical',
        message: `Contract alignment broken: Undeclared shadow endpoint "${actual.id}" found in ${actual.sourceFile}:${actual.line}, but not defined in contract ${targetSpec.sourceFile}.`,
        sourceFile: actual.sourceFile,
        line: actual.line,
        column: actual.column,
        snippet: actual.snippet,
        suggestion: `Remove undeclared route "${actual.id}" or add it to contract specification ${targetSpec.sourceFile} if intentional.`,
      });
    }
  }

  return violations;
}
