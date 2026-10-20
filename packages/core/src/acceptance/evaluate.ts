import { parseAcceptanceConfig } from './config.js';
import type {
  AcceptanceCheck,
  AcceptanceConfig,
  AcceptanceStatus,
  CheckEvidence,
  CheckResult,
  RequirementResult,
  RunEvidence,
  VerificationReport,
  VersionBinding,
} from './types.js';

interface EvaluationContext {
  runId: string;
  versions: VersionBinding;
}

const STATUS_RANK: Record<AcceptanceStatus, number> = {
  PASS: 0,
  UNVERIFIED: 1,
  FAIL: 2,
  ERROR: 3,
};

const versionKeys = ['sourceHash', 'designHash', 'acceptanceHash', 'configHash'] as const;
const evidenceKeys = ['runId', 'versionsBefore', 'versionsAfter', 'complete', 'checks'] as const;
const checkEvidenceKeys = [
  'checkId',
  'scenarioId',
  'testFile',
  'testName',
  'status',
  'message',
  'location',
] as const;
const locationKeys = ['file', 'line'] as const;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function worstStatus(statuses: AcceptanceStatus[]): AcceptanceStatus {
  return statuses.reduce<AcceptanceStatus>(
    (worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst),
    'PASS',
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isVersionBinding(value: unknown): value is VersionBinding {
  return (
    isPlainObject(value) &&
    hasOnlyKeys(value, versionKeys) &&
    versionKeys.every((key) => typeof value[key] === 'string' && SHA256_HEX.test(value[key]))
  );
}

function sameVersions(left: VersionBinding, right: VersionBinding): boolean {
  return versionKeys.every((key) => left[key] === right[key]);
}

function validationError(message: string, config?: AcceptanceConfig): VerificationReport {
  return {
    status: 'ERROR',
    requirements: config ? buildInvalidRequirementResults(config, message) : [],
    issues: [message],
  };
}

function buildInvalidRequirementResults(config: AcceptanceConfig, message: string): RequirementResult[] {
  return config.requirements.map((requirement) => ({
    requirementId: requirement.id,
    status: 'ERROR',
    checks: requirement.checkIds.map((checkId) => ({
      checkId,
      status: 'ERROR',
      issues: [message],
    })),
    issues: [message],
  }));
}

function parseConfig(config: AcceptanceConfig): AcceptanceConfig | VerificationReport {
  try {
    return parseAcceptanceConfig(config);
  } catch (error) {
    return {
      status: 'ERROR',
      requirements: [],
      issues: [`Acceptance config is invalid: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

function contextValidationError(context: EvaluationContext): string | undefined {
  if (!isPlainObject(context)) {
    return 'Evaluation context must be an object.';
  }

  if (!hasOnlyKeys(context, ['runId', 'versions'])) {
    return 'Evaluation context contains unknown fields.';
  }

  if (typeof context.runId !== 'string' || context.runId.length === 0) {
    return 'Evaluation context runId must be a non-empty string.';
  }

  if (!isVersionBinding(context.versions)) {
    return 'Evaluation context versions must be a valid version binding.';
  }

  return undefined;
}

function evidenceValidationError(evidence: unknown): string | undefined {
  if (!isPlainObject(evidence)) {
    return 'Run evidence must be an object.';
  }

  if (!hasOnlyKeys(evidence, evidenceKeys)) {
    return 'Run evidence contains unknown fields.';
  }

  if (typeof evidence.runId !== 'string' || evidence.runId.length === 0) {
    return 'Run evidence runId must be a non-empty string.';
  }

  if (!isVersionBinding(evidence.versionsBefore)) {
    return 'Run evidence versionsBefore must be a valid version binding.';
  }

  if (!isVersionBinding(evidence.versionsAfter)) {
    return 'Run evidence versionsAfter must be a valid version binding.';
  }

  if (typeof evidence.complete !== 'boolean') {
    return 'Run evidence complete must be a boolean.';
  }

  if (!Array.isArray(evidence.checks)) {
    return 'Run evidence checks must be an array.';
  }

  for (const check of evidence.checks) {
    const error = checkEvidenceValidationError(check);
    if (error) return error;
  }

  return undefined;
}

function checkEvidenceValidationError(check: unknown): string | undefined {
  if (!isPlainObject(check)) {
    return 'Check evidence must be an object.';
  }

  if (!hasOnlyKeys(check, checkEvidenceKeys)) {
    return 'Check evidence contains unknown fields.';
  }

  for (const key of ['checkId', 'scenarioId', 'testFile', 'testName'] as const) {
    if (typeof check[key] !== 'string' || check[key].length === 0) {
      return `Check evidence ${key} must be a non-empty string.`;
    }
  }

  const validEvidenceStatuses = ['PASS', 'FAIL', 'SKIP', 'ERROR'];
  if (typeof check.status !== 'string' || !validEvidenceStatuses.includes(check.status)) {
    return 'Check evidence status must be PASS, FAIL, SKIP or ERROR.';
  }

  if ('message' in check && check.message !== undefined && typeof check.message !== 'string') {
    return 'Check evidence message must be a string when present.';
  }

  if ('location' in check && check.location !== undefined) {
    if (!isPlainObject(check.location) || !hasOnlyKeys(check.location, locationKeys)) {
      return 'Check evidence location must contain only file and line.';
    }
    if (typeof check.location.file !== 'string' || check.location.file.length === 0) {
      return 'Check evidence location.file must be a non-empty string.';
    }
    const line = check.location.line;
    if (typeof line !== 'number' || !Number.isInteger(line) || line <= 0) {
      return 'Check evidence location.line must be a positive integer.';
    }
  }

  return undefined;
}

function validateEvidenceIdentities(config: AcceptanceConfig, runEvidence: RunEvidence): string | undefined {
  const checksById = new Map(config.checks.map((check) => [check.id, check]));
  const seen = new Set<string>();

  for (const check of runEvidence.checks) {
    if (seen.has(check.checkId)) {
      return `Duplicate evidence for acceptance check "${check.checkId}".`;
    }
    seen.add(check.checkId);

    const expected = checksById.get(check.checkId);
    if (!expected) {
      return `Evidence references unknown acceptance check "${check.checkId}".`;
    }

    if (
      check.scenarioId !== expected.scenarioId ||
      check.testFile !== expected.testFile ||
      check.testName !== expected.testName
    ) {
      return `Evidence identity for acceptance check "${check.checkId}" does not match the configured test.`;
    }
  }

  return undefined;
}

function reportStaleConfirmation(config: AcceptanceConfig, versions: VersionBinding): string | undefined {
  if (!config.confirmation) return 'Acceptance confirmation is missing or stale.';

  if (
    config.confirmation.designHash !== versions.designHash ||
    config.confirmation.acceptanceHash !== versions.acceptanceHash ||
    config.confirmation.configHash !== versions.configHash
  ) {
    return 'Acceptance confirmation is missing or stale.';
  }

  return undefined;
}

function buildRequirementResults(
  config: AcceptanceConfig,
  runEvidence: RunEvidence | undefined,
  options: { allowPass: boolean; allowFail: boolean },
): { requirements: RequirementResult[]; checkEvidenceById: Map<string, CheckEvidence> } {
  const configChecks = new Map(config.checks.map((check) => [check.id, check]));
  const checkEvidenceById = new Map(runEvidence?.checks.map((check) => [check.checkId, check]) ?? []);

  const requirements = config.requirements.map<RequirementResult>((requirement) => {
    const checkResults = requirement.checkIds.map<CheckResult>((checkId) => {
      const configuredCheck = configChecks.get(checkId);
      if (!configuredCheck) {
        return {
          checkId,
          status: 'ERROR',
          issues: [`Requirement "${requirement.id}" references unknown acceptance check "${checkId}".`],
        };
      }

      return evaluateCheck(configuredCheck, checkEvidenceById.get(checkId), options);
    });

    const issues: string[] = [];
    const hasRequiredCheck = requirement.checkIds.some((checkId) => configChecks.get(checkId)?.required === true);
    if (!hasRequiredCheck) {
      issues.push(`Requirement "${requirement.id}" has no required acceptance checks.`);
    }

    if (requirement.checkIds.length === 0) {
      issues.push(`Requirement "${requirement.id}" has no mapped acceptance checks.`);
    }

    const requiredCheckResults = checkResults.filter((check) => configChecks.get(check.checkId)?.required === true);
    const optionalBlockingResults = checkResults.filter(
      (check) => configChecks.get(check.checkId)?.required === false && ['ERROR', 'FAIL'].includes(check.status),
    );
    const aggregateStatuses = [...requiredCheckResults, ...optionalBlockingResults].map((check) => check.status);
    let status = aggregateStatuses.length > 0 ? worstStatus(aggregateStatuses) : 'UNVERIFIED';

    if (status === 'PASS' && (!hasRequiredCheck || !options.allowPass)) {
      status = 'UNVERIFIED';
    }

    if (status === 'PASS') {
      if (requiredCheckResults.length === 0 || requiredCheckResults.some((check) => check.status !== 'PASS')) {
        status = 'UNVERIFIED';
      }
    }

    return {
      requirementId: requirement.id,
      status,
      checks: checkResults,
      issues,
    };
  });

  return { requirements, checkEvidenceById };
}

function evaluateCheck(
  check: AcceptanceCheck,
  evidence: CheckEvidence | undefined,
  options: { allowPass: boolean; allowFail: boolean },
): CheckResult {
  if (!evidence) {
    return {
      checkId: check.id,
      status: 'UNVERIFIED',
      issues: check.required ? [`Required acceptance check "${check.id}" did not produce evidence.`] : [],
    };
  }

  if (evidence.status === 'ERROR') {
    return {
      checkId: check.id,
      status: 'ERROR',
      evidence,
      issues: [evidence.message ?? `Acceptance check "${check.id}" errored.`],
    };
  }

  if (evidence.status === 'FAIL') {
    if (!options.allowFail) {
      return {
        checkId: check.id,
        status: 'UNVERIFIED',
        evidence,
        issues: ['Failing evidence is not current for the requested run and version binding.'],
      };
    }

    return {
      checkId: check.id,
      status: 'FAIL',
      evidence,
      issues: [evidence.message ?? `Acceptance check "${check.id}" failed.`],
    };
  }

  if (evidence.status === 'SKIP') {
    return {
      checkId: check.id,
      status: 'UNVERIFIED',
      evidence,
      issues: check.required ? [`Required acceptance check "${check.id}" was skipped.`] : [],
    };
  }

  return {
    checkId: check.id,
    status: options.allowPass ? 'PASS' : 'UNVERIFIED',
    evidence,
    issues: options.allowPass ? [] : ['Passing evidence is not current, complete and confirmed.'],
  };
}

function buildReport(
  config: AcceptanceConfig,
  issues: string[],
  runEvidence?: RunEvidence,
  options: { staleEvidence?: boolean; globalStatus?: AcceptanceStatus; allowPass?: boolean } = {},
): VerificationReport {
  const allowPass = options.allowPass ?? issues.length === 0;
  const allowFail = !options.staleEvidence;
  const evidenceForResults = options.staleEvidence ? undefined : runEvidence;
  const { requirements } = buildRequirementResults(config, evidenceForResults, { allowPass, allowFail });
  const requirementStatuses = requirements.map((requirement) => requirement.status);
  const requirementStatus =
    requirements.length === 0 ? 'UNVERIFIED' : worstStatus(requirementStatuses.length > 0 ? requirementStatuses : ['UNVERIFIED']);
  const status = options.globalStatus ? worstStatus([requirementStatus, options.globalStatus]) : requirementStatus;

  return {
    status: status === 'PASS' && !allowPass ? 'UNVERIFIED' : status,
    requirements,
    issues,
  };
}

export function evaluateAcceptance(
  config: AcceptanceConfig,
  context: EvaluationContext,
  evidence: unknown,
): VerificationReport {
  const parsed = parseConfig(config);
  if ('status' in parsed) return parsed;

  const invalidContext = contextValidationError(context);
  if (invalidContext) {
    return validationError(invalidContext, parsed);
  }

  if (evidence === undefined) {
    return buildReport(parsed, ['Run evidence is missing.']);
  }

  const validationErrorMessage = evidenceValidationError(evidence);
  if (validationErrorMessage) {
    return validationError(validationErrorMessage, parsed);
  }

  const runEvidence = evidence as RunEvidence;
  const identityError = validateEvidenceIdentities(parsed, runEvidence);
  if (identityError) {
    return validationError(identityError, parsed);
  }

  const issues: string[] = [];
  let staleEvidence = false;
  if (runEvidence.runId !== context.runId) {
    issues.push(`Evidence runId "${runEvidence.runId}" does not match requested runId "${context.runId}".`);
    staleEvidence = true;
  }
  if (!sameVersions(runEvidence.versionsBefore, context.versions)) {
    issues.push('Evidence versionsBefore does not match the requested version binding.');
    staleEvidence = true;
  }
  if (!sameVersions(runEvidence.versionsAfter, context.versions)) {
    issues.push('Evidence versionsAfter does not match the requested version binding.');
    staleEvidence = true;
  }
  if (!sameVersions(runEvidence.versionsBefore, runEvidence.versionsAfter)) {
    issues.push('Evidence versions changed during the run.');
    staleEvidence = true;
  }
  if (!runEvidence.complete) {
    issues.push('Evidence run did not complete.');
  }

  const confirmationIssue = reportStaleConfirmation(parsed, context.versions);
  if (confirmationIssue) {
    issues.push(confirmationIssue);
  }

  const allowMappedPass = issues.length === 0;
  const mappedCheckIds = new Set(parsed.requirements.flatMap((requirement) => requirement.checkIds));
  const evidenceByCheckId = new Map(runEvidence.checks.map((check) => [check.checkId, check]));
  let globalStatus: AcceptanceStatus | undefined;
  if (!staleEvidence) {
    for (const check of parsed.checks) {
      if (mappedCheckIds.has(check.id)) {
        continue;
      }

      const checkEvidence = evidenceByCheckId.get(check.id);
      if (!checkEvidence) {
        if (check.required) {
          globalStatus = globalStatus ? worstStatus([globalStatus, 'UNVERIFIED']) : 'UNVERIFIED';
          issues.push(`Unmapped required acceptance check "${check.id}" did not produce evidence.`);
        }
        continue;
      }

      if (checkEvidence.status === 'SKIP') {
        if (check.required) {
          globalStatus = globalStatus ? worstStatus([globalStatus, 'UNVERIFIED']) : 'UNVERIFIED';
          issues.push(`Unmapped required acceptance check "${check.id}" was skipped.`);
        }
        continue;
      }

      if (checkEvidence.status === 'FAIL') {
        globalStatus = globalStatus ? worstStatus([globalStatus, 'FAIL']) : 'FAIL';
        issues.push(
          `Unmapped acceptance check "${check.id}" failed: ${checkEvidence.message ?? 'Acceptance check failed.'}`,
        );
        continue;
      }

      if (checkEvidence.status === 'ERROR') {
        globalStatus = globalStatus ? worstStatus([globalStatus, 'ERROR']) : 'ERROR';
        issues.push(
          `Unmapped acceptance check "${check.id}" errored: ${checkEvidence.message ?? 'Acceptance check errored.'}`,
        );
      }
    }
  }

  return buildReport(parsed, issues, runEvidence, { staleEvidence, globalStatus, allowPass: allowMappedPass });
}
