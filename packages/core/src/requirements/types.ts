export const ENTITY_KINDS = [
  'requirement',
  'flow',
  'rule',
  'event',
  'state',
  'test',
  'code',
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ENTITY_PREFIX: Record<EntityKind, string> = {
  requirement: 'BR-',
  flow: 'FLOW-',
  rule: 'RULE-',
  event: 'EVENT-',
  state: 'STATE-',
  test: 'TC-',
  code: 'CODE-',
};

export const RELATION_TYPES = [
  'includes',
  'triggers',
  'constrains',
  'produces',
  'affects',
  'implemented_by',
  'verified_by',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export interface BusinessEntity {
  id: string;
  kind: EntityKind;
  title: string;
  status?: string;
  actor?: string;
  source?: string;
  checkId?: string;
  questions?: string[];
}

export interface BusinessRelation {
  from: string;
  to: string;
  type: RelationType;
}

/** Canonical graph. Entities and relations are sorted. Shorthand lists are not retained. */
export interface BusinessRequirementGraph {
  entities: BusinessEntity[];
  relations: BusinessRelation[];
}

export interface ReviewItem {
  id: string;
  relation: RelationType;
  scope: 'review-scope';
  anchor?: 'declared' | 'missing';
  source?: string;
}

export interface ReviewScope {
  entityId: string;
  items: ReviewItem[];
}

export interface BusinessRequirementView {
  structured: string;
  mermaid: string;
}
