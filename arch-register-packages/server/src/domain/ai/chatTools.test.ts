import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { createAiChatTools } from './chatTools';
import type { DatabaseAdapter } from '../../db/database';
import { Entity, SchemaDbResult } from '../catalog/db/catalogDatabase';
import { AuditLogDbCreate, AuditLogDbResult } from '../audit/db/auditDatabase';
import type {
  RelationDbCreate,
  RelationDbResult,
  RelationSchemaDbResult
} from '../catalog/db/relationDatabase';

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
        direction: 'in',
        groupId: 'finance'
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
      },
      {
        id: 'typedConsumers',
        name: 'Typed consumers',
        type: 'typedRelation',
        relationSchemaId: 'rel-1',
        direction: 'out',
        groupId: 'finance'
      }
    ],
    groups: [{ id: 'finance', name: 'Finance', accessControl: { teamIds: ['team-finance'] } }],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'CAP',
    created_at: now,
    updated_at: now
  }
];

const relationSchema: RelationSchemaDbResult = {
  id: 'rel-1',
  workspace: 'ws-1',
  name: 'Depends on',
  description: '',
  in_schema_ids: ['application'],
  out_schema_ids: ['capability'],
  fields: [
    { id: 'secret', name: 'Secret', type: 'text', requirementLevel: null, groupId: 'finance' }
  ],
  groups: [{ id: 'finance', name: 'Finance', accessControl: { teamIds: ['team-finance'] } }],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  version: 1,
  created_at: now,
  updated_at: now
};

const relationRows: RelationDbResult[] = [
  {
    id: 'relation-1',
    workspace: 'ws-1',
    schema_id: 'rel-1',
    schema_name: 'Depends on',
    in_entity_id: 'entity-app-4',
    in_entity_name: 'Restricted App',
    out_entity_id: 'entity-cap-1',
    out_entity_name: 'Payment Processing',
    data: { secret: 'restricted relation value' },
    owner: null,
    owner_name: null,
    lifecycle: null,
    lifecycle_label: null,
    version: 1,
    approval_policy_override: null,
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
const queuedAuditJobs: Array<{ job_type: string; payload: Record<string, unknown> }> = [];

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
  relation: {
    listRelationSchemas: async () => [relationSchema],
    getRelationSchema: async (_ws: string, schemaId: string) =>
      relationSchema.id === schemaId ? relationSchema : null,
    listRelations: async (
      _ws: string,
      filters: {
        schemaId?: string | null;
        inEntityId?: string | null;
        outEntityId?: string | null;
      },
      pagination: { limit?: number | null; offset?: number | null }
    ) => {
      const filtered = relationRows.filter(
        row =>
          (filters.schemaId == null || row.schema_id === filters.schemaId) &&
          (filters.inEntityId == null || row.in_entity_id === filters.inEntityId) &&
          (filters.outEntityId == null || row.out_entity_id === filters.outEntityId)
      );
      const offset = pagination.offset ?? 0;
      const limit = pagination.limit ?? filtered.length;
      return { items: filtered.slice(offset, offset + limit), total: filtered.length };
    },
    getRelation: async (_ws: string, relationId: string) =>
      relationRows.find(row => row.id === relationId) ?? null,
    listRelationsForEntity: async (_ws: string, entityId: string) => ({
      outgoing: relationRows.filter(row => row.in_entity_id === entityId),
      incoming: relationRows.filter(row => row.out_entity_id === entityId)
    }),
    createRelation: vi.fn(
      async (input: RelationDbCreate) =>
        ({
          ...input,
          schema_name: relationSchema.name,
          in_entity_name: entities.find(entity => entity.id === input.in_entity_id)?.name ?? '',
          out_entity_name: entities.find(entity => entity.id === input.out_entity_id)?.name ?? '',
          version: input.version ?? 1,
          approval_policy_override: null
        }) as RelationDbResult
    ),
    updateRelation: vi.fn(
      async (
        _ws: string,
        relationId: string,
        input: { data: Record<string, unknown>; version: number; updated_at: Date }
      ) => {
        const existing = relationRows.find(row => row.id === relationId);
        return existing ? ({ ...existing, ...input } as RelationDbResult) : null;
      }
    ),
    deleteRelation: vi.fn(
      async (_ws: string, relationId: string) =>
        relationRows.find(row => row.id === relationId) ?? null
    )
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
    createAuditLog: vi.fn(async (input: AuditLogDbCreate) => {
      const auditLog = {
        ...input,
        id: `audit-${input.entity_id}`,
        user_display_name: 'Test User'
      } as AuditLogDbResult;
      createdAuditLogs.push(auditLog);
      return auditLog;
    })
  },
  jobs: {
    enqueueOneOffRun: vi.fn(async (input: { job_type: string; payload: Record<string, unknown> }) => {
      queuedAuditJobs.push(input);
      return input;
    })
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
    expect(queuedAuditJobs.at(-1)).toMatchObject({
      job_type: 'audit.fanout',
      payload: { auditLogId: createdAuditLogs.at(-1)?.id }
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
    expect(queuedAuditJobs.at(-1)).toMatchObject({
      job_type: 'audit.fanout',
      payload: { auditLogId: createdAuditLogs.at(-1)?.id }
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

    it('fails closed for entity values and typed relation edges when schemas are missing', async () => {
      const originalListSchemas = db.catalog.listSchemas;
      db.catalog.listSchemas = async () => [];
      try {
        const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
        const queryEntities = tools.find(tool => tool.name === 'query_entities');
        const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');
        const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');
        const listRelations = tools.find(tool => tool.name === 'list_relations');

        const query = await queryEntities!.execute?.({ query: '1000000' });
        expect(query).toMatchObject({ total: 0, entities: [] });

        const details = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });
        expect(details).toMatchObject({
          found: true,
          entity: { data: {}, outgoingTypedRelations: [], incomingTypedRelations: [] }
        });

        const graph = await traverseRelations!.execute?.({
          entityId: 'entity-app-4',
          depth: 1,
          direction: 'outgoing'
        });
        expect(graph).toMatchObject({ nodes: [{ id: 'entity-app-4' }], edges: [] });

        const relations = await listRelations!.execute?.({});
        expect(relations).toMatchObject({ total: 0, items: [] });
      } finally {
        db.catalog.listSchemas = originalListSchemas;
      }
    });

    it('fails closed when a missing endpoint is paired with a known unbound endpoint', async () => {
      const knownUnboundSchema = {
        ...schemas[0]!,
        id: 'known-unbound',
        name: 'Known unbound endpoint',
        fields: [],
        groups: []
      };
      const missingEndpoint = {
        ...entities[0]!,
        id: 'entity-missing-schema',
        schema_id: 'missing'
      };
      const knownUnboundEndpoint = {
        ...entities[1]!,
        id: 'entity-known-unbound',
        schema_id: knownUnboundSchema.id
      };
      const relation = {
        ...relationRows[0]!,
        id: 'relation-missing-endpoint-schema',
        in_entity_id: missingEndpoint.id,
        in_entity_name: missingEndpoint.name,
        out_entity_id: knownUnboundEndpoint.id,
        out_entity_name: knownUnboundEndpoint.name
      };
      const originalListSchemas = db.catalog.listSchemas;
      entities.push(missingEndpoint, knownUnboundEndpoint);
      relationRows.push(relation);
      db.catalog.listSchemas = async () => [...schemas, knownUnboundSchema];

      try {
        const tools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
        const listRelations = tools.find(tool => tool.name === 'list_relations');
        const getRelation = tools.find(tool => tool.name === 'get_relation');

        expect(await listRelations!.execute?.({})).toMatchObject({ total: 0, items: [] });
        await expect(getRelation!.execute?.({ relationId: relation.id })).rejects.toThrow(
          `Relation '${relation.id}' not found`
        );
      } finally {
        db.catalog.listSchemas = originalListSchemas;
        relationRows.splice(relationRows.indexOf(relation), 1);
        entities.splice(entities.indexOf(missingEndpoint), 1);
        entities.splice(entities.indexOf(knownUnboundEndpoint), 1);
      }
    });

    it('fails closed in entity details when a visible target schema is missing', async () => {
      const originalListSchemas = db.catalog.listSchemas;
      db.catalog.listSchemas = async () => schemas.filter(schema => schema.id !== 'capability');

      try {
        const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
        const getEntityDetails = tools.find(tool => tool.name === 'get_entity_details');

        const result = await getEntityDetails!.execute?.({ entityId: 'entity-app-4' });

        expect(result).toMatchObject({
          found: true,
          entity: { outgoingTypedRelations: [] }
        });
      } finally {
        db.catalog.listSchemas = originalListSchemas;
      }
    });

    it('fails closed in outgoing traversal when a visible target schema is missing', async () => {
      const relation = {
        ...relationRows[0]!,
        id: 'relation-missing-outgoing-endpoint-schema',
        in_entity_id: 'entity-app-3',
        in_entity_name: 'Orphan Service',
        out_entity_id: 'entity-cap-2',
        out_entity_name: 'Card Network'
      };
      const originalListSchemas = db.catalog.listSchemas;
      relationRows.push(relation);
      db.catalog.listSchemas = async () => schemas.filter(schema => schema.id !== 'capability');

      try {
        const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
        const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

        const result = await traverseRelations!.execute?.({
          entityId: 'entity-app-3',
          depth: 1,
          direction: 'outgoing'
        });

        expect(result).toMatchObject({ entityId: 'entity-app-3', edges: [] });
        expect((result as { nodes: { id: string }[] }).nodes.map(node => node.id)).toEqual([
          'entity-app-3'
        ]);
        expect(JSON.stringify(result)).not.toContain('entity-cap-2');
      } finally {
        db.catalog.listSchemas = originalListSchemas;
        relationRows.splice(relationRows.indexOf(relation), 1);
      }
    });

    it('fails closed in incoming traversal when a visible source schema is missing', async () => {
      const relation = {
        ...relationRows[0]!,
        id: 'relation-missing-incoming-endpoint-schema',
        in_entity_id: 'entity-app-3',
        in_entity_name: 'Orphan Service',
        out_entity_id: 'entity-cap-2',
        out_entity_name: 'Card Network'
      };
      const originalListSchemas = db.catalog.listSchemas;
      relationRows.push(relation);
      db.catalog.listSchemas = async () => schemas.filter(schema => schema.id !== 'application');

      try {
        const tools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
        const traverseRelations = tools.find(tool => tool.name === 'traverse_relations');

        const result = await traverseRelations!.execute?.({
          entityId: 'entity-cap-2',
          depth: 1,
          direction: 'incoming'
        });

        expect((result as { nodes: { id: string }[] }).nodes.map(node => node.id)).not.toContain(
          'entity-app-3'
        );
        expect(
          (result as { edges: { sourceId: string; targetId: string; kind: string }[] }).edges
        ).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourceId: 'entity-app-3',
              targetId: 'entity-cap-2',
              kind: 'typed'
            })
          ])
        );
        expect(JSON.stringify(result)).not.toContain('entity-app-3');
      } finally {
        db.catalog.listSchemas = originalListSchemas;
        relationRows.splice(relationRows.indexOf(relation), 1);
      }
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

  describe('typed relation owner field restriction', () => {
    it('filters standalone typed relation reads by owner access and endpoint visibility', async () => {
      const restrictedTools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const restrictedList = restrictedTools.find(tool => tool.name === 'list_relations');
      const restrictedGet = restrictedTools.find(tool => tool.name === 'get_relation');

      await expect(restrictedList!.execute?.({})).resolves.toEqual({ total: 0, items: [] });
      await expect(restrictedGet!.execute?.({ relationId: 'relation-1' })).rejects.toThrow(
        "Relation 'relation-1' not found"
      );

      const authorizedTools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const authorizedList = authorizedTools.find(tool => tool.name === 'list_relations');
      const authorizedGet = authorizedTools.find(tool => tool.name === 'get_relation');

      await expect(authorizedList!.execute?.({})).resolves.toMatchObject({
        total: 1,
        items: [
          {
            _uid: 'relation-1',
            inEntityId: 'entity-app-4',
            outEntityId: 'entity-cap-1',
            fields: { secret: 'restricted relation value' }
          }
        ]
      });
      await expect(authorizedGet!.execute?.({ relationId: 'relation-1' })).resolves.toMatchObject({
        _uid: 'relation-1',
        inEntityId: 'entity-app-4',
        outEntityId: 'entity-cap-1',
        fields: { secret: 'restricted relation value' }
      });
    });

    it('filters typed relations in entity details and traversal by endpoint direction', async () => {
      const restrictedTools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const restrictedDetails = restrictedTools.find(tool => tool.name === 'get_entity_details');
      const restrictedTraverse = restrictedTools.find(tool => tool.name === 'traverse_relations');

      const details = await restrictedDetails!.execute?.({ entityId: 'entity-app-4' });
      expect(details).toMatchObject({
        entity: { incomingTypedRelations: [], outgoingTypedRelations: [] }
      });

      const graph = await restrictedTraverse!.execute?.({
        entityId: 'entity-app-4',
        direction: 'outgoing',
        depth: 1
      });
      expect(graph).toMatchObject({ entityId: 'entity-app-4', edges: [] });
      expect((graph as { nodes: { id: string }[] }).nodes.map(node => node.id)).toEqual([
        'entity-app-4'
      ]);

      const authorizedTools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const authorizedDetails = authorizedTools.find(tool => tool.name === 'get_entity_details');
      const authorizedTraverse = authorizedTools.find(tool => tool.name === 'traverse_relations');

      await expect(
        authorizedDetails!.execute?.({ entityId: 'entity-app-4' })
      ).resolves.toMatchObject({
        entity: {
          outgoingTypedRelations: [
            {
              relationId: 'relation-1',
              target: { id: 'entity-cap-1' },
              fields: { secret: 'restricted relation value' }
            }
          ]
        }
      });
      await expect(
        authorizedTraverse!.execute?.({ entityId: 'entity-app-4', direction: 'outgoing', depth: 1 })
      ).resolves.toMatchObject({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: 'entity-app-4' }),
          expect.objectContaining({ id: 'entity-cap-1' })
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            sourceId: 'entity-app-4',
            targetId: 'entity-cap-1',
            kind: 'typed'
          })
        ])
      });
    });

    it('requires owner-field edit access for typed relation mutations', async () => {
      const restrictedTools = createAiChatTools(db, 'ws-1', restrictedCallerAuthCtx, actor);
      const restrictedCreate = restrictedTools.find(tool => tool.name === 'create_relation');
      const restrictedUpdate = restrictedTools.find(tool => tool.name === 'update_relation');
      const restrictedDelete = restrictedTools.find(tool => tool.name === 'delete_relation');

      await expect(
        restrictedCreate!.execute?.({
          schemaId: 'rel-1',
          inEntityId: 'entity-app-4',
          outEntityId: 'entity-cap-1'
        })
      ).rejects.toThrow(/owner fields/i);
      await expect(
        restrictedUpdate!.execute?.({ relationId: 'relation-1', fields: {} })
      ).rejects.toThrow(/owner fields/i);
      await expect(restrictedDelete!.execute?.({ relationId: 'relation-1' })).rejects.toThrow(
        /owner fields/i
      );

      const authorizedTools = createAiChatTools(db, 'ws-1', financeCallerAuthCtx, actor);
      const authorizedCreate = authorizedTools.find(tool => tool.name === 'create_relation');
      const authorizedUpdate = authorizedTools.find(tool => tool.name === 'update_relation');
      const authorizedDelete = authorizedTools.find(tool => tool.name === 'delete_relation');

      await expect(
        authorizedCreate!.execute?.({
          schemaId: 'rel-1',
          inEntityId: 'entity-app-4',
          outEntityId: 'entity-cap-1'
        })
      ).resolves.toMatchObject({ schemaId: 'rel-1' });
      await expect(
        authorizedUpdate!.execute?.({ relationId: 'relation-1', fields: {} })
      ).resolves.toMatchObject({ _uid: 'relation-1' });
      await expect(authorizedDelete!.execute?.({ relationId: 'relation-1' })).resolves.toEqual({
        success: true
      });
    });
  });
});
