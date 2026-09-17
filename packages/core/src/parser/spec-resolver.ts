import fs from 'node:fs';
import path from 'node:path';
import { TargetArchitecture } from '../types/architecture.js';
import { parseJsonSpec } from './json-spec-parser.js';
import { extractMermaidFromMarkdown, parseMermaidArchitecture } from './mermaid-adapter.js';
import { ConfigValidationError } from '../errors/config-error.js';

export function resolveTargetArchitecture(
  rootDir: string,
  customSpecPath?: string
): TargetArchitecture {
  // 1. Explicit path
  if (customSpecPath) {
    const fullPath = path.isAbsolute(customSpecPath)
      ? customSpecPath
      : path.resolve(rootDir, customSpecPath);

    if (!fs.existsSync(fullPath)) {
      throw new ConfigValidationError(`Custom architecture spec not found at: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    if (fullPath.endsWith('.json')) {
      return parseJsonSpec(content);
    }
    const mermaid = extractMermaidFromMarkdown(content);
    if (mermaid) {
      return parseMermaidArchitecture(mermaid);
    }
    throw new ConfigValidationError(
      `File ${fullPath} is neither valid JSON nor contains a Mermaid diagram`
    );
  }

  // 2. Default JSON locations: sextant.json, .sextant/architecture.json
  const defaultJsonPaths = [
    path.resolve(rootDir, 'sextant.json'),
    path.resolve(rootDir, '.sextant/architecture.json'),
  ];

  for (const jsonPath of defaultJsonPaths) {
    if (fs.existsSync(jsonPath)) {
      const content = fs.readFileSync(jsonPath, 'utf-8');
      return parseJsonSpec(content);
    }
  }

  // 3. Fallback Markdown locations: ARCHITECTURE.md, AGENTS.md
  const fallbackMarkdownPaths = [
    path.resolve(rootDir, 'ARCHITECTURE.md'),
    path.resolve(rootDir, 'AGENTS.md'),
  ];

  for (const mdPath of fallbackMarkdownPaths) {
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, 'utf-8');
      const mermaid = extractMermaidFromMarkdown(content);
      if (mermaid) {
        try {
          return parseMermaidArchitecture(mermaid);
        } catch {
          // If markdown contains an unrelated mermaid diagram, continue to next fallback
          continue;
        }
      }
    }
  }

  throw new ConfigValidationError(
    `No architecture specification found in ${rootDir}. Expected sextant.json, .sextant/architecture.json, ARCHITECTURE.md, or AGENTS.md with Mermaid architecture diagram.`
  );
}
