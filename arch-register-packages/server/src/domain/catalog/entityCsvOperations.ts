import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { decodeRefs } from '../../types';
import { formatArrayForCsv, generateCsv } from '../../utils/csv';
import { orpcAssert } from '../../utils/orpcAssert';
import { filterVisibleEntities, requireSchemaRead } from '../auth/authorization';
import { relationFields } from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';
import { listEntities, type EntityQueryOptions } from './entityQueryOperations';

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
    listAllCatalogEntities(db, workspace),
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

  const dynamicColumns = schema?.fields.map(field => field.name) ?? [];
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
      for (const field of schema.fields) {
        const value = entity[field.id];
        if (field.type === 'reference' || field.type === 'containment') {
          row[field.name] = formatArrayForCsv(
            decodeRefs(value).map(id => referenceLookup.get(id) ?? id)
          );
        } else if (field.type === 'boolean') {
          row[field.name] = value === true ? 'true' : value === false ? 'false' : '';
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
  const columns = [
    'ID',
    'Name',
    'Slug',
    'Namespace',
    'Description',
    'Owner',
    'Lifecycle',
    'Tags',
    ...schema.fields.map(field => field.name)
  ];
  return csvResponse(
    columns.map(column => `"${column}"`).join(';'),
    `${schema.name.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`
  );
};
