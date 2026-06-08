import { describe, expect, it, vi } from 'vitest';
import { createAiChatTools } from './chatTools';
import type { DatabaseAdapter } from '../../db/database';
import type { Entity, EntitySchema } from '../../types';

const now = new Date('2026-01-01T00:00:00.000Z');

const schemas: EntitySchema[] = [
  {
    id: 'application',
    workspace: 'ws-1',
    name: 'Application',
    description: '',
    fields: [
      { id: 'tech', name: 'Tech', type: 'text' },
      {
        id: 'dependsOn',
        name: 'Depends on',
        type: 'reference',
        schemaId: 'capability',
        minCount: 0,
        maxCount: -1
      }
    ],
    color: null,
    icon: null,
    default_owner: null,
    created_at: now,
    updated_at: now
  },
  {
    id: 'capability',
    workspace: 'ws-1',
    name: 'Capability',
    description: '',
    fields: [{ id: 'critical', name: 'Critical', type: 'boolean' }],
    color: null,
    icon: null,
    default_owner: null,
    created_at: now,
    updated_at: now
  }
];

const entities: Entity[] = [
  {
    id: 'entity-app-1',
    workspace: 'ws-1',
    slug: 'payments-api',
    namespace: '',
    name: 'Payments API',
    description: 'Handles card payments',
    owner: 'team-payments',
    lifecycle: 'production',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['payments'],
    links: [],
    schema_id: 'application',
    data: {
      tech: 'PostgreSQL'
    },
    visibility_mode: 'public',
    created_at: now,
    updated_at: now
  },
  {
    id: 'entity-app-2',
    workspace: 'ws-1',
    slug: 'billing-api',
    namespace: '',
    name: 'Billing API',
    description: 'Billing entry point',
    owner: 'team-billing',
    lifecycle: 'production',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['billing'],
    links: [],
    schema_id: 'application',
    data: {
      tech: 'Node',
      dependsOn: 'entity-cap-1'
    },
    visibility_mode: 'public',
    created_at: now,
    updated_at: now
  },
  {
    id: 'entity-cap-1',
    workspace: 'ws-1',
    slug: 'payment-processing',
    namespace: '',
    name: 'Payment Processing',
    description: 'Core payment capability',
    owner: 'team-payments',
    lifecycle: 'production',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['core'],
    links: [],
    schema_id: 'capability',
    data: {
      critical: true
    },
    visibility_mode: 'public',
    created_at: now,
    updated_at: now
  }
];

const createdEntities: Entity[] = [];
const updatedEntities: Entity[] = [];

const db = {
  catalog: {
    listSchemas: async () => schemas,
    listEntities: async () => entities,
    getSchema: async (_ws: string, schemaId: string) =>
      schemas.find(schema => schema.id === schemaId) ?? null,
    getEntity: async (_ws: string, entityId: string) =>
      entities.find(entity => entity.id === entityId) ?? null,
    createEntity: vi.fn(async (input: Entity) => {
      createdEntities.push(input);
      return input;
    }),
    updateEntity: vi.fn(async (_ws: string, entityId: string, input: Partial<Entity>) => {
      const existing = entities.find(entity => entity.id === entityId);
      if (!existing) return null;
      const updated = { ...existing, ...input } as Entity;
      updatedEntities.push(updated);
      return updated;
    })
  },
  workspace: {
    listTeams: async () => [
      {
        id: 'team-payments',
        workspace: 'ws-1',
        sort_order: 0,
        color: null,
        description: '',
        created_at: now
      },
      {
        id: 'team-billing',
        workspace: 'ws-1',
        sort_order: 1,
        color: null,
        description: '',
        created_at: now
      }
    ],
    listLifecycleStates: async () => [
      {
        id: 'production',
        workspace: 'ws-1',
        label: 'Production',
        color: '#000',
        sort_order: 0,
        created_at: now
      }
    ]
  }
} as unknown as DatabaseAdapter;

describe('createAiChatTools', () => {
  it('queries actual entity content, not just schema metadata', async () => {
    const tools = createAiChatTools(db, 'ws-1', null);
    const queryEntities = tools.find(tool => tool.name === 'query_entities');

    expect(queryEntities).toBeDefined();

    const result = await queryEntities!.execute?.({ query: 'postgres' });

    expect(result).toMatchObject({
      total: 1,
      entities: [
        {
          id: 'entity-app-1',
          name: 'Payments API',
          matchedFields: ['tech']
        }
      ]
    });
  });

  it('returns full entity details with resolved relations', async () => {
    const tools = createAiChatTools(db, 'ws-1', null);
    const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');

    expect(getEntityDetails).toBeDefined();

    const result = await getEntityDetails!.execute?.({ entityId: 'entity-cap-1' });

    expect(result).toMatchObject({
      found: true,
      entity: {
        id: 'entity-cap-1',
        name: 'Payment Processing',
        schemaName: 'Capability',
        incomingRelations: [
          {
            source: {
              id: 'entity-app-2',
              name: 'Billing API'
            },
            fieldId: 'dependsOn',
            kind: 'reference'
          }
        ]
      }
    });
  });

  it('creates entities through an approval-gated mutation tool', async () => {
    const tools = createAiChatTools(db, 'ws-1', null);
    const createEntity = tools.find(tool => tool.name === 'create_entity');

    expect(createEntity).toBeDefined();
    expect(createEntity?.needsApproval).toBe(true);

    const result = await createEntity!.execute?.({
      schemaId: 'application',
      name: 'Orders API',
      fields: { tech: 'Go' }
    });

    expect(result).toMatchObject({
      entity: {
        name: 'Orders API',
        schemaId: 'application'
      }
    });
    expect(createdEntities.at(-1)).toMatchObject({
      name: 'Orders API',
      data: { tech: 'Go' }
    });
  });

  it('updates entities through an approval-gated mutation tool', async () => {
    const tools = createAiChatTools(db, 'ws-1', null);
    const updateEntity = tools.find(tool => tool.name === 'update_entity');

    expect(updateEntity).toBeDefined();
    expect(updateEntity?.needsApproval).toBe(true);

    const result = await updateEntity!.execute?.({
      entityId: 'entity-app-1',
      description: 'Handles card and wallet payments',
      fields: { tech: 'PostgreSQL 16' }
    });

    expect(result).toMatchObject({
      entity: {
        id: 'entity-app-1',
        name: 'Payments API'
      }
    });
    expect(updatedEntities.at(-1)).toMatchObject({
      description: 'Handles card and wallet payments',
      data: { tech: 'PostgreSQL 16' }
    });
  });
});
