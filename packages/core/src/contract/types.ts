export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

export interface ContractParam {
  name: string;
  type?: string;
  required: boolean;
  specLine: number;
}

export interface ContractStatus {
  code: number | string;
  description?: string;
  specLine: number;
}

export interface ContractEndpoint {
  id: string; // e.g. "POST /api/v1/orders"
  method: HttpMethod;
  path: string;
  specFile: string;
  specLine: number;
  params: ContractParam[];
  statuses: ContractStatus[];
}

export interface TargetContractSpec {
  title?: string;
  sourceFile: string;
  endpoints: ContractEndpoint[];
}

export interface ActualEndpoint {
  id: string; // e.g. "POST /api/v1/orders"
  method: HttpMethod;
  path: string;
  sourceFile: string;
  line: number;
  column: number;
  snippet: string;
  extractedParams: string[];
  extractedStatuses: (number | string)[];
}

export type ContractLintRuleId =
  | 'DUPLICATE_ENDPOINT'
  | 'INVALID_HTTP_METHOD'
  | 'INVALID_STATUS_CODE'
  | 'MALFORMED_PARAM'
  | 'EMPTY_ENDPOINT_SPEC';

export interface ContractLintIssue {
  ruleId: ContractLintRuleId;
  severity: 'critical' | 'warning';
  message: string;
  specFile: string;
  specLine: number;
  endpointId?: string;
  suggestion: string;
  snippet?: string;
}

