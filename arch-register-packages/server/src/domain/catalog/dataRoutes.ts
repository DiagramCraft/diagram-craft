import { defineHandler, getQuery, H3, readBody } from 'h3';
import { randomUUID } from 'node:crypto';
import type {
  CreateEntityGrantInput,
  DatabaseAdapter,
  UpdateEntityInput,
  CreateEntityInput
} from '../../db/database';
import { createLogger } from '../../utils/logger';
import { parseCsv, validateCsvData, csvRowToEntity } from '../../utils/csvImport';
import {
  decodeRefs,
  type Entity,
  type EntityLink,
  type EntitySchema as InternalEntitySchema,
  type SchemaField
} from '../../types';
import { toApiEntity, toApiEntitySummary } from './entityHelpers';
import { computeChanges, extractEntityFields, flattenEntityAuditFields, logAudit } from '../audit/db/auditLogging';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import { formatArrayForCsv, generateCsv } from '../../utils/csv';
import { handleDbError, parsePositiveInt, slugify } from '../../utils/http';
import { computeEntityCompleteness } from '../../utils/completeness';
import {
  buildApiAuthCtx,
  requireCanCreateTopLevelEntity,
  requireEntityAction
} from '../auth/authorization';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { PermissionChecker } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';

const logger = createLogger('data');

const BASE = '/api/:workspace/data';

const handleError = (error: unknown, fallback: string): never =>
  handleDbError(error, fallback, {
    foreign: '_schemaId references a schema that does not exist',
    unique:
      'An entity with that slug already exists in this namespace for the given schema in this workspace'
  });

const getLifecycleValues = async (db: DatabaseAdapter, workspace: string): Promise<Set<string>> =>
  new Set((await db.workspace.listLifecycleStates(workspace)).map(r => r.id));

const getTeamIds = async (db: DatabaseAdapter, workspace: string): Promise<Set<string>> =>
  new Set((await db.workspace.listTeams(workspace)).map(r => r.id));

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

export const resolveCreateOwner = (
  explicitOwner: string | null,
  parentEntities: Entity[],
  schema: InternalEntitySchema,
  teamIds: Set<string>,
  fallbackOwner: string | null
) => {
  if (explicitOwner && teamIds.has(explicitOwner)) return explicitOwner;
  const inheritedOwner =
    parentEntities.find(parent => parent.owner && teamIds.has(parent.owner))?.owner ?? null;
  if (inheritedOwner) return inheritedOwner;
  if (schema.default_owner && teamIds.has(schema.default_owner)) return schema.default_owner;
  if (fallbackOwner && teamIds.has(fallbackOwner)) return fallbackOwner;
  return null;
};

export const getEntityParentsFromPayload = (
  schema: InternalEntitySchema,
  payload: Record<string, unknown>,
  entityLookup: Map<string, Entity>
) => {
  const parentIds = schema.fields
    .filter(
      (field): field is Extract<InternalEntitySchema['fields'][number], { type: 'containment' }> =>
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

export const filterEntities = (
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

type EntityMutationPayload = {
  schemaId: string;
  name: string;
  slug: string;
  namespace: string;
  description: string;
  requestedOwner: string | null;
  requestedLifecycle: string | null;
  requestedTargetLifecycle: string | null;
  requestedTargetLifecycleDate: string | null;
  tags: string[];
  links: EntityLink[];
  visibilityMode: 'public' | 'restricted' | null;
  fields: Record<string, unknown>;
};

const relationFields = (fields: SchemaField[]) =>
  fields.filter(
    (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
      field.type === 'reference' || field.type === 'containment'
  );

export const parseEntityMutationPayload = (
  body: Record<string, unknown>
): EntityMutationPayload => {
  const {
    _schemaId,
    _name,
    _slug,
    _namespace = 'default',
    _description = '',
    _owner = null,
    _lifecycle = null,
    _targetLifecycle = null,
    _targetLifecycleDate = null,
    _tags = [],
    _links = [],
    _visibilityMode,
    ...fields
  } = body;

  httpAssert.string(_schemaId, {
    message: '_schemaId is required and must be a string (UUID)'
  });

  const name =
    typeof _name === 'string' ? _name : typeof fields['name'] === 'string' ? fields['name'] : '';
  delete fields['name'];

  const slug = typeof _slug === 'string' && _slug ? _slug : slugify(name);
  httpAssert.present(slug, {
    message: '_slug (or a _name to derive it from) is required'
  });

  return {
    schemaId: _schemaId,
    name,
    slug,
    namespace: typeof _namespace === 'string' ? _namespace : 'default',
    description: typeof _description === 'string' ? _description : '',
    requestedOwner: typeof _owner === 'string' ? _owner : null,
    requestedLifecycle: typeof _lifecycle === 'string' ? _lifecycle : null,
    requestedTargetLifecycle: typeof _targetLifecycle === 'string' ? _targetLifecycle : null,
    requestedTargetLifecycleDate: typeof _targetLifecycleDate === 'string' ? _targetLifecycleDate : null,
    tags: Array.isArray(_tags) ? _tags.filter((t): t is string => typeof t === 'string') : [],
    links: Array.isArray(_links) ? (_links as EntityLink[]) : [],
    visibilityMode:
      _visibilityMode === 'public' || _visibilityMode === 'restricted' ? _visibilityMode : null,
    fields
  };
};

export const buildEntityRelations = (
  entity: Entity,
  schemas: InternalEntitySchema[],
  entities: Entity[]
): RelationsResponse => {
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
        entitySlug: target.slug ?? refId,
        entityName: target.name ?? target.slug ?? refId,
        entitySchemaId: target.schema_id ?? field.schemaId,
        fieldName: field.name,
        kind: field.type
      });
    }
  }

  const incoming: RelationRecord[] = [];
  for (const row of entities) {
    if (row.id === entity.id) continue;
    const rowSchema = schemaMap.get(row.schema_id);
    if (!rowSchema) continue;
    for (const field of relationFields(rowSchema.fields)) {
      if (!decodeRefs(row.data[field.id]).includes(entity.id)) continue;
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

  return { outgoing, incoming };
};

export const buildEntityGrantInputs = (
  workspace: string,
  entityId: string,
  grants: unknown[],
  createdAt: Date,
  idFactory: () => string = randomUUID
): CreateEntityGrantInput[] =>
  grants.map(grant => {
    httpAssert.json(grant, { message: 'Each grant must be an object' });
    const typed = grant as Record<string, unknown>;
    httpAssert.true(typed['principal_type'] === 'user' || typed['principal_type'] === 'team', {
      message: 'principal_type must be user or team'
    });
    httpAssert.string(typed['principal_id'], {
      message: 'principal_id must be a non-empty string'
    });
    httpAssert.true(
      ['viewer', 'editor', 'contributor', 'entity_admin'].includes(String(typed['role'])),
      {
        message: 'role must be viewer, editor, contributor, or entity_admin'
      }
    );
    httpAssert.true(['self', 'subtree'].includes(String(typed['applies_to'])), {
      message: 'applies_to must be self or subtree'
    });
    return {
      id: idFactory(),
      workspace,
      entity_id: entityId,
      principal_type: typed['principal_type'] as 'user' | 'team',
      principal_id: typed['principal_id'] as string,
      role: typed['role'] as 'viewer' | 'editor' | 'contributor' | 'entity_admin',
      applies_to: typed['applies_to'] as 'self' | 'subtree',
      created_at: createdAt
    };
  });

export function createDataRoutes(db: DatabaseAdapter) {
  const checker = new PermissionChecker();
  const router = new H3();

  router.get(
    BASE,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
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
        const [allEntities, schemas] = await Promise.all([
          db.catalog.listEntities(workspace),
          db.catalog.listSchemas(workspace)
        ]);
        const schemaMap = new Map(schemas.map(s => [s.id, s]));
        const visibleEntities = allEntities.filter(entity =>
          checker.hasEntityPermission(authCtx, entity, 'view_entity')
        );
        const rows = filterEntities(visibleEntities, { schemaId, owner, lifecycle, q })
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(offset, limit != null ? offset + limit : undefined);
        return view === 'summary'
          ? rows.map(row => {
              const schema = schemaMap.get(row.schema_id);
              return toApiEntitySummary(
                row,
                authCtx,
                schema != null ? computeEntityCompleteness(row, schema) : null
              );
            })
          : rows.map(row => {
              const schema = schemaMap.get(row.schema_id);
              return toApiEntity(
                row,
                authCtx,
                schema != null ? computeEntityCompleteness(row, schema) : null
              );
            });
      } catch (e) {
        handleError(e, 'Failed to retrieve data');
      }
    })
  );

  router.get(
    `${BASE}/facets`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      try {
        const [allEntities, schemas] = await Promise.all([
          db.catalog.listEntities(workspace),
          db.catalog.listSchemas(workspace)
        ]);
        const schemaMap = new Map(schemas.map(s => [s.id, s]));
        const entities = allEntities.filter(entity =>
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

        const completenessScores = entities.map(entity => {
          const schema = schemaMap.get(entity.schema_id);
          return schema ? computeEntityCompleteness(entity, schema) : null;
        });
        const scored = completenessScores.filter((s): s is number => s !== null);
        const completeness = {
          below50: scored.filter(s => s < 50).length,
          below80: scored.filter(s => s >= 50 && s < 80).length,
          above80: scored.filter(s => s >= 80).length
        };

        return {
          total: entities.length,
          lifecycle: countBy(entities.map(entity => entity.lifecycle)),
          owner: countBy(entities.map(entity => entity.owner)),
          schema: countBy(entities.map(entity => entity.schema_id)).map(({ value, count }) => ({
            schemaId: value!,
            count
          })),
          completeness
        };
      } catch (e) {
        handleError(e, 'Failed to retrieve data facets');
      }
    })
  );

  router.get(
    `${BASE}/tree`,
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
            ...toApiEntitySummary(row, authCtx),
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

        // Build template columns
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

        // Generate empty CSV with just headers (using semicolon delimiter)
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

        // Convert to entity format for preview
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

          // Check permissions for updates
          if ((isUpdate || matchType === 'name') && existingEntity) {
            const checker = new PermissionChecker();
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
                    // Only include _links if it has actual content
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
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
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

          // Resolve reference fields
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

            const updateInput: UpdateEntityInput = {
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
            await logAudit(db.audit, {
              workspace,
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
            // Create new entity
            const createInput: CreateEntityInput = {
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
            await logAudit(db.audit, {
              workspace,
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
      try {
        const [row, schemas] = await Promise.all([
          db.catalog.getEntity(workspace, id),
          db.catalog.listSchemas(workspace)
        ]);
        httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
        requireEntityAction(
          authCtx,
          row,
          'view_entity',
          'You do not have access to view this entity'
        );
        const schema = schemas.find(s => s.id === row.schema_id);
        return toApiEntity(
          row,
          authCtx,
          schema != null ? computeEntityCompleteness(row, schema) : null
        );
      } catch (e) {
        handleError(e, 'Failed to retrieve data record');
      }
    })
  );

  router.get(
    `${BASE}/:id/relations`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });

      try {
        const [entity, schemas, entitiesRaw] = await Promise.all([
          db.catalog.getEntity(workspace, id),
          db.catalog.listSchemas(workspace),
          db.catalog.listEntities(workspace)
        ]);
        httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });
        requireEntityAction(
          authCtx,
          entity,
          'view_entity',
          'You do not have access to view this entity'
        );
        const entities = authCtx
          ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
          : entitiesRaw;

        return buildEntityRelations(entity, schemas, entities);
      } catch (e) {
        handleError(e, 'Failed to retrieve data relations');
      }
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
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const payload = parseEntityMutationPayload(body as Record<string, unknown>);
      const lifecycleValues = await getLifecycleValues(db, workspace);
      const lifecycle =
        payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
          ? payload.requestedLifecycle
          : null;
      const target_lifecycle =
        payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
          ? payload.requestedTargetLifecycle
          : null;
      const target_lifecycle_date = payload.requestedTargetLifecycleDate ?? null;
      const teamIds = await getTeamIds(db, workspace);

      try {
        const [schema, entities] = await Promise.all([
          db.catalog.getSchema(workspace, payload.schemaId),
          db.catalog.listEntities(workspace)
        ]);
        httpAssert.present(schema, {
          status: 404,
          message: `Schema '${payload.schemaId}' not found`
        });
        const entityLookup = new Map(entities.map(entity => [entity.id, entity]));
        const parents = getEntityParentsFromPayload(schema, payload.fields, entityLookup);
        const fallbackOwner = (await db.workspace.listTeams(workspace))[0]?.id ?? null;
        const owner = resolveCreateOwner(
          payload.requestedOwner,
          parents,
          schema,
          teamIds,
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
        const row = await db.catalog.createEntity({
          id: randomUUID(),
          workspace,
          slug: payload.slug,
          namespace: payload.namespace,
          name: payload.name,
          description: payload.description,
          owner,
          lifecycle,
          target_lifecycle,
          target_lifecycle_date,
          tags: payload.tags,
          links: payload.links,
          schema_id: payload.schemaId,
          data: payload.fields,
          visibility_mode: payload.visibilityMode,
          created_at: timestamp,
          updated_at: timestamp
        });

        await logAudit(db.audit, {
          workspace,
          operation: 'create',
          entityType: 'entity',
          entityId: row.id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            new: flattenEntityAuditFields(row)
          }
        });

        return toApiEntity(row, authCtx);
      } catch (e) {
        handleError(e, 'Failed to create data record');
      }
    })
  );

  router.put(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });

      const body = await event.req.json().catch(() => undefined);
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const payload = parseEntityMutationPayload(body as Record<string, unknown>);
      const lifecycleValues = await getLifecycleValues(db, workspace);
      const lifecycle =
        payload.requestedLifecycle && lifecycleValues.has(payload.requestedLifecycle)
          ? payload.requestedLifecycle
          : null;
      const target_lifecycle =
        payload.requestedTargetLifecycle && lifecycleValues.has(payload.requestedTargetLifecycle)
          ? payload.requestedTargetLifecycle
          : null;
      const target_lifecycle_date = payload.requestedTargetLifecycleDate ?? null;
      const teamIds = await getTeamIds(db, workspace);
      const owner =
        payload.requestedOwner && teamIds.has(payload.requestedOwner)
          ? payload.requestedOwner
          : null;

      try {
        const oldRow = await db.catalog.getEntity(workspace, id);
        httpAssert.present(oldRow, { status: 404, message: `Data record '${id}' not found` });
        if (authCtx)
          requireEntityAction(
            authCtx,
            oldRow,
            'edit_entity',
            'You do not have permission to edit this entity'
          );
        if (
          authCtx &&
          (owner !== oldRow.owner || payload.visibilityMode !== oldRow.visibility_mode)
        ) {
          requireEntityAction(
            authCtx,
            oldRow,
            'admin_entity',
            'You do not have permission to change ownership or visibility'
          );
        }

        const row = await db.catalog.updateEntity(workspace, id, {
          slug: payload.slug,
          namespace: payload.namespace,
          name: payload.name,
          description: payload.description,
          owner,
          lifecycle,
          target_lifecycle,
          target_lifecycle_date,
          tags: payload.tags,
          links: payload.links,
          schema_id: payload.schemaId,
          data: payload.fields,
          visibility_mode: payload.visibilityMode,
          updated_at: new Date()
        });

        httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
        await logAudit(db.audit, {
          workspace,
          operation: 'update',
          entityType: 'entity',
          entityId: id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: computeChanges(flattenEntityAuditFields(oldRow), flattenEntityAuditFields(row))
        });

        return toApiEntity(row, authCtx);
      } catch (e) {
        handleError(e, 'Failed to update data record');
      }
    })
  );

  router.post(
    `${BASE}/:id/clone`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      try {
        const source = await db.catalog.getEntity(workspace, id);
        httpAssert.present(source, { status: 404, message: `Data record '${id}' not found` });
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
        const row = await db.catalog.createEntity({
          id: randomUUID(),
          workspace,
          slug: baseSlug,
          namespace: source.namespace,
          name: baseName,
          description: source.description,
          owner: source.owner,
          lifecycle: source.lifecycle,
          target_lifecycle: source.target_lifecycle,
          target_lifecycle_date: source.target_lifecycle_date,
          tags: source.tags,
          links: source.links,
          schema_id: source.schema_id,
          data: source.data,
          visibility_mode: source.visibility_mode,
          created_at: timestamp,
          updated_at: timestamp
        });

        await logAudit(db.audit, {
          workspace,
          operation: 'create',
          entityType: 'entity',
          entityId: row.id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            new: flattenEntityAuditFields(row)
          }
        });

        return toApiEntity(row, authCtx);
      } catch (e) {
        handleError(e, 'Failed to clone data record');
      }
    })
  );

  router.delete(
    `${BASE}/:id`,
    defineHandler(async event => {
      const workspace = await resolveWorkspace(db.catalog, event.context.params?.['workspace']);
      const authCtx = await buildApiAuthCtx(db, workspace, event as AuthenticatedEvent);
      const id = event.context.params?.['id'];
      httpAssert.present(id, { message: 'id is required' });
      try {
        const row = await db.catalog.getEntity(workspace, id);
        httpAssert.present(row, { status: 404, message: `Data record '${id}' not found` });
        if (authCtx)
          requireEntityAction(
            authCtx,
            row,
            'admin_entity',
            'You do not have permission to delete this entity'
          );

        await db.catalog.deleteEntity(workspace, id);
        await logAudit(db.audit, {
          workspace,
          operation: 'delete',
          entityType: 'entity',
          entityId: id,
          entityName: row.name,
          entitySlug: row.slug,
          schemaId: row.schema_id,
          changes: {
            old: flattenEntityAuditFields(row)
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
