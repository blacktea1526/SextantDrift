import { ViolationEvidence } from '../types/report.js';

export type FixAction =
  | 'REMOVE_ROUTE'
  | 'IMPLEMENT_ROUTE'
  | 'ADD_PARAM'
  | 'HANDLE_STATUS'
  | 'FIX_SPEC'
  | 'REMOVE_BYPASS'
  | 'INVERT_DEP'
  | 'BREAK_CYCLE'
  | 'REMOVE_IMPORT'
  | 'FIX_INVARIANT'
  | 'FIX_STATE_DEADLOCK'
  | 'CONNECT_STATE'
  | 'ADD_TIMEOUT_FALLBACK'
  | 'REORDER_CALLS'
  | 'REMOVE_CALL'
  | 'ADD_CALL'
  | 'RESOLVE_DRIFT';

/**
 * Maps drift violation types to concise, deterministic remediation actions for AI agents.
 */
export function determineFixAction(type: string): FixAction {
  switch (type) {
    case 'CONTRACT_SHADOW_ENDPOINT':
      return 'REMOVE_ROUTE';
    case 'CONTRACT_MISSING_ENDPOINT':
      return 'IMPLEMENT_ROUTE';
    case 'CONTRACT_MISSING_PARAM':
      return 'ADD_PARAM';
    case 'CONTRACT_UNHANDLED_STATUS':
      return 'HANDLE_STATUS';
    case 'CONTRACT_LINT_ERROR':
      return 'FIX_SPEC';
    case 'CRITICAL_BYPASS':
      return 'REMOVE_BYPASS';
    case 'CRITICAL_INVERSION':
      return 'INVERT_DEP';
    case 'CRITICAL_CYCLE':
      return 'BREAK_CYCLE';
    case 'CRITICAL_FORBIDDEN_IMPORT':
      return 'REMOVE_IMPORT';
    case 'INVARIANT_BROKEN':
      return 'FIX_INVARIANT';
    case 'STATE_DEADLOCK':
      return 'FIX_STATE_DEADLOCK';
    case 'STATE_UNREACHABLE':
      return 'CONNECT_STATE';
    case 'STATE_MISSING_FALLBACK':
      return 'ADD_TIMEOUT_FALLBACK';
    case 'DYNAMIC_OUT_OF_ORDER':
      return 'REORDER_CALLS';
    case 'DYNAMIC_UNEXPECTED_CALL':
      return 'REMOVE_CALL';
    case 'DYNAMIC_MISSING_CALL':
      return 'ADD_CALL';
    default:
      return 'RESOLVE_DRIFT';
  }
}

/**
 * Estimates token consumption using standard ~3.8 chars/token approximation.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Generates an ultra-compact YAML Fix Manifest designed specifically for LLM context windows.
 * Cuts token footprint by 80%+ compared to verbose JSON reports or terminal ANSI text.
 */
export function generateAiFixManifest(violations: ViolationEvidence[]): string {
  if (!violations || violations.length === 0) {
    return [
      '# SextantDrift AI Fix Manifest',
      '# Clean: 0 architectural drifts detected',
      'fixes: []',
    ].join('\n');
  }

  const lines: string[] = [
    '# SextantDrift AI Fix Manifest',
    `# Total drifts: ${violations.length} | High-density signal format (<15% raw tokens)`,
    'fixes:',
  ];

  for (const v of violations) {
    const action = determineFixAction(v.type);
    const loc = `${v.sourceFile}:${v.line}`;
    lines.push(`  - type: ${v.type}`);
    lines.push(`    file: ${loc}`);
    lines.push(`    action: ${action}`);

    // Extract target identifier (route, component, import target)
    let target = v.targetComponent || v.targetCall;
    if (!target) {
      if (v.type.startsWith('CONTRACT_')) {
        const match = v.id.match(/(?:GET|POST|PUT|DELETE|PATCH|ALL)_[^_\s]+/i);
        target = match ? match[0].replace('_', ' ') : v.snippet;
      } else {
        target = v.snippet;
      }
    }
    if (target) {
      lines.push(`    target: ${target.replace(/[\r\n]+/g, ' ').trim()}`);
    }

    if (v.suggestion) {
      lines.push(`    fix: ${v.suggestion.replace(/[\r\n]+/g, ' ').trim()}`);
    }
  }

  return lines.join('\n');
}

/**
 * Wraps the Fix Manifest into a ready-to-execute prompt for AI coding assistants.
 */
export function generateAiFixPrompt(violations: ViolationEvidence[]): string {
  const manifest = generateAiFixManifest(violations);
  return [
    `Please resolve the following ${violations.length} architectural & contract drifts detected by SextantDrift:`,
    '',
    '```yaml',
    manifest,
    '```',
    '',
    'Instructions:',
    '1. For each item in `fixes`, locate the file and line number.',
    '2. Apply the specified `action` following the `fix` recommendation.',
    '3. Preserve existing architectural invariants and verify with `npx sextant-drift check`.',
  ].join('\n');
}
