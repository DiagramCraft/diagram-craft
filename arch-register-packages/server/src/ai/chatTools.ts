import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import { toolDefinition } from '@tanstack/ai';
import { newid } from '@diagram-craft/utils/id';
import type { DatabaseAdapter } from '../db/database.js';
import { decodeRefs, type Entity, type SchemaField } from '../types.js';
import { requireCanCreateTopLevelEntity, requireEntityAction } from '../auth/authorization.js';

const checker = new PermissionChecker();

type QueryEntitiesArgs = {
  query?: string;
  schemaId?: string;
  owner?: string;
  lifecycle?: string;
  limit?: number;
  offset?: number;
};

type GetEntityDetailsArgs = {
  entityId?: string;
  slug?: string;
  includeRelated?: boolean;
};

type CreateEntityArgs = {
  schemaId: string;
  name?: string;
  slug?: string;
  namespace?: string;
  description?: string;
  owner?: string | null;
  lifecycle?: string | null;
  tags?: string[];
  visibilityMode?: 'public' | 'restricted' | null;
  fields?: Record<string, unknown>;
};

type UpdateEntityArgs = {
  entityId: string;
  name?: string;
  slug?: string;
  namespace?: string;
  description?: string;
  owner?: string | null;
  lifecycle?: string | null;
  tags?: string[];
  visibilityMode?: 'public' | 'restricted' | null;
  fields?: Record<string, unknown>;
};

const queryEntitiesTool = toolDefinition({
  name: 'query_entities',
  description:
    'Find entities in the workspace by text query and optional schema, owner, or lifecycle filters.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      schemaId: { type: 'string' },
      owner: { type: 'string' },
      lifecycle: { type: 'string' },
      limit: { type: 'number', minimum: 1, maximum: 50 },
      offset: { type: 'number', minimum: 0 }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      total: { type: 'number' },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            schemaId: { type: 'string' },
            schemaName: { type: 'string' },
            description: { type: 'string' },
            owner: { type: ['string', 'null'] },
            lifecycle: { type: ['string', 'null'] },
            tags: { type: 'array', items: { type: 'string' } },
            matchedMetadata: { type: 'array', items: { type: 'string' } },
            matchedFields: { type: 'array', items: { type: 'string' } },
            dataPreview: { type: 'object', additionalProperties: true }
          },
          required: [
            'id',
            'name',
            'slug',
            'schemaId',
            'schemaName',
            'description',
            'owner',
            'lifecycle',
            'tags',
            'matchedMetadata',
            'matchedFields',
            'dataPreview'
          ],
          additionalProperties: false
        }
      }
    },
    required: ['total', 'entities'],
    additionalProperties: false
  }
});

const getEntityDetailsTool = toolDefinition({
  name: 'get_entity_details',
  description:
    'Get the full details of one entity, including its schema fields and resolved incoming/outgoing relations.',
  inputSchema: {
    type: 'object',
    properties: {
      entityId: { type: 'string' },
      slug: { type: 'string' },
      includeRelated: { type: 'boolean' }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      message: { type: ['string', 'null'] },
      entity: { type: ['object', 'null'], additionalProperties: true }
    },
    required: ['found', 'message', 'entity'],
    additionalProperties: false
  }
});

const createEntityTool = toolDefinition({
  name: 'create_entity',
  description: 'Create a new entity in the workspace. Requires explicit user approval before execution.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: {
      schemaId: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      namespace: { type: 'string' },
      description: { type: 'string' },
      owner: { type: ['string', 'null'] },
      lifecycle: { type: ['string', 'null'] },
      tags: { type: 'array', items: { type: 'string' } },
      visibilityMode: { type: ['string', 'null'], enum: ['public', 'restricted', null] },
      fields: { type: 'object', additionalProperties: true }
    },
    required: ['schemaId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      entity: { type: 'object', additionalProperties: true },
      message: { type: 'string' }
    },
    required: ['entity', 'message'],
    additionalProperties: false
  }
});

const updateEntityTool = toolDefinition({
  name: 'update_entity',
  description: 'Update an existing entity in the workspace. Requires explicit user approval before execution.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: {
      entityId: { type: 'string' },
      name: { type: 'string' },
      slug: { type: 'string' },
      namespace: { type: 'string' },
      description: { type: 'string' },
      owner: { type: ['string', 'null'] },
      lifecycle: { type: ['string', 'null'] },
      tags: { type: 'array', items: { type: 'string' } },
      visibilityMode: { type: ['string', 'null'], enum: ['public', 'restricted', null] },
      fields: { type: 'object', additionalProperties: true }
    },
    required: ['entityId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      entity: { type: 'object', additionalProperties: true },
      message: { type: 'string' }
    },
    required: ['entity', 'message'],
    additionalProperties: false
  }
});

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

const getVisibleEntities = (
  entities: Entity[],
  authCtx: AuthorizationContext | null
) => {
  if (authCtx === null) return entities;
  return entities.filter(entity => checker.hasEntityPermission(authCtx, entity, 'view_entity'));
};

const getMatchedMetadata = (entity: Entity, query: string) => {
  const matches: string[] = [];
  if (includesQuery(entity.name, query)) matches.push('name');
  if (includesQuery(entity.slug, query)) matches.push('slug');
  if (includesQuery(entity.description, query)) matches.push('description');
  if (includesQuery(entity.namespace, query)) matches.push('namespace');
  if (includesQuery(entity.owner, query)) matches.push('owner');
  if (includesQuery(entity.lifecycle, query)) matches.push('lifecycle');
  if (entity.tags.some(tag => includesQuery(tag, query))) matches.push('tags');
  if (
    entity.links.some(
      link =>
        includesQuery(link.title, query) ||
        includesQuery(link.url, query) ||
        includesQuery(link.type, query)
    )
  ) {
    matches.push('links');
  }
  return matches;
};

const getMatchedFields = (data: Entity['data'], query: string) =>
  Object.entries(data)
    .filter(([, value]) => includesQuery(value, query))
    .map(([key]) => key);

const matchesEntityFilters = (
  entity: Entity,
  options: {
    schemaId?: string;
    owner?: string;
    lifecycle?: string;
  }
) => {
  if (options.schemaId && entity.schema_id !== options.schemaId) return false;
  if (options.owner && entity.owner !== options.owner) return false;
  if (options.lifecycle && entity.lifecycle !== options.lifecycle) return false;
  return true;
};

const getDataPreview = (entity: Entity, matchedFields: string[]) => {
  const fieldIds = matchedFields.length > 0 ? matchedFields : Object.keys(entity.data).slice(0, 6);
  return Object.fromEntries(fieldIds.map(fieldId => [fieldId, entity.data[fieldId] ?? null]));
};

const relationFields = (fields: SchemaField[]) =>
  fields.filter(
    (field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
      field.type === 'reference' || field.type === 'containment'
  );

const summarizeRelationTarget = (
  entity: Entity,
  schemaName: string | undefined
) => ({
  id: entity.id,
  name: entity.name,
  slug: entity.slug,
  schemaId: entity.schema_id,
  schemaName: schemaName ?? entity.schema_id
});

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const summarizeEntity = (
  entity: Entity,
  schemaName: string | undefined
) => ({
  id: entity.id,
  name: entity.name,
  slug: entity.slug,
  schemaId: entity.schema_id,
  schemaName: schemaName ?? entity.schema_id,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  description: entity.description
});

const filterStringArray = (values: unknown): string[] =>
  Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];

const normalizeVisibilityMode = (value: unknown): 'public' | 'restricted' | null =>
  value === 'public' || value === 'restricted' ? value : null;

const normalizeOwner = (value: unknown, teamIds: Set<string>, fallback: string | null) => {
  if (value === null) return null;
  if (typeof value === 'string' && teamIds.has(value)) return value;
  return fallback;
};

export const createAiChatTools = (
  db: DatabaseAdapter,
  workspaceId: string,
  authCtx: AuthorizationContext | null
) => {
  const queryEntities = queryEntitiesTool.server(async rawArgs => {
    const args = rawArgs as QueryEntitiesArgs;
    const [schemas, rawEntities] = await Promise.all([
      db.catalog.listSchemas(workspaceId),
      db.catalog.listEntities(workspaceId)
    ]);
    const entities = getVisibleEntities(rawEntities, authCtx);
    const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
    const normalizedQuery = args.query?.trim().toLowerCase() ?? '';
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 10), 1), 50);
    const offset = Math.max(Math.trunc(args.offset ?? 0), 0);

    const filtered = entities
      .filter(entity =>
        matchesEntityFilters(entity, {
          schemaId: args.schemaId,
          owner: args.owner,
          lifecycle: args.lifecycle
        })
      )
      .map(entity => {
        const matchedMetadata =
          normalizedQuery.length > 0 ? getMatchedMetadata(entity, normalizedQuery) : [];
        const matchedFields =
          normalizedQuery.length > 0 ? getMatchedFields(entity.data, normalizedQuery) : [];

        if (
          normalizedQuery.length > 0 &&
          matchedMetadata.length === 0 &&
          matchedFields.length === 0
        ) {
          return null;
        }

        return {
          id: entity.id,
          name: entity.name,
          slug: entity.slug,
          schemaId: entity.schema_id,
          schemaName: schemaMap.get(entity.schema_id)?.name ?? entity.schema_id,
          description: entity.description,
          owner: entity.owner,
          lifecycle: entity.lifecycle,
          tags: entity.tags,
          matchedMetadata,
          matchedFields,
          dataPreview: getDataPreview(entity, matchedFields)
        };
      })
      .filter(entity => entity !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      total: filtered.length,
      entities: filtered.slice(offset, offset + limit)
    };
  });

  const getEntityDetails = getEntityDetailsTool.server(async rawArgs => {
    const args = rawArgs as GetEntityDetailsArgs;
    const [schemas, rawEntities] = await Promise.all([
      db.catalog.listSchemas(workspaceId),
      db.catalog.listEntities(workspaceId)
    ]);
    const entities = getVisibleEntities(rawEntities, authCtx);
    const entity =
      (args.entityId ? entities.find(candidate => candidate.id === args.entityId) : undefined) ??
      (args.slug ? entities.find(candidate => candidate.slug === args.slug) : undefined);

    if (!entity) {
      return {
        found: false,
        message: 'Entity not found or not visible in this workspace.',
        entity: null
      };
    }

    const schemaMap = new Map(schemas.map(schema => [schema.id, schema]));
    const entityLookup = new Map(entities.map(candidate => [candidate.id, candidate]));
    const schema = schemaMap.get(entity.schema_id);
    const includeRelated = args.includeRelated ?? true;
    const outgoingRelations = includeRelated && schema
      ? relationFields(schema.fields).map(field => {
          const ids = decodeRefs(entity.data[field.id]);
          return {
            fieldId: field.id,
            fieldName: field.name,
            kind: field.type,
            targets: ids.map(id => {
              const target = entityLookup.get(id);
              if (!target) {
                return {
                  id,
                  name: null,
                  slug: null,
                  schemaId: field.schemaId,
                  schemaName: schemaMap.get(field.schemaId)?.name ?? field.schemaId
                };
              }
              return summarizeRelationTarget(target, schemaMap.get(target.schema_id)?.name);
            })
          };
        })
      : [];

    const incomingRelations = includeRelated
      ? entities.flatMap(source => {
          const sourceSchema = schemaMap.get(source.schema_id);
          if (!sourceSchema) return [];
          return relationFields(sourceSchema.fields).flatMap(field => {
            if (!decodeRefs(source.data[field.id]).includes(entity.id)) return [];
            return {
              source: summarizeRelationTarget(source, sourceSchema.name),
              fieldId: field.id,
              fieldName: field.name,
              kind: field.type
            };
          });
        })
      : [];

    return {
      found: true,
      message: null,
      entity: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        namespace: entity.namespace,
        schemaId: entity.schema_id,
        schemaName: schema?.name ?? entity.schema_id,
        description: entity.description,
        owner: entity.owner,
        lifecycle: entity.lifecycle,
        tags: entity.tags,
        links: entity.links,
        data: entity.data,
        schemaFields: schema?.fields ?? [],
        outgoingRelations,
        incomingRelations
      }
    };
  });

  const createEntity = createEntityTool.server(async rawArgs => {
    const args = rawArgs as CreateEntityArgs;
    const schema = await db.catalog.getSchema(workspaceId, args.schemaId);
    if (!schema) throw new Error(`Schema '${args.schemaId}' not found`);

    const requestedName =
      typeof args.name === 'string'
        ? args.name.trim()
        : typeof args.fields?.['name'] === 'string'
          ? String(args.fields['name']).trim()
          : '';
    if (requestedName === '') throw new Error('A name is required to create an entity');

    const teamIds = new Set((await db.workspaceAdmin.listTeams(workspaceId)).map(team => team.id));
    const owner = normalizeOwner(args.owner, teamIds, schema.default_owner);
    if (authCtx !== null) {
      requireCanCreateTopLevelEntity(
        authCtx,
        owner,
        'You do not have permission to create an entity with the resolved owner'
      );
    }

    const lifecycleValues = new Set(
      (await db.workspaceAdmin.listLifecycleStates(workspaceId)).map(state => state.id)
    );
    const lifecycle =
      typeof args.lifecycle === 'string' && lifecycleValues.has(args.lifecycle) ? args.lifecycle : null;

    const timestamp = new Date();
    const entity = await db.catalog.createEntity({
      id: newid(),
      workspace: workspaceId,
      slug:
        typeof args.slug === 'string' && args.slug.trim().length > 0
          ? args.slug.trim()
          : slugify(requestedName),
      namespace:
        typeof args.namespace === 'string' && args.namespace.trim().length > 0
          ? args.namespace.trim()
          : 'default',
      name: requestedName,
      description: typeof args.description === 'string' ? args.description : '',
      owner,
      lifecycle,
      tags: filterStringArray(args.tags),
      links: [],
      schema_id: schema.id,
      data: args.fields ?? {},
      visibility_mode: normalizeVisibilityMode(args.visibilityMode),
      created_at: timestamp,
      updated_at: timestamp
    });

    return {
      entity: summarizeEntity(entity, schema.name),
      message: `Created [${entity.name}](entity:${entity.id}).`
    };
  });

  const updateEntity = updateEntityTool.server(async rawArgs => {
    const args = rawArgs as UpdateEntityArgs;
    const current = await db.catalog.getEntity(workspaceId, args.entityId);
    if (!current) throw new Error(`Entity '${args.entityId}' not found`);

    if (authCtx !== null) {
      requireEntityAction(authCtx, current, 'edit_entity', 'You do not have permission to edit this entity');
    }

    const teamIds = new Set((await db.workspaceAdmin.listTeams(workspaceId)).map(team => team.id));
    const nextOwner = normalizeOwner(args.owner, teamIds, current.owner);
    const nextVisibilityMode =
      args.visibilityMode === undefined ? current.visibility_mode : normalizeVisibilityMode(args.visibilityMode);

    if (
      authCtx !== null &&
      (nextOwner !== current.owner || nextVisibilityMode !== current.visibility_mode)
    ) {
      requireEntityAction(
        authCtx,
        current,
        'admin_entity',
        'You do not have permission to change ownership or visibility'
      );
    }

    const lifecycleValues = new Set(
      (await db.workspaceAdmin.listLifecycleStates(workspaceId)).map(state => state.id)
    );
    const nextLifecycle =
      args.lifecycle === undefined
        ? current.lifecycle
        : typeof args.lifecycle === 'string' && lifecycleValues.has(args.lifecycle)
          ? args.lifecycle
          : null;

    const entity = await db.catalog.updateEntity(workspaceId, current.id, {
      slug:
        typeof args.slug === 'string' && args.slug.trim().length > 0
          ? args.slug.trim()
          : current.slug,
      namespace:
        typeof args.namespace === 'string' && args.namespace.trim().length > 0
          ? args.namespace.trim()
          : current.namespace,
      name:
        typeof args.name === 'string' && args.name.trim().length > 0
          ? args.name.trim()
          : current.name,
      description: typeof args.description === 'string' ? args.description : current.description,
      owner: nextOwner,
      lifecycle: nextLifecycle,
      tags: args.tags === undefined ? current.tags : filterStringArray(args.tags),
      links: current.links,
      schema_id: current.schema_id,
      data: {
        ...current.data,
        ...(args.fields ?? {})
      },
      visibility_mode: nextVisibilityMode,
      updated_at: new Date()
    });
    if (!entity) throw new Error(`Failed to update entity '${current.id}'`);

    return {
      entity: summarizeEntity(entity, undefined),
      message: `Updated [${entity.name}](entity:${entity.id}).`
    };
  });

  return [queryEntities, getEntityDetails, createEntity, updateEntity];
};
