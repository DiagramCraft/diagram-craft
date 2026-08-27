import type { AuthorizationContext } from '@arch-register/permissions';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import { filterRelationFieldData } from '../catalog/relationHelpers';
import { buildEntityProjection } from './entityProjection';

export type RelationProjectionOptions = {
  depth?: number;
  authCtx?: AuthorizationContext | null;
};

/**
 * Builds the evaluation context a relation-rooted derived expression reads through `relation.*`:
 *
 * - the relation's own field values (redacted against `authCtx` when one is supplied),
 * - `relation._in` / `relation._out` — projections of the connected endpoint entities,
 * - one array entry per `entityRelation` field, each element a projection of a carried entity.
 *
 * Mirrors `buildEntityProjection`'s handling of `typedRelation` fields on the entity side. During
 * system recalculation `authCtx` is omitted (no redaction) — the materialized value is redacted
 * later at read time, exactly like an entity derived field.
 */
export const buildRelationProjection = (
  relation: RelationDbResult,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  relations: RelationDbResult[],
  relationSchemas: RelationSchemaDbResult[],
  options: RelationProjectionOptions = {}
): Record<string, unknown> => {
  const authCtx = options.authCtx ?? null;
  const depth = Math.max(0, options.depth ?? 1);
  const relationSchema = relationSchemas.find(schema => schema.id === relation.schema_id);

  const projectEntity = (entityId: string, entityDepth: number) =>
    buildEntityProjection(entityId, entities, schemas, relations, relationSchemas, {
      depth: entityDepth,
      authCtx
    });

  const result: Record<string, unknown> = {
    ...filterRelationFieldData(authCtx, relationSchema, relation.data),
    metadata: {
      id: relation.id,
      schemaId: relation.schema_id,
      inEntityId: relation.in_entity_id,
      outEntityId: relation.out_entity_id
    },
    _in: projectEntity(relation.in_entity_id, depth),
    _out: projectEntity(relation.out_entity_id, depth)
  };

  for (const field of relationSchema?.fields ?? []) {
    if (field.type !== 'entityRelation') continue;
    const raw = relation.data[field.id];
    const ids = Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
    result[field.id] = ids.flatMap(id => {
      const projected = projectEntity(id, Math.max(0, depth - 1));
      return projected ? [projected] : [];
    });
  }

  return result;
};
