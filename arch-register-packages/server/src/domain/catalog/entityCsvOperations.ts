import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { decodeRefs } from '../../types';
import { formatArrayForCsv, generateCsv } from '../../utils/csv';
import { orpcAssert } from '../../utils/orpcAssert';
import { filterVisibleEntities, requireSchemaRead } from '../auth/authorization';
import { filterEntities, relationFields } from './dataHelpers';
import { listAllCatalogEntities } from './entityLoader';

type EntityCsvFilter = {
  schemaId: string | null;
  owner: string | null;
  lifecycle: string | null;
  q: string;
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
  filter: EntityCsvFilter,
  now = new Date()
) => {
  const [schemas, allEntitiesRaw] = await Promise.all([
    db.catalog.listSchemas(workspace),
    listAllCatalogEntities(db, workspace)
  ]);
  const allEntities = filterVisibleEntities(authCtx, allEntitiesRaw);
  const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
  const entities = filterEntities(allEntities, filter).sort((a, b) => a.name.localeCompare(b.name));
  const schema = filter.schemaId ? schemaMap.get(filter.schemaId) : undefined;
  if (filter.schemaId) {
    orpcAssert.present(schema, { code: 'NOT_FOUND', message: 'Schema not found' });
  }

  const dynamicColumns = schema?.fields.map(field => field.name) ?? [];
  const referenceLookup = new Map<string, string>();
  if (schema) {
    const referenceIds = new Set<string>();
    for (const entity of entities) {
      for (const field of relationFields(schema.fields)) {
        decodeRefs(entity.data[field.id]).forEach(id => referenceIds.add(id));
      }
    }
    for (const entity of allEntities) {
      if (referenceIds.has(entity.id)) referenceLookup.set(entity.id, entity.name || entity.slug);
    }
  }

  const rows = entities.map(entity => {
    const row: Record<string, unknown> = {
      ID: entity.id,
      Name: entity.name,
      Slug: entity.slug,
      Namespace: entity.namespace,
      Description: entity.description,
      Owner: entity.owner ?? '',
      Lifecycle: entity.lifecycle ?? '',
      'Target Lifecycle': entity.target_lifecycle ?? '',
      'Target Date': entity.target_lifecycle_date ?? '',
      Tags: formatArrayForCsv(entity.tags),
      Links: entity.links.length.toString(),
      'Schema Type': schema?.name ?? schemaMap.get(entity.schema_id)?.name ?? entity.schema_id
    };
    if (schema) {
      for (const field of schema.fields) {
        const value = entity.data[field.id];
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
