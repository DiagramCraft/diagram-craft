import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import {
  isReferenceOrContainmentField,
  isTypedRelationField,
  type SchemaField
} from '@arch-register/api-types/schemaContract';
import type { DatabaseAdapter } from '../../db/database';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { filterRelationFieldData } from '../catalog/relationHelpers';
import type { Entity, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import type { AiChatToolContext } from './chatToolContext';

const checker = new PermissionChecker();

export const getVisibleEntities = (entities: Entity[], authCtx: AuthorizationContext | null) => {
  if (authCtx === null || checker.hasWorkspaceWideEntityView(authCtx)) return entities;
  return entities.filter(entity => checker.hasEntityPermission(authCtx, entity, 'view_entity'));
};

export const relationFields = (fields: SchemaField[]) =>
  fields.filter(isReferenceOrContainmentField);

export const assertNoTypedRelationFieldWrites = (
  schema: { fields: SchemaField[] },
  fields: Record<string, unknown> | undefined
) => {
  const typedRelationFieldIds = new Set(
    schema.fields.filter(isTypedRelationField).map(field => field.id)
  );
  const offending = Object.keys(fields ?? {}).filter(id => typedRelationFieldIds.has(id));
  if (offending.length > 0) {
    throw new Error(
      `Cannot set typed-relation field(s) via this tool: ${offending.join(', ')}. Typed relations are not yet supported through AI tools.`
    );
  }
};

export const summarizeRelationTarget = (
  entity: Pick<Entity, 'id' | 'name' | 'slug' | 'schema_id'>,
  schemaName: string | undefined
) => ({
  id: entity.id,
  name: entity.name,
  slug: entity.slug,
  schemaId: entity.schema_id,
  schemaName: schemaName ?? entity.schema_id
});

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const summarizeEntity = (entity: Entity, schemaName: string | undefined) => ({
  id: entity.id,
  name: entity.name,
  slug: entity.slug,
  schemaId: entity.schema_id,
  schemaName: schemaName ?? entity.schema_id,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  description: entity.description
});

export const filterStringArray = (values: unknown): string[] =>
  Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];

export const normalizeOwner = (value: unknown, teamIds: Set<string>, fallback: string | null) => {
  if (value === null) return null;
  if (typeof value === 'string' && teamIds.has(value)) return value;
  return fallback;
};

export type RelationEndpointAccess = {
  inEntity: Entity | null;
  outEntity: Entity | null;
  endpoints: Array<{
    schema: SchemaDbResult | undefined;
    direction: 'in' | 'out';
  }>;
};

export const relationSchemaMap = async (context: AiChatToolContext) => {
  const schemas = await context.db.relation.listRelationSchemas(context.workspaceId);
  return new Map(schemas.map(schema => [schema.id, schema]));
};

export const getRelationEndpointAccess = (
  inEntity: Entity | null,
  outEntity: Entity | null,
  entitySchemaMap: Map<string, SchemaDbResult>
): RelationEndpointAccess => ({
  inEntity,
  outEntity,
  endpoints: [
    {
      schema: inEntity ? entitySchemaMap.get(inEntity.schema_id) : undefined,
      direction: 'in'
    },
    {
      schema: outEntity ? entitySchemaMap.get(outEntity.schema_id) : undefined,
      direction: 'out'
    }
  ]
});

export const loadRelationEndpointAccess = async (
  context: AiChatToolContext,
  inEntityId: string,
  outEntityId: string
): Promise<RelationEndpointAccess> => {
  const [inEntity, outEntity, schemas] = await Promise.all([
    context.db.catalog.getEntity(context.workspaceId, inEntityId),
    context.db.catalog.getEntity(context.workspaceId, outEntityId),
    context.db.catalog.listSchemas(context.workspaceId)
  ]);
  return getRelationEndpointAccess(
    inEntity,
    outEntity,
    new Map(schemas.map(schema => [schema.id, schema]))
  );
};

export const loadVisibleRelationEndpoints = async (context: AiChatToolContext) => {
  const [schemas, rawEntities] = await Promise.all([
    context.db.catalog.listSchemas(context.workspaceId),
    listAllCatalogEntities(context.db, context.workspaceId)
  ]);
  const visibleEntities = getVisibleEntities(rawEntities, context.authCtx);
  return {
    entityMap: new Map(visibleEntities.map(entity => [entity.id, entity])),
    schemaMap: new Map(schemas.map(schema => [schema.id, schema]))
  };
};

export const listAllRelationRows = async (
  context: AiChatToolContext,
  filters: Parameters<DatabaseAdapter['relation']['listRelations']>[1]
) => {
  const rows: RelationDbResult[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const page = await context.db.relation.listRelations(context.workspaceId, filters, {
      limit: pageSize,
      offset
    });
    rows.push(...page.items);
    if (page.items.length === 0 || page.items.length < pageSize || rows.length >= page.total) {
      break;
    }
    offset += page.items.length;
  }

  return rows;
};

export const toAiRelation = (
  row: RelationDbResult | null,
  authCtx: AuthorizationContext | null,
  schemaMap: Map<string, RelationSchemaDbResult>
) => {
  if (!row) return null;
  const schema = schemaMap.get(row.schema_id);
  return {
    _uid: row.id,
    schemaId: row.schema_id,
    schemaName: row.schema_name,
    inEntityId: row.in_entity_id,
    inEntityName: row.in_entity_name,
    outEntityId: row.out_entity_id,
    outEntityName: row.out_entity_name,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    fields: filterRelationFieldData(authCtx, schema, row.data)
  };
};
