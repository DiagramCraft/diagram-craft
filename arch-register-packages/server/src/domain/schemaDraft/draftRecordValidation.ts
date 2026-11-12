import type { EntityDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult } from '../catalog/db/relationDatabase';
import { evaluateValidationRules } from '../catalog/entityValidationRules';
import { buildEntityProjection } from '../derived/entityProjection';
import type { CatalogSnapshot } from './draftCatalog';

export type RecordProblemKind =
  | 'schema_deleted'
  | 'required_missing'
  | 'invalid_option'
  | 'endpoint_not_allowed'
  | 'validation_rule';

export type RecordProblemGroup = {
  /** Entity schema or relation schema id. */
  schemaId: string;
  schemaName: string;
  recordType: 'entity' | 'relation';
  fieldId: string | null;
  fieldName: string | null;
  problem: RecordProblemKind;
  count: number;
  examples: { recordId: string; message: string }[];
};

export type RecordValidationResult = {
  entitiesChecked: number;
  relationsChecked: number;
  problemCount: number;
  groups: RecordProblemGroup[];
};

const MAX_EXAMPLES = 5;

const isEmpty = (value: unknown) =>
  value == null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0);

/**
 * Pure: checks existing records against a (draft) catalog snapshot. Reports only problems that the
 * live catalog does not already have, so the numbers reflect what the draft would cause.
 */
export const validateRecordsAgainstCatalog = (
  live: CatalogSnapshot,
  draft: CatalogSnapshot,
  entities: readonly EntityDbResult[],
  relations: readonly RelationDbResult[]
): RecordValidationResult => {
  const groups = new Map<string, RecordProblemGroup>();
  const add = (
    schemaId: string,
    schemaName: string,
    recordType: 'entity' | 'relation',
    fieldId: string | null,
    fieldName: string | null,
    problem: RecordProblemKind,
    recordId: string,
    message: string
  ) => {
    const key = `${recordType}|${schemaId}|${fieldId ?? ''}|${problem}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        schemaId,
        schemaName,
        recordType,
        fieldId,
        fieldName,
        problem,
        count: 0,
        examples: []
      };
      groups.set(key, group);
    }
    group.count++;
    if (group.examples.length < MAX_EXAMPLES) group.examples.push({ recordId, message });
  };

  const draftSchemas = new Map(draft.schemas.map(s => [s.id, s]));
  const liveSchemas = new Map(live.schemas.map(s => [s.id, s]));
  const draftRelationSchemas = new Map(draft.relationSchemas.map(s => [s.id, s]));
  const liveRelationSchemas = new Map(live.relationSchemas.map(s => [s.id, s]));
  const enumOptions = new Map(draft.enums.map(e => [e.id, new Set(e.options.map(o => o.value))]));
  const liveEnumOptions = new Map(
    live.enums.map(e => [e.id, new Set(e.options.map(o => o.value))])
  );

  type AnyField = {
    id: string;
    name: string;
    type: string;
    enumId?: string;
    requirementLevel?: string | null;
  };
  const checkFields = (
    recordType: 'entity' | 'relation',
    record: { id: string; data: Record<string, unknown> },
    schemaId: string,
    schemaName: string,
    fields: AnyField[],
    liveFields: AnyField[] | undefined
  ) => {
    const liveById = new Map((liveFields ?? []).map(f => [f.id, f]));
    for (const field of fields) {
      if (field.type === 'derived') continue;
      const value = record.data[field.id];
      const before = liveById.get(field.id);
      if (
        field.requirementLevel === 'required' &&
        isEmpty(value) &&
        before?.requirementLevel !== 'required'
      ) {
        add(
          schemaId,
          schemaName,
          recordType,
          field.id,
          field.name,
          'required_missing',
          record.id,
          `"${field.name}" is required but empty`
        );
      }
      if (field.type === 'select' && field.enumId && !isEmpty(value)) {
        const allowed = enumOptions.get(field.enumId);
        const wasAllowed = liveEnumOptions.get(before?.enumId ?? field.enumId);
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          if (typeof v !== 'string' || !allowed || allowed.has(v)) continue;
          if (before && wasAllowed && !wasAllowed.has(v)) continue; // already invalid in live
          add(
            schemaId,
            schemaName,
            recordType,
            field.id,
            field.name,
            'invalid_option',
            record.id,
            `"${v}" is not an option of the enum used by "${field.name}"`
          );
        }
      }
    }
  };

  for (const entity of entities) {
    const schema = draftSchemas.get(entity.schema_id);
    const before = liveSchemas.get(entity.schema_id);
    if (!schema) {
      if (before) {
        add(
          entity.schema_id,
          before.name,
          'entity',
          null,
          null,
          'schema_deleted',
          entity.id,
          `Schema "${before.name}" is deleted in the draft`
        );
      }
      continue;
    }
    checkFields(
      'entity',
      entity,
      schema.id,
      schema.name,
      schema.fields as AnyField[],
      before?.fields as AnyField[] | undefined
    );

    const rules = schema.validation_rules ?? [];
    const liveRules = before?.validation_rules ?? [];
    if (rules.length > 0 && JSON.stringify(rules) !== JSON.stringify(liveRules)) {
      const projection = buildEntityProjection(
        entity.id,
        entities as EntityDbResult[],
        draft.schemas,
        relations as RelationDbResult[],
        draft.relationSchemas,
        { depth: 1 }
      );
      if (projection) {
        try {
          const result = evaluateValidationRules(rules, projection, {
            id: entity.id,
            schemaId: schema.id,
            schemaVersion: schema.version ?? 1
          });
          for (const diagnostic of result.errors) {
            const ruleFieldId = (diagnostic as { fieldId?: string }).fieldId ?? null;
            add(
              schema.id,
              schema.name,
              'entity',
              ruleFieldId,
              schema.fields.find(f => f.id === ruleFieldId)?.name ?? null,
              'validation_rule',
              entity.id,
              diagnostic.message
            );
          }
        } catch {
          // An invalid rule set is already reported as a dependency finding.
        }
      }
    }
  }

  const entitySchemaIdById = new Map(entities.map(e => [e.id, e.schema_id]));
  for (const relation of relations) {
    const schema = draftRelationSchemas.get(relation.schema_id);
    const before = liveRelationSchemas.get(relation.schema_id);
    if (!schema) {
      if (before) {
        add(
          relation.schema_id,
          before.name,
          'relation',
          null,
          null,
          'schema_deleted',
          relation.id,
          `Relation type "${before.name}" is deleted in the draft`
        );
      }
      continue;
    }
    checkFields(
      'relation',
      relation,
      schema.id,
      schema.name,
      schema.fields as AnyField[],
      before?.fields as AnyField[] | undefined
    );
    const ends = [
      ['in', relation.in_entity_id, schema.in_schema_ids, before?.in_schema_ids],
      ['out', relation.out_entity_id, schema.out_schema_ids, before?.out_schema_ids]
    ] as const;
    for (const [side, entityId, allowed, liveAllowed] of ends) {
      const entitySchemaId =
        relation[side === 'in' ? 'in_entity_schema_id' : 'out_entity_schema_id'] ??
        entitySchemaIdById.get(entityId);
      if (!entitySchemaId || allowed === 'any' || allowed.includes(entitySchemaId)) continue;
      if (liveAllowed && liveAllowed !== 'any' && !liveAllowed.includes(entitySchemaId)) continue;
      add(
        schema.id,
        schema.name,
        'relation',
        null,
        null,
        'endpoint_not_allowed',
        relation.id,
        `The ${side} endpoint's schema is no longer allowed by "${schema.name}"`
      );
    }
  }

  const list = [...groups.values()].sort((a, b) => b.count - a.count);
  return {
    entitiesChecked: entities.length,
    relationsChecked: relations.length,
    problemCount: list.reduce((n, g) => n + g.count, 0),
    groups: list
  };
};
