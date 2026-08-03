import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { createAiChatTools } from './chatTools';
import type { DatabaseAdapter } from '../../db/database';
import { Entity, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { AuditLogDbResult } from '../audit/db/auditDatabase';

const now = new Date('2026-01-01T00:00:00.000Z');

const schemas: SchemaDbResult[] = [
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
        maxCount: -1,
        groupId: 'finance'
      },
      { id: 'budget', name: 'Budget', type: 'text', groupId: 'finance' },
      {
        id: 'typedDeps',
        name: 'Typed dependency',
        type: 'typedRelation',
        relationSchemaId: 'rel-1',
        direction: 'out'
      } as never
    ],
    groups: [{ id: 'finance', name: 'Finance', accessControl: { teamIds: ['team-finance'] } }],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'APP',
    created_at: now,
    updated_at: now
  },
  {
    id: 'capability',
    workspace: 'ws-1',
    name: 'Capability',
    description: '',
    fields: [
      { id: 'critical', name: 'Critical', type: 'boolean' },
      {
        id: 'builtOn',
        name: 'Built on',
        type: 'reference',
        schemaId: 'capability',
        minCount: 0,
        maxCount: -1
      }
    ],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'CAP',
    created_at: now,
    updated_at: now
  }
];

const entities: Entity[] = [
  {
    id: 'entity-app-1',
    workspace: 'ws-1',
    public_id: 'APP-1',
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
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  },
  {
    id: 'entity-app-2',
    workspace: 'ws-1',
    public_id: 'APP-2',
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
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  },
  {
    id: 'entity-cap-1',
    workspace: 'ws-1',
    public_id: 'CAP-1',
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
      critical: true,
      builtOn: 'entity-cap-2'
    },
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  },
  {
    id: 'entity-cap-2',
    workspace: 'ws-1',
    public_id: 'CAP-2',
    slug: 'card-network',
    namespace: '',
    name: 'Card Network',
    description: 'External card network integration',
    owner: 'team-payments',
    lifecycle: 'production',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: 'capability',
    data: {
      critical: false
    },
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  },
  {
    id: 'entity-app-3',
    workspace: 'ws-1',
    public_id: 'APP-3',
    slug: 'orphan-service',
    namespace: '',
    name: 'Orphan Service',
    description: 'No relations',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: 'application',
    data: {},
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  },
  {
    id: 'entity-app-4',
    workspace: 'ws-1',
    public_id: 'APP-4',
    slug: 'restricted-app',
    namespace: '',
    name: 'Restricted App',
    description: 'Has a restricted field',
    owner: 'team-payments',
    lifecycle: 'production',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: 'application',
    data: {
      tech: 'Java',
      dependsOn: 'entity-cap-1',
      budget: '1000000'
    },
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  }
];

const createdEntities: Entity[] = [];
const updatedEntities: Entity[] = [];
const createdAuditLogs: AuditLogDbResult[] = [];
const createdNotifications: Array<{ changedByDisplayName: string; auditLog: AuditLogDbResult }> =
  [];

const db = {
  catalog: {
    listSchemas: async () => schemas,
    listEntities: async () => entities,
    listEntitiesPaginated: async (
      _ws: string,
      _filters: unknown,
      { limit, offset }: { limit: number; offset: number }
    ) => entities.slice(offset, offset + limit),
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
    }),
    createEntityVersion: vi.fn(async () => {}),
    pruneAutosaveVersions: vi.fn(async () => {})
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
    ],
    allocatePublicId: vi.fn(async () => 1)
  },
  audit: {
    createAuditLog: vi.fn(async (input: AuditLogDbResult) => {
      createdAuditLogs.push(input);
      return input;
    })
  },
  watch: {
    createNotificationsFromAudit: vi.fn(
      async (input: { changedByDisplayName: string; auditLog: AuditLogDbResult }) => {
        createdNotifications.push(input);
      }
    )
  }
} as unknown as DatabaseAdapter;

const actor = {
  id: 'user-1',
  displayName: 'Test User'
};

const restrictedCallerAuthCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'editor',
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const financeCallerAuthCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'editor',
  teamAssignments: [{ teamId: 'team-finance', role: 'team_editor' }],
  schemas: [],
  entities: [],
  grants: []
});

describe('createAiChatTools', () => {
  it('exposes the standard read-only set when no selection is provided', () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor, { readOnly: true });
    expect(tools.map(tool => tool.name)).toEqual([
      'query_entities',
      'get_entity_details',
      'traverse_relations',
      'list_relation_schemas',
      'list_relations',
      'get_relation'
    ]);
  });

  it('filters the read-only tool set by the requested IDs', () => {
    const selected = createAiChatTools(db, 'ws-1', null, actor, {
      readOnly: true,
      toolIds: ['get_entity_details', 'query_entities']
    });
    expect(selected.map(tool => tool.name)).toEqual(['query_entities', 'get_entity_details']);

    const none = createAiChatTools(db, 'ws-1', null, actor, {
      readOnly: true,
      toolIds: []
    });
    expect(none).toEqual([]);
  });

  it('queries actual entity content, not just schema metadata', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
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
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');

    expect(getEntityDetails).toBeDefined();

    const result = await getEntityDetails!.execute?.({ entityId: 'entity-cap-1' });

    expect(result).toMatchObject({
      found: true,
      entity: {
        id: 'entity-cap-1',
        name: 'Payment Processing',
        schemaName: 'Capability'
      }
    });
    expect(
      (result as { entity: { incomingRelations: unknown[] } }).entity.incomingRelations
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ id: 'entity-app-2', name: 'Billing API' }),
          fieldId: 'dependsOn',
          kind: 'reference'
        })
      ])
    );
  });

  it('creates entities through an approval-gated mutation tool', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
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
    expect(createdAuditLogs.at(-1)).toMatchObject({
      user_id: actor.id,
      operation: 'create',
      entity_type: 'entity',
      entity_name: 'Orders API'
    });
    expect(createdNotifications.at(-1)).toMatchObject({
      changedByDisplayName: actor.displayName
    });
  });

  it('updates entities through an approval-gated mutation tool', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
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
    expect(createdAuditLogs.at(-1)).toMatchObject({
      user_id: actor.id,
      operation: 'update',
      entity_type: 'entity',
      entity_id: 'entity-app-1'
    });
    expect(createdNotifications.at(-1)).toMatchObject({
      changedByDisplayName: actor.displayName
    });
  });

  it('rejects create_entity writes to a typedRelation field', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const createEntity = tools.find(tool => tool.name === 'create_entity');

    await expect(
      createEntity!.execute?.({
        schemaId: 'application',
        name: 'Orders API',
        fields: { typedDeps: ['entity-x'] }
      })
    ).rejects.toThrow(/typed-relation/i);
  });

  it('rejects update_entity writes to a typedRelation field', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const updateEntity = tools.find(tool => tool.name === 'update_entity');

    await expect(
      updateEntity!.execute?.({
        entityId: 'entity-app-1',
        fields: { typedDeps: ['entity-x'] }
      })
    ).rejects.toThrow(/typed-relation/i);
  });

  it('traverses outgoing relations one hop', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

    expect(traverseRelations).toBeDefined();

    const result = await traverseRelations!.execute?.({
      entityId: 'entity-app-2',
      depth: 1,
      direction: 'outgoing'
    });

    expect(result).toMatchObject({
      entityId: 'entity-app-2',
      truncated: false
    });
    expect((result as { nodes: { id: string }[] }).nodes.map(n => n.id).sort()).toEqual(
      ['entity-app-2', 'entity-cap-1'].sort()
    );
    expect((result as { edges: unknown[] }).edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'entity-app-2',
          targetId: 'entity-cap-1',
          fieldId: 'dependsOn',
          kind: 'reference'
        })
      ])
    );
  });

  it('traverses incoming relations one hop', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

    const result = await traverseRelations!.execute?.({
      entityId: 'entity-cap-1',
      depth: 1,
      direction: 'incoming'
    });

    expect((result as { nodes: { id: string }[] }).nodes.map(n => n.id).sort()).toEqual(
      ['entity-app-2', 'entity-app-4', 'entity-cap-1'].sort()
    );
    expect((result as { edges: unknown[] }).edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'entity-app-2',
          targetId: 'entity-cap-1',
          fieldId: 'dependsOn',
          kind: 'reference'
        })
      ])
    );
  });

  it('traverses both directions across multiple hops', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

    // entity-app-2 → entity-cap-1 → entity-cap-2 (depth 2, outgoing)
    const result = await traverseRelations!.execute?.({
      entityId: 'entity-app-2',
      depth: 2,
      direction: 'outgoing'
    });

    const nodeIds = (result as { nodes: { id: string }[] }).nodes.map(n => n.id).sort();
    expect(nodeIds).toEqual(['entity-app-2', 'entity-cap-1', 'entity-cap-2'].sort());
    expect((result as { edges: unknown[] }).edges).toHaveLength(2);
  });

  it('returns only the starting node for an entity with no relations', async () => {
    const tools = createAiChatTools(db, 'ws-1', null, actor);
    const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

    const result = await traverseRelations!.execute?.({
      entityId: 'entity-app-3',
      depth: 2,
      direction: 'both'
    });

    expect(result).toMatchObject({
      entityId: 'entity-app-3',
      nodes: [{ id: 'entity-app-3', name: 'Orphan Service' }],
      edges: [],
      truncated: false
    });
  });

  describe('field group restriction', () => {
    it('omits restricted relations from entity details and graph traversal', async () => {
      const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');
      const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

      const details = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });
      expect(
        (details as { entity: { outgoingRelations: unknown[] } }).entity.outgoingRelations
      ).toEqual([]);

      const graph = await traverseRelations!.execute?.({
        entityId: 'entity-app-4',
        depth: 2,
        direction: 'both'
      });
      expect((graph as { nodes: { id: string }[] }).nodes.map(node => node.id)).toEqual([
        'entity-app-4'
      ]);
      expect((graph as { edges: unknown[] }).edges).toEqual([]);
    });

    it('includes restricted relations for a caller with group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');
      const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

      const details = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });
      expect(details).toMatchObject({
        entity: { outgoingRelations: [{ fieldId: 'dependsOn', targets: [{ id: 'entity-cap-1' }] }] }
      });

      const graph = await traverseRelations!.execute?.({
        entityId: 'entity-app-4',
        depth: 1,
        direction: 'outgoing'
      });
      expect((graph as { nodes: { id: string }[] }).nodes.map(node => node.id).sort()).toEqual(
        ['entity-app-4', 'entity-cap-1'].sort()
      );
    });

    it('omits a restricted field from get_entity_details for a caller without group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');

      const result = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });

      expect(result).toMatchObject({ found: true, entity: { data: { tech: 'Java' } } });
      expect(
        (result as { entity: { data: Record<string, unknown> } }).entity.data
      ).not.toHaveProperty('budget');
    });

    it('includes a restricted field in get_entity_details for a caller with group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');

      const result = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });

      expect(result).toMatchObject({
        found: true,
        entity: { data: { tech: 'Java', budget: '1000000' } }
      });
    });

    it('includes a restricted field in get_entity_details when authCtx is null (system bypass)', async () => {
      const tools = createAiChatTools(db, 'ws-1', null, actor);
      const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');

      const result = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });

      expect(result).toMatchObject({
        found: true,
        entity: { data: { tech: 'Java', budget: '1000000' } }
      });
    });

    it('cannot match or preview a restricted field via query_entities for a caller without group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const queryEntities = tools.find(tool => tool.name === 'query_entities');

      const result = await queryEntities!.execute?.({ query: '1000000' });

      expect(result).toMatchObject({ total: 0, entities: [] });
    });

    it('matches a restricted field via query_entities for a caller with group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const queryEntities = tools.find(tool => tool.name === 'query_entities');

      const result = await queryEntities!.execute?.({ query: '1000000' });

      expect(result).toMatchObject({
        total: 1,
        entities: [{ id: 'entity-app-4', matchedFields: ['budget'] }]
      });
    });

    it('rejects create_entity writes to a restricted field for a caller without group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const createEntity = tools.find(tool => tool.name === 'create_entity');

      await expect(
        createEntity!.execute?.({
          schemaId: 'application',
          name: 'New App',
          fields: { budget: '500' }
        })
      ).rejects.toThrow();
    });

    it('allows create_entity writes to a restricted field for a caller with group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const createEntity = tools.find(tool => tool.name === 'create_entity');

      const result = await createEntity!.execute?.({
        schemaId: 'application',
        name: 'New Finance App',
        fields: { budget: '500' }
      });

      expect(result).toMatchObject({ entity: { name: 'New Finance App' } });
    });

    it('rejects update_entity writes to a changed restricted field for a caller without group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const updateEntity = tools.find(tool => tool.name === 'update_entity');

      await expect(
        updateEntity!.execute?.({
          entityId: 'entity-app-4',
          fields: { budget: '2000000' }
        })
      ).rejects.toThrow();
    });

    it('allows update_entity when the restricted field is unchanged', async () => {
      const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const updateEntity = tools.find(tool => tool.name === 'update_entity');

      const result = await updateEntity!.execute?.({
        entityId: 'entity-app-4',
        fields: { budget: '1000000', tech: 'Kotlin' }
      });

      expect(result).toMatchObject({ entity: { id: 'entity-app-4' } });
    });

    it('allows update_entity writes to a changed restricted field for a caller with group access', async () => {
      const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const updateEntity = tools.find(tool => tool.name === 'update_entity');

      const result = await updateEntity!.execute?.({
        entityId: 'entity-app-4',
        fields: { budget: '2000000' }
      });

      expect(result).toMatchObject({ entity: { id: 'entity-app-4' } });
    });
  });
});
