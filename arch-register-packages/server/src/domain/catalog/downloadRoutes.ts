import { defineHandler, getQuery, H3 } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { buildApiAuthCtx } from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { decodeRefs } from '../../types';
import { filterEntities, handleError } from './dataHelpers';
import { formatArrayForCsv, generateCsv } from '../../utils/csv';
import { PermissionChecker } from '@arch-register/permissions';
import type { SchemaField } from '../../types';

const BASE = '/api/download/:workspace/data';

const checker = new PermissionChecker();

const relationFields = (fields: SchemaField[]) =>
  fields.filter(
    (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
      field.type === 'reference' || field.type === 'containment'
  );

export const createDownloadRoutes = (db: DatabaseAdapter) => {
  const router = new H3();

  // GET /api/download/:workspace/data/export
  router.get(
    `${BASE}/export`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      const schemaId = typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null;
      const owner = typeof query['owner'] === 'string' ? query['owner'] : null;
      const lifecycle = typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null;
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';

      try {
        const [schemas, allEntitiesRaw] = await Promise.all([
          db.catalog.listSchemas(workspace),
          db.catalog.listEntities(workspace)
        ]);
        const allEntities = allEntitiesRaw.filter(entity =>
          checker.hasEntityPermission(authCtx, entity, 'view_entity')
        );
        const schemaMap = new Map(schemas.map(s => [s.id, s]));
        const entities = filterEntities(allEntities, { schemaId, owner, lifecycle, q }).sort(
          (a, b) => a.name.localeCompare(b.name)
        );

        let csvContent: string;
        if (schemaId) {
          const schema = schemaMap.get(schemaId);
          httpAssert.present(schema, { status: 404, message: 'Schema not found' });

          const refFields = relationFields(schema.fields);
          const allRefIds = new Set<string>();
          for (const entity of entities) {
            for (const field of refFields) {
              decodeRefs(entity.data[field.id]).forEach(id => allRefIds.add(id));
            }
          }
          const refLookup = new Map(
            allEntities
              .filter(entity => allRefIds.has(entity.id))
              .map(entity => [entity.id, entity.name || entity.slug])
          );
          const columns = [
            'ID', 'Name', 'Slug', 'Namespace', 'Description', 'Owner', 'Lifecycle',
            'Target Lifecycle', 'Target Date', 'Tags', 'Links', 'Schema Type',
            ...schema.fields.map(f => f.name)
          ];
          const rows = entities.map(entity => {
            const row: Record<string, unknown> = {
              'ID': entity.id, 'Name': entity.name, 'Slug': entity.slug,
              'Namespace': entity.namespace, 'Description': entity.description,
              'Owner': entity.owner ?? '', 'Lifecycle': entity.lifecycle ?? '',
              'Target Lifecycle': entity.target_lifecycle ?? '',
              'Target Date': entity.target_lifecycle_date ?? '',
              'Tags': formatArrayForCsv(entity.tags),
              'Links': entity.links.length.toString(),
              'Schema Type': schema.name
            };
            for (const field of schema.fields) {
              const value = entity.data[field.id];
              if (field.type === 'reference' || field.type === 'containment') {
                row[field.name] = formatArrayForCsv(
                  decodeRefs(value).map(id => refLookup.get(id) ?? id)
                );
              } else if (field.type === 'boolean') {
                row[field.name] = value === true ? 'true' : value === false ? 'false' : '';
              } else if (Array.isArray(value)) {
                row[field.name] = formatArrayForCsv(value);
              } else {
                row[field.name] = value ?? '';
              }
            }
            return row;
          });
          csvContent = generateCsv(rows, columns, ';');
        } else {
          const columns = [
            'ID', 'Name', 'Slug', 'Namespace', 'Description', 'Owner', 'Lifecycle',
            'Target Lifecycle', 'Target Date', 'Tags', 'Links', 'Schema Type'
          ];
          const rows = entities.map(entity => ({
            'ID': entity.id, 'Name': entity.name, 'Slug': entity.slug,
            'Namespace': entity.namespace, 'Description': entity.description,
            'Owner': entity.owner ?? '', 'Lifecycle': entity.lifecycle ?? '',
            'Target Lifecycle': entity.target_lifecycle ?? '',
            'Target Date': entity.target_lifecycle_date ?? '',
            'Tags': formatArrayForCsv(entity.tags),
            'Links': entity.links.length.toString(),
            'Schema Type': schemaMap.get(entity.schema_id)?.name ?? entity.schema_id
          }));
          csvContent = generateCsv(rows, columns, ';');
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const schemaName = schemaId
          ? schemaMap.get(schemaId)?.name.toLowerCase().replace(/\s+/g, '-')
          : 'entities';
        const filename = `${schemaName}-${timestamp}.csv`;
        event.res.headers.set('Content-Type', 'text/csv; charset=utf-8');
        event.res.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        return csvContent;
      } catch (e) {
        handleError(e, 'Failed to export data');
      }
    })
  );

  // GET /api/download/:workspace/data/import/template/:schemaId
  router.get(
    `${BASE}/import/template/:schemaId`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const schemaId = event.context.params?.['schemaId'];
      httpAssert.present(schemaId, { message: 'schemaId is required' });

      try {
        const schema = await db.catalog.getSchema(workspace, schemaId);
        httpAssert.present(schema, { status: 404, message: 'Schema not found' });

        const columns = [
          'ID', 'Name', 'Slug', 'Namespace', 'Description', 'Owner', 'Lifecycle', 'Tags',
          ...schema.fields.map(f => f.name)
        ];
        const csvContent = columns.map(col => `"${col}"`).join(';');

        const filename = `${schema.name.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`;
        event.res.headers.set('Content-Type', 'text/csv; charset=utf-8');
        event.res.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        return csvContent;
      } catch (e) {
        handleError(e, 'Failed to generate import template');
      }
    })
  );

  return router;
};
