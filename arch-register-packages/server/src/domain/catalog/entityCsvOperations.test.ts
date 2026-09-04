import { buildAuthorizationContext, type AuthorizationContext } from '@arch-register/permissions';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { matchesFilterCondition } from './dataHelpers';
import { downloadEntityImportTemplate, exportEntitiesCsv } from './entityCsvOperations';

const adminContext: AuthorizationContext = {
  userId: 'user-1',
  globalRoles: new Set(['global_admin']),
  globalPermissions: new Set(['admin_platform']),
  workspaceRole: null,
  workspaceRoles: new Map(),
  teamIds: new Set(),
  teamAssignments: [],
  teamRolesByTeam: new Map(),
  teams: [],
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

const now = new Date('2026-07-23T12:00:00.000Z');

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [{ id: 'criticality', name: 'Criticality', type: 'text' }],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const makeEntity = (index: number, overrides: Partial<EntityDbResult> = {}): EntityDbResult => ({
  id: `entity-${index}`,
  workspace: 'ws-1',
  public_id: `ENT-${index}`,
  slug: `entity-${String(index).padStart(3, '0')}`,
  namespace: 'default',
  name: `Entity ${String(index).padStart(3, '0')}`,
  description: `Description ${index}`,
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service',
  completeness: 0,
  ...overrides
});

const makeDb = (entities: EntityDbResult[]) => {
  // Mimics the real DB layer's SQL-level filtering of schemaId/owner/lifecycle/conditions, which
  // `listEntitiesPaginated` normally applies before returning a page.
  const listEntitiesPaginated = vi.fn(
    async (
      _workspace: string,
      filters?: {
        schemaId?: string | null;
        owner?: string | null;
        lifecycle?: string | null;
        conditions?: FilterCondition[];
      },
      pagination?: { limit?: number; offset?: number }
    ) => {
      const filtered = entities.filter(entity => {
        if (filters?.schemaId && entity.schema_id !== filters.schemaId) return false;
        if (filters?.owner && entity.owner !== filters.owner) return false;
        if (filters?.lifecycle && entity.lifecycle !== filters.lifecycle) return false;
        return (filters?.conditions ?? []).every(condition =>
          matchesFilterCondition(entity, condition, entity.completeness)
        );
      });
      return filtered.slice(
        pagination?.offset ?? 0,
        (pagination?.offset ?? 0) + (pagination?.limit ?? filtered.length)
      );
    }
  );

  return {
    core: { driver: 'sqlite' },
    catalog: {
      listSchemas: vi.fn(async () => [schema]),
      listEntitiesPaginated,
      runCompiledEntityQuery: vi.fn(async () => []),
      runCompiledEntityCountQuery: vi.fn(async () => entities.length)
    },
    project: {
      projectEntities: {
        listProjectEntities: vi.fn(async () => [])
      }
    },
    view: {
      listCollectionEntityIds: vi.fn(async () => [])
    },
    relation: {
      listRelationSchemas: vi.fn(async () => [])
    }
  } as unknown as DatabaseAdapter;
};

describe('exportEntitiesCsv', () => {
  it('only exports entities matching structured conditions, not just schema/owner/lifecycle/q', async () => {
    const entities = [
      makeEntity(1, { name: 'Payments API', data: { criticality: 'high' } }),
      makeEntity(2, { name: 'Reporting API', data: { criticality: 'low' } })
    ];
    const db = makeDb(entities);

    const response = await exportEntitiesCsv(
      db,
      'ws-1',
      adminContext,
      {
        conditions: [{ fieldId: 'criticality', op: 'equals', value: 'high' }]
      },
      now
    );

    const csv = await response.body.text();
    expect(csv).toContain('Payments API');
    expect(csv).not.toContain('Reporting API');
  });

  it('routes a structured entityQuery IR through the compiled-SQL execution path', async () => {
    const db = makeDb([]);
    const runCompiledEntityQuery = vi.mocked(db.catalog.runCompiledEntityQuery);
    runCompiledEntityQuery.mockResolvedValue([
      { ...makeEntity(1, { name: 'Payments API' }), projections: {} }
    ]);

    const response = await exportEntitiesCsv(
      db,
      'ws-1',
      adminContext,
      {
        entityQuery: { root: { kind: 'freeText', value: 'Payments' } }
      },
      now
    );

    expect(runCompiledEntityQuery).toHaveBeenCalled();
    const csv = await response.body.text();
    expect(csv).toContain('Payments API');
  });

  it('omits a restricted field-group column for a caller without view access, and includes it for one with view access', async () => {
    const restrictedSchema: SchemaDbResult = {
      ...schema,
      fields: [
        { id: 'criticality', name: 'Criticality', type: 'text' },
        { id: 'secretPlan', name: 'Secret Plan', type: 'text', groupId: 'restricted' }
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    } as never;
    const entities = [
      makeEntity(1, {
        name: 'Payments API',
        data: { criticality: 'high', secretPlan: 'top secret' }
      })
    ];
    const db = {
      ...makeDb(entities),
      catalog: { ...makeDb(entities).catalog, listSchemas: vi.fn(async () => [restrictedSchema]) }
    } as unknown as DatabaseAdapter;

    const restrictedContext = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: 'viewer',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });
    const viewerContext = buildAuthorizationContext({
      userId: 'user-3',
      globalRoles: [],
      workspaceRole: 'viewer',
      teamAssignments: [{ teamId: 'team-restricted', role: 'team_reviewer' }],
      schemas: [],
      entities: [],
      grants: []
    });

    const restrictedResponse = await exportEntitiesCsv(
      db,
      'ws-1',
      restrictedContext,
      { schemaId: 'schema-1' },
      now
    );
    const restrictedCsv = await restrictedResponse.body.text();
    expect(restrictedCsv).not.toContain('top secret');
    expect(restrictedCsv.split('\n')[0]).not.toContain('Secret Plan');

    const viewerResponse = await exportEntitiesCsv(
      db,
      'ws-1',
      viewerContext,
      { schemaId: 'schema-1' },
      now
    );
    const viewerCsv = await viewerResponse.body.text();
    expect(viewerCsv).toContain('top secret');
    expect(viewerCsv.split('\n')[0]).toContain('Secret Plan');
  });

  it('exports a typedRelation column as a joined summary of related entity names', async () => {
    const typedRelationSchema: SchemaDbResult = {
      ...schema,
      fields: [
        { id: 'criticality', name: 'Criticality', type: 'text' },
        {
          id: 'deps',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId: 'rel-1',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        } as never
      ]
    };
    const targetSchema: SchemaDbResult = {
      ...schema,
      id: 'schema-2',
      name: 'Database',
      fields: []
    };
    const entities = [
      makeEntity(1, { name: 'Payments API' }),
      makeEntity(2, {
        name: 'Database',
        schema_id: targetSchema.id,
        schema_name: targetSchema.name
      })
    ];
    const base = makeDb(entities);
    const db = {
      ...base,
      catalog: {
        ...base.catalog,
        listSchemas: vi.fn(async () => [typedRelationSchema, targetSchema])
      },
      relation: {
        listRelationSchemas: vi.fn(async () => []),
        listRelations: vi.fn(async () => ({
          items: [
            {
              id: 'rel-row-1',
              out_entity_id: 'entity-1',
              in_entity_id: 'entity-2',
              in_entity_name: 'Database'
            }
          ],
          total: 1
        }))
      }
    } as unknown as DatabaseAdapter;

    const response = await exportEntitiesCsv(
      db,
      'ws-1',
      adminContext,
      { schemaId: 'schema-1' },
      now
    );
    const csv = await response.body.text();
    expect(csv.split('\n')[0]).toContain('Depends on');
    expect(csv).toContain('Database');
  });

  it('omits typed-relation values when an endpoint schema is missing', async () => {
    const typedRelationSchema: SchemaDbResult = {
      ...schema,
      fields: [
        {
          id: 'deps',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId: 'rel-1',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        } as never
      ]
    };
    const targetSchema: SchemaDbResult = {
      ...schema,
      id: 'schema-2',
      name: 'Database',
      fields: []
    };
    const entities = [
      makeEntity(1, { name: 'Payments API' }),
      makeEntity(2, {
        name: 'Database',
        schema_id: targetSchema.id,
        schema_name: targetSchema.name
      })
    ];
    const base = makeDb(entities);
    const db = {
      ...base,
      catalog: {
        ...base.catalog,
        // Keep the target entity row available, but make its schema unavailable to mirror a
        // dangling historical relation endpoint.
        listSchemas: vi.fn(async () => [typedRelationSchema])
      },
      relation: {
        listRelationSchemas: vi.fn(async () => []),
        listRelations: vi.fn(async () => ({
          items: [
            {
              id: 'rel-row-1',
              out_entity_id: 'entity-1',
              in_entity_id: 'entity-2',
              in_entity_name: 'Database',
              owner: null
            }
          ],
          total: 1
        }))
      }
    } as unknown as DatabaseAdapter;

    const response = await exportEntitiesCsv(
      db,
      'ws-1',
      adminContext,
      { schemaId: 'schema-1' },
      now
    );
    const csv = await response.body.text();

    expect(csv.split('\n')[0]).toContain('Depends on');
    expect(csv).not.toContain('Database');
  });

  it('omits a typed-relation column when its owner field is restricted', async () => {
    const restrictedTypedRelationSchema: SchemaDbResult = {
      ...schema,
      fields: [
        {
          id: 'deps',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId: 'rel-1',
          direction: 'out',
          minCount: 0,
          maxCount: -1,
          groupId: 'restricted'
        } as never
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    } as never;
    const base = makeDb([makeEntity(1, { name: 'Payments API' })]);
    const db = {
      ...base,
      catalog: {
        ...base.catalog,
        listSchemas: vi.fn(async () => [restrictedTypedRelationSchema])
      }
    } as unknown as DatabaseAdapter;
    const restrictedContext = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: 'viewer',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const response = await exportEntitiesCsv(
      db,
      'ws-1',
      restrictedContext,
      { schemaId: 'schema-1' },
      now
    );
    const csv = await response.body.text();

    expect(csv.split('\n')[0]).not.toContain('Depends on');
  });
});

describe('downloadEntityImportTemplate', () => {
  it('builds the template outside the transport handler', async () => {
    const getSchema = vi.fn().mockResolvedValue({
      id: 'application',
      name: 'Business Application',
      fields: [{ id: 'criticality', name: 'Criticality', type: 'text' }]
    });
    const db = { catalog: { getSchema } } as unknown as DatabaseAdapter;

    const response = await downloadEntityImportTemplate(
      db,
      'workspace-1',
      adminContext,
      'application'
    );

    expect(getSchema).toHaveBeenCalledWith('workspace-1', 'application');
    expect(response.headers['content-disposition']).toContain(
      'business-application-import-template.csv'
    );
    expect(await response.body.text()).toContain('"Criticality"');
  });

  it('omits a restricted field-group column from the import template', async () => {
    const getSchema = vi.fn().mockResolvedValue({
      id: 'application',
      name: 'Business Application',
      fields: [
        { id: 'criticality', name: 'Criticality', type: 'text' },
        { id: 'secretPlan', name: 'Secret Plan', type: 'text', groupId: 'restricted' }
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    });
    const db = { catalog: { getSchema } } as unknown as DatabaseAdapter;

    const restrictedContext = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: 'viewer',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const response = await downloadEntityImportTemplate(
      db,
      'workspace-1',
      restrictedContext,
      'application'
    );

    const csv = await response.body.text();
    expect(csv).toContain('"Criticality"');
    expect(csv).not.toContain('Secret Plan');
  });
});
