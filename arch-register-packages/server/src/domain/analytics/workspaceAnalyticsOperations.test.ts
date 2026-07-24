import { describe, expect, it } from 'vitest';
import { computeActivityTrend, computeWorkspaceAnalytics } from './workspaceAnalyticsOperations';
import { computeEntityCompleteness } from '../../utils/completeness';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { LifecycleStateDbResult } from '../workspace/db/workspaceDatabase';
import type { AuditLogDbResult } from '../audit/db/auditDatabase';

const now = new Date('2026-01-01T00:00:00.000Z');

const schemas: SchemaDbResult[] = [
  {
    id: 'schema-service',
    workspace: 'default',
    name: 'Service',
    description: '',
    fields: [{ id: 'runbook', name: 'Runbook', type: 'text', requirementLevel: 'required' }],
    color: '#123',
    icon: null,
    default_owner: null,
    key_prefix: 'SRV',
    created_at: now,
    updated_at: now
  },
  {
    id: 'schema-team',
    workspace: 'default',
    name: 'Team',
    description: '',
    fields: [],
    color: '#456',
    icon: null,
    default_owner: null,
    key_prefix: 'TEM',
    created_at: now,
    updated_at: now
  }
];

const lifecycleStates: LifecycleStateDbResult[] = [
  {
    id: 'proposed',
    workspace: 'default',
    label: 'Proposed',
    color: '#aaa',
    sort_order: 0,
    created_at: now
  },
  {
    id: 'production',
    workspace: 'default',
    label: 'Production',
    color: '#0f0',
    sort_order: 1,
    created_at: now
  }
];

const makeEntity = (overrides: Partial<EntityDbResult>): EntityDbResult => {
  const merged = {
    id: 'e-1',
    workspace: 'default',
    public_id: 'SRV-1',
    slug: 'entity-1',
    namespace: '',
    name: 'Entity 1',
    description: 'desc',
    owner: 'team-a',
    lifecycle: 'production',
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: 'schema-service',
    data: { runbook: 'https://runbook' },
    project_id: null,
    created_at: now,
    updated_at: now,
    owner_name: 'Platform',
    lifecycle_label: 'Production',
    target_lifecycle_label: null,
    schema_name: 'Service',
    ...overrides
  };
  // Analytics now reads the materialized `completeness` column rather than recomputing it, so the
  // fixture must carry a value consistent with the merged fields above (same logic production
  // write paths run at entity-write time).
  return { ...merged, completeness: computeEntityCompleteness(merged, schemas[0]!) };
};

const makeAuditRow = (overrides: Partial<AuditLogDbResult>): AuditLogDbResult => ({
  id: 'audit-1',
  workspace: 'default',
  timestamp: new Date('2026-01-01T12:00:00.000Z'),
  user_id: null,
  user_display_name: null,
  operation: 'create',
  entity_type: 'entity',
  entity_id: 'entity-1',
  entity_name: 'Entity 1',
  entity_slug: 'entity-1',
  schema_id: 'schema-service',
  changes: {},
  metadata: {},
  ...overrides
});

describe('computeWorkspaceAnalytics', () => {
  it('aggregates lifecycle, ownership, completeness, and zero-entity schemas', () => {
    const entities: EntityDbResult[] = [
      makeEntity({ id: 'svc-1', public_id: 'SRV-1' }),
      makeEntity({
        id: 'svc-2',
        public_id: 'SRV-2',
        name: 'Entity 2',
        owner: null,
        owner_name: null,
        lifecycle: 'proposed',
        lifecycle_label: 'Proposed',
        description: '',
        data: { runbook: '' }
      }),
      makeEntity({
        id: 'svc-3',
        public_id: 'SRV-3',
        name: 'Entity 3',
        owner: null,
        owner_name: null,
        lifecycle: null,
        lifecycle_label: null
      })
    ];

    const analytics = computeWorkspaceAnalytics(entities, schemas, lifecycleStates);

    expect(analytics.summary).toEqual({
      totalEntities: 3,
      percentWithOwner: 33.3,
      percentCompleteness80Plus: 33.3
    });

    expect(analytics.lifecycleBreakdown).toEqual([
      { lifecycleId: 'proposed', label: 'Proposed', color: '#aaa', count: 1, percent: 33.3 },
      {
        lifecycleId: 'production',
        label: 'Production',
        color: '#0f0',
        count: 1,
        percent: 33.3
      },
      { lifecycleId: null, label: 'Unassigned', color: null, count: 1, percent: 33.3 }
    ]);

    expect(analytics.coverage[0]).toMatchObject({
      schemaId: 'schema-service',
      totalCount: 3
    });
    expect(analytics.coverage[1]).toMatchObject({
      schemaId: 'schema-team',
      totalCount: 0
    });

    expect(analytics.ownershipGaps[0]).toMatchObject({
      schemaId: 'schema-service',
      missingOwnerCount: 2,
      missingOwnerPercent: 66.7
    });

    expect(analytics.completeness[0]).toMatchObject({
      schemaId: 'schema-service',
      below50Count: 1,
      between50And79Count: 1,
      above80Count: 1
    });

    expect(analytics.schemaUtilization).toEqual([
      { schemaId: 'schema-service', schemaName: 'Service', count: 3 },
      { schemaId: 'schema-team', schemaName: 'Team', count: 0 }
    ]);
  });

  it('returns empty percentages when there are no entities', () => {
    const analytics = computeWorkspaceAnalytics([], schemas, lifecycleStates);

    expect(analytics.summary).toEqual({
      totalEntities: 0,
      percentWithOwner: 0,
      percentCompleteness80Plus: 0
    });
    expect(analytics.lifecycleBreakdown.at(-1)).toEqual({
      lifecycleId: null,
      label: 'Unassigned',
      color: null,
      count: 0,
      percent: 0
    });
  });

  it('builds zero-filled UTC activity buckets from entity creates and updates only', () => {
    const trend = computeActivityTrend(
      [
        makeAuditRow({ timestamp: new Date('2025-12-30T23:59:59.000Z'), operation: 'create' }),
        makeAuditRow({
          id: 'audit-2',
          timestamp: new Date('2025-12-31T00:00:00.000Z'),
          operation: 'update'
        }),
        makeAuditRow({
          id: 'audit-3',
          timestamp: new Date('2026-01-01T20:00:00.000Z'),
          operation: 'create'
        }),
        makeAuditRow({ id: 'audit-4', operation: 'delete' }),
        makeAuditRow({ id: 'audit-5', entity_type: 'project' })
      ],
      3,
      new Date('2026-01-01T23:00:00.000Z')
    );

    expect(trend).toEqual([
      {
        date: '2025-12-30',
        startDate: '2025-12-30T00:00:00.000Z',
        endDate: '2025-12-30T23:59:59.999Z',
        created: 1,
        updated: 0
      },
      {
        date: '2025-12-31',
        startDate: '2025-12-31T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.999Z',
        created: 0,
        updated: 1
      },
      {
        date: '2026-01-01',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-01T23:59:59.999Z',
        created: 1,
        updated: 0
      }
    ]);
  });

  it('reports stale entities by schema using a strict updated-at cutoff', () => {
    const analytics = computeWorkspaceAnalytics(
      [
        makeEntity({ id: 'old-service', updated_at: new Date('2025-09-30T00:00:00.000Z') }),
        makeEntity({
          id: 'at-cutoff-service',
          updated_at: new Date('2025-10-03T00:00:00.000Z')
        }),
        makeEntity({
          id: 'old-team',
          schema_id: 'schema-team',
          schema_name: 'Team',
          updated_at: new Date('2025-09-01T00:00:00.000Z')
        })
      ],
      schemas,
      lifecycleStates,
      90,
      [],
      new Date('2026-01-01T00:00:00.000Z')
    );

    expect(analytics.stale).toEqual({
      thresholdDays: 90,
      cutoffAt: '2025-10-03T00:00:00.000Z',
      totalCount: 2,
      percent: 66.7,
      schemas: [
        {
          schemaId: 'schema-service',
          schemaName: 'Service',
          totalCount: 2,
          staleCount: 1,
          stalePercent: 50
        },
        {
          schemaId: 'schema-team',
          schemaName: 'Team',
          totalCount: 1,
          staleCount: 1,
          stalePercent: 100
        }
      ]
    });
  });
});
