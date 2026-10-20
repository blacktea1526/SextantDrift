import type { BusinessRequirementGraph, BusinessRequirementView } from './types.js';
import { stableStringify } from './order.js';

function mermaidLabel(text: string): string {
  return text.replace(/"/g, '#quot;');
}

export function projectStructured(graph: BusinessRequirementGraph): string {
  return stableStringify({ entities: graph.entities, relations: graph.relations });
}

export function projectMermaid(graph: BusinessRequirementGraph): string {
  const lines = ['flowchart TD'];
  const nodeId = new Map<string, string>();
  graph.entities.forEach((entity, index) => {
    const id = `n${index}`;
    nodeId.set(entity.id, id);
    const question = entity.questions?.length ? `<br/>${entity.questions.join('<br/>')}` : '';
    lines.push(`  ${id}["${mermaidLabel(`${entity.id} ${entity.title}${question}`)}"]`);
  });
  for (const relation of graph.relations) {
    lines.push(
      `  ${nodeId.get(relation.from)} -->|"${mermaidLabel(relation.type)}"| ${nodeId.get(relation.to)}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

export function projectBusinessRequirements(graph: BusinessRequirementGraph): BusinessRequirementView {
  return {
    structured: projectStructured(graph),
    mermaid: projectMermaid(graph),
  };
}
