import type { DatabaseAdapter } from '../../db/database';
import { ENTITY_DEFAULTS } from '../../constants';

type EnumField = {
  id: string;
  type: string;
  enumId?: string;
};

const collectEnumFieldIds = (
  schemas: readonly { id: string; fields: readonly EnumField[] }[],
  enumId: string
) => {
  const fieldIdsBySchema = new Map<string, Set<string>>();
  for (const schema of schemas) {
    const fieldIds = schema.fields
      .filter(field => field.type === 'select' && field.enumId === enumId)
      .map(field => field.id);
    if (fieldIds.length > 0) fieldIdsBySchema.set(schema.id, new Set(fieldIds));
  }
  return fieldIdsBySchema;
};

const addUsedValues = (
  usedValues: Set<string>,
  data: Record<string, unknown>,
  fieldIds: Set<string>
) => {
  for (const fieldId of fieldIds) {
    const rawValue = data[fieldId];
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (typeof value === 'string') usedValues.add(value);
    }
  }
};

const listAllRelations = async (db: DatabaseAdapter, workspace: string) => {
  const relations = [];
  let offset = 0;
  while (true) {
    const page = await db.relation.listRelations(
      workspace,
      {},
      { limit: ENTITY_DEFAULTS.PAGE_SIZE, offset }
    );
    relations.push(...page.items);
    if (page.items.length === 0 || relations.length >= page.total) break;
    offset += page.items.length;
  }
  return relations;
};

export const listUsedEnumOptionValues = async (
  db: DatabaseAdapter,
  workspace: string,
  enumId: string
): Promise<Set<string>> => {
  const [schemas, relationSchemas] = await Promise.all([
    db.catalog.listSchemas(workspace),
    db.relation.listRelationSchemas(workspace)
  ]);
  const entityFieldIdsBySchema = collectEnumFieldIds(schemas, enumId);
  const relationFieldIdsBySchema = collectEnumFieldIds(relationSchemas, enumId);
  const usedValues = new Set<string>();

  if (entityFieldIdsBySchema.size > 0) {
    const entities = await db.catalog.listEntities(workspace);
    for (const entity of entities) {
      const fieldIds = entityFieldIdsBySchema.get(entity.schema_id);
      if (fieldIds) addUsedValues(usedValues, entity.data, fieldIds);
    }
  }

  if (relationFieldIdsBySchema.size > 0) {
    const relations = await listAllRelations(db, workspace);
    for (const relation of relations) {
      const fieldIds = relationFieldIdsBySchema.get(relation.schema_id);
      if (fieldIds) addUsedValues(usedValues, relation.data, fieldIds);
    }
  }

  return usedValues;
};
