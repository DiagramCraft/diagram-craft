import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import { toolDefinition } from '@tanstack/ai';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { decodeRefs } from '../../types';
import { requireCanCreateTopLevelEntity, requireEntityAction } from '../auth/authorization';
import {
  filterLiveFieldGroups,
  isFieldViewRestricted,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import {
  createEntityWithAudit,
  type EntityMutationActor,
  updateEntityWithAudit
} from '../catalog/entityMutations';
import { Entity, type SchemaDbResult } from '../catalog/db/catalogDatabase';
import { equalEntityValue } from '../catalog/entityDiff';
import {
  SchemaField,
  isReferenceOrContainmentField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
import { formatPublicId } from '../../utils/publicIds';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import { computeEntityCompleteness } from '../../utils/completeness';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import type { DocumentAiToolId } from '@arch-register/api-types/documentContract';
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import {
  filterRelationFieldData,
  assertRelationMutationsSupported,
  flattenRelationAuditFields,
  validateRelationEndpoints
} from '../catalog/relationHelpers';
import {
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint,
  requireTypedRelationEdit
} from '../catalog/relationAccessControl';
import { requireWorkspaceCapability } from '../auth/authorization';
import { withCatalogMutationTransaction } from '../catalog/mutationTransaction';

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

type ListRelationsArgs = {
  schemaId?: string;
  inEntityId?: string;
  outEntityId?: string;
  limit?: number;
  offset?: number;
};

type GetRelationArgs = { relationId: string };
type CreateRelationArgs = {
  schemaId: string;
  inEntityId: string;
  outEntityId: string;
  fields?: Record<string, unknown>;
};
type UpdateRelationArgs = { relationId: string; fields: Record<string, unknown> };
type DeleteRelationArgs = { relationId: string };

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
            kind: { type: 'string', enum: ['reference', 'containment', 'typed'] },
            relationId: { type: 'string' },
            relationSchemaId: { type: 'string' },
            relationFields: { type: 'object', additionalProperties: true }
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

const relationOutputSchema = {
  type: 'object',
  additionalProperties: true
};

const listRelationSchemasTool = toolDefinition({
  name: 'list_relation_schemas',
  description: 'List typed relation schemas, endpoint constraints, fields, groups, and metadata.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  outputSchema: { type: 'array', items: relationOutputSchema }
});

const listRelationsTool = toolDefinition({
  name: 'list_relations',
  description:
    'List visible typed relation instances with optional endpoint filters and pagination.',
  inputSchema: {
    type: 'object',
    properties: {
      schemaId: { type: 'string' },
      inEntityId: { type: 'string' },
      outEntityId: { type: 'string' },
      limit: { type: 'number', minimum: 1, maximum: 100 },
      offset: { type: 'number', minimum: 0 }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      items: { type: 'array', items: relationOutputSchema },
      total: { type: 'number' }
    },
    required: ['items', 'total'],
    additionalProperties: false
  }
});

const getRelationTool = toolDefinition({
  name: 'get_relation',
  description: 'Get one visible typed relation instance by ID.',
  inputSchema: {
    type: 'object',
    properties: { relationId: { type: 'string' } },
    required: ['relationId'],
    additionalProperties: false
  },
  outputSchema: relationOutputSchema
});

const createRelationTool = toolDefinition({
  name: 'create_relation',
  description: 'Create a typed relation instance between two entities; requires explicit approval.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: {
      schemaId: { type: 'string' },
      inEntityId: { type: 'string' },
      outEntityId: { type: 'string' },
      fields: { type: 'object', additionalProperties: true }
    },
    required: ['schemaId', 'inEntityId', 'outEntityId'],
    additionalProperties: false
  },
  outputSchema: relationOutputSchema
});

const updateRelationTool = toolDefinition({
  name: 'update_relation',
  description: 'Update typed relation fields; requires explicit approval.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: {
      relationId: { type: 'string' },
      fields: { type: 'object', additionalProperties: true }
    },
    required: ['relationId', 'fields'],
    additionalProperties: false
  },
  outputSchema: relationOutputSchema
});

const deleteRelationTool = toolDefinition({
  name: 'delete_relation',
  description: 'Delete a typed relation instance; requires explicit approval.',
  needsApproval: true,
  inputSchema: {
    type: 'object',
    properties: { relationId: { type: 'string' } },
    required: ['relationId'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: { success: { type: 'boolean' } },
    required: ['success']
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

const getDataPreview = (data: Entity['data'], matchedFields: string[]) => {
  const fieldIds = matchedFields.length > 0 ? matchedFields : Object.keys(data).slice(0, 6);
  return Object.fromEntries(fieldIds.map(fieldId => [fieldId, data[fieldId] ?? null]));
};

const relationFields = (fields: SchemaField[]) => fields.filter(isReferenceOrContainmentField);

// Typed relations aren't part of the entity's data blob and have no dedicated AI tool yet — reject
// rather than silently writing raw values into a field that expects none.
const assertNoTypedRelationFieldWrites = (
  schema: { fields: SchemaField[] },
  fields: Record<string, unknown> | undefined
) => {
  const typedRelationFieldIds = new Set(schema.fields.filter(isTypedRelationField).map(f => f.id));
  const offending = Object.keys(fields ?? {}).filter(id => typedRelationFieldIds.has(id));
  if (offending.length > 0) {
    throw new Error(
      `Cannot set typed-relation field(s) via this tool: ${offending.join(', ')}. Typed relations are not yet supported through AI tools.`
    );
  }
};

const summarizeRelationTarget = (
  entity: Pick<Entity, 'id' | 'name' | 'slug' | 'schema_id'>,
  schemaName: string | undefined
) => ({
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
  const relationDb = (db as unknown as { relation?: DatabaseAdapter['relation'] }).relation;
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
        const visibleData = filterLiveFieldGroups(
          authCtx,
          schemaMap.get(entity.schema_id),
          entity.data
        );
        const matchedMetadata =
          normalizedQuery.length > 0 ? getMatchedMetadata(entity, normalizedQuery) : [];
        const matchedFields =
          normalizedQuery.length > 0 ? getMatchedFields(visibleData, normalizedQuery) : [];

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
          dataPreview: getDataPreview(visibleData, matchedFields)
        };
      })
      .filter(entity => entity !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      total: filtered.length,
      entities: filtered.slice(offset, offset + limit)
    };
  });

  const relationSchemaMap = async () => {
    const schemas = await db.relation.listRelationSchemas(workspaceId);
    return new Map(schemas.map(schema => [schema.id, schema]));
  };

  type RelationEndpointAccess = {
    inEntity: Entity | null;
    outEntity: Entity | null;
    endpoints: Array<{
      schema: SchemaDbResult | undefined;
      direction: 'in' | 'out';
    }>;
  };

  const getRelationEndpointAccess = (
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

  const loadRelationEndpointAccess = async (
    inEntityId: string,
    outEntityId: string
  ): Promise<RelationEndpointAccess> => {
    const [inEntity, outEntity, schemas] = await Promise.all([
      db.catalog.getEntity(workspaceId, inEntityId),
      db.catalog.getEntity(workspaceId, outEntityId),
      db.catalog.listSchemas(workspaceId)
    ]);
    return getRelationEndpointAccess(
      inEntity,
      outEntity,
      new Map(schemas.map(schema => [schema.id, schema]))
    );
  };

  const loadVisibleRelationEndpoints = async () => {
    const [schemas, rawEntities] = await Promise.all([
      db.catalog.listSchemas(workspaceId),
      listAllCatalogEntities(db, workspaceId)
    ]);
    const visibleEntities = getVisibleEntities(rawEntities, authCtx);
    return {
      entityMap: new Map(visibleEntities.map(entity => [entity.id, entity])),
      schemaMap: new Map(schemas.map(schema => [schema.id, schema]))
    };
  };

  const listAllRelationRows = async (
    filters: Parameters<DatabaseAdapter['relation']['listRelations']>[1]
  ) => {
    const rows: Awaited<ReturnType<DatabaseAdapter['relation']['listRelations']>>['items'] = [];
    const pageSize = 100;
    let offset = 0;

    while (true) {
      const page = await db.relation.listRelations(workspaceId, filters, {
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

  const toAiRelation = (
    row: Awaited<ReturnType<DatabaseAdapter['relation']['getRelation']>>,
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

  const listRelationSchemas = listRelationSchemasTool.server(async () => {
    const schemas = await db.relation.listRelationSchemas(workspaceId);
    return schemas;
  });

  const listRelations = listRelationsTool.server(async rawArgs => {
    const args = rawArgs as ListRelationsArgs;
    const schemaMap = await relationSchemaMap();
    const { entityMap, schemaMap: entitySchemaMap } = await loadVisibleRelationEndpoints();
    const rows = await listAllRelationRows({
      schemaId: args.schemaId ?? null,
      inEntityId: args.inEntityId ?? null,
      outEntityId: args.outEntityId ?? null
    });
    const visibleRows = rows.filter(row => {
      const access = getRelationEndpointAccess(
        entityMap.get(row.in_entity_id) ?? null,
        entityMap.get(row.out_entity_id) ?? null,
        entitySchemaMap
      );
      return (
        access.inEntity !== null &&
        access.outEntity !== null &&
        canViewTypedRelation(authCtx, access.endpoints, row.schema_id)
      );
    });
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 20), 1), 100);
    const offset = Math.max(Math.trunc(args.offset ?? 0), 0);
    return {
      total: visibleRows.length,
      items: visibleRows
        .slice(offset, offset + limit)
        .map(row => toAiRelation(row, schemaMap))
        .filter(Boolean)
    };
  });

  const getRelation = getRelationTool.server(async rawArgs => {
    const args = rawArgs as GetRelationArgs;
    const row = await db.relation.getRelation(workspaceId, args.relationId);
    if (!row) throw new Error(`Relation '${args.relationId}' not found`);
    const { entityMap, schemaMap: entitySchemaMap } = await loadVisibleRelationEndpoints();
    const access = getRelationEndpointAccess(
      entityMap.get(row.in_entity_id) ?? null,
      entityMap.get(row.out_entity_id) ?? null,
      entitySchemaMap
    );
    if (
      access.inEntity === null ||
      access.outEntity === null ||
      !canViewTypedRelation(authCtx, access.endpoints, row.schema_id)
    ) {
      throw new Error(`Relation '${args.relationId}' not found`);
    }
    const schemaMap = await relationSchemaMap();
    const result = toAiRelation(row, schemaMap);
    if (!result) throw new Error(`Relation '${args.relationId}' not found`);
    return result;
  });

  const createRelation = createRelationTool.server(async rawArgs => {
    const args = rawArgs as CreateRelationArgs;
    if (authCtx) requireWorkspaceCapability(authCtx, 'ent.edit');
    const schema = await db.relation.getRelationSchema(workspaceId, args.schemaId);
    if (!schema) throw new Error(`Relation schema '${args.schemaId}' not found`);
    // Creating a relation instance is never gated on approval policy, mirroring entity create.
    const endpointAccess = await loadRelationEndpointAccess(args.inEntityId, args.outEntityId);
    validateRelationEndpoints(schema, endpointAccess.inEntity, endpointAccess.outEntity);
    if (authCtx) requireTypedRelationEdit(authCtx, endpointAccess.endpoints, schema.id);
    const fields = args.fields ?? {};
    if (authCtx) requireNoRestrictedFieldWrites(authCtx, schema, Object.keys(fields));
    const now = new Date();
    const row = await db.relation.createRelation({
      id: randomUUID(),
      workspace: workspaceId,
      schema_id: schema.id,
      in_entity_id: endpointAccess.inEntity!.id,
      out_entity_id: endpointAccess.outEntity!.id,
      data: fields,
      created_at: now,
      updated_at: now
    });
    await logAudit(db, {
      userId: actor.id,
      userDisplayName: actor.displayName,
      workspace: workspaceId,
      operation: 'create',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: { new: flattenRelationAuditFields(row) }
    });
    return toAiRelation(row, new Map([[schema.id, schema]]));
  });

  const updateRelation = updateRelationTool.server(async rawArgs => {
    const args = rawArgs as UpdateRelationArgs;
    if (authCtx) requireWorkspaceCapability(authCtx, 'ent.edit');
    const oldRow = await db.relation.getRelation(workspaceId, args.relationId);
    if (!oldRow) throw new Error(`Relation '${args.relationId}' not found`);
    const schema = await db.relation.getRelationSchema(workspaceId, oldRow.schema_id);
    if (!schema) throw new Error(`Relation schema '${oldRow.schema_id}' not found`);
    assertRelationMutationsSupported(schema, oldRow);
    const endpointAccess = await loadRelationEndpointAccess(
      oldRow.in_entity_id,
      oldRow.out_entity_id
    );
    if (authCtx) requireTypedRelationEdit(authCtx, endpointAccess.endpoints, oldRow.schema_id);
    const changed = Object.keys(args.fields).filter(
      key => JSON.stringify(oldRow.data[key] ?? null) !== JSON.stringify(args.fields[key] ?? null)
    );
    if (authCtx) requireNoRestrictedFieldWrites(authCtx, schema, changed);
    const row = await db.relation.updateRelation(workspaceId, oldRow.id, {
      data: { ...oldRow.data, ...args.fields },
      version: oldRow.version + 1,
      updated_at: new Date()
    });
    if (!row) throw new Error(`Relation '${args.relationId}' not found`);
    await logAudit(db, {
      userId: actor.id,
      userDisplayName: actor.displayName,
      workspace: workspaceId,
      operation: 'update',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: computeChanges(flattenRelationAuditFields(oldRow), flattenRelationAuditFields(row), {
        alwaysInclude: ['_inEntityId', '_outEntityId']
      })
    });
    return toAiRelation(row, new Map([[schema.id, schema]]));
  });

  const deleteRelation = deleteRelationTool.server(async rawArgs => {
    const args = rawArgs as DeleteRelationArgs;
    if (authCtx) requireWorkspaceCapability(authCtx, 'ent.edit');
    const row = await db.relation.getRelation(workspaceId, args.relationId);
    if (!row) throw new Error(`Relation '${args.relationId}' not found`);
    const schema = await db.relation.getRelationSchema(workspaceId, row.schema_id);
    if (!schema) throw new Error(`Relation schema '${row.schema_id}' not found`);
    // Deleting a relation instance is never gated on approval policy, mirroring entity delete.
    const endpointAccess = await loadRelationEndpointAccess(row.in_entity_id, row.out_entity_id);
    if (authCtx) requireTypedRelationEdit(authCtx, endpointAccess.endpoints, row.schema_id);
    await db.relation.deleteRelation(workspaceId, row.id);
    await logAudit(db, {
      userId: actor.id,
      userDisplayName: actor.displayName,
      workspace: workspaceId,
      operation: 'delete',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: { old: flattenRelationAuditFields(row) }
    });
    return { success: true };
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
    const typedRelations =
      includeRelated && relationDb?.listRelationsForEntity
        ? await relationDb.listRelationsForEntity(workspaceId, entity.id)
        : { outgoing: [], incoming: [] };
    const typedSchemaMap = relationDb?.listRelationSchemas ? await relationSchemaMap() : new Map();
    const canViewTypedRelationInDetails = (
      ownerSchema: SchemaDbResult | undefined,
      otherEndpointSchema: SchemaDbResult | undefined,
      relationSchemaId: string,
      direction: 'in' | 'out'
    ) => {
      if (authCtx !== null && (!ownerSchema || !otherEndpointSchema)) return false;
      return canViewTypedRelationFromEndpoint(authCtx, ownerSchema, relationSchemaId, direction);
    };
    const outgoingRelations =
      includeRelated && schema
        ? relationFields(schema.fields)
            .filter(field => !isFieldViewRestricted(authCtx, schema, field.id))
            .map(field => {
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
          return relationFields(sourceSchema.fields)
            .filter(field => !isFieldViewRestricted(authCtx, sourceSchema, field.id))
            .flatMap(field => {
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

    const outgoingTypedRelations = typedRelations.outgoing.flatMap(row => {
      const target = entityLookup.get(row.out_entity_id);
      const targetSchema = target ? schemaMap.get(target.schema_id) : undefined;
      if (!target || !canViewTypedRelationInDetails(schema, targetSchema, row.schema_id, 'in')) {
        return [];
      }
      return [
        {
          relationId: row.id,
          relationSchemaId: row.schema_id,
          relationSchemaName: row.schema_name,
          target: summarizeRelationTarget(target, schemaMap.get(target.schema_id)?.name),
          fields: filterRelationFieldData(authCtx, typedSchemaMap.get(row.schema_id), row.data)
        }
      ];
    });
    const incomingTypedRelations = typedRelations.incoming.flatMap(row => {
      const source = entityLookup.get(row.in_entity_id);
      const sourceSchema = source ? schemaMap.get(source.schema_id) : undefined;
      if (!source || !canViewTypedRelationInDetails(schema, sourceSchema, row.schema_id, 'out')) {
        return [];
      }
      return [
        {
          relationId: row.id,
          relationSchemaId: row.schema_id,
          relationSchemaName: row.schema_name,
          source: summarizeRelationTarget(source, schemaMap.get(source.schema_id)?.name),
          fields: filterRelationFieldData(authCtx, typedSchemaMap.get(row.schema_id), row.data)
        }
      ];
    });

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
        data: filterLiveFieldGroups(authCtx, schema, entity.data),
        schemaFields: schema?.fields ?? [],
        outgoingRelations,
        incomingRelations,
        outgoingTypedRelations,
        incomingTypedRelations
      }
    };
  });

  const createEntity = createEntityTool.server(async rawArgs => {
    const args = rawArgs as CreateEntityArgs;
    const schema = await db.catalog.getSchema(workspaceId, args.schemaId);
    if (!schema) throw new Error(`Schema '${args.schemaId}' not found`);
    assertNoTypedRelationFieldWrites(schema, args.fields);

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

    if (authCtx !== null) {
      requireNoRestrictedFieldWrites(
        authCtx,
        schema,
        Object.keys(args.fields ?? {}),
        'You do not have permission to set one or more restricted fields on this entity'
      );
    }

    if (!schema.key_prefix) throw new Error(`Schema '${args.schemaId}' is missing a key prefix`);
    const entity = await withCatalogMutationTransaction(db, async tx => {
      const timestamp = new Date();
      const publicId = formatPublicId(
        schema.key_prefix,
        await tx.workspace.allocatePublicId(schema.key_prefix, timestamp)
      );
      return createEntityWithAudit(tx, {
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
    if (schema && (await entityRequiresApproval(db, workspaceId, schema, current))) {
      throw new Error('This entity requires an approved change proposal before it can be edited');
    }
    if (schema) assertNoTypedRelationFieldWrites(schema, args.fields);

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

    if (authCtx !== null && schema) {
      const changedFieldIds = Object.keys(args.fields ?? {}).filter(
        fieldId => !equalEntityValue(current.data[fieldId], nextData[fieldId])
      );
      requireNoRestrictedFieldWrites(
        authCtx,
        schema,
        changedFieldIds,
        'You do not have permission to edit one or more restricted fields on this entity'
      );
    }

    const entity = await withCatalogMutationTransaction(db, tx =>
      updateEntityWithAudit(tx, {
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
      })
    );
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

    const canViewTypedRelationAtBothEndpoints = (
      firstEndpointSchema: SchemaDbResult | undefined,
      firstDirection: 'in' | 'out',
      secondEndpointSchema: SchemaDbResult | undefined,
      secondDirection: 'in' | 'out',
      relationSchemaId: string
    ) => {
      if (authCtx !== null && (!firstEndpointSchema || !secondEndpointSchema)) return false;
      return (
        canViewTypedRelationFromEndpoint(
          authCtx,
          firstEndpointSchema,
          relationSchemaId,
          firstDirection
        ) &&
        canViewTypedRelationFromEndpoint(
          authCtx,
          secondEndpointSchema,
          relationSchemaId,
          secondDirection
        )
      );
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
          if (isFieldViewRestricted(authCtx, schema, field.id)) continue;
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
            if (isFieldViewRestricted(authCtx, sourceSchema, field.id)) continue;
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

      if (
        relationDb?.listRelationsForEntity &&
        (direction === 'outgoing' || direction === 'both')
      ) {
        const typed = await relationDb.listRelationsForEntity(workspaceId, currentId);
        for (const relation of typed.outgoing) {
          const targetEntity = entityMap.get(relation.out_entity_id);
          if (!targetEntity) continue;
          const targetSchema = schemaMap.get(targetEntity.schema_id);
          if (
            !canViewTypedRelationAtBothEndpoints(
              schema,
              'in',
              targetSchema,
              'out',
              relation.schema_id
            )
          ) {
            continue;
          }
          const target = targetEntity.id;
          const relationSchema = await relationDb.getRelationSchema(
            workspaceId,
            relation.schema_id
          );
          addEdge(
            currentId,
            target,
            relation.id,
            relationSchema?.name ?? relation.schema_name,
            'typed'
          );
          if (!visited.has(target)) {
            visited.add(target);
            if (nodes.size < MAX_NODES) queue.push({ id: target, depth: depth + 1 });
            else truncated = true;
          }
        }
      }

      if (
        relationDb?.listRelationsForEntity &&
        (direction === 'incoming' || direction === 'both')
      ) {
        const typed = await relationDb.listRelationsForEntity(workspaceId, currentId);
        for (const relation of typed.incoming) {
          const sourceEntity = entityMap.get(relation.in_entity_id);
          if (!sourceEntity) continue;
          const sourceSchema = schemaMap.get(sourceEntity.schema_id);
          if (
            !canViewTypedRelationAtBothEndpoints(
              schema,
              'out',
              sourceSchema,
              'in',
              relation.schema_id
            )
          ) {
            continue;
          }
          const source = sourceEntity.id;
          const relationSchema = await relationDb.getRelationSchema(
            workspaceId,
            relation.schema_id
          );
          addEdge(
            source,
            currentId,
            relation.id,
            relationSchema?.name ?? relation.schema_name,
            'typed'
          );
          if (!visited.has(source)) {
            visited.add(source);
            if (nodes.size < MAX_NODES) queue.push({ id: source, depth: depth + 1 });
            else truncated = true;
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
    const readOnlyTools = [
      queryEntities,
      getEntityDetails,
      traverseRelations,
      listRelationSchemas,
      listRelations,
      getRelation
    ];
    if (options.toolIds === undefined) return readOnlyTools;
    const allowedToolIds = new Set(options.toolIds);
    return readOnlyTools.filter(tool => allowedToolIds.has(tool.name as DocumentAiToolId));
  }
  return [
    queryEntities,
    getEntityDetails,
    createEntity,
    updateEntity,
    traverseRelations,
    listRelationSchemas,
    listRelations,
    getRelation,
    createRelation,
    updateRelation,
    deleteRelation
  ];
};
