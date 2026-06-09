import { defineHandler, getQuery, H3, readBody } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter, EntityDbUpdate, EntityDbCreate } from '../../db/database';
import { createLogger } from '../../utils/logger';
import { parseCsv, validateCsvData, csvRowToEntity } from '../../utils/csvImport';
import { decodeRefs, type SchemaField } from '../../types';
import { computeChanges, extractEntityFields, flattenEntityAuditFields, logAudit } from '../audit/db/auditLogging';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { formatArrayForCsv, generateCsv } from '../../utils/csv';
import { parsePositiveInt, slugify } from '../../utils/http';
import {
  buildApiAuthCtx,
  requireCanCreateTopLevelEntity,
  requireEntityAction
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import {
  handleError,
  getLifecycleValues,
  getTeamIds,
  resolveCreateOwner,
  buildEntityGrantInputs,
  filterEntities
} from './dataHelpers';
import {
  listEntities,
  getEntityFacets,
  getEntityTree,
  getEntity,
  getEntityRelations,
  createEntity,
  updateEntity,
  cloneEntity,
  deleteEntity
} from './entityOperations';

const logger = createLogger('data');

const BASE = '/api/:workspace/data';

const relationFields = (fields: SchemaField[]) =>
  fields.filter(
    (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
      field.type === 'reference' || field.type === 'containment'
  );

export function createDataRoutes(db: DatabaseAdapter) {
  const checker = new PermissionChecker();
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      return await listEntities(db, workspace, authCtx, {
        schemaId: typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null,
        owner: typeof query['owner'] === 'string' ? query['owner'] : null,
        lifecycle: typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null,
        q: typeof query['q'] === 'string' ? query['q'].trim() : '',
        view: query['view'] === 'summary' ? 'summary' : 'full',
        limit: parsePositiveInt(query['limit'], 'limit'),
        offset: parsePositiveInt(query['offset'], 'offset') ?? 0
      });
    })
  );

  router.get(
    `${BASE}/facets`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      return await getEntityFacets(db, workspace, authCtx);
    })
  );

  router.get(
    `${BASE}/tree`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      return await getEntityTree(db, workspace, authCtx, {
        schemaId: typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null,
        owner: typeof query['owner'] === 'string' ? query['owner'] : null,
        lifecycle: typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null,
        q: typeof query['q'] === 'string' ? query['q'].trim() : ''
      });
    })
  );

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
            'Schema Type',
            ...schema.fields.map(f => f.name)
          ];
          const rows = entities.map(entity => {
            const row: Record<string, unknown> = {
              'ID': entity.id,
              'Name': entity.name,
              'Slug': entity.slug,
              'Namespace': entity.namespace,
              'Description': entity.description,
              'Owner': entity.owner ?? '',
              'Lifecycle': entity.lifecycle ?? '',
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
          const rows = entities.map(entity => ({
            'ID': entity.id,
            'Name': entity.name,
            'Slug': entity.slug,
            'Namespace': entity.namespace,
            'Description': entity.description,
            'Owner': entity.owner ?? '',
            'Lifecycle': entity.lifecycle ?? '',
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
        if (event?.res) {
          event.res.headers.set('Content-Type', 'text/csv; charset=utf-8');
          event.res.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        }
        return csvContent;
      } catch (e) {
        handleError(e, 'Failed to export data');
      }
    })
  );

  // CSV Import endpoints
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
          'ID',
          'Name',
          'Slug',
          'Namespace',
          'Description',
          'Owner',
          'Lifecycle',
          'Tags',
          ...schema.fields.map(f => f.name)
        ];

        const csvContent = columns.map(col => `"${col}"`).join(';');

        const filename = `${schema.name.toLowerCase().replace(/\s+/g, '-')}-import-template.csv`;
        if (event?.res) {
          event.res.headers.set('Content-Type', 'text/csv; charset=utf-8');
          event.res.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        }
        return csvContent;
      } catch (e) {
        handleError(e, 'Failed to generate import template');
      }
    })
  );

  router.post(
    `${BASE}/import/parse`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const body = await readBody<{ schemaId: string; csvContent: string }>(event);

      httpAssert.present(body, { message: 'Request body is required' });
      httpAssert.present(body.schemaId, { message: 'schemaId is required' });
      httpAssert.present(body.csvContent, { message: 'csvContent is required' });

      try {
        const schema = await db.catalog.getSchema(workspace, body.schemaId);
        httpAssert.present(schema, { status: 404, message: 'Schema not found' });

        const parseResult = parseCsv(body.csvContent);
        const validatedRows = validateCsvData(parseResult.rows, schema.fields);

        const allEntities = await db.catalog.listEntities(workspace);
        const schemaEntities = allEntities.filter(e => e.schema_id === body.schemaId);

        const existingEntitiesMap = new Map(schemaEntities.map(e => [e.id, e]));
        const entitiesBySlug = new Map(schemaEntities.map(e => [`${e.namespace}:${e.slug}`, e]));
        const entitiesByName = new Map<string, (typeof allEntities)[0][]>();
        for (const entity of schemaEntities) {
          const name = entity.name.toLowerCase().trim();
          const list = entitiesByName.get(name) ?? [];
          list.push(entity);
          entitiesByName.set(name, list);
        }

        const entities = validatedRows.map(row => {
          const rowName = row.data['Name']?.toLowerCase().trim();
          const rowSlug = row.data['Slug']?.trim();
          const rowNamespace = row.data['Namespace']?.trim() || 'default';

          let existingEntity: (typeof allEntities)[0] | undefined;
          let matchType: 'id' | 'slug' | 'name' | 'none' = 'none';
          let nameMatches: typeof allEntities = [];
          const constraintViolations: Array<{
            type: 'duplicate_slug' | 'wrong_workspace' | 'wrong_schema';
            message: string;
          }> = [];

          if (row.existingId) {
            const entityById = existingEntitiesMap.get(row.existingId);
            if (entityById) {
              if (entityById.workspace !== workspace) {
                constraintViolations.push({
                  type: 'wrong_workspace',
                  message: 'ID exists but belongs to different workspace'
                });
                row.errors.push('ID exists but belongs to different workspace');
              } else if (entityById.schema_id !== body.schemaId) {
                constraintViolations.push({
                  type: 'wrong_schema',
                  message: 'ID exists but belongs to different schema type'
                });
                row.errors.push('ID exists but belongs to different schema type');
              } else {
                matchType = 'id';
                existingEntity = entityById;
              }
            }
          }

          if (matchType === 'none' && rowSlug) {
            const entityBySlug = entitiesBySlug.get(`${rowNamespace}:${rowSlug}`);
            if (entityBySlug) {
              matchType = 'slug';
              existingEntity = entityBySlug;
            }
          }

          if (matchType === 'none' && rowName && entitiesByName.has(rowName)) {
            matchType = 'name';
            nameMatches = entitiesByName.get(rowName)!;
            existingEntity = nameMatches[0];
          }

          if (matchType === 'none' || matchType === 'name') {
            const proposedSlug = rowSlug || (rowName ? slugify(rowName) : '');

            if (proposedSlug) {
              const wouldConflict = entitiesBySlug.has(`${rowNamespace}:${proposedSlug}`);

              if (wouldConflict) {
                constraintViolations.push({
                  type: 'duplicate_slug',
                  message: `Slug "${proposedSlug}" already exists in namespace "${rowNamespace}"`
                });
                if (matchType === 'none') {
                  row.errors.push(
                    `Slug "${proposedSlug}" already exists in namespace "${rowNamespace}"`
                  );
                }
              }
            }
          }

          const isUpdate = matchType === 'id' || matchType === 'slug';

          if ((isUpdate || matchType === 'name') && existingEntity) {
            const hasPermission = checker.hasEntityPermission(
              authCtx,
              existingEntity,
              'edit_entity'
            );
            if (!hasPermission) {
              return {
                rowNumber: row.rowNumber,
                errors: [...row.errors, 'No permission to update this entity'],
                entity: null,
                isUpdate: false,
                matchType: 'none',
                nameMatches: [],
                existingId: row.existingId,
                existingEntity: null,
                constraintViolations
              };
            }
          }

          return {
            rowNumber: row.rowNumber,
            errors: row.errors,
            entity: row.errors.length === 0 ? csvRowToEntity(row.data, schema.fields) : null,
            isUpdate,
            matchType,
            nameMatches:
              matchType === 'name'
                ? nameMatches.map(e => ({
                    id: e.id,
                    name: e.name,
                    slug: e.slug,
                    namespace: e.namespace
                  }))
                : [],
            existingId: existingEntity?.id ?? row.existingId,
            existingEntity:
              (isUpdate || matchType === 'name') && existingEntity
                ? {
                    _name: existingEntity.name,
                    _slug: existingEntity.slug,
                    _namespace: existingEntity.namespace,
                    _description: existingEntity.description,
                    _owner: existingEntity.owner,
                    _lifecycle: existingEntity.lifecycle,
                    _tags: existingEntity.tags,
                    ...(existingEntity.links && existingEntity.links.length > 0
                      ? { _links: existingEntity.links }
                      : {}),
                    ...existingEntity.data
                  }
                : null,
            constraintViolations: constraintViolations.length > 0 ? constraintViolations : undefined
          };
        });

        return {
          schemaId: body.schemaId,
          schemaName: schema.name,
          totalRows: parseResult.totalRows,
          validRows: parseResult.validRows,
          entities
        };
      } catch (e) {
        handleError(e, 'Failed to parse CSV');
      }
    })
  );

  router.post(
    `${BASE}/import/commit`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      const auditUser = authEvent.context.user;
      const body = await readBody<{
        schemaId: string;
        entities: Array<Record<string, unknown> & { _existingId?: string }>;
      }>(event);

      httpAssert.present(body, { message: 'Request body is required' });
      httpAssert.present(body.schemaId, { message: 'schemaId is required' });
      httpAssert.present(body.entities, { message: 'entities is required' });

      try {
        const schema = await db.catalog.getSchema(workspace, body.schemaId);
        httpAssert.present(schema, { status: 404, message: 'Schema not found' });

        requireCanCreateTopLevelEntity(
          authCtx,
          schema.id,
          'You do not have permission to create entities of this type'
        );

        const [lifecycleValues, teamIds, allEntities] = await Promise.all([
          getLifecycleValues(db, workspace),
          getTeamIds(db, workspace),
          db.catalog.listEntities(workspace)
        ]);

        const nameToId = new Map(allEntities.map(e => [e.name.toLowerCase(), e.id]));
        const entitiesById = new Map(allEntities.map(e => [e.id, e]));
        const entitiesBySlug = new Map(
          allEntities
            .filter(e => e.schema_id === body.schemaId && e.workspace === workspace)
            .map(e => [`${e.namespace}:${e.slug}`, e])
        );

        const createdIds: string[] = [];
        const updatedIds: string[] = [];

        for (const entityData of body.entities) {
          const existingId = entityData._existingId as string | undefined;
          const existingEntity = existingId ? entitiesById.get(existingId) : undefined;

          if (existingId) {
            if (!existingEntity) {
              throw new Error(`Entity ${existingId} not found`);
            }
            if (existingEntity.workspace !== workspace) {
              throw new Error(`Entity ${existingId} belongs to different workspace`);
            }
            if (existingEntity.schema_id !== body.schemaId) {
              throw new Error(`Entity ${existingId} has different schema type`);
            }
          } else {
            const proposedSlug =
              (entityData._slug as string) || slugify((entityData._name as string) ?? '');
            const proposedNamespace = (entityData._namespace as string) || 'default';

            if (entitiesBySlug.has(`${proposedNamespace}:${proposedSlug}`)) {
              throw new Error(
                `Slug "${proposedSlug}" already exists in namespace "${proposedNamespace}"`
              );
            }
          }

          const isUpdate = !!existingEntity;
          const owner = resolveCreateOwner(
            (entityData._owner as string | null) ?? null,
            [],
            schema,
            teamIds,
            authCtx.userId
          );

          const lifecycle = (entityData._lifecycle as string | null) ?? null;
          if (lifecycle && !lifecycleValues.has(lifecycle)) {
            throw new Error(`Invalid lifecycle value: ${lifecycle}`);
          }
          const target_lifecycle = (entityData._targetLifecycle as string | null) ?? null;
          if (target_lifecycle && !lifecycleValues.has(target_lifecycle)) {
            throw new Error(`Invalid target_lifecycle value: ${target_lifecycle}`);
          }
          const target_lifecycle_date = (entityData._targetLifecycleDate as string | null) ?? null;

          const resolvedData = { ...entityData };
          for (const field of schema.fields) {
            if (
              (field.type === 'reference' || field.type === 'containment') &&
              resolvedData[field.id]
            ) {
              const value = resolvedData[field.id];
              if (typeof value === 'string') {
                const refNames = value
                  .split(',')
                  .map(n => n.trim())
                  .filter(Boolean);
                const refIds = refNames
                  .map(name => nameToId.get(name.toLowerCase()))
                  .filter((id): id is string => id !== undefined);

                if (refIds.length > 0) {
                  resolvedData[field.id] = refIds.join(',');
                } else {
                  delete resolvedData[field.id];
                }
              }
            }
          }

          if (isUpdate && existingId && existingEntity) {
            requireEntityAction(
              authCtx,
              existingEntity,
              'edit_entity',
              'You do not have permission to update this entity'
            );

            const updateInput: EntityDbUpdate = {
              name: (resolvedData._name as string) ?? existingEntity.name,
              slug: (resolvedData._slug as string) ?? existingEntity.slug,
              namespace: (resolvedData._namespace as string) ?? existingEntity.namespace,
              description: (resolvedData._description as string) ?? existingEntity.description,
              owner,
              lifecycle,
              target_lifecycle,
              target_lifecycle_date,
              tags: Array.isArray(resolvedData._tags)
                ? (resolvedData._tags as string[])
                : existingEntity.tags,
              links: existingEntity.links,
              schema_id: existingEntity.schema_id,
              data: extractEntityFields(resolvedData),
              visibility_mode: existingEntity.visibility_mode,
              updated_at: new Date()
            };

            const updatedEntity = await db.catalog.updateEntity(workspace, existingId, updateInput);
            if (!updatedEntity) {
              throw new Error(`Failed to update entity ${existingId}`);
            }
            await logAudit(db, {
              workspace,
              userId: auditUser.id,
              userDisplayName: auditUser.display_name,
              operation: 'update',
              entityType: 'entity',
              entityId: existingId,
              entityName: updatedEntity.name,
              entitySlug: updatedEntity.slug,
              schemaId: updatedEntity.schema_id,
              changes: computeChanges(
                flattenEntityAuditFields(existingEntity),
                flattenEntityAuditFields(updatedEntity)
              )
            });

            updatedIds.push(existingId);
            nameToId.set(updatedEntity.name.toLowerCase(), existingId);
          } else {
            const createInput: EntityDbCreate = {
              id: randomUUID(),
              workspace,
              schema_id: body.schemaId,
              name: (resolvedData._name as string) ?? '',
              slug: slugify((resolvedData._slug as string) ?? (resolvedData._name as string) ?? ''),
              namespace: (resolvedData._namespace as string) ?? '',
              description: (resolvedData._description as string) ?? '',
              owner,
              lifecycle,
              target_lifecycle,
              target_lifecycle_date,
              tags: Array.isArray(resolvedData._tags) ? (resolvedData._tags as string[]) : [],
              links: [],
              data: extractEntityFields(resolvedData),
              visibility_mode: null,
              created_at: new Date(),
              updated_at: new Date()
            };

            const entity = await db.catalog.createEntity(createInput);
            await logAudit(db, {
              workspace,
              userId: auditUser.id,
              userDisplayName: auditUser.display_name,
              operation: 'create',
              entityType: 'entity',
              entityId: entity.id,
              entityName: entity.name,
              entitySlug: entity.slug,
              schemaId: entity.schema_id,
              changes: {
                new: flattenEntityAuditFields(entity)
              }
            });

            createdIds.push(entity.id);
            nameToId.set(entity.name.toLowerCase(), entity.id);
          }
        }

        return {
          created: createdIds.length,
          updated: updatedIds.length,
          ids: [...createdIds, ...updatedIds]
        };
      } catch (e) {
        logger.error('Import entities error', e instanceof Error ? e : new Error(String(e)));
        handleError(e, 'Failed to import entities');
      }
    })
  );

  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      return await getEntity(db, workspace, id, authCtx);
    })
  );

  router.get(
    `${BASE}/:id/relations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      return await getEntityRelations(db, workspace, id, authCtx);
    })
  );

  router.get(
    `${BASE}/:id/access`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });

      const entity = await db.catalog.getEntity(workspace, id);
      httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });

      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );

      return {
        owner: entity.owner,
        visibility_mode: entity.visibility_mode,
        grants: await db.catalog.getEntityGrants(workspace, id)
      };
    })
  );

  router.put(
    `${BASE}/:id/access`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });

      const entity = await db.catalog.getEntity(workspace, id);
      httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });

      requireEntityAction(
        authCtx,
        entity,
        'admin_entity',
        'You do not have permission to manage entity access'
      );

      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const { grants = [] } = body as Record<string, unknown>;
      httpAssert.array(grants, { message: 'grants must be an array' });
      const grantRows = grants as unknown[];

      const rows = buildEntityGrantInputs(workspace, id, grantRows, new Date());

      return {
        owner: entity.owner,
        visibility_mode: entity.visibility_mode,
        grants: await db.catalog.replaceEntityGrants(workspace, id, rows)
      };
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      const auditUser = authEvent.context.user;
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      return await createEntity(db, workspace, body as Record<string, unknown>, authCtx, {
        id: auditUser.id,
        displayName: auditUser.display_name
      });
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      const auditUser = authEvent.context.user;
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });
      return await updateEntity(db, workspace, id, body as Record<string, unknown>, authCtx, {
        id: auditUser.id,
        displayName: auditUser.display_name
      });
    })
  );

  router.post(
    `${BASE}/:id/clone`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      const auditUser = authEvent.context.user;
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      return await cloneEntity(db, workspace, id, authCtx, {
        id: auditUser.id,
        displayName: auditUser.display_name
      });
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const authEvent = event as AuthenticatedEvent;
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, authEvent);
      const auditUser = authEvent.context.user;
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      return await deleteEntity(db, workspace, id, authCtx, {
        id: auditUser.id,
        displayName: auditUser.display_name
      });
    })
  );

  return router;
}
