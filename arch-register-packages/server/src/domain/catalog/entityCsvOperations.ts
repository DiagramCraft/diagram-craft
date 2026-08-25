import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { decodeRefs } from '../../types';
import { formatArrayForCsv, generateCsv } from '../../utils/csv';
import { orpcAssert } from '../../utils/orpcAssert';
import { filterVisibleEntities, requireSchemaRead } from '../auth/authorization';
import { restrictedFieldIds } from '../auth/fieldGroupAccessControl';
import { relationFields } from './dataHelpers';
import { canViewTypedRelation } from './relationAccessControl';
import {
  isReferenceOrContainmentField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
import { listAllCatalogEntities } from './entityLoader';
import { listEntities, type EntityQueryOptions } from './entityQueryOperations';
import { ENTITY_DEFAULTS } from '../../constants';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { buildEntityViewPermissionScope } from './db/entityPermissionScope';
import { isMultiValuedScalarField } from './entityScalarValues';

/** Fetches every relation instance for a relation schema, following pagination to completion. */
const listAllRelationsForSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  relationSchemaId: string
) => {
  const rows = [];
  const pageSize = ENTITY_DEFAULTS.PAGE_SIZE;
  let offset = 0;
  while (true) {
    const { items } = await db.relation.listRelations(
      workspace,
      { schemaId: relationSchemaId, inEntityId: null, outEntityId: null },
      { limit: pageSize, offset }
    );
    if (items.length === 0) break;
    rows.push(...items);
    if (items.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
};

/** Builds an ownerEntityId -> other-endpoint-name[] lookup per typedRelation field, for CSV export. */
const buildTypedRelationLookups = async (
  db: DatabaseAdapter,
  workspace: string,
  typedRelationFields: Array<{ id: string; relationSchemaId: string; direction: 'in' | 'out' }>,
  authCtx: AuthorizationContext,
  entityById: ReadonlyMap<string, EntityDbResult>,
  visibleEntityIds: ReadonlySet<string>,
  schemaById: ReadonlyMap<string, SchemaDbResult>
) => {
  const lookups = new Map<string, Map<string, string[]>>();
  for (const field of typedRelationFields) {
    const relations = await listAllRelationsForSchema(db, workspace, field.relationSchemaId);
    const byOwner = new Map<string, string[]>();
    for (const relation of relations) {
      const ownerEntityId =
        field.direction === 'out' ? relation.out_entity_id : relation.in_entity_id;
      const targetEntityId =
        field.direction === 'out' ? relation.in_entity_id : relation.out_entity_id;
      const ownerEntity = entityById.get(ownerEntityId);
      const targetEntity = entityById.get(targetEntityId);
      if (!ownerEntity || !targetEntity || !visibleEntityIds.has(targetEntityId)) continue;

      const ownerSchema = schemaById.get(ownerEntity.schema_id);
      const targetSchema = schemaById.get(targetEntity.schema_id);
      if (
        !canViewTypedRelation(
          authCtx,
          [
            { schema: ownerSchema, direction: field.direction },
            {
              schema: targetSchema,
              direction: field.direction === 'out' ? 'in' : 'out'
            }
          ],
          field.relationSchemaId,
          relation.owner
        )
      ) {
        continue;
      }

      const otherName =
        field.direction === 'out' ? relation.in_entity_name : relation.out_entity_name;
      const list = byOwner.get(ownerEntityId) ?? [];
      list.push(otherName);
      byOwner.set(ownerEntityId, list);
    }
    lookups.set(field.id, byOwner);
  }
  return lookups;
};

const csvResponse = (content: string, filename: string) => ({
  headers: {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="${filename}"`
  },
  body: new Blob([content], { type: 'text/csv; charset=utf-8' })
});

const commonColumns = [
  'ID',
  'Name',
  'Slug',
  'Namespace',
  'Description',
  'Owner',
  'Lifecycle',
  'Target Lifecycle',
  'Target Date',
  'Tags',
  'Links',
  'Schema Type'
];

export const exportEntitiesCsv = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  query: EntityQueryOptions,
  now = new Date()
) => {
  const [schemas, allEntitiesRaw, entities] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace, {
      permissionScope: buildEntityViewPermissionScope(authCtx)
    }),
    listEntities(db, workspace, authCtx, { ...query, view: 'full', limit: null, offset: 0 })
  ]);
  const allEntities = filterVisibleEntities(authCtx, allEntitiesRaw);
  const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
  entities.sort((a, b) => (a._name as string).localeCompare(b._name as string));
  const schemaId = query.schemaId ?? undefined;
  const schema = schemaId ? schemaMap.get(schemaId) : undefined;
  if (schemaId) {
    orpcAssert.present(schema, { code: 'NOT_FOUND', message: 'Schema not found' });
  }

  const restricted = restrictedFieldIds(authCtx, schema);
  const visibleFields = schema?.fields.filter(field => !restricted.has(field.id)) ?? [];
  const dynamicColumns = visibleFields.map(field => field.name);
  const referenceLookup = new Map<string, string>();
  if (schema) {
    const referenceIds = new Set<string>();
    for (const entity of entities) {
      for (const field of relationFields(schema.fields)) {
        decodeRefs(entity[field.id]).forEach(id => referenceIds.add(id));
      }
    }
    for (const entity of allEntities) {
      if (referenceIds.has(entity.id)) referenceLookup.set(entity.id, entity.name ?? entity.slug);
    }
  }

  const typedRelationLookups = schema
    ? await buildTypedRelationLookups(
        db,
        workspace,
        visibleFields.filter(isTypedRelationField),
        authCtx,
        new Map(allEntitiesRaw.map(entity => [entity.id, entity])),
        new Set(allEntities.map(entity => entity.id)),
        schemaMap
      )
    : new Map<string, Map<string, string[]>>();

  const rows = entities.map(entity => {
    const owner = entity._owner as { id: string; name: string } | null;
    const lifecycle = entity._lifecycle as { id: string; name: string } | null;
    const targetLifecycle = entity._targetLifecycle as { id: string; name: string } | null;
    const entitySchema = entity._schema as { id: string; name: string };
    const row: Record<string, unknown> = {
      ID: entity._uid,
      Name: entity._name,
      Slug: entity._slug,
      Namespace: entity._namespace,
      Description: entity._description,
      Owner: owner?.id ?? '',
      Lifecycle: lifecycle?.id ?? '',
      'Target Lifecycle': targetLifecycle?.id ?? '',
      'Target Date': entity._targetLifecycleDate ?? '',
      Tags: formatArrayForCsv((entity._tags as string[]) ?? []),
      Links: ((entity._links as unknown[]) ?? []).length.toString(),
      'Schema Type': schema?.name ?? entitySchema.name ?? entitySchema.id
    };
    if (schema) {
      for (const field of visibleFields) {
        const value = entity[field.id];
        if (isReferenceOrContainmentField(field)) {
          row[field.name] = formatArrayForCsv(
            decodeRefs(value).map(id => referenceLookup.get(id) ?? id)
          );
        } else if (isTypedRelationField(field)) {
          row[field.name] = formatArrayForCsv(
            typedRelationLookups.get(field.id)?.get(entity._uid as string) ?? []
          );
        } else if (isMultiValuedScalarField(field)) {
          const values = Array.isArray(value) ? value : value == null ? [] : [value];
          row[field.name] = JSON.stringify(values);
        } else if (field.type === 'boolean') {
          row[field.name] = value === true ? 'true' : value === false ? 'false' : '';
        } else if (field.type === 'principal') {
          const principal = value as { principal_type?: string; principal_id?: string } | null;
          row[field.name] = principal?.principal_type
            ? `${principal.principal_type}:${principal.principal_id}`
            : '';
        } else if (Array.isArray(value)) {
          row[field.name] = formatArrayForCsv(value);
        } else {
          row[field.name] = value ?? '';
        }
      }
    }
    return row;
  });

  const filenameBase = schema ? schema.name.toLowerCase().replace(/\s+/g, '-') : 'entities';
  return csvResponse(
    generateCsv(rows, [...commonColumns, ...dynamicColumns], ';'),
    `${filenameBase}-${now.toISOString().split('T')[0]}.csv`
  );
};

export const downloadEntityImportTemplate = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: AuthorizationContext,
  schemaId: string
) => {
  requireSchemaRead(authCtx);
  const schema = await db.catalog.getSchema(workspace, schemaId);
  orpcAssert.present(schema, { code: 'NOT_FOUND', message: 'Schema not found' });
  const restricted = restrictedFieldIds(authCtx, schema);
  const columns = [
    'ID',
    'Name',
    'Slug',
    'Namespace',
    'Description',
    'Owner',
    'Lifecycle',
    'Tags',
    ...schema.fields.filter(field => !restricted.has(field.id)).map(field => field.name)
  ];
  return csvResponse(
    columns.map(column => `"${column}"`).join(';'),
    `${schema.name.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`
  );
};
