/**
 * SextantDrift Phase 5: Mermaid sequenceDiagram Parser
 * 解析 Markdown 与架构设计文档中的 Mermaid 时序图规范
 */

import type { SequenceDiagramSpec, SequenceInteraction, SequenceArrowType } from './types.js';

const INTERACTION_REGEX = /^([A-Za-z0-9_]+)\s*(-->>|->>|--\)|-\)|-->|->)\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/;
const PARTICIPANT_ALIAS_REGEX = /^(?:participant|actor)\s+([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)/;
const PARTICIPANT_SIMPLE_REGEX = /^(?:participant|actor)\s+([A-Za-z0-9_]+)/;

/**
 * Parses a single Mermaid sequenceDiagram block.
 */
export function parseSequenceDiagram(mermaidContent: string, sourceDoc = 'unknown.md'): SequenceDiagramSpec {
  const lines = mermaidContent.split('\n');
  const aliasMap = new Map<string, string>();
  const participants: string[] = [];
  const interactions: SequenceInteraction[] = [];

  let foundHeader = false;
  let lineIndex = 0;

  for (const rawLine of lines) {
    lineIndex++;
    const trimmed = rawLine.trim();

    // Skip empty lines or comments
    if (!trimmed || trimmed.startsWith('%%')) {
      continue;
    }

    if (!foundHeader) {
      if (trimmed === 'sequenceDiagram' || trimmed.startsWith('sequenceDiagram')) {
        foundHeader = true;
        continue;
      } else {
        throw new Error('Not a valid Mermaid sequenceDiagram: missing sequenceDiagram header');
      }
    }

    // Ignore structural directives that don't affect interaction flow
    if (
      trimmed.startsWith('autonumber') ||
      trimmed.startsWith('title') ||
      trimmed.startsWith('box') ||
      trimmed === 'end' ||
      trimmed.startsWith('activate') ||
      trimmed.startsWith('deactivate') ||
      trimmed.startsWith('note')
    ) {
      continue;
    }

    // Check participant / actor with alias: participant C as OrderController
    const aliasMatch = trimmed.match(PARTICIPANT_ALIAS_REGEX);
    if (aliasMatch) {
      const alias = aliasMatch[1];
      const realName = aliasMatch[2];
      aliasMap.set(alias, realName);
      if (!participants.includes(realName)) {
        participants.push(realName);
      }
      continue;
    }

    // Check simple participant / actor: participant OrderController
    const simpleMatch = trimmed.match(PARTICIPANT_SIMPLE_REGEX);
    if (simpleMatch) {
      const name = simpleMatch[1];
      aliasMap.set(name, name);
      if (!participants.includes(name)) {
        participants.push(name);
      }
      continue;
    }

    // Check interaction line: A ->> B: msg
    const interactionMatch = trimmed.match(INTERACTION_REGEX);
    if (interactionMatch) {
      const rawSource = interactionMatch[1];
      const arrow = interactionMatch[2];
      const rawTarget = interactionMatch[3];
      const message = interactionMatch[4].trim();

      const source = aliasMap.get(rawSource) || rawSource;
      const target = aliasMap.get(rawTarget) || rawTarget;

      if (!participants.includes(source)) {
        participants.push(source);
      }
      if (!participants.includes(target)) {
        participants.push(target);
      }

      let type: SequenceArrowType = 'sync';
      if (arrow === '-->>' || arrow === '-->') {
        type = 'reply';
      } else if (arrow === '-)' || arrow === '--)') {
        type = 'async';
      }

      interactions.push({
        id: `seq-${interactions.length + 1}`,
        source,
        target,
        message,
        type,
        lineNumber: lineIndex,
      });
    }
  }

  if (!foundHeader) {
    throw new Error('Not a valid Mermaid sequenceDiagram: missing sequenceDiagram header');
  }

  return {
    participants,
    interactions,
    sourceDoc,
  };
}

/**
 * Extracts and parses all Mermaid sequence diagrams from a Markdown file.
 */
export function extractSequenceDiagrams(markdownContent: string, sourceDoc: string): SequenceDiagramSpec[] {
  const specs: SequenceDiagramSpec[] = [];
  const codeBlockRegex = /```(?:mermaid)?\s*([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(markdownContent)) !== null) {
    const blockContent = match[1];
    if (blockContent.includes('sequenceDiagram')) {
      try {
        const spec = parseSequenceDiagram(blockContent, sourceDoc);
        specs.push(spec);
      } catch {
        // Ignore non-sequence blocks or malformed fragments gracefully
      }
    }
  }

  return specs;
}
