import { ConfigValidationError } from '../errors/config-error.js';
import type { AcceptanceConfig } from '../acceptance/types.js';
import {
  ENTITY_KINDS,
  ENTITY_PREFIX,
  RELATION_TYPES,
  type BusinessEntity,
  type BusinessRelation,
  type BusinessRequirementGraph,
  type EntityKind,
  type RelationType,
} from './types.js';
import { compareUtf8 } from './order.js';

const SHORTHAND: Record<string, { type: RelationType; direction: 'out' | 'in'; many: boolean }> = {
  flows: { type: 'includes', direction: 'out', many: true },
  trigger: { type: 'triggers', direction: 'out', many: false },
  preconditions: { type: 'constrains', direction: 'in', many: true },
  rules: { type: 'constrains', direction: 'in', many: true },
  effects: { type: 'produces', direction: 'out', many: true },
  acceptance: { type: 'verified_by', direction: 'out', many: true },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string, field: string): never {
  throw new ConfigValidationError(message, { field });
}

function readIdList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    fail(`${field} must be an array of entity ids`, field);
  }
  return value as string[];
}

function openQuestions(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${field} must be an array`, field);
  const texts: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') {
      if (!item.trim()) fail(`${field} contains an empty question`, field);
      texts.push(item);
      continue;
    }
    if (isRecord(item) && typeof item.text === 'string' && item.text.trim()) {
      const open = item.open === undefined ? true : item.open === true;
      if (open) texts.push(item.text);
      continue;
    }
    fail(`${field} contains a question without text`, field);
  }
  return [...new Set(texts)].sort(compareUtf8);
}

export function parseBusinessRequirements(
  input: unknown,
  acceptance?: AcceptanceConfig,
): BusinessRequirementGraph {
  if (!isRecord(input)) {
    fail('businessRequirements must be an object', 'businessRequirements');
  }
  if (!Array.isArray(input.entities) || input.entities.length === 0) {
    fail('businessRequirements.entities must be a non-empty array', 'businessRequirements.entities');
  }

  const entities: BusinessEntity[] = [];
  const byId = new Map<string, BusinessEntity>();
  const shorthand: { owner: string; field: string; ids: string[] }[] = [];

  for (let i = 0; i < input.entities.length; i++) {
    const raw = input.entities[i];
    const field = `businessRequirements.entities[${i}]`;
    if (!isRecord(raw)) fail(`${field} must be an object`, field);
    if (typeof raw.id !== 'string' || !raw.id.trim()) fail(`${field}.id must be a non-empty string`, `${field}.id`);
    if (typeof raw.kind !== 'string' || !ENTITY_KINDS.includes(raw.kind as EntityKind)) {
      fail(`${field}.kind is not a business entity kind`, `${field}.kind`);
    }
    const kind = raw.kind as EntityKind;
    const id = raw.id;
    if (!id.startsWith(ENTITY_PREFIX[kind])) {
      fail(`Entity id "${id}" does not match kind ${kind}`, `${field}.id`);
    }
    if (byId.has(id)) fail(`Duplicate entity id "${id}"`, `${field}.id`);
    if (typeof raw.title !== 'string' || !raw.title.trim()) {
      fail(`Entity "${id}" must have a title`, `${field}.title`);
    }

    const entity: BusinessEntity = { id, kind, title: raw.title };
    if (typeof raw.status === 'string') entity.status = raw.status;
    if (typeof raw.actor === 'string') entity.actor = raw.actor;
    if (typeof raw.source === 'string' && raw.source.trim()) entity.source = raw.source;
    if (typeof raw.checkId === 'string' && raw.checkId.trim()) entity.checkId = raw.checkId;
    const questions = openQuestions(raw.questions, `${field}.questions`);
    if (questions.length > 0) entity.questions = questions;

    if (kind !== 'requirement') {
      for (const name of Object.keys(SHORTHAND)) {
        if (raw[name] !== undefined) {
          fail(`Entity "${id}" is not a requirement and cannot declare ${name}`, `${field}.${name}`);
        }
      }
    }

    if (kind === 'requirement') {
      for (const [name, rule] of Object.entries(SHORTHAND)) {
        if (raw[name] === undefined) continue;
        const ids = rule.many
          ? readIdList(raw[name], `${field}.${name}`)
          : typeof raw[name] === 'string' && raw[name].trim()
            ? [raw[name] as string]
            : fail(`${field}.${name} must be an entity id`, `${field}.${name}`);
        shorthand.push({ owner: id, field: `${field}.${name}`, ids });
      }
    }

    entities.push(entity);
    byId.set(id, entity);
  }

  if (acceptance) {
    const known = new Set(acceptance.checks.map((check) => check.id));
    for (const entity of entities) {
      if (entity.kind === 'test' && entity.checkId && !known.has(entity.checkId)) {
        fail(
          `Test entity "${entity.id}" references unknown acceptance check "${entity.checkId}"`,
          `businessRequirements.entities.${entity.id}.checkId`,
        );
      }
    }
  }

  const relations: BusinessRelation[] = [];
  const pairType = new Map<string, RelationType>();

  const addRelation = (from: string, to: string, type: RelationType, field: string) => {
    if (!byId.has(from)) fail(`Relation references missing id "${from}"`, field);
    if (!byId.has(to)) fail(`Relation references missing id "${to}"`, field);
    const key = `${from}\0${to}`;
    const existing = pairType.get(key);
    if (existing && existing !== type) {
      fail(`Entity pair "${from}" and "${to}" has conflicting relation types "${existing}" and "${type}"`, field);
    }
    if (existing === type) return;
    pairType.set(key, type);
    relations.push({ from, to, type });
  };

  for (const entry of shorthand) {
    const rule = SHORTHAND[entry.field.slice(entry.field.lastIndexOf('.') + 1)]!;
    for (const target of entry.ids) {
      if (!byId.has(target)) fail(`Relation references missing id "${target}"`, entry.field);
      if (rule.direction === 'out') addRelation(entry.owner, target, rule.type, entry.field);
      else addRelation(target, entry.owner, rule.type, entry.field);
    }
  }

  if (input.relations !== undefined) {
    if (!Array.isArray(input.relations)) {
      fail('businessRequirements.relations must be an array', 'businessRequirements.relations');
    }
    for (let i = 0; i < input.relations.length; i++) {
      const raw = input.relations[i];
      const field = `businessRequirements.relations[${i}]`;
      if (!isRecord(raw)) fail(`${field} must be an object`, field);
      if (typeof raw.from !== 'string' || typeof raw.to !== 'string') {
        fail(`${field} must name from and to`, field);
      }
      if (typeof raw.type !== 'string' || !RELATION_TYPES.includes(raw.type as RelationType)) {
        fail(`${field}.type is not a relation type`, `${field}.type`);
      }
      addRelation(raw.from, raw.to, raw.type as RelationType, field);
    }
  }

  entities.sort((a, b) => compareUtf8(a.id, b.id));
  relations.sort((a, b) => compareUtf8(a.from, b.from) || compareUtf8(a.to, b.to) || compareUtf8(a.type, b.type));
  return { entities, relations };
}
