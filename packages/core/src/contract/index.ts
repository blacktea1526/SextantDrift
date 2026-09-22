import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { TargetContractSpec, ActualEndpoint } from './types.js';
import { parseMarkdownContract } from './markdown-parser.js';
import { extractEndpointsFromSource } from './ast-route-extractor.js';
import { diffContractAlignment } from './differencer.js';
import { lintContractSpec, contractLintIssuesToViolations } from './linter.js';
import { ViolationEvidence } from '../types/report.js';

export * from './types.js';
export * from './markdown-parser.js';
export * from './ast-route-extractor.js';
export * from './differencer.js';
export * from './linter.js';
export * from './fix-manifest.js';

export interface VerifyContractOptions {
  rootDir: string;
  contractPath?: string;
  contractContent?: string;
  files?: string[];
  fileContentMap?: Map<string, string>;
}

export interface ContractVerificationResult {
  passed: boolean;
  violations: ViolationEvidence[];
  targetSpec?: TargetContractSpec;
  actualEndpoints: ActualEndpoint[];
}

const DEFAULT_CONTRACT_FILENAMES = [
  'api-contract.md',
  'contract.md',
  'api-spec.md',
  '.sextant/contract.md',
  'docs/api-contract.md',
];

/**
 * Resolves contract file path if not explicitly provided.
 */
export function findContractFile(rootDir: string): string | null {
  for (const fn of DEFAULT_CONTRACT_FILENAMES) {
    const fullPath = path.resolve(rootDir, fn);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Executes lightweight contract alignment verification across source files.
 */
export function verifyContractAlignment(
  options: VerifyContractOptions
): ContractVerificationResult {
  const { rootDir, files = [] } = options;

  let contractPath = options.contractPath;
  let contractContent = options.contractContent;

  if (!contractContent) {
    if (!contractPath) {
      const found = findContractFile(rootDir);
      if (!found) {
        // No contract found, clean pass with empty endpoints
        return {
          passed: true,
          violations: [],
          actualEndpoints: [],
        };
      }
      contractPath = found;
    } else if (!path.isAbsolute(contractPath)) {
      const fromRoot = path.resolve(rootDir, contractPath);
      const fromCwd = path.resolve(process.cwd(), contractPath);
      if (fs.existsSync(fromRoot)) {
        contractPath = fromRoot;
      } else if (fs.existsSync(fromCwd)) {
        contractPath = fromCwd;
      } else {
        contractPath = fromRoot;
      }
    }

    if (!fs.existsSync(contractPath)) {
      return {
        passed: true,
        violations: [],
        actualEndpoints: [],
      };
    }

    contractContent = fs.readFileSync(contractPath, 'utf-8');
  }

  const relContractPath = contractPath ? path.relative(rootDir, contractPath) : 'api-contract.md';
  const targetSpec = parseMarkdownContract(contractContent, relContractPath);
  const lintIssues = lintContractSpec(contractContent, relContractPath, targetSpec);
  const lintViolations = contractLintIssuesToViolations(lintIssues);

  // If no endpoints declared in spec and no lint errors, nothing to verify
  if (targetSpec.endpoints.length === 0 && lintViolations.length === 0) {
    return {
      passed: true,
      violations: [],
      targetSpec,
      actualEndpoints: [],
    };
  }

  // Extract endpoints from all scanned source files (filter controller/route/api/src files)
  const actualEndpoints: ActualEndpoint[] = [];

  for (const file of files) {
    const absPath = path.isAbsolute(file) ? file : path.resolve(rootDir, file);
    const relPath = path.isAbsolute(file) ? path.relative(rootDir, file) : file;

    // Fast heuristic: only files that might be controllers/routes
    const lower = file.toLowerCase();
    const isControllerLike =
      lower.includes('controller') ||
      lower.includes('route') ||
      lower.includes('api') ||
      lower.includes('handler') ||
      lower.includes('server') ||
      lower.includes('app');

    if (!isControllerLike && files.length > 50) {
      continue;
    }

    try {
      const sourceCode =
        options.fileContentMap?.get(relPath) ||
        options.fileContentMap?.get(file) ||
        (fs.existsSync(absPath) ? fs.readFileSync(absPath, 'utf-8') : null);

      if (!sourceCode) continue;

      // Short-circuit: if file doesn't contain route keywords, skip AST creation
      if (
        !sourceCode.includes('router.') &&
        !sourceCode.includes('app.') &&
        !sourceCode.includes('@Controller') &&
        !sourceCode.includes('@Get') &&
        !sourceCode.includes('@Post') &&
        !sourceCode.includes('export async function GET') &&
        !sourceCode.includes('export async function POST')
      ) {
        continue;
      }

      const sf = ts.createSourceFile(relPath, sourceCode, ts.ScriptTarget.Latest, true);
      const extracted = extractEndpointsFromSource(sf, relPath);
      actualEndpoints.push(...extracted);
    } catch {
      // Ignore parse errors on unsupported files
    }
  }

  const diffViolations = diffContractAlignment(targetSpec, actualEndpoints);
  const violations = [...lintViolations, ...diffViolations];

  return {
    passed: violations.length === 0,
    violations,
    targetSpec,
    actualEndpoints,
  };
}
