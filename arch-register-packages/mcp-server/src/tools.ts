import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  mcpCreateEntityInput,
  mcpGetEntityInput,
  mcpListSchemasInput,
  mcpRelationTraversalInput,
  mcpSearchEntitiesInput,
  mcpUpdateEntityFieldInput,
  mcpUpdateEntityInput,
  mcpWorkspaceSummaryInput,
  type McpCreateEntityInput,
  type McpGetEntityInput,
  type McpRelationTraversalInput,
  type McpSearchEntitiesInput,
  type McpUpdateEntityFieldInput,
  type McpUpdateEntityInput
} from '@arch-register/api-types/mcpToolsContract';
import { ArchRegisterApiError, type ArchRegisterApiClient } from './apiClient';

type JsonObject = Record<string, unknown>;

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

const jsonResult = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }]
});

const errorResult = (error: unknown): ToolResult => {
  if (error instanceof ArchRegisterApiError) {
    const code =
      error.status === 401
        ? 'UNAUTHORIZED'
        : error.status === 403
          ? 'FORBIDDEN'
          : error.status === 404
            ? 'NOT_FOUND'
            : error.status === 409
              ? 'CONFLICT'
              : error.status >= 400 && error.status < 500
                ? 'BAD_REQUEST'
                : 'UPSTREAM';
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ code, message: error.message }) }]
    };
  }

  const message = error instanceof Error ? error.message : 'Unexpected MCP tool failure';
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify({ code: 'UPSTREAM', message }) }]
  };
};

const run = async (callback: () => Promise<unknown>): Promise<ToolResult> => {
  try {
    return jsonResult(await callback());
  } catch (error) {
    return errorResult(error);
  }
};

const stringValue = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const nullableForeignKey = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const record = value as JsonObject;
  return {
    id: stringValue(record['id']),
    name: stringValue(record['name'], stringValue(record['id']))
  };
};

const entityData = (entity: JsonObject): JsonObject => {
  const metadataKeys = new Set(['canView', 'canEdit', 'canDelete', 'canAdmin', 'canCreateChild']);
  return Object.fromEntries(
    Object.entries(entity).filter(([key]) => !key.startsWith('_') && !metadataKeys.has(key))
  );
};

const toEntitySummary = (entity: JsonObject) => ({
  id: stringValue(entity['_uid']),
  publicId: stringValue(entity['_publicId'], stringValue(entity['_uid'])),
  name: stringValue(entity['_name']),
  slug: stringValue(entity['_slug']),
  schemaId: stringValue((entity['_schema'] as JsonObject | undefined)?.['id']),
  schemaName: stringValue((entity['_schema'] as JsonObject | undefined)?.['name']),
  description: stringValue(entity['_description']),
  owner: nullableForeignKey(entity['_owner']),
  lifecycle: nullableForeignKey(entity['_lifecycle']),
  tags: Array.isArray(entity['_tags'])
    ? entity['_tags'].filter((tag): tag is string => typeof tag === 'string')
    : [],
  data: entityData(entity)
});

const toEntityDetails = (entity: JsonObject, relations?: JsonObject) => {
  const summary = toEntitySummary(entity);
  return {
    ...summary,
    namespace: stringValue(entity['_namespace']),
    links: Array.isArray(entity['_links']) ? entity['_links'] : [],
    projectId: typeof entity['_projectId'] === 'string' ? entity['_projectId'] : null,
    schemaFields: Array.isArray(entity['_schemaFields']) ? entity['_schemaFields'] : [],
    fields: entityData(entity),
    outgoingRelations: relations?.['outgoing'] ?? [],
    incomingRelations: relations?.['incoming'] ?? []
  };
};

const exactEntityMatch = (entities: JsonObject[], key: '_name' | '_slug', value: string) => {
  const matches = entities.filter(
    entity => stringValue(entity[key]).toLowerCase() === value.toLowerCase()
  );
  if (matches.length === 0) throw new Error(`No visible entity matched ${key.slice(1)} '${value}'`);
  if (matches.length > 1)
    throw new Error(`More than one visible entity matched ${key.slice(1)} '${value}'`);
  return stringValue(matches[0]!['_uid']);
};

const resolveEntityId = async (api: ArchRegisterApiClient, input: McpGetEntityInput) => {
  if (input.entityId) return input.entityId;
  const search = await api.searchEntities({
    query: input.name ?? input.slug,
    limit: 50,
    offset: 0
  });
  return exactEntityMatch(
    search.entities,
    input.name ? '_name' : '_slug',
    input.name ?? input.slug!
  );
};

const relationTargetId = (relation: JsonObject) => stringValue(relation['entityId']);

const getDependencies = async (api: ArchRegisterApiClient, input: McpRelationTraversalInput) => {
  const maxDepth = input.transitive ? input.depth : 1;
  const queue = [{ entityId: input.entityId, depth: 0 }];
  const visited = new Set([input.entityId]);
  const relations: JsonObject[] = [];
  let truncated = false;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const result = await api.getEntityRelations(current.entityId);
    for (const relation of result.outgoing) {
      if (relations.length >= input.limit) {
        truncated = true;
        break;
      }
      relations.push({ ...relation, depth: current.depth + 1 });
      const targetId = relationTargetId(relation);
      if (current.depth + 1 < maxDepth && targetId && !visited.has(targetId)) {
        visited.add(targetId);
        queue.push({ entityId: targetId, depth: current.depth + 1 });
      }
    }
    if (truncated) break;
  }

  return { entityId: input.entityId, dependencies: relations, truncated };
};

const registerReadTools = (server: McpServer, api: ArchRegisterApiClient) => {
  server.registerTool(
    'search_entities',
    {
      description:
        'Search visible Arch Register entities using text, entity-browser filters, and pagination.',
      inputSchema: mcpSearchEntitiesInput.shape
    },
    async rawInput => {
      return run(async () => {
        const input = mcpSearchEntitiesInput.parse(rawInput) as McpSearchEntitiesInput;
        const result = await api.searchEntities(input);
        return {
          total: result.total,
          entities: result.entities.map(toEntitySummary)
        };
      });
    }
  );

  server.registerTool(
    'get_entity',
    {
      description: 'Get one visible entity by ID, exact slug, or exact name, including relations.',
      inputSchema: mcpGetEntityInput.shape
    },
    async rawInput => {
      return run(async () => {
        const input = mcpGetEntityInput.parse(rawInput) as McpGetEntityInput;
        const entityId = await resolveEntityId(api, input);
        const entity = await api.getEntity(entityId);
        const [relations, schemas] = await Promise.all([
          input.includeRelated ? api.getEntityRelations(entityId) : Promise.resolve(undefined),
          api.listSchemas()
        ]);
        const schemaId = stringValue((entity['_schema'] as JsonObject | undefined)?.['id']);
        const schema = schemas.find(item => stringValue(item['id']) === schemaId);
        const enrichedEntity = {
          ...entity,
          _schemaFields: Array.isArray(schema?.['fields']) ? schema['fields'] : []
        };
        return { found: true, entity: toEntityDetails(enrichedEntity, relations) };
      });
    }
  );

  server.registerTool(
    'list_schemas',
    {
      description: 'List visible workspace schemas and their field definitions.',
      inputSchema: mcpListSchemasInput.shape
    },
    async () =>
      run(async () => {
        const schemas = await api.listSchemas();
        return schemas.map(schema => {
          const { entity_count: _entityCount, ...safeSchema } = schema;
          return safeSchema;
        });
      })
  );

  server.registerTool(
    'get_entity_dependencies',
    {
      description: 'Return outgoing entity dependencies, optionally traversed to a bounded depth.',
      inputSchema: mcpRelationTraversalInput.shape
    },
    async rawInput =>
      run(() =>
        getDependencies(api, mcpRelationTraversalInput.parse(rawInput) as McpRelationTraversalInput)
      )
  );

  server.registerTool(
    'get_entity_dependents',
    {
      description: 'Return entities that depend on the selected entity, directly or transitively.',
      inputSchema: mcpRelationTraversalInput.shape
    },
    async rawInput =>
      run(async () => {
        const input = mcpRelationTraversalInput.parse(rawInput) as McpRelationTraversalInput;
        const result = await api.getEntityDependents(input.entityId, input.transitive, input.depth);
        return {
          entityId: input.entityId,
          dependents: result.dependents.slice(0, input.limit),
          truncated: result.truncated || result.dependents.length > input.limit
        };
      })
  );

  server.registerTool(
    'get_workspace_summary',
    {
      description: 'Summarize visible entity totals by schema and lifecycle state.',
      inputSchema: mcpWorkspaceSummaryInput.shape
    },
    async () =>
      run(async () => {
        const [schemas, lifecycleStates] = await Promise.all([
          api.listSchemas(),
          api.listLifecycleStates()
        ]);
        const total = await api.searchEntities({ limit: 1, offset: 0 });
        const schemaCounts = await Promise.all(
          schemas.map(async schema => ({
            schemaId: stringValue(schema['id']),
            schemaName: stringValue(schema['name']),
            count: (
              await api.searchEntities({
                schemaId: stringValue(schema['id']),
                limit: 1,
                offset: 0
              })
            ).total
          }))
        );
        const lifecycleCounts = await Promise.all(
          lifecycleStates.map(async state => ({
            lifecycleId: stringValue(state['id']),
            label: stringValue(state['label']),
            count: (
              await api.searchEntities({
                lifecycle: stringValue(state['id']),
                limit: 1,
                offset: 0
              })
            ).total
          }))
        );
        const assignedLifecycleCount = lifecycleCounts.reduce((sum, item) => sum + item.count, 0);
        if (assignedLifecycleCount < total.total) {
          lifecycleCounts.push({
            lifecycleId: '',
            label: 'Unassigned',
            count: total.total - assignedLifecycleCount
          });
        }
        return {
          totalEntities: total.total,
          schemaCounts,
          lifecycleCounts
        };
      })
  );
};

const registerMutationTools = (server: McpServer, api: ArchRegisterApiClient) => {
  server.registerTool(
    'create_entity',
    {
      description:
        'Create an entity. This has a persistent side effect and requires MCP mutations to be enabled.',
      inputSchema: mcpCreateEntityInput.shape
    },
    async rawInput =>
      run(async () => {
        const input = mcpCreateEntityInput.parse(rawInput) as McpCreateEntityInput;
        const entity = await api.createEntity(input);
        return { entity, message: `Created entity ${stringValue(entity['_uid'])}.` };
      })
  );

  server.registerTool(
    'update_entity_field',
    {
      description:
        'Update one schema field on an existing entity. This has a persistent side effect and requires MCP mutations to be enabled.',
      inputSchema: mcpUpdateEntityFieldInput.shape,
      annotations: { destructiveHint: true, idempotentHint: true }
    },
    async rawInput =>
      run(async () => {
        const input = mcpUpdateEntityFieldInput.parse(rawInput) as McpUpdateEntityFieldInput;
        const current = await api.getEntity(input.entityId);
        const currentSchema = current['_schema'] as JsonObject | undefined;
        const entity = await api.updateEntity({
          entityId: input.entityId,
          schemaId: stringValue(currentSchema?.['id']),
          name: stringValue(current['_name']),
          slug: stringValue(current['_slug']),
          namespace: stringValue(current['_namespace']),
          description: stringValue(current['_description']),
          owner: nullableForeignKey(current['_owner'])?.id ?? null,
          lifecycle: nullableForeignKey(current['_lifecycle'])?.id ?? null,
          tags: Array.isArray(current['_tags'])
            ? current['_tags'].filter((tag): tag is string => typeof tag === 'string')
            : [],
          fields: { ...entityData(current), [input.fieldId]: input.value }
        });
        return {
          entity,
          message: `Updated field '${input.fieldId}' on entity ${stringValue(entity['_uid'])}.`
        };
      })
  );

  server.registerTool(
    'update_entity',
    {
      description:
        'Update an entity. This has a persistent side effect and requires MCP mutations to be enabled.',
      inputSchema: mcpUpdateEntityInput.shape,
      annotations: { destructiveHint: true, idempotentHint: true }
    },
    async rawInput =>
      run(async () => {
        const input = mcpUpdateEntityInput.parse(rawInput) as McpUpdateEntityInput;
        const current = await api.getEntity(input.entityId);
        const currentSchema = current['_schema'] as JsonObject | undefined;
        const currentOwner = nullableForeignKey(current['_owner']);
        const currentLifecycle = nullableForeignKey(current['_lifecycle']);
        const entity = await api.updateEntity({
          ...input,
          schemaId: input.schemaId ?? stringValue(currentSchema?.['id']),
          name: input.name ?? stringValue(current['_name']),
          slug: input.slug ?? stringValue(current['_slug']),
          namespace: input.namespace ?? stringValue(current['_namespace']),
          description: input.description ?? stringValue(current['_description']),
          owner: input.owner === undefined ? (currentOwner?.id ?? null) : input.owner,
          lifecycle:
            input.lifecycle === undefined ? (currentLifecycle?.id ?? null) : input.lifecycle,
          tags:
            input.tags ??
            (Array.isArray(current['_tags'])
              ? current['_tags'].filter((tag): tag is string => typeof tag === 'string')
              : []),
          fields: { ...entityData(current), ...(input.fields ?? {}) }
        });
        return { entity, message: `Updated entity ${stringValue(entity['_uid'])}.` };
      })
  );
};

export type McpServerOptions = {
  api: ArchRegisterApiClient;
  enableMutations?: boolean;
};

export const createMcpServer = ({ api, enableMutations = false }: McpServerOptions) => {
  const server = new McpServer({ name: 'arch-register', version: '1.0.0' });
  registerReadTools(server, api);
  if (enableMutations) registerMutationTools(server, api);
  return server;
};
