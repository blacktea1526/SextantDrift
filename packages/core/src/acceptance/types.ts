/** Acceptance describes exact checks; it does not execute tests or attest business behavior. */
export type AcceptanceStatus = 'PASS' | 'FAIL' | 'UNVERIFIED' | 'ERROR';

export interface Requirement {
  id: string;
  designRef: string;
  checkIds: string[];
}

export interface Scenario { id: string }

export interface AcceptanceCheck {
  id: string;
  scenarioId: string;
  testFile: string;
  /** Full test name, including suite names. */
  testName: string;
  required: boolean;
}

export interface Confirmation {
  confirmedBy: string;
  designHash: string;
  acceptanceHash: string;
  configHash: string;
}

export interface AcceptanceConfig {
  requirements: Requirement[];
  scenarios: Scenario[];
  checks: AcceptanceCheck[];
  confirmation?: Confirmation;
}

export interface VersionBinding {
  sourceHash: string;
  designHash: string;
  acceptanceHash: string;
  configHash: string;
}

export interface CheckEvidence {
  checkId: string;
  scenarioId: string;
  testFile: string;
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';
  message?: string;
  /** Assertion/test location, not a proven application source location. */
  location?: { file: string; line: number };
}

export interface RunEvidence {
  runId: string;
  versionsBefore: VersionBinding;
  versionsAfter: VersionBinding;
  complete: boolean;
  checks: CheckEvidence[];
}

export interface CheckResult {
  checkId: string;
  status: AcceptanceStatus;
  evidence?: CheckEvidence;
  issues: string[];
}

export interface RequirementResult {
  requirementId: string;
  status: AcceptanceStatus;
  checks: CheckResult[];
  issues: string[];
}

/** Acceptance-only result; existing structural DriftReport remains independent. */
export interface VerificationReport {
  status: AcceptanceStatus;
  requirements: RequirementResult[];
  issues: string[];
}
