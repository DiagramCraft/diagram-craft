import { H3, HTTPError, defineHandler, getQuery } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import {
  decodeRefs,
  type Entity,
  type EntityApiResponse,
  type EntityLink,
  type SchemaField
} from '../types.js';
import { logAudit, extractEntityFields, computeChanges } from '../db/audit.js';
import { resolveWorkspace } from './workspace-resolver.js';
import { generateCsv, formatArrayForCsv } from '../utils/csv.js';
import { handleDbError, parsePositiveInt, slugify } from '../utils/http.js';
import { buildApiAuthCtx, requireEntityAction, requireCanCreateTopLevelEntity } from '../auth/authorization.js';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import {
  AuthorizationContext,
  EntityCapabilities,
  EntitySchema,
  PermissionChecker
} from '@arch-register/permissions';

const BASE = '/api/:workspace/data';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    foreign: '_schemaId references a schema that does not exist',
    unique:
      'An entity with that slug already exists in this namespace for the given schema in this workspace'
  });

const getLifecycleValues = async (db: DatabaseAdapter, workspace: string): Promise<Set<string>> =>
  new Set((await db.listLifecycleStates(workspace)).map(r => r.id));

const getOwnerValues = async (db: DatabaseAdapter, workspace: string): Promise<Set<string>> =>
  new Set((await db.listOwners(workspace)).map(r => r.id));

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

const resolveCreateOwner = (
  explicitOwner: string | null,
  parentEntities: Entity[],
  schema: EntitySchema,
  ownerValues: Set<string>,
  fallbackOwner: string | null
) => {
  if (explicitOwner && ownerValues.has(explicitOwner)) return explicitOwner;
  const inheritedOwner =
    parentEntities.find(parent => parent.owner && ownerValues.has(parent.owner))?.owner ?? null;
  if (inheritedOwner) return inheritedOwner;
  if (schema.default_owner && ownerValues.has(schema.default_owner)) return schema.default_owner;
  if (fallbackOwner && ownerValues.has(fallbackOwner)) return fallbackOwner;
  return null;
};

const getEntityParentsFromPayload = (
  schema: EntitySchema,
  payload: Record<string, unknown>,
  entityLookup: Map<string, Entity>
) => {
  const parentIds = schema.fields
    .filter(
      (field): field is Extract<EntitySchema['fields'][number], { type: 'containment' }> =>
        field.type === 'containment'
    )
    .flatMap(field => {
      const raw = payload[field.id];
      if (raw == null || raw === '') return [];
      return String(raw)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    });
  return parentIds
    .map(parentId => entityLookup.get(parentId))
    .filter((entity): entity is Entity => entity != null);
};

const entityMatchesPattern = (entity: Entity, pattern: string) => {
  const query = pattern.toLowerCase();
  return (
    includesQuery(entity.name, query) ||
    includesQuery(entity.slug, query) ||
    includesQuery(entity.description, query) ||
    includesQuery(entity.owner, query) ||
    entity.tags.some(tag => includesQuery(tag, query))
  );
};

const getEntityCapabilities = (
  context: AuthorizationContext | null,
  entity: Entity
): EntityCapabilities => {
  if (!context) {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
      canAdmin: true,
      canCreateChild: true
    };
  }

  const checker = new PermissionChecker();
  return {
    canView: checker.hasEntityPermission(context, entity, 'view_entity'),
    canEdit: checker.hasEntityPermission(context, entity, 'edit_entity'),
    canDelete: checker.hasEntityPermission(context, entity, 'admin_entity'),
    canAdmin: checker.hasEntityPermission(context, entity, 'admin_entity'),
    canCreateChild: checker.hasEntityPermission(context, entity, 'create_child')
  };
};

const filterEntities = (
  entities: Entity[],
  options: {
    schemaId: string | null;
    owner: string | null;
    lifecycle: string | null;
    q: string;
  }
) => {
  const trimmed = options.q.trim();
  return entities.filter(entity => {
    if (options.schemaId && entity.schema_id !== options.schemaId) return false;
    if (options.owner && entity.owner !== options.owner) return false;
    if (options.lifecycle && entity.lifecycle !== options.lifecycle) return false;
    if (trimmed && !entityMatchesPattern(entity, trimmed)) return false;
    return true;
  });
};

const toApiFormat = (row: Entity, authCtx: AuthorizationContext): EntityApiResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _name: row.name,
  _slug: row.slug,
  _namespace: row.namespace,
  _description: row.description,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  _tags: row.tags,
  _links: row.links,
  _visibilityMode: row.visibility_mode,
  ...getEntityCapabilities(authCtx, row),
  ...row.data
});

type EntitySummaryResponse = {
  _uid: string;
  _workspace: string;
  _schemaId: string;
  _name: string;
  _slug: string;
  _namespace: string;
  _description: string;
  _owner: string | null;
  _lifecycle: string | null;
  _tags: string[];
  _links: EntityLink[];
  _visibilityMode: Entity['visibility_mode'];
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAdmin: boolean;
  canCreateChild: boolean;
};

const toSummaryFormat = (row: Entity, authCtx: AuthorizationContext): EntitySummaryResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _name: row.name,
  _slug: row.slug,
  _namespace: row.namespace,
  _description: row.description,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  _tags: row.tags,
  _links: row.links,
  _visibilityMode: row.visibility_mode,
  ...getEntityCapabilities(authCtx, row)
});

type RelationRecord = {
  entityId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

type RelationsResponse = {
  outgoing: RelationRecord[];
  incoming: RelationRecord[];
};

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
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      const schemaId = typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null;
      const owner = typeof query['owner'] === 'string' ? query['owner'] : null;
      const lifecycle = typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null;
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
      const view = query['view'] === 'summary' ? 'summary' : 'full';
      const limit = parsePositiveInt(query['limit'], 'limit');
      const offset = parsePositiveInt(query['offset'], 'offset') ?? 0;
      try {
        const visibleEntities = (await db.listEntities(workspace)).filter(entity =>
          checker.hasEntityPermission(authCtx, entity, 'view_entity')
        );
        const rows = filterEntities(visibleEntities, { schemaId, owner, lifecycle, q })
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(offset, limit != null ? offset + limit : undefined);
        return view === 'summary'
          ? rows.map(row => toSummaryFormat(row, authCtx))
          : rows.map(row => toApiFormat(row, authCtx));
      } catch (e) {
        handleError(e, 'Failed to retrieve data');
      }
    })
  );

  router.get(
    `${BASE}/facets`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      try {
        const entities = (await db.listEntities(workspace)).filter(entity =>
          checker.hasEntityPermission(authCtx, entity, 'view_entity')
        );
        const countBy = <T extends string | null>(values: T[]) =>
          [
            ...values
              .reduce(
                (acc, value) => acc.set(value, (acc.get(value) ?? 0) + 1),
                new Map<T, number>()
              )
              .entries()
          ]
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
        return {
          total: entities.length,
          lifecycle: countBy(entities.map(entity => entity.lifecycle)),
          owner: countBy(entities.map(entity => entity.owner)),
          schema: countBy(entities.map(entity => entity.schema_id)).map(({ value, count }) => ({
            schemaId: value!,
            count
          }))
        };
      } catch (e) {
        handleError(e, 'Failed to retrieve data facets');
      }
    })
  );

  router.get(
    `${BASE}/tree`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      const schemaId = typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null;
      const owner = typeof query['owner'] === 'string' ? query['owner'] : null;
      const lifecycle = typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null;
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';

      try {
        const [schemas, allEntitiesRaw] = await Promise.all([
          db.listSchemas(workspace),
          db.listEntities(workspace)
        ]);
        const allEntities = allEntitiesRaw.filter(entity =>
          checker.hasEntityPermission(authCtx, entity, 'view_entity')
        );
        const containmentFieldsBySchema = new Map<string, string[]>();
        for (const schema of schemas) {
          const cFields = schema.fields
            .filter(
              (f): f is Extract<SchemaField, { type: 'containment' }> => f.type === 'containment'
            )
            .map(f => f.id);
          if (cFields.length > 0) containmentFieldsBySchema.set(schema.id, cFields);
        }

        const matchRows = filterEntities(allEntities, { schemaId, owner, lifecycle, q }).sort(
          (a, b) => a.name.localeCompare(b.name)
        );
        const matchIds = new Set(matchRows.map(r => r.id));
        const entityById = new Map(allEntities.map(entity => [entity.id, entity]));
        const allIncluded = new Map<string, Entity>(matchRows.map(entity => [entity.id, entity]));
        const edges: Array<{ childId: string; parentId: string }> = [];

        let currentLevel = [...matchRows];
        while (currentLevel.length > 0) {
          const nextLevel: Entity[] = [];
          for (const entity of currentLevel) {
            const cFields = containmentFieldsBySchema.get(entity.schema_id) ?? [];
            for (const fieldId of cFields) {
              for (const parentId of decodeRefs(entity.data[fieldId])) {
                edges.push({ childId: entity.id, parentId });
                const parent = entityById.get(parentId);
                if (parent && !allIncluded.has(parent.id)) {
                  allIncluded.set(parent.id, parent);
                  nextLevel.push(parent);
                }
              }
            }
          }
          currentLevel = nextLevel;
        }

        return {
          nodes: [...allIncluded.values()].map(row => ({
            ...toSummaryFormat(row, authCtx),
            _isMatch: matchIds.has(row.id)
          })),
          edges
        };
      } catch (e) {
        handleError(e, 'Failed to build tree data');
      }
    })
  );

  router.get(
    `${BASE}/export`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const query = getQuery(event);
      const schemaId = typeof query['_schemaId'] === 'string' ? query['_schemaId'] : null;
      const owner = typeof query['owner'] === 'string' ? query['owner'] : null;
      const lifecycle = typeof query['lifecycle'] === 'string' ? query['lifecycle'] : null;
      const q = typeof query['q'] === 'string' ? query['q'].trim() : '';

      try {
        const [schemas, allEntitiesRaw] = await Promise.all([
          db.listSchemas(workspace),
          db.listEntities(workspace)
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
          if (!schema) {
            throw new HTTPError({
              status: 404,
              statusText: 'Not Found',
              message: 'Schema not found'
            });
          }

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
            'Name',
            'Slug',
            'Namespace',
            'Description',
            'Owner',
            'Lifecycle',
            'Tags',
            'Links',
            'Schema Type',
            ...schema.fields.map(f => f.name)
          ];
          const rows = entities.map(entity => {
            const row: Record<string, unknown> = {
              'Name': entity.name,
              'Slug': entity.slug,
              'Namespace': entity.namespace,
              'Description': entity.description,
              'Owner': entity.owner ?? '',
              'Lifecycle': entity.lifecycle ?? '',
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
          csvContent = generateCsv(rows, columns);
        } else {
          const columns = [
            'Name',
            'Slug',
            'Namespace',
            'Description',
            'Owner',
            'Lifecycle',
            'Tags',
            'Links',
            'Schema Type'
          ];
          const rows = entities.map(entity => ({
            'Name': entity.name,
            'Slug': entity.slug,
            'Namespace': entity.namespace,
            'Description': entity.description,
            'Owner': entity.owner ?? '',
            'Lifecycle': entity.lifecycle ?? '',
            'Tags': formatArrayForCsv(entity.tags),
            'Links': entity.links.length.toString(),
            'Schema Type': schemaMap.get(entity.schema_id)?.name ?? entity.schema_id
          }));
          csvContent = generateCsv(rows, columns);
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

  router.get(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const row = await db.getEntity(workspace, id);
        if (!row) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data record '${id}' not found`
          });
        }
        requireEntityAction(
          authCtx,
          row,
          'view_entity',
          'You do not have access to view this entity'
        );
        return toApiFormat(row, authCtx);
      } catch (e) {
        handleError(e, 'Failed to retrieve data record');
      }
    })
  );

  router.get(
    `${BASE}/:id/relations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      try {
        const [entity, schemas, entitiesRaw] = await Promise.all([
          db.getEntity(workspace, id),
          db.listSchemas(workspace),
          db.listEntities(workspace)
        ]);
        if (!entity) {
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data record '${id}' not found`
          });
        }
        requireEntityAction(
          authCtx,
          entity,
          'view_entity',
          'You do not have access to view this entity'
        );
        const entities = authCtx
          ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
          : entitiesRaw;

        const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
        const entitySchema = schemaMap.get(entity.schema_id);
        const outgoingFields = relationFields(entitySchema?.fields ?? []);
        const entityLookup = new Map(entities.map(row => [row.id, row]));
        const outgoing: RelationRecord[] = [];
        for (const field of outgoingFields) {
          for (const refId of decodeRefs(entity.data[field.id])) {
            const target = entityLookup.get(refId);
            if (!target) continue;
            outgoing.push({
              entityId: refId,
              entitySlug: target?.slug ?? refId,
              entityName: target?.name ?? target?.slug ?? refId,
              entitySchemaId: target?.schema_id ?? field.schemaId,
              fieldName: field.name,
              kind: field.type
            });
          }
        }

        const incoming: RelationRecord[] = [];
        for (const row of entities) {
          if (row.id === id) continue;
          const rowSchema = schemaMap.get(row.schema_id);
          if (!rowSchema) continue;
          for (const field of relationFields(rowSchema.fields)) {
            if (!decodeRefs(row.data[field.id]).includes(id)) continue;
            incoming.push({
              entityId: row.id,
              entitySlug: row.slug,
              entityName: row.name || row.slug,
              entitySchemaId: row.schema_id,
              fieldName: field.name,
              kind: field.type
            });
          }
        }

        const response: RelationsResponse = { outgoing, incoming };
        return response;
      } catch (e) {
        handleError(e, 'Failed to retrieve data relations');
      }
    })
  );

  router.get(
    `${BASE}/:id/access`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      const entity = await db.getEntity(workspace, id);
      if (!entity) {
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Data record '${id}' not found`
        });
      }

      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );

      return {
        owner: entity.owner,
        visibility_mode: entity.visibility_mode,
        grants: await db.getEntityGrants(workspace, id)
      };
    })
  );

  router.put(
    `${BASE}/:id/access`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      const entity = await db.getEntity(workspace, id);
      if (!entity)
        throw new HTTPError({
          status: 404,
          statusText: 'Not Found',
          message: `Data record '${id}' not found`
        });
      if (authCtx)
        requireEntityAction(
          authCtx,
          entity,
          'admin_entity',
          'You do not have permission to manage entity access'
        );

      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object') {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });
      }

      const { grants = [] } = body as Record<string, unknown>;
      if (!Array.isArray(grants)) {
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'grants must be an array'
        });
      }

      const rows = grants.map(grant => {
        if (grant == null || typeof grant !== 'object') {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'Each grant must be an object'
          });
        }
        const typed = grant as Record<string, unknown>;
        if (typed['principal_type'] !== 'user' && typed['principal_type'] !== 'team') {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'principal_type must be user or team'
          });
        }
        if (typeof typed['principal_id'] !== 'string' || typed['principal_id'] === '') {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'principal_id must be a non-empty string'
          });
        }
        if (!['viewer', 'editor', 'contributor', 'entity_admin'].includes(String(typed['role']))) {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'role must be viewer, editor, contributor, or entity_admin'
          });
        }
        if (!['self', 'subtree'].includes(String(typed['applies_to']))) {
          throw new HTTPError({
            status: 400,
            statusText: 'Bad Request',
            message: 'applies_to must be self or subtree'
          });
        }
        const principalType = typed['principal_type'] as 'user' | 'team';
        const role = typed['role'] as 'viewer' | 'editor' | 'contributor' | 'entity_admin';
        const appliesTo = typed['applies_to'] as 'self' | 'subtree';
        return {
          id: crypto.randomUUID(),
          workspace,
          entity_id: id,
          principal_type: principalType,
          principal_id: typed['principal_id'],
          role,
          applies_to: appliesTo,
          created_at: new Date()
        };
      });

      return {
        owner: entity.owner,
        visibility_mode: entity.visibility_mode,
        grants: await db.replaceEntityGrants(workspace, id, rows)
      };
    })
  );

  router.post(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });

      const {
        _schemaId,
        _name,
        _slug,
        _namespace = 'default',
        _description = '',
        _owner = null,
        _lifecycle = null,
        _tags = [],
        _links = [],
        _visibilityMode,
        ...fields
      } = body as Record<string, unknown>;

      if (!_schemaId || typeof _schemaId !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: '_schemaId is required and must be a string (UUID)'
        });

      const name =
        typeof _name === 'string'
          ? _name
          : typeof fields['name'] === 'string'
            ? fields['name']
            : '';
      delete fields['name'];

      const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
      if (!slug)
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: '_slug (or a _name to derive it from) is required'
        });

      const namespace = typeof _namespace === 'string' ? _namespace : 'default';
      const description = typeof _description === 'string' ? _description : '';
      const lifecycleValues = await getLifecycleValues(db, workspace);
      const lifecycle =
        typeof _lifecycle === 'string' && lifecycleValues.has(_lifecycle) ? _lifecycle : null;
      const ownerValues = await getOwnerValues(db, workspace);
      const tags = Array.isArray(_tags)
        ? _tags.filter((t): t is string => typeof t === 'string')
        : [];
      const links = Array.isArray(_links) ? (_links as EntityLink[]) : [];
      const visibilityMode =
        _visibilityMode === 'public' || _visibilityMode === 'restricted' ? _visibilityMode : null;

      try {
        const [schema, entities] = await Promise.all([
          db.getSchema(workspace, _schemaId),
          db.listEntities(workspace)
        ]);
        if (!schema)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Schema '${_schemaId}' not found`
          });
        const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
        const parents = getEntityParentsFromPayload(schema, fields, entityLookup);
        const fallbackOwner = (await db.listOwners(workspace))[0]?.id ?? null;
        const owner = resolveCreateOwner(
          typeof _owner === 'string' ? _owner : null,
          parents,
          schema,
          ownerValues,
          fallbackOwner
        );
        if (authCtx) {
          if (parents.length > 0) {
            parents.forEach(parent =>
              requireEntityAction(
                authCtx,
                parent,
                'create_child',
                'You do not have permission to add children under one or more parent entities'
              )
            );
          } else {
            requireCanCreateTopLevelEntity(
              authCtx,
              owner,
              'Top-level entity creation requires membership in the resolved owner team or a platform admin role'
            );
          }
        }
        const timestamp = new Date();
        const row = await db.createEntity({
          id: crypto.randomUUID(),
          workspace,
          slug,
          namespace,
          name,
          description,
          owner,
          lifecycle,
          tags,
          links,
          schema_id: _schemaId,
          data: fields,
          visibility_mode: visibilityMode,
          created_at: timestamp,
          updated_at: timestamp
        });

        await logAudit(db, {
          workspace,
          operation: 'create',
          entityType: 'entity',
          entityId: row.id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            new: extractEntityFields(row)
          }
        });

        return toApiFormat(row, authCtx);
      } catch (e) {
        handleError(e, 'Failed to create data record');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });

      const body = await event.req.json().catch(() => undefined);
      if (body == null || typeof body !== 'object')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: 'Request body must be a JSON object'
        });

      const {
        _schemaId,
        _name,
        _slug,
        _namespace,
        _description = '',
        _owner,
        _lifecycle,
        _tags = [],
        _links = [],
        _visibilityMode,
        ...fields
      } = body as Record<string, unknown>;

      if (!_schemaId || typeof _schemaId !== 'string')
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: '_schemaId is required and must be a string (UUID)'
        });

      const name =
        typeof _name === 'string'
          ? _name
          : typeof fields['name'] === 'string'
            ? fields['name']
            : '';
      delete fields['name'];

      const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
      if (!slug)
        throw new HTTPError({
          status: 400,
          statusText: 'Bad Request',
          message: '_slug (or a _name to derive it from) is required'
        });

      const namespace = typeof _namespace === 'string' ? _namespace : 'default';
      const description = typeof _description === 'string' ? _description : '';
      const lifecycleValues = await getLifecycleValues(db, workspace);
      const lifecycle =
        typeof _lifecycle === 'string' && lifecycleValues.has(_lifecycle) ? _lifecycle : null;
      const ownerValues = await getOwnerValues(db, workspace);
      const owner = typeof _owner === 'string' && ownerValues.has(_owner) ? _owner : null;
      const tags = Array.isArray(_tags)
        ? _tags.filter((t): t is string => typeof t === 'string')
        : [];
      const links = Array.isArray(_links) ? (_links as EntityLink[]) : [];
      const visibilityMode =
        _visibilityMode === 'public' || _visibilityMode === 'restricted' ? _visibilityMode : null;

      try {
        const oldRow = await db.getEntity(workspace, id);
        if (!oldRow)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data record '${id}' not found`
          });
        if (authCtx)
          requireEntityAction(
            authCtx,
            oldRow,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
        if (authCtx && (owner !== oldRow.owner || visibilityMode !== oldRow.visibility_mode)) {
          requireEntityAction(
            authCtx,
            oldRow,
            'admin_entity',
            'You do not have permission to change ownership or visibility'
          );
        }

        const row = await db.updateEntity(workspace, id, {
          slug,
          namespace,
          name,
          description,
          owner,
          lifecycle,
          tags,
          links,
          schema_id: _schemaId,
          data: fields,
          visibility_mode: visibilityMode,
          updated_at: new Date()
        });

        const changes = computeChanges(extractEntityFields(oldRow), extractEntityFields(row!));
        await logAudit(db, {
          workspace,
          operation: 'update',
          entityType: 'entity',
          entityId: id,
          entityName: row!.name,
          entitySlug: row!.slug,
          schemaId: row!.schema_id,
          changes
        });

        return toApiFormat(row!, authCtx);
      } catch (e) {
        handleError(e, 'Failed to update data record');
      }
    })
  );

  router.post(
    `${BASE}/:id/clone`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const source = await db.getEntity(workspace, id);
        if (!source)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data record '${id}' not found`
          });
        if (authCtx)
          requireEntityAction(
            authCtx,
            source,
            'create_child',
            'You do not have permission to clone this entity'
          );

        const baseName = source.name ? `${source.name} (copy)` : source.slug;
        const baseSlug = slugify(baseName);
        const timestamp = new Date();
        const row = await db.createEntity({
          id: crypto.randomUUID(),
          workspace,
          slug: baseSlug,
          namespace: source.namespace,
          name: baseName,
          description: source.description,
          owner: source.owner,
          lifecycle: source.lifecycle,
          tags: source.tags,
          links: source.links,
          schema_id: source.schema_id,
          data: source.data,
          visibility_mode: source.visibility_mode,
          created_at: timestamp,
          updated_at: timestamp
        });

        await logAudit(db, {
          workspace,
          operation: 'create',
          entityType: 'entity',
          entityId: row.id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            new: extractEntityFields(row)
          }
        });

        return toApiFormat(row, authCtx);
      } catch (e) {
        handleError(e, 'Failed to clone data record');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(event, db);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      if (!id)
        throw new HTTPError({ status: 400, statusText: 'Bad Request', message: 'id is required' });
      try {
        const row = await db.getEntity(workspace, id);
        if (!row)
          throw new HTTPError({
            status: 404,
            statusText: 'Not Found',
            message: `Data record '${id}' not found`
          });
        if (authCtx)
          requireEntityAction(
            authCtx,
            row,
            'admin_entity',
            'You do not have permission to delete this entity'
          );

        await db.deleteEntity(workspace, id);
        await logAudit(db, {
          workspace,
          operation: 'delete',
          entityType: 'entity',
          entityId: id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            old: extractEntityFields(row)
          }
        });

        return { success: true, message: `Data record '${id}' deleted` };
      } catch (e) {
        handleError(e, 'Failed to delete data record');
      }
    })
  );

  return router;
}
