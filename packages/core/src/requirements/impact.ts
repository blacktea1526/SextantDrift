import { ConfigValidationError } from '../errors/config-error.js';
import type { BusinessRequirementGraph, ReviewItem, ReviewScope } from './types.js';
import { compareUtf8 } from './order.js';

export function reviewScope(graph: BusinessRequirementGraph, entityId: string): ReviewScope {
  const entity = graph.entities.find((item) => item.id === entityId);
  if (!entity) {
    throw new ConfigValidationError(`Unknown business entity "${entityId}"`, {
      field: 'businessRequirements',
    });
  }

  const items: ReviewItem[] = [];
  for (const relation of graph.relations) {
    const otherId = relation.from === entityId ? relation.to : relation.to === entityId ? relation.from : undefined;
    if (!otherId) continue;
    const other = graph.entities.find((item) => item.id === otherId)!;
    const item: ReviewItem = {
      id: other.id,
      relation: relation.type,
      scope: 'review-scope',
    };
    if (other.kind === 'code' || other.kind === 'test') {
      const missing = other.kind === 'code' ? !other.source : !other.checkId;
      item.anchor = missing ? 'missing' : 'declared';
      if (other.kind === 'code' && other.source) item.source = other.source;
    }
    items.push(item);
  }

  items.sort((a, b) => compareUtf8(a.id, b.id) || compareUtf8(a.relation, b.relation));
  return { entityId, items };
}
