import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  isReferenceOrContainmentField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import { decodeRefs } from '../../types';
import { filterLiveFieldGroups, isFieldViewRestricted } from '../auth/fieldGroupAccessControl';
import {
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint
} from '../catalog/relationAccessControl';
import { filterRelationFieldData } from '../catalog/relationHelpers';

export type EntityProjectionOptions = {
  depth: number;
  authCtx?: AuthorizationContext | null;
};

type ProjectionState = {
  entitiesById: Map<string, EntityDbResult>;
  schemasById: Map<string, SchemaDbResult>;
  relationSchemasById: Map<string, RelationSchemaDbResult>;
  relations: RelationDbResult[];
  authCtx: AuthorizationContext | null;
};

const checker = new PermissionChecker();

const canViewEntity = (state: ProjectionState, entity: EntityDbResult) =>
  state.authCtx == null || checker.hasEntityPermission(state.authCtx, entity, 'view_entity');

const metadata = (entity: EntityDbResult) => ({
  id: entity.id,
  publicId: entity.public_id ?? entity.id,
  name: entity.name,
  slug: entity.slug,
  schemaId: entity.schema_id
});

const targetForRelation = (state: ProjectionState, relation: RelationDbResult, entityId: string) =>
  state.entitiesById.get(
    relation.in_entity_id === entityId ? relation.out_entity_id : relation.in_entity_id
  );

const typedRelationRowsForField = (
  state: ProjectionState,
  entity: EntityDbResult,
  field: Extract<SchemaField, { type: 'typedRelation' }>
) =>
  state.relations.filter(relation =>
    field.direction === 'in'
      ? relation.in_entity_id === entity.id && relation.schema_id === field.relationSchemaId
      : relation.out_entity_id === entity.id && relation.schema_id === field.relationSchemaId
  );

const canExposeTypedRelation = (
  state: ProjectionState,
  entity: EntityDbResult,
  target: EntityDbResult,
  field: Extract<SchemaField, { type: 'typedRelation' }>,
  relation: RelationDbResult
) => {
  if (!canViewEntity(state, target)) return false;
  const entitySchema = state.schemasById.get(entity.schema_id);
  const targetSchema = state.schemasById.get(target.schema_id);
  if (isFieldViewRestricted(state.authCtx, entitySchema, field.id)) return false;
  return (
    canViewTypedRelation(
      state.authCtx,
      field.direction === 'in'
        ? [
            { schema: entitySchema, direction: 'in' },
            { schema: targetSchema, direction: 'out' }
          ]
        : [
            { schema: targetSchema, direction: 'in' },
            { schema: entitySchema, direction: 'out' }
          ],
      relation.schema_id,
      relation.owner
    ) &&
    (state.authCtx == null ||
      canViewTypedRelationFromEndpoint(
        state.authCtx,
        entitySchema,
        relation.schema_id,
        field.direction
      ))
  );
};

const buildProjection = (
  entity: EntityDbResult,
  depth: number,
  state: ProjectionState
): Record<string, unknown> => {
  const schema = state.schemasById.get(entity.schema_id);
  const visibleData = filterLiveFieldGroups(state.authCtx, schema, entity.data);
  const result: Record<string, unknown> = {
    ...visibleData,
    metadata: metadata(entity)
  };

  if (depth <= 0 || !schema) {
    for (const field of schema?.fields.filter(isReferenceOrContainmentField) ?? []) {
      if (isFieldViewRestricted(state.authCtx, schema, field.id)) continue;
      const raw = visibleData[field.id];
      if (raw === undefined) continue;
      const ids = decodeRefs(raw).filter(targetId => {
        const target = state.entitiesById.get(targetId);
        return target != null && canViewEntity(state, target);
      });
      result[field.id] =
        field.type === 'reference' && field.maxCount !== 1 ? ids : (ids[0] ?? null);
    }
    for (const field of schema?.fields.filter(isTypedRelationField) ?? []) {
      const ids = typedRelationRowsForField(state, entity, field).flatMap(relation => {
        const target = targetForRelation(state, relation, entity.id);
        return target && canExposeTypedRelation(state, entity, target, field, relation)
          ? [target.id]
          : [];
      });
      result[field.id] = ids;
    }
    return result;
  }

  for (const field of schema.fields) {
    if (isReferenceOrContainmentField(field)) {
      if (isFieldViewRestricted(state.authCtx, schema, field.id)) continue;
      const raw = visibleData[field.id];
      if (raw === undefined) continue;
      const projected = decodeRefs(raw).flatMap(targetId => {
        const target = state.entitiesById.get(targetId);
        return target && canViewEntity(state, target)
          ? [buildProjection(target, depth - 1, state)]
          : [];
      });
      result[field.id] =
        field.type === 'reference' && field.maxCount !== 1 ? projected : (projected[0] ?? null);
    }

    if (isTypedRelationField(field)) {
      result[field.id] = typedRelationRowsForField(state, entity, field).flatMap(relation => {
        const target = targetForRelation(state, relation, entity.id);
        if (!target || !canExposeTypedRelation(state, entity, target, field, relation)) return [];
        const relationSchema = state.relationSchemasById.get(relation.schema_id);
        return [
          {
            ...filterRelationFieldData(state.authCtx, relationSchema, relation.data),
            entity: buildProjection(target, depth - 1, state)
          }
        ];
      });
    }
  }

  return result;
};

export const buildEntityProjection = (
  entityId: string,
  entities: EntityDbResult[],
  schemas: SchemaDbResult[],
  relations: RelationDbResult[],
  relationSchemas: RelationSchemaDbResult[],
  options: EntityProjectionOptions
): Record<string, unknown> | null => {
  const entitiesById = new Map(entities.map(entity => [entity.id, entity]));
  const entity = entitiesById.get(entityId);
  if (!entity) return null;

  const state: ProjectionState = {
    entitiesById,
    schemasById: new Map(schemas.map(schema => [schema.id, schema])),
    relationSchemasById: new Map(relationSchemas.map(schema => [schema.id, schema])),
    relations,
    authCtx: options.authCtx ?? null
  };
  return canViewEntity(state, entity)
    ? buildProjection(entity, Math.max(0, options.depth), state)
    : null;
};
