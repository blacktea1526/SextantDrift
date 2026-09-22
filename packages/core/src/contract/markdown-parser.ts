import {
  HttpMethod,
  ContractParam,
  ContractStatus,
  ContractEndpoint,
  TargetContractSpec,
} from './types.js';

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL']);

/**
 * Normalizes HTTP route paths by removing trailing slashes.
 */
export function normalizeHttpPath(p: string): string {
  if (!p) return '/';
  const trimmed = p.trim();
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (withLeading.length > 1 && withLeading.endsWith('/')) {
    return withLeading.slice(0, -1);
  }
  return withLeading;
}

/**
 * Parses lightweight Markdown Line-by-Line contract specification into structured TargetContractSpec.
 */
export function parseMarkdownContract(
  content: string,
  filePath: string
): TargetContractSpec {
  const lines = content.split(/\r?\n/);
  const endpoints: ContractEndpoint[] = [];
  let currentTitle: string | undefined;
  let currentEndpoint: ContractEndpoint | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNumber = idx + 1;
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('<!--')) {
      continue;
    }

    // Title: # Title
    if (trimmed.startsWith('# ') && !currentTitle) {
      currentTitle = trimmed.replace(/^#\s+/, '').trim();
      continue;
    }

    // Header endpoint declaration: e.g. "### POST /api/v1/orders"
    const headerMatch = trimmed.match(/^#{2,4}\s+(?:\[[^\]]+\]\s+)?(GET|POST|PUT|DELETE|PATCH|ALL)\s+(\S+)/i);
    if (headerMatch) {
      if (currentEndpoint) {
        endpoints.push(currentEndpoint);
      }
      const method = headerMatch[1].toUpperCase() as HttpMethod;
      const routePath = normalizeHttpPath(headerMatch[2]);
      currentEndpoint = {
        id: `${method} ${routePath}`,
        method,
        path: routePath,
        specFile: filePath,
        specLine: lineNumber,
        params: [],
        statuses: [],
      };
      continue;
    }

    if (!currentEndpoint) {
      continue;
    }

    // - [method] POST /api/v1/orders or - method: POST /api/v1/orders
    const methodMatch = trimmed.match(/^[-*]\s+(?:\[method\]|method:)\s+(GET|POST|PUT|DELETE|PATCH|ALL)\s+(\S+)/i);
    if (methodMatch) {
      const method = methodMatch[1].toUpperCase() as HttpMethod;
      const routePath = normalizeHttpPath(methodMatch[2]);
      currentEndpoint.method = method;
      currentEndpoint.path = routePath;
      currentEndpoint.id = `${method} ${routePath}`;
      continue;
    }

    // - [param] amount: number (required) or - param: amount (required)
    // Matches: - [param] name (: type)? (modifiers)?
    const paramMatch = trimmed.match(
      /^[-*]\s+(?:\[(?:param|body\.param|query\.param|path\.param)\]|param:)\s+([a-zA-Z0-9_$]+)(?:\s*:\s*([a-zA-Z0-9_$[\]<>|]+))?(?:\s*\(([^)]+)\))?/i
    );
    if (paramMatch) {
      const name = paramMatch[1].trim();
      const type = paramMatch[2]?.trim() || 'string';
      const modifiers = paramMatch[3]?.toLowerCase() || '';
      const isRequired = modifiers.includes('required') || !modifiers.includes('optional');

      currentEndpoint.params.push({
        name,
        type,
        required: isRequired,
        specLine: lineNumber,
      });
      continue;
    }

    // - [status] 201 (Created) or - status: 201 (Created)
    const statusMatch = trimmed.match(
      /^[-*]\s+(?:\[(?:status|response\.status)\]|status:)\s*(\d{3})(?:\s*\(([^)]+)\))?/i
    );
    if (statusMatch) {
      const code = parseInt(statusMatch[1], 10);
      const desc = statusMatch[2]?.trim();
      currentEndpoint.statuses.push({
        code,
        description: desc,
        specLine: lineNumber,
      });
      continue;
    }
  }

  if (currentEndpoint) {
    endpoints.push(currentEndpoint);
  }

  return {
    title: currentTitle,
    sourceFile: filePath,
    endpoints,
  };
}
