import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import { toolDefinition } from '@tanstack/ai';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { decodeRefs } from '../../types';
import { requireCanCreateTopLevelEntity, requireEntityAction } from '../auth/authorization';
import {
  createEntityWithAudit,
  type EntityMutationActor,
  updateEntityWithAudit
} from '../catalog/entityMutations';
import { Entity } from '../catalog/db/catalogDatabase';
import { SchemaField } from '@arch-register/api-types/schemaContract';
import { formatPublicId } from '../../utils/publicIds';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import { computeEntityCompleteness } from '../../utils/completeness';
import type { DocumentAiToolId } from '@arch-register/api-types/documentContract';

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
  fields?: Record<string, unknown>;
};

type TraverseRelationsArgs = {
  entityId: string;
  depth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';
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
  description:
    'Create a new entity in the workspace. Requires explicit user approval before execution.',
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
  description:
    'Update an existing entity in the workspace. Requires explicit user approval before execution.',
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

const traverseRelationsTool = toolDefinition({
  name: 'traverse_relations',
  description:
    'Walk the relation graph from a starting entity up to a given depth. Returns a subgraph of nodes (entities) and edges (relations). Useful for impact analysis, dependency discovery, and finding orphaned entities.',
  inputSchema: {
    type: 'object',
    properties: {
      entityId: { type: 'string' },
      depth: { type: 'number', minimum: 1, maximum: 5 },
      direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'] }
    },
    required: ['entityId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      entityId: { type: 'string' },
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            schemaId: { type: 'string' },
            schemaName: { type: 'string' }
          },
          required: ['id', 'name', 'slug', 'schemaId', 'schemaName'],
          additionalProperties: false
        }
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            targetId: { type: 'string' },
            fieldId: { type: 'string' },
            fieldName: { type: 'string' },
            kind: { type: 'string', enum: ['reference', 'containment'] }
          },
          required: ['sourceId', 'targetId', 'fieldId', 'fieldName', 'kind'],
          additionalProperties: false
        }
      },
      truncated: { type: 'boolean' }
    },
    required: ['entityId', 'nodes', 'edges', 'truncated'],
    additionalProperties: false
  }
});

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

const getVisibleEntities = (entities: Entity[], authCtx: AuthorizationContext | null) => {
  if (authCtx === null || checker.hasWorkspaceWideEntityView(authCtx)) return entities;
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

const summarizeRelationTarget = (entity: Entity, schemaName: string | undefined) => ({
  id: entity.id,
  name: entity.name,
  slug: entity.slug,
  schemaId: entity.schema_id,
  schemaName: schemaName ?? entity.schema_id
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const summarizeEntity = (entity: Entity, schemaName: string | undefined) => ({
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

const normalizeOwner = (value: unknown, teamIds: Set<string>, fallback: string | null) => {
  if (value === null) return null;
  if (typeof value === 'string' && teamIds.has(value)) return value;
  return fallback;
};

export const createAiChatTools = (
  db: DatabaseAdapter,
  workspaceId: string,
  authCtx: AuthorizationContext | null,
  actor: EntityMutationActor,
  options: { readOnly?: boolean; toolIds?: readonly DocumentAiToolId[] } = {}
) => {
  const queryEntities = queryEntitiesTool.server(async rawArgs => {
    const args = rawArgs as QueryEntitiesArgs;
    const [schemas, rawEntities] = await Promise.all([
      db.catalog.listSchemas(workspaceId),
      listAllCatalogEntities(db, workspaceId)
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
      listAllCatalogEntities(db, workspaceId)
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
    const outgoingRelations =
      includeRelated && schema
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

    const teamIds = new Set((await db.workspace.listTeams(workspaceId)).map(team => team.id));
    const owner = normalizeOwner(args.owner, teamIds, schema.default_owner);
    if (authCtx !== null) {
      requireCanCreateTopLevelEntity(
        authCtx,
        owner,
        'You do not have permission to create an entity with the resolved owner'
      );
    }

    const lifecycleValues = new Set(
      (await db.workspace.listLifecycleStates(workspaceId)).map(state => state.id)
    );
    const lifecycle =
      typeof args.lifecycle === 'string' && lifecycleValues.has(args.lifecycle)
        ? args.lifecycle
        : null;

    const timestamp = new Date();
    if (!schema.key_prefix) throw new Error(`Schema '${args.schemaId}' is missing a key prefix`);
    const publicId = formatPublicId(
      schema.key_prefix,
      await db.workspace.allocatePublicId(schema.key_prefix, timestamp)
    );
    const entity = await createEntityWithAudit(db, {
      workspace: workspaceId,
      actor,
      entity: {
        id: randomUUID(),
        workspace: workspaceId,
        public_id: publicId,
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
        target_lifecycle: null,
        target_lifecycle_date: null,
        tags: filterStringArray(args.tags),
        links: [],
        schema_id: schema.id,
        data: args.fields ?? {},
        project_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        completeness: computeEntityCompleteness(
          {
            description: typeof args.description === 'string' ? args.description : '',
            owner,
            lifecycle,
            data: args.fields ?? {}
          },
          schema
        )
      }
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
    const schema = await db.catalog.getSchema(workspaceId, current.schema_id);
    if (schema && entityRequiresApproval(schema, current)) {
      throw new Error('This entity requires an approved change proposal before it can be edited');
    }

    if (authCtx !== null) {
      requireEntityAction(
        authCtx,
        current,
        'edit_entity',
        'You do not have permission to edit this entity'
      );
    }

    const teamIds = new Set((await db.workspace.listTeams(workspaceId)).map(team => team.id));
    const nextOwner = normalizeOwner(args.owner, teamIds, current.owner);

    if (authCtx !== null && nextOwner !== current.owner) {
      requireEntityAction(
        authCtx,
        current,
        'admin_entity',
        'You do not have permission to change ownership'
      );
    }

    const lifecycleValues = new Set(
      (await db.workspace.listLifecycleStates(workspaceId)).map(state => state.id)
    );
    const nextLifecycle =
      args.lifecycle === undefined
        ? current.lifecycle
        : typeof args.lifecycle === 'string' && lifecycleValues.has(args.lifecycle)
          ? args.lifecycle
          : null;

    const nextDescription =
      typeof args.description === 'string' ? args.description : current.description;
    const nextData = {
      ...current.data,
      ...(args.fields ?? {})
    };

    const entity = await updateEntityWithAudit(db, {
      workspace: workspaceId,
      entityId: current.id,
      previous: current,
      actor,
      next: {
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
        description: nextDescription,
        owner: nextOwner,
        lifecycle: nextLifecycle,
        target_lifecycle: current.target_lifecycle,
        target_lifecycle_date: current.target_lifecycle_date,
        tags: args.tags === undefined ? current.tags : filterStringArray(args.tags),
        links: current.links,
        schema_id: current.schema_id,
        data: nextData,
        project_id: current.project_id,
        updated_at: new Date(),
        completeness: schema
          ? computeEntityCompleteness(
              {
                description: nextDescription,
                owner: nextOwner,
                lifecycle: nextLifecycle,
                data: nextData
              },
              schema
            )
          : current.completeness
      }
    });
    if (!entity) throw new Error(`Failed to update entity '${current.id}'`);

    return {
      entity: summarizeEntity(entity, undefined),
      message: `Updated [${entity.name}](entity:${entity.id}).`
    };
  });

  const traverseRelations = traverseRelationsTool.server(async rawArgs => {
    const args = rawArgs as TraverseRelationsArgs;
    const direction = args.direction ?? 'both';
    const maxDepth = Math.min(Math.max(Math.trunc(args.depth ?? 2), 1), 5);

    const [schemas, rawEntities] = await Promise.all([
      db.catalog.listSchemas(workspaceId),
      listAllCatalogEntities(db, workspaceId)
    ]);
    const entities = getVisibleEntities(rawEntities, authCtx);
    const schemaMap = new Map(schemas.map(s => [s.id, s]));
    const entityMap = new Map(entities.map(e => [e.id, e]));

    const visited = new Set<string>([args.entityId]);
    const nodes = new Map<string, ReturnType<typeof summarizeRelationTarget>>();
    const edgeKeys = new Set<string>();
    const edges: Array<{
      sourceId: string;
      targetId: string;
      fieldId: string;
      fieldName: string;
      kind: string;
    }> = [];

    const queue: Array<{ id: string; depth: number }> = [{ id: args.entityId, depth: 0 }];

    const MAX_NODES = 100;
    let truncated = false;

    const addEdge = (
      sourceId: string,
      targetId: string,
      fieldId: string,
      fieldName: string,
      kind: string
    ) => {
      const key = `${sourceId}:${targetId}:${fieldId}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push({ sourceId, targetId, fieldId, fieldName, kind });
    };

    while (queue.length > 0) {
      const { id: currentId, depth } = queue.shift()!;
      const current = entityMap.get(currentId);
      if (!current) continue;

      const schema = schemaMap.get(current.schema_id);
      nodes.set(currentId, summarizeRelationTarget(current, schema?.name));

      if (depth >= maxDepth) continue;

      if (direction === 'outgoing' || direction === 'both') {
        for (const field of relationFields(schema?.fields ?? [])) {
          for (const refId of decodeRefs(current.data[field.id])) {
            addEdge(currentId, refId, field.id, field.name, field.type);
            if (!visited.has(refId)) {
              visited.add(refId);
              if (nodes.size < MAX_NODES) queue.push({ id: refId, depth: depth + 1 });
              else truncated = true;
            }
          }
        }
      }

      if (direction === 'incoming' || direction === 'both') {
        for (const source of entities) {
          if (source.id === currentId) continue;
          const sourceSchema = schemaMap.get(source.schema_id);
          for (const field of relationFields(sourceSchema?.fields ?? [])) {
            if (!decodeRefs(source.data[field.id]).includes(currentId)) continue;
            addEdge(source.id, currentId, field.id, field.name, field.type);
            if (!visited.has(source.id)) {
              visited.add(source.id);
              if (nodes.size < MAX_NODES) queue.push({ id: source.id, depth: depth + 1 });
              else truncated = true;
            }
          }
        }
      }
    }

    return {
      entityId: args.entityId,
      nodes: Array.from(nodes.values()),
      edges,
      truncated
    };
  });

  if (options.readOnly) {
    const readOnlyTools = [queryEntities, getEntityDetails, traverseRelations];
    if (options.toolIds === undefined) return readOnlyTools;
    const allowedToolIds = new Set(options.toolIds);
    return readOnlyTools.filter(tool => allowedToolIds.has(tool.name as DocumentAiToolId));
  }
  return [queryEntities, getEntityDetails, createEntity, updateEntity, traverseRelations];
};
