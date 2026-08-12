import { toolDefinition } from '@tanstack/ai';
import { randomUUID } from 'node:crypto';
import { decodeRefs } from '../../types';
import {
  filterLiveFieldGroups,
  isFieldViewRestricted,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import { requireCanCreateTopLevelEntity, requireEntityAction } from '../auth/authorization';
import { createEntityWithAudit, updateEntityWithAudit } from '../catalog/entityMutations';
import type { Entity, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { equalEntityValue } from '../catalog/entityDiff';
import { listAllCatalogEntities } from '../catalog/entityLoader';
import { entityRequiresApproval } from '../catalog/entityChangeOperations';
import { normalizeEntityScalarFields } from '../catalog/entityScalarValues';
import { computeEntityCompleteness } from '../../utils/completeness';
import { formatPublicId } from '../../utils/publicIds';
import { filterRelationFieldData } from '../catalog/relationHelpers';
import { canViewTypedRelationFromEndpoint } from '../catalog/relationAccessControl';
import { withCatalogMutationTransaction } from '../catalog/mutationTransaction';
import type { RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import {
  assertNoTypedRelationFieldWrites,
  filterStringArray,
  getVisibleEntities,
  normalizeOwner,
  relationFields,
  relationSchemaMap,
  slugify,
  summarizeEntity,
  summarizeRelationTarget
} from './chatToolHelpers';
import type { AiChatToolContext } from './chatToolContext';

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

const includesQuery = (value: unknown, query: string) =>
  String(value ?? '')
    .toLowerCase()
    .includes(query);

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

const createQueryEntitiesTool = (context: AiChatToolContext) =>
  queryEntitiesTool.server(async rawArgs => {
    const args = rawArgs as QueryEntitiesArgs;
    const [schemas, rawEntities] = await Promise.all([
      context.db.catalog.listSchemas(context.workspaceId),
      listAllCatalogEntities(context.db, context.workspaceId)
    ]);
    const entities = getVisibleEntities(rawEntities, context.authCtx);
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
          context.authCtx,
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

const createGetEntityDetailsTool = (context: AiChatToolContext) =>
  getEntityDetailsTool.server(async rawArgs => {
    const args = rawArgs as GetEntityDetailsArgs;
    const [schemas, rawEntities] = await Promise.all([
      context.db.catalog.listSchemas(context.workspaceId),
      listAllCatalogEntities(context.db, context.workspaceId)
    ]);
    const entities = getVisibleEntities(rawEntities, context.authCtx);
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
    const typedRelations = includeRelated
      ? await context.db.relation.listRelationsForEntity(context.workspaceId, entity.id)
      : { outgoing: [], incoming: [] };
    const typedSchemaMap = includeRelated
      ? await relationSchemaMap(context)
      : new Map<string, RelationSchemaDbResult>();
    const canViewTypedRelationInDetails = (
      ownerSchema: SchemaDbResult | undefined,
      otherEndpointSchema: SchemaDbResult | undefined,
      relationSchemaId: string,
      direction: 'in' | 'out'
    ) => {
      if (context.authCtx !== null && (!ownerSchema || !otherEndpointSchema)) return false;
      return canViewTypedRelationFromEndpoint(
        context.authCtx,
        ownerSchema,
        relationSchemaId,
        direction
      );
    };
    const outgoingRelations =
      includeRelated && schema
        ? relationFields(schema.fields)
            .filter(field => !isFieldViewRestricted(context.authCtx, schema, field.id))
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
            .filter(field => !isFieldViewRestricted(context.authCtx, sourceSchema, field.id))
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
          fields: filterRelationFieldData(
            context.authCtx,
            typedSchemaMap.get(row.schema_id),
            row.data
          )
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
          fields: filterRelationFieldData(
            context.authCtx,
            typedSchemaMap.get(row.schema_id),
            row.data
          )
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
        data: filterLiveFieldGroups(context.authCtx, schema, entity.data),
        schemaFields: schema?.fields ?? [],
        outgoingRelations,
        incomingRelations,
        outgoingTypedRelations,
        incomingTypedRelations
      }
    };
  });

const createCreateEntityTool = (context: AiChatToolContext) =>
  createEntityTool.server(async rawArgs => {
    const args = rawArgs as CreateEntityArgs;
    const schema = await context.db.catalog.getSchema(context.workspaceId, args.schemaId);
    if (!schema) throw new Error(`Schema '${args.schemaId}' not found`);
    assertNoTypedRelationFieldWrites(schema, args.fields);

    const requestedName =
      typeof args.name === 'string'
        ? args.name.trim()
        : typeof args.fields?.['name'] === 'string'
          ? String(args.fields['name']).trim()
          : '';
    if (requestedName === '') throw new Error('A name is required to create an entity');

    const teamIds = new Set(
      (await context.db.workspace.listTeams(context.workspaceId)).map(team => team.id)
    );
    const owner = normalizeOwner(args.owner, teamIds, schema.default_owner);
    if (context.authCtx !== null) {
      requireCanCreateTopLevelEntity(
        context.authCtx,
        owner,
        'You do not have permission to create an entity with the resolved owner'
      );
    }

    const lifecycleValues = new Set(
      (await context.db.workspace.listLifecycleStates(context.workspaceId)).map(state => state.id)
    );
    const lifecycle =
      typeof args.lifecycle === 'string' && lifecycleValues.has(args.lifecycle)
        ? args.lifecycle
        : null;
    const currencyConfig = await context.db.workspace.getSupportedCurrencies?.(context.workspaceId);
    const normalizedFields = normalizeEntityScalarFields({
      schemaFields: schema.fields,
      fields: args.fields ?? {},
      supportedCurrencies: currencyConfig
        ? new Set(currencyConfig.currencies.map(currency => currency.code))
        : undefined
    });

    if (context.authCtx !== null) {
      requireNoRestrictedFieldWrites(
        context.authCtx,
        schema,
        Object.keys(args.fields ?? {}),
        'You do not have permission to set one or more restricted fields on this entity'
      );
    }

    if (!schema.key_prefix) throw new Error(`Schema '${args.schemaId}' is missing a key prefix`);
    const entity = await withCatalogMutationTransaction(context.db, async tx => {
      const timestamp = new Date();
      const publicId = formatPublicId(
        schema.key_prefix,
        await tx.workspace.allocatePublicId(schema.key_prefix, timestamp)
      );
      return createEntityWithAudit(tx, {
        workspace: context.workspaceId,
        actor: context.actor,
        entity: {
          id: randomUUID(),
          workspace: context.workspaceId,
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
          data: normalizedFields,
          project_id: null,
          created_at: timestamp,
          updated_at: timestamp,
          completeness: computeEntityCompleteness(
            {
              description: typeof args.description === 'string' ? args.description : '',
              owner,
              lifecycle,
              data: normalizedFields
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

const createUpdateEntityTool = (context: AiChatToolContext) =>
  updateEntityTool.server(async rawArgs => {
    const args = rawArgs as UpdateEntityArgs;
    const current = await context.db.catalog.getEntity(context.workspaceId, args.entityId);
    if (!current) throw new Error(`Entity '${args.entityId}' not found`);
    const schema = await context.db.catalog.getSchema(context.workspaceId, current.schema_id);
    if (
      schema &&
      (await entityRequiresApproval(context.db, context.workspaceId, schema, current))
    ) {
      throw new Error('This entity requires an approved change proposal before it can be edited');
    }
    if (schema) assertNoTypedRelationFieldWrites(schema, args.fields);

    if (context.authCtx !== null) {
      requireEntityAction(
        context.authCtx,
        current,
        'edit_entity',
        'You do not have permission to edit this entity'
      );
    }

    const teamIds = new Set(
      (await context.db.workspace.listTeams(context.workspaceId)).map(team => team.id)
    );
    const nextOwner = normalizeOwner(args.owner, teamIds, current.owner);

    if (context.authCtx !== null && nextOwner !== current.owner) {
      requireEntityAction(
        context.authCtx,
        current,
        'admin_entity',
        'You do not have permission to change ownership'
      );
    }

    const lifecycleValues = new Set(
      (await context.db.workspace.listLifecycleStates(context.workspaceId)).map(state => state.id)
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
    const currencyConfig = schema
      ? await context.db.workspace.getSupportedCurrencies?.(context.workspaceId)
      : null;
    const normalizedNextData = schema
      ? normalizeEntityScalarFields({
          schemaFields: schema.fields,
          fields: nextData,
          supportedCurrencies: currencyConfig
            ? new Set(currencyConfig.currencies.map(currency => currency.code))
            : undefined
        })
      : nextData;

    if (context.authCtx !== null && schema) {
      const changedFieldIds = Object.keys(args.fields ?? {}).filter(
        fieldId => !equalEntityValue(current.data[fieldId], normalizedNextData[fieldId])
      );
      requireNoRestrictedFieldWrites(
        context.authCtx,
        schema,
        changedFieldIds,
        'You do not have permission to edit one or more restricted fields on this entity'
      );
    }

    const entity = await withCatalogMutationTransaction(context.db, tx =>
      updateEntityWithAudit(tx, {
        workspace: context.workspaceId,
        entityId: current.id,
        previous: current,
        actor: context.actor,
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
          data: normalizedNextData,
          project_id: current.project_id,
          updated_at: new Date(),
          completeness: schema
            ? computeEntityCompleteness(
                {
                  description: nextDescription,
                  owner: nextOwner,
                  lifecycle: nextLifecycle,
                  data: normalizedNextData
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

export const createEntityChatTools = (context: AiChatToolContext) => [
  createQueryEntitiesTool(context),
  createGetEntityDetailsTool(context),
  createCreateEntityTool(context),
  createUpdateEntityTool(context)
];
