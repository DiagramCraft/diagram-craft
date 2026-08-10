import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult } from '../catalog/db/relationDatabase';
import { decodeRefs } from '../../types';
import { materializeDerivedFields } from './derivedFields';
import { buildEntityProjection } from './entityProjection';
import { createLogger } from '../../utils/logger';

const logger = createLogger('derived-recalculation');

type EntityEdge = {
  kind: 'reference' | 'containment' | 'typedRelation';
  fieldId?: string;
  relationSchemaId?: string;
  relationId?: string;
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
};

const valuesEqual = (left: unknown, right: unknown) =>
  stableStringify(left) === stableStringify(right);

const connect = (
  neighborsByEntityId: Map<string, Map<string, EntityEdge>>,
  leftId: string,
  rightId: string,
  edge: EntityEdge
) => {
  if (leftId === rightId) return;
  const left = neighborsByEntityId.get(leftId) ?? new Map<string, EntityEdge>();
  if (!left.has(rightId)) left.set(rightId, edge);
  neighborsByEntityId.set(leftId, left);

  const right = neighborsByEntityId.get(rightId) ?? new Map<string, EntityEdge>();
  if (!right.has(leftId)) right.set(leftId, edge);
  neighborsByEntityId.set(rightId, right);
};

const buildNeighborIndex = (entities: EntityDbResult[], schemas: SchemaDbResult[]) => {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const neighborsByEntityId = new Map<string, Map<string, EntityEdge>>();

  for (const entity of entities) {
    const schema = schemaById.get(entity.schema_id);
    for (const field of schema?.fields ?? []) {
      if (field.type !== 'reference' && field.type !== 'containment') continue;
      for (const targetId of decodeRefs(entity.data[field.id])) {
        if (!entityById.has(targetId)) continue;
        connect(neighborsByEntityId, entity.id, targetId, {
          kind: field.type,
          fieldId: field.id
        });
      }
    }
  }

  return { entityById, neighborsByEntityId };
};

const affectedEntityIds = (
  entities: EntityDbResult[],
  neighborsByEntityId: Map<string, Map<string, EntityEdge>>,
  changedEntityIds: string[] | undefined
) => {
  if (!changedEntityIds || changedEntityIds.length === 0) {
    return new Set(entities.map(entity => entity.id));
  }

  const entityIds = new Set(entities.map(entity => entity.id));
  const affected = new Set<string>();
  const queue = [...new Set(changedEntityIds)].filter(id => entityIds.has(id));
  queue.forEach(id => affected.add(id));

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const neighborId of neighborsByEntityId.get(currentId)?.keys() ?? []) {
      if (affected.has(neighborId)) continue;
      affected.add(neighborId);
      queue.push(neighborId);
    }
  }

  return affected;
};

/**
 * Recalculates materialized entity derived values against the current one-hop entity graph.
 *
 * The default is a full workspace scan. Callers may provide changed entity ids to limit the
 * recalculation to their connected components, but no persistent dependency index is maintained.
 * This function is transaction-safe and intentionally does not create audit/version records for
 * derived-only updates.
 */
export const recalculateEntityDerivedFields = async (
  db: DatabaseAdapter,
  workspace: string,
  changedEntityIds?: string[]
) => {
  // Small unit-test adapters often exercise the low-level mutation helpers without providing the
  // complete catalog/relation surface. Production adapters always provide these methods.
  if (
    typeof db.catalog.listEntities !== 'function' ||
    typeof db.catalog.listSchemas !== 'function' ||
    typeof db.relation.listRelationsForEntities !== 'function'
  ) {
    return false;
  }

  const [entities, schemas] = await Promise.all([
    db.catalog.listEntities(workspace),
    db.catalog.listSchemas(workspace)
  ]);
  const relationRows = await db.relation.listRelationsForEntities(
    workspace,
    entities.map(entity => entity.id)
  );
  const allTypedRelations: RelationDbResult[] = [
    ...relationRows.outgoing,
    ...relationRows.incoming
  ].filter((row, index, rows) => rows.findIndex(candidate => candidate.id === row.id) === index);
  const relationSchemas =
    typeof db.relation.listRelationSchemas === 'function'
      ? await db.relation.listRelationSchemas(workspace)
      : [];

  const { entityById, neighborsByEntityId } = buildNeighborIndex(entities, schemas);
  for (const relation of allTypedRelations) {
    if (!entityById.has(relation.in_entity_id) || !entityById.has(relation.out_entity_id)) {
      continue;
    }
    connect(neighborsByEntityId, relation.in_entity_id, relation.out_entity_id, {
      kind: 'typedRelation',
      relationSchemaId: relation.schema_id,
      relationId: relation.id
    });
  }

  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const affected = affectedEntityIds(entities, neighborsByEntityId, changedEntityIds);
  const workingEntities = new Map(
    entities.map(entity => [entity.id, { ...entity, data: { ...entity.data } }])
  );
  const maxPasses = Math.max(2, affected.size + 1);
  let stable = false;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (const entityId of [...affected].sort()) {
      const entity = workingEntities.get(entityId);
      const schema = entity ? schemaById.get(entity.schema_id) : undefined;
      if (!entity || !schema?.fields.some(field => field.type === 'derived')) continue;

      const projection = buildEntityProjection(
        entity.id,
        [...workingEntities.values()],
        schemas,
        allTypedRelations,
        relationSchemas,
        { depth: 1 }
      );

      const nextData = materializeDerivedFields(
        schema.fields,
        entity.data,
        { objectType: 'entity', objectId: entity.id },
        schema.groups ?? [],
        projection ?? entity.data
      );
      if (valuesEqual(entity.data, nextData)) continue;
      entity.data = nextData;
      changed = true;
    }

    if (!changed) {
      stable = true;
      break;
    }
  }

  if (!stable) {
    logger.error('Derived-field recalculation did not converge; clearing affected derived values', {
      workspace,
      entityCount: affected.size
    });
    for (const entityId of affected) {
      const entity = workingEntities.get(entityId);
      const schema = entity ? schemaById.get(entity.schema_id) : undefined;
      if (!entity || !schema) continue;
      for (const field of schema.fields) {
        if (field.type === 'derived') delete entity.data[field.id];
      }
    }
  }

  for (const entityId of [...affected].sort()) {
    const original = entityById.get(entityId);
    const recalculated = workingEntities.get(entityId);
    if (!original || !recalculated || valuesEqual(original.data, recalculated.data)) continue;
    await db.catalog.updateEntityDerivedFields(workspace, entityId, recalculated.data);
  }
  return true;
};
