import { StateMachineGraph, StateNode, StateTransition } from './types.js';

export interface ExtractedStateDiagram {
  code: string;
  title?: string;
  sourceFile: string;
  startLine: number;
}

/**
 * Extracts Mermaid stateDiagram blocks from markdown content
 */
export function extractStateDiagramsFromMarkdown(
  markdownText: string,
  sourceFile = 'spec.md'
): ExtractedStateDiagram[] {
  const diagrams: ExtractedStateDiagram[] = [];
  const lines = markdownText.split('\n');

  let inBlock = false;
  let blockStartLine = 0;
  let blockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inBlock) {
      if (trimmed.startsWith('```mermaid')) {
        inBlock = true;
        blockStartLine = i + 1;
        blockLines = [];
      }
    } else {
      if (trimmed.startsWith('```')) {
        inBlock = false;
        const code = blockLines.join('\n');
        if (code.includes('stateDiagram') || code.includes('stateDiagram-v2')) {
          // Look for title preceding the block or in comments
          let title: string | undefined;
          for (let j = blockStartLine - 2; j >= Math.max(0, blockStartLine - 6); j--) {
            const prevLine = lines[j].trim();
            if (prevLine.startsWith('#')) {
              title = prevLine.replace(/^#+\s*/, '').trim();
              break;
            }
          }

          diagrams.push({
            code,
            title,
            sourceFile,
            startLine: blockStartLine,
          });
        }
        blockLines = [];
      } else {
        blockLines.push(line);
      }
    }
  }

  // Also handle raw state diagram without code fences (only if the text actually starts with stateDiagram)
  const trimmed = markdownText.trim();
  if (
    diagrams.length === 0 &&
    (trimmed.startsWith('stateDiagram') || trimmed.startsWith('stateDiagram-v2'))
  ) {
    diagrams.push({
      code: markdownText,
      sourceFile,
      startLine: 1,
    });
  }

  return diagrams;
}

export interface ParseStateDiagramOptions {
  sourceFile?: string;
  startLine?: number;
  title?: string;
}

/**
 * Parses Mermaid stateDiagram-v2 syntax into a StateMachineGraph
 */
export function parseStateDiagram(
  mermaidCode: string,
  options: ParseStateDiagramOptions = {}
): StateMachineGraph {
  const sourceFile = options.sourceFile || 'unknown.mmd';
  const startLine = options.startLine || 1;
  const title = options.title;

  const rawLines = mermaidCode.split('\n');
  const nodes = new Map<string, StateNode>();
  const transitions: StateTransition[] = [];

  const getOrCreateNode = (id: string, lineNum?: number): StateNode => {
    let node = nodes.get(id);
    if (!node) {
      node = {
        id,
        name: id,
        isInitial: id === '[*]',
        isTerminal: id === '[*]',
        isChoice: false,
        inDegree: 0,
        outDegree: 0,
        line: lineNum,
      };
      nodes.set(id, node);
    }
    return node;
  };

  let inNoteBlock = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    const currentLineNumber = startLine + i;

    if (!trimmed) continue;
    if (trimmed.startsWith('%%')) continue;
    if (trimmed.startsWith('stateDiagram') || trimmed.startsWith('stateDiagram-v2')) continue;

    // Handle multiline notes
    if (trimmed.startsWith('note right of') || trimmed.startsWith('note left of') || trimmed.startsWith('note ')) {
      if (!trimmed.includes('end note')) {
        inNoteBlock = true;
      }
      continue;
    }
    if (inNoteBlock) {
      if (trimmed.includes('end note')) {
        inNoteBlock = false;
      }
      continue;
    }

    // Choice / fork / join: state check_state <<choice>>
    const choiceMatch = trimmed.match(/^state\s+([A-Za-z0-9_]+)\s*<<(choice|fork|join)>>/i);
    if (choiceMatch) {
      const id = choiceMatch[1];
      const node = getOrCreateNode(id, currentLineNumber);
      node.isChoice = true;
      continue;
    }

    // Transition: from --> to : label
    const transMatch = trimmed.match(/^(\[\*\]|[A-Za-z0-9_]+)\s*--+>\s*(\[\*\]|[A-Za-z0-9_]+)(?:\s*:\s*(.*))?$/);
    if (transMatch) {
      const fromId = transMatch[1];
      const toId = transMatch[2];
      const rawLabel = transMatch[3]?.trim();

      let event: string | undefined;
      let condition: string | undefined;

      if (rawLabel) {
        const condMatch = rawLabel.match(/^(.*?)(?:\[(.*?)\])?$/);
        if (condMatch) {
          event = condMatch[1]?.trim() || undefined;
          condition = condMatch[2]?.trim() || undefined;
        } else {
          event = rawLabel;
        }
      }

      const fromNode = getOrCreateNode(fromId, currentLineNumber);
      const toNode = getOrCreateNode(toId, currentLineNumber);

      fromNode.outDegree++;
      toNode.inDegree++;

      if (fromId === '[*]') {
        fromNode.isInitial = true;
      }
      if (toId === '[*]') {
        toNode.isTerminal = true;
      }

      transitions.push({
        from: fromId,
        to: toId,
        event,
        condition,
        line: currentLineNumber,
        raw: trimmed,
      });
      continue;
    }

    // State description: StateId: Description
    const descMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (descMatch) {
      const id = descMatch[1];
      const description = descMatch[2].trim();
      const node = getOrCreateNode(id, currentLineNumber);
      node.description = description;
      continue;
    }

    // Single standalone state definition: StateId
    const singleStateMatch = trimmed.match(/^([A-Za-z0-9_]+)$/);
    if (singleStateMatch) {
      const id = singleStateMatch[1];
      getOrCreateNode(id, currentLineNumber);
      continue;
    }
  }

  const diagramId = title || options.sourceFile || 'state-machine';

  return {
    id: diagramId,
    title,
    nodes,
    transitions,
    sourceFile,
    startLine,
  };
}
