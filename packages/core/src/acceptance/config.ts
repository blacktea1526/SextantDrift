import { AcceptanceConfig, Requirement, Scenario, AcceptanceCheck, Confirmation } from './types.js';
import { ConfigValidationError } from '../errors/config-error.js';

function assertNoUnknownKeys(
  obj: Record<string, unknown>,
  allowedKeys: Set<string>,
  parentField: string
): void {
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      throw new ConfigValidationError(`Unknown field "${key}" in ${parentField}`, {
        field: `${parentField}.${key}`,
      });
    }
  }
}

function isValidPosixRelativePath(path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) {
    return false;
  }
  if (/[\\:\u0000]/.test(path)) {
    return false;
  }
  if (path.startsWith('/')) {
    return false;
  }
  const segments = path.split('/');
  for (const seg of segments) {
    if (!seg || seg.trim().length === 0 || seg === '.' || seg === '..') {
      return false;
    }
  }
  return true;
}

const HASH_REGEX = /^[0-9a-f]{64}$/;

const ROOT_ALLOWED = new Set(['requirements', 'scenarios', 'checks', 'confirmation']);
const REQ_ALLOWED = new Set(['id', 'designRef', 'checkIds']);
const SCN_ALLOWED = new Set(['id']);
const CHK_ALLOWED = new Set(['id', 'scenarioId', 'testFile', 'testName', 'required']);
const CONF_ALLOWED = new Set(['confirmedBy', 'designHash', 'acceptanceHash', 'configHash']);

export function parseAcceptanceConfig(value: unknown): AcceptanceConfig {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigValidationError('Acceptance configuration must be a valid JSON object', {
      field: 'acceptance',
    });
  }

  const raw = value as Record<string, unknown>;
  assertNoUnknownKeys(raw, ROOT_ALLOWED, 'acceptance');

  if (!Array.isArray(raw.requirements)) {
    throw new ConfigValidationError('acceptance.requirements must be an array', {
      field: 'acceptance.requirements',
    });
  }

  if (!Array.isArray(raw.scenarios)) {
    throw new ConfigValidationError('acceptance.scenarios must be an array', {
      field: 'acceptance.scenarios',
    });
  }

  if (!Array.isArray(raw.checks)) {
    throw new ConfigValidationError('acceptance.checks must be an array', {
      field: 'acceptance.checks',
    });
  }

  // 1. Validate Scenarios and collect scenario IDs
  const parsedScenarios: Scenario[] = [];
  const scenarioIds = new Set<string>();
  for (let i = 0; i < raw.scenarios.length; i++) {
    const item = raw.scenarios[i];
    const fieldPath = `acceptance.scenarios[${i}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ConfigValidationError(`Scenario at index ${i} must be an object`, {
        field: fieldPath,
      });
    }
    const sObj = item as Record<string, unknown>;
    assertNoUnknownKeys(sObj, SCN_ALLOWED, fieldPath);

    if (typeof sObj.id !== 'string' || sObj.id.trim().length === 0) {
      throw new ConfigValidationError(`Scenario id at index ${i} must be a non-empty string`, {
        field: `${fieldPath}.id`,
      });
    }

    if (scenarioIds.has(sObj.id)) {
      throw new ConfigValidationError(`Duplicate scenario id "${sObj.id}"`, {
        field: `${fieldPath}.id`,
      });
    }
    scenarioIds.add(sObj.id);

    parsedScenarios.push({ id: sObj.id });
  }

  // 2. Validate Checks, check IDs, test identity uniqueness, and scenario references
  const parsedChecks: AcceptanceCheck[] = [];
  const checkIds = new Set<string>();
  const testIdentities = new Set<string>();
  for (let i = 0; i < raw.checks.length; i++) {
    const item = raw.checks[i];
    const fieldPath = `acceptance.checks[${i}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ConfigValidationError(`Check at index ${i} must be an object`, {
        field: fieldPath,
      });
    }
    const cObj = item as Record<string, unknown>;
    assertNoUnknownKeys(cObj, CHK_ALLOWED, fieldPath);

    if (typeof cObj.id !== 'string' || cObj.id.trim().length === 0) {
      throw new ConfigValidationError(`Check id at index ${i} must be a non-empty string`, {
        field: `${fieldPath}.id`,
      });
    }

    if (checkIds.has(cObj.id)) {
      throw new ConfigValidationError(`Duplicate check id "${cObj.id}"`, {
        field: `${fieldPath}.id`,
      });
    }
    checkIds.add(cObj.id);

    if (typeof cObj.scenarioId !== 'string' || cObj.scenarioId.trim().length === 0) {
      throw new ConfigValidationError(`Check scenarioId at index ${i} must be a non-empty string`, {
        field: `${fieldPath}.scenarioId`,
      });
    }

    if (!scenarioIds.has(cObj.scenarioId)) {
      throw new ConfigValidationError(
        `Check "${cObj.id}" references unknown scenarioId "${cObj.scenarioId}"`,
        {
          field: `${fieldPath}.scenarioId`,
        }
      );
    }

    if (typeof cObj.testFile !== 'string' || !isValidPosixRelativePath(cObj.testFile)) {
      throw new ConfigValidationError(
        `Check testFile at index ${i} must be a valid project-relative POSIX file path`,
        {
          field: `${fieldPath}.testFile`,
        }
      );
    }

    if (typeof cObj.testName !== 'string' || cObj.testName.trim().length === 0) {
      throw new ConfigValidationError(`Check testName at index ${i} must be a non-empty string`, {
        field: `${fieldPath}.testName`,
      });
    }

    const testIdentity = `${cObj.testFile}\0${cObj.testName}`;
    if (testIdentities.has(testIdentity)) {
      throw new ConfigValidationError(
        `Duplicate test identity found for testFile "${cObj.testFile}" and testName "${cObj.testName}"`,
        {
          field: `${fieldPath}.testName`,
        }
      );
    }
    testIdentities.add(testIdentity);

    if (typeof cObj.required !== 'boolean') {
      throw new ConfigValidationError(`Check required at index ${i} must be a boolean`, {
        field: `${fieldPath}.required`,
      });
    }

    parsedChecks.push({
      id: cObj.id,
      scenarioId: cObj.scenarioId,
      testFile: cObj.testFile,
      testName: cObj.testName,
      required: cObj.required,
    });
  }

  // 3. Validate Requirements, requirement IDs, and check references
  const parsedRequirements: Requirement[] = [];
  const requirementIds = new Set<string>();
  for (let i = 0; i < raw.requirements.length; i++) {
    const item = raw.requirements[i];
    const fieldPath = `acceptance.requirements[${i}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ConfigValidationError(`Requirement at index ${i} must be an object`, {
        field: fieldPath,
      });
    }
    const rObj = item as Record<string, unknown>;
    assertNoUnknownKeys(rObj, REQ_ALLOWED, fieldPath);

    if (typeof rObj.id !== 'string' || rObj.id.trim().length === 0) {
      throw new ConfigValidationError(`Requirement id at index ${i} must be a non-empty string`, {
        field: `${fieldPath}.id`,
      });
    }

    if (requirementIds.has(rObj.id)) {
      throw new ConfigValidationError(`Duplicate requirement id "${rObj.id}"`, {
        field: `${fieldPath}.id`,
      });
    }
    requirementIds.add(rObj.id);

    if (typeof rObj.designRef !== 'string' || rObj.designRef.trim().length === 0) {
      throw new ConfigValidationError(`Requirement designRef at index ${i} must be a non-empty string`, {
        field: `${fieldPath}.designRef`,
      });
    }

    if (!Array.isArray(rObj.checkIds)) {
      throw new ConfigValidationError(`Requirement checkIds at index ${i} must be an array`, {
        field: `${fieldPath}.checkIds`,
      });
    }

    const checkIdsList: string[] = [];
    const seenInReq = new Set<string>();
    for (let j = 0; j < rObj.checkIds.length; j++) {
      const cId = rObj.checkIds[j];
      const checkIdField = `${fieldPath}.checkIds[${j}]`;
      if (typeof cId !== 'string' || cId.trim().length === 0) {
        throw new ConfigValidationError(
          `Requirement checkIds[${j}] at index ${i} must be a non-empty string`,
          {
            field: checkIdField,
          }
        );
      }

      if (seenInReq.has(cId)) {
        throw new ConfigValidationError(
          `Requirement "${rObj.id}" contains duplicate checkId "${cId}"`,
          {
            field: checkIdField,
          }
        );
      }
      seenInReq.add(cId);

      if (!checkIds.has(cId)) {
        throw new ConfigValidationError(
          `Requirement "${rObj.id}" references unknown checkId "${cId}"`,
          {
            field: checkIdField,
          }
        );
      }

      checkIdsList.push(cId);
    }

    parsedRequirements.push({
      id: rObj.id,
      designRef: rObj.designRef,
      checkIds: checkIdsList,
    });
  }

  // 4. Validate Confirmation (optional)
  let parsedConfirmation: Confirmation | undefined;
  if (raw.confirmation !== undefined) {
    const fieldPath = 'acceptance.confirmation';
    if (typeof raw.confirmation !== 'object' || raw.confirmation === null || Array.isArray(raw.confirmation)) {
      throw new ConfigValidationError('acceptance.confirmation must be an object', {
        field: fieldPath,
      });
    }
    const cObj = raw.confirmation as Record<string, unknown>;
    assertNoUnknownKeys(cObj, CONF_ALLOWED, fieldPath);

    if (typeof cObj.confirmedBy !== 'string' || cObj.confirmedBy.trim().length === 0) {
      throw new ConfigValidationError('acceptance.confirmation.confirmedBy must be a non-empty string', {
        field: `${fieldPath}.confirmedBy`,
      });
    }

    if (typeof cObj.designHash !== 'string' || !HASH_REGEX.test(cObj.designHash)) {
      throw new ConfigValidationError(
        'acceptance.confirmation.designHash must be a 64-character lowercase hexadecimal sha256 string',
        {
          field: `${fieldPath}.designHash`,
        }
      );
    }

    if (typeof cObj.acceptanceHash !== 'string' || !HASH_REGEX.test(cObj.acceptanceHash)) {
      throw new ConfigValidationError(
        'acceptance.confirmation.acceptanceHash must be a 64-character lowercase hexadecimal sha256 string',
        {
          field: `${fieldPath}.acceptanceHash`,
        }
      );
    }

    if (typeof cObj.configHash !== 'string' || !HASH_REGEX.test(cObj.configHash)) {
      throw new ConfigValidationError(
        'acceptance.confirmation.configHash must be a 64-character lowercase hexadecimal sha256 string',
        {
          field: `${fieldPath}.configHash`,
        }
      );
    }

    parsedConfirmation = {
      confirmedBy: cObj.confirmedBy,
      designHash: cObj.designHash,
      acceptanceHash: cObj.acceptanceHash,
      configHash: cObj.configHash,
    };
  }

  const result: AcceptanceConfig = {
    requirements: parsedRequirements,
    scenarios: parsedScenarios,
    checks: parsedChecks,
  };

  if (parsedConfirmation) {
    result.confirmation = parsedConfirmation;
  }

  return result;
}
