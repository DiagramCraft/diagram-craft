import type { AuthorizationContext } from '@arch-register/permissions';
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
      runCompiledEntityQuery: vi.fn(async () => [])
    },
    project: {
      listProjectEntities: vi.fn(async () => [])
    },
    view: {
      listCollectionEntityIds: vi.fn(async () => [])
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
});
