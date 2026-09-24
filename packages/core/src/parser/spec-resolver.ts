import fs from 'node:fs';
import path from 'node:path';
import { TargetArchitecture } from '../types/architecture.js';
import { parseJsonSpec } from './json-spec-parser.js';
import {
  extractMermaidFromMarkdown,
  extractMermaidBlocksFromMarkdown,
  parseMermaidArchitecture,
} from './mermaid-adapter.js';
import { extractInvariantsFromMarkdown } from '../invariants/parser.js';
import { ConfigValidationError } from '../errors/config-error.js';

function attachMarkdownInvariants(arch: TargetArchitecture, ...markdownContents: string[]): void {
  const invariants = arch.invariants ? [...arch.invariants] : [];
  const seenIds = new Set(invariants.map((r) => r.id));

  for (const md of markdownContents) {
    if (!md) continue;
    const extracted = extractInvariantsFromMarkdown(md);
    for (const rule of extracted) {
      if (!seenIds.has(rule.id)) {
        invariants.push(rule);
        seenIds.add(rule.id);
      }
    }
  }

  arch.invariants = invariants;
}

function getRootDirMarkdownContents(rootDir: string): string[] {
  const mdPaths = [
    path.resolve(rootDir, 'ARCHITECTURE.md'),
    path.resolve(rootDir, 'AGENTS.md'),
  ];
  const contents: string[] = [];
  for (const p of mdPaths) {
    if (fs.existsSync(p)) {
      try {
        contents.push(fs.readFileSync(p, 'utf-8'));
      } catch {
        // ignore read errors
      }
    }
  }
  return contents;
}

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
      const arch = parseJsonSpec(content);
      attachMarkdownInvariants(arch, ...getRootDirMarkdownContents(rootDir));
      return arch;
    }
    const candidateBlocks = extractMermaidBlocksFromMarkdown(content);
    for (const mermaid of candidateBlocks) {
      try {
        const arch = parseMermaidArchitecture(mermaid);
        attachMarkdownInvariants(arch, content, ...getRootDirMarkdownContents(rootDir));
        return arch;
      } catch {
        continue;
      }
    }
    throw new ConfigValidationError(
      `File ${fullPath} is neither valid JSON nor contains a valid Mermaid architecture diagram`
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
      const arch = parseJsonSpec(content);
      attachMarkdownInvariants(arch, ...getRootDirMarkdownContents(rootDir));
      return arch;
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
      const candidateBlocks = extractMermaidBlocksFromMarkdown(content);
      for (const mermaid of candidateBlocks) {
        try {
          const arch = parseMermaidArchitecture(mermaid);
          attachMarkdownInvariants(arch, content, ...getRootDirMarkdownContents(rootDir));
          return arch;
        } catch {
          // If this block is not an architecture diagram, try next
          continue;
        }
      }
    }
  }

  throw new ConfigValidationError(
    `No architecture specification found in ${rootDir}. Expected sextant.json, .sextant/architecture.json, ARCHITECTURE.md, or AGENTS.md with Mermaid architecture diagram.`
  );
}
