import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { ArchRegisterApiError, type ArchRegisterApiClient } from './apiClient';
import { createMcpServer } from './tools';

const entity = {
  _uid: 'entity-1',
  _publicId: 'APP-1',
  _schema: { id: 'application', name: 'Application' },
  _name: 'Payments API',
  _slug: 'payments-api',
  _namespace: '',
  _description: 'Handles payments',
  _owner: { id: 'team-payments', name: 'Payments' },
  _lifecycle: { id: 'production', name: 'Production' },
  _tags: ['payments'],
  _links: [],
  _visibilityMode: 'public',
  canView: true,
  canEdit: true,
  tech: 'PostgreSQL',
  criticality: 'high'
};

const schemas = [
  {
    id: 'application',
    name: 'Application',
    fields: [{ id: 'tech', name: 'Technology', type: 'text' }],
    entity_count: 1
  }
];

const createFakeApi = () => {
  const api = {
    searchEntities: vi.fn(async (input: { schemaId?: string; lifecycle?: string }) => ({
      entities: [entity],
      total: input.schemaId === 'application' || input.lifecycle === 'production' ? 1 : 1
    })),
    getEntity: vi.fn(async () => entity),
    getEntityRelations: vi.fn(async () => ({ outgoing: [], incoming: [] })),
    getEntityDependents: vi.fn(async () => ({ dependents: [], truncated: false })),
    listSchemas: vi.fn(async () => schemas),
    listLifecycleStates: vi.fn(async () => [{ id: 'production', label: 'Production' }]),
    createEntity: vi.fn(async () => ({ ...entity, _uid: 'entity-new' })),
    updateEntity: vi.fn(async () => ({ ...entity, _name: 'Renamed' }))
  };
  return api as unknown as ArchRegisterApiClient;
};

const connect = async (api: ArchRegisterApiClient, enableMutations = false) => {
  const server = createMcpServer({ api, enableMutations });
  const client = new Client({ name: 'mcp-server-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
};

const resultJson = (result: unknown) => {
  const content =
    typeof result === 'object' &&
    result !== null &&
    'content' in result &&
    Array.isArray(result.content)
      ? result.content
      : [];
  let text: string | undefined;
  for (const item of content) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'type' in item &&
      item.type === 'text' &&
      'text' in item &&
      typeof item.text === 'string'
    ) {
      text = item.text;
      break;
    }
  }
  expect(text).toBeDefined();
  return JSON.parse(text!);
};

describe('MCP tools', () => {
  it('exposes read tools by default and gates mutation tools', async () => {
    const api = createFakeApi();
    const { client, server } = await connect(api);
    const readOnlyTools = await client.listTools();

    expect(readOnlyTools.tools.map(tool => tool.name)).toEqual([
      'search_entities',
      'get_entity',
      'list_schemas',
      'get_entity_dependencies',
      'get_entity_dependents',
      'get_workspace_summary'
    ]);

    await client.close();
    await server.close();

    const mutationConnection = await connect(createFakeApi(), true);
    const allTools = await mutationConnection.client.listTools();
    expect(allTools.tools.map(tool => tool.name)).toContain('create_entity');
    expect(allTools.tools.map(tool => tool.name)).toContain('update_entity_field');
    expect(allTools.tools.map(tool => tool.name)).toContain('update_entity');
    await mutationConnection.client.close();
    await mutationConnection.server.close();
  });

  it('returns normalized search results over the MCP protocol', async () => {
    const api = createFakeApi();
    const { client, server } = await connect(api);

    const result = await client.callTool({
      name: 'search_entities',
      arguments: { query: 'payments', limit: 5 }
    });

    expect(resultJson(result)).toEqual({
      total: 1,
      entities: [
        expect.objectContaining({
          id: 'entity-1',
          publicId: 'APP-1',
          name: 'Payments API',
          schemaId: 'application',
          data: { tech: 'PostgreSQL', criticality: 'high' }
        })
      ]
    });
    expect(api.searchEntities).toHaveBeenCalledWith({
      query: 'payments',
      limit: 5,
      offset: 0
    });

    await client.close();
    await server.close();
  });

  it('resolves an entity and includes schema fields and relations', async () => {
    const api = createFakeApi();
    const { client, server } = await connect(api);

    const result = await client.callTool({
      name: 'get_entity',
      arguments: { name: 'Payments API' }
    });
    const body = resultJson(result);

    expect(body.entity).toEqual(
      expect.objectContaining({
        id: 'entity-1',
        schemaFields: [{ id: 'tech', name: 'Technology', type: 'text' }],
        fields: { tech: 'PostgreSQL', criticality: 'high' },
        outgoingRelations: [],
        incomingRelations: []
      })
    );
    expect(api.searchEntities).toHaveBeenCalledWith({
      query: 'Payments API',
      limit: 50,
      offset: 0
    });

    await client.close();
    await server.close();
  });

  it('merges update input with the current entity before writing', async () => {
    const api = createFakeApi();
    const { client, server } = await connect(api, true);

    const result = await client.callTool({
      name: 'update_entity',
      arguments: {
        entityId: 'entity-1',
        name: 'Renamed',
        fields: { tech: 'Rust' }
      }
    });

    expect(resultJson(result)).toEqual(
      expect.objectContaining({ message: 'Updated entity entity-1.' })
    );
    expect(api.updateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'entity-1',
        schemaId: 'application',
        name: 'Renamed',
        owner: 'team-payments',
        lifecycle: 'production',
        fields: { tech: 'Rust', criticality: 'high' }
      })
    );

    await client.close();
    await server.close();
  });

  it('supports the focused single-field mutation from the issue contract', async () => {
    const api = createFakeApi();
    const { client, server } = await connect(api, true);

    const result = await client.callTool({
      name: 'update_entity_field',
      arguments: { entityId: 'entity-1', fieldId: 'tech', value: 'Rust' }
    });

    expect(resultJson(result)).toEqual(
      expect.objectContaining({ message: "Updated field 'tech' on entity entity-1." })
    );
    expect(api.updateEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: 'entity-1',
        fields: { tech: 'Rust', criticality: 'high' }
      })
    );

    await client.close();
    await server.close();
  });

  it('returns structured authorization errors', async () => {
    const api = createFakeApi();
    api.getEntity = vi.fn(async () => {
      throw new ArchRegisterApiError(403, 'Token lacks ent.edit');
    }) as typeof api.getEntity;
    const { client, server } = await connect(api);

    const result = await client.callTool({
      name: 'get_entity',
      arguments: { entityId: 'entity-1' }
    });

    expect(result.isError).toBe(true);
    expect(resultJson(result)).toEqual({
      code: 'FORBIDDEN',
      message: 'Token lacks ent.edit'
    });

    await client.close();
    await server.close();
  });
});
