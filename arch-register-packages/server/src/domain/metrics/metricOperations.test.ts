import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { LifecycleStateDbResult } from '../workspace/db/workspaceDatabase';
import type { AssessmentDbResult, AssessmentResponseDbResult } from '../project/db/projectDatabase';
import type { MetricConfig } from '@arch-register/api-types/metricContract';
import { computeBoxMetrics, getBoxMetrics } from './metricOperations';

const now = new Date('2026-01-01T00:00:00.000Z');

const domainSchema: SchemaDbResult = {
  id: 'domain',
  workspace: 'ws-1',
  name: 'Domain',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'DOM',
  created_at: now,
  updated_at: now
};

const serviceSchema: SchemaDbResult = {
  id: 'service',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [
    {
      id: 'parent',
      name: 'Parent',
      type: 'containment',
      schemaId: 'domain',
      minCount: 0,
      maxCount: 1,
      requirementLevel: 'optional'
    },
    { id: 'score', name: 'Score', type: 'number', requirementLevel: 'optional' },
    { id: 'tier', name: 'Tier', type: 'select', enumId: 'enum-tier', requirementLevel: 'optional' }
  ],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const schemas = [domainSchema, serviceSchema];

const tierEnumOptions = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' }
];

const lifecycleStates: LifecycleStateDbResult[] = [
  {
    id: 'proposed',
    workspace: 'ws-1',
    label: 'Proposed',
    color: '#aaa',
    sort_order: 0,
    created_at: now
  },
  {
    id: 'production',
    workspace: 'ws-1',
    label: 'Production',
    color: '#0f0',
    sort_order: 1,
    created_at: now
  },
  {
    id: 'deprecated',
    workspace: 'ws-1',
    label: 'Deprecated',
    color: '#f00',
    sort_order: 2,
    created_at: now
  }
];

const makeService = (
  id: string,
  parentId: string,
  overrides: Partial<EntityDbResult> = {}
): EntityDbResult => ({
  id,
  workspace: 'ws-1',
  public_id: id.toUpperCase(),
  slug: id,
  namespace: '',
  name: id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'service',
  data: { parent: parentId },
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

const makeDomain = (id: string, overrides: Partial<EntityDbResult> = {}): EntityDbResult => ({
  id,
  workspace: 'ws-1',
  public_id: id.toUpperCase(),
  slug: id,
  namespace: '',
  name: id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'domain',
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Domain',
  completeness: 0,
  ...overrides
});

const numericMetric: MetricConfig = {
  sourceSchemaId: 'service',
  source: { kind: 'field', fieldId: 'score' },
  aggregation: 'sum'
};

const alwaysMatch = () => true;

describe('computeBoxMetrics', () => {
  it('returns a null value and zero counts for a box with no descendants', () => {
    const d1 = makeDomain('d1');
    const result = computeBoxMetrics(
      ['d1'],
      numericMetric,
      [d1],
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results).toEqual([
      {
        boxEntityId: 'd1',
        value: null,
        lifecycleId: null,
        dominantValue: null,
        dominantLabel: null,
        distribution: [],
        sourceCount: 0,
        populatedCount: 0
      }
    ]);
    expect(result.legend).toEqual({ min: null, max: null });
  });

  it('aggregates a partial subtree, ignoring missing field values', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 } }),
      makeService('s2', 'd1', { data: { parent: 'd1' } }), // missing score
      makeService('s3', 'd1', { data: { parent: 'd1', score: 5 } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      numericMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({
      value: 15,
      sourceCount: 3,
      populatedCount: 2
    });
  });

  it('aggregates a deep subtree through an intermediate schema level', () => {
    const groupSchema: SchemaDbResult = {
      ...domainSchema,
      id: 'group',
      fields: [
        {
          id: 'parent',
          name: 'Parent',
          type: 'containment',
          schemaId: 'domain',
          minCount: 0,
          maxCount: 1,
          requirementLevel: 'optional'
        }
      ]
    };
    const entities = [
      makeDomain('d1'),
      { ...makeDomain('g1'), schema_id: 'group', data: { parent: 'd1' } },
      makeService('s1', 'g1', { data: { parent: 'g1', score: 7 } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      numericMetric,
      entities,
      [domainSchema, groupSchema, serviceSchema],
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({ value: 7, sourceCount: 1, populatedCount: 1 });
  });

  it('count aggregation counts source entities regardless of field population', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', score: 5 } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      { ...numericMetric, aggregation: 'count' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({ value: 2, sourceCount: 2, populatedCount: 2 });
  });

  it('average divides only over populated values', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 } }),
      makeService('s2', 'd1', { data: { parent: 'd1', score: 20 } }),
      makeService('s3', 'd1', { data: { parent: 'd1' } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      { ...numericMetric, aggregation: 'average' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]?.value).toBe(15);
  });

  it('worst picks the lowest value when direction is "low"', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 } }),
      makeService('s2', 'd1', { data: { parent: 'd1', score: 3 } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      { ...numericMetric, aggregation: 'worst', worstDirection: 'low' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]?.value).toBe(3);
  });

  it('worst picks the highest value when direction is "high"', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 } }),
      makeService('s2', 'd1', { data: { parent: 'd1', score: 3 } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      { ...numericMetric, aggregation: 'worst', worstDirection: 'high' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]?.value).toBe(10);
  });

  it('lifecycle source ranks by sort_order and reports the winning lifecycle id', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { lifecycle: 'production' }),
      makeService('s2', 'd1', { lifecycle: 'deprecated' }),
      makeService('s3', 'd1', { lifecycle: null }) // unassigned, ignored
    ];
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'lifecycle' },
      aggregation: 'worst',
      worstDirection: 'high'
    };
    const result = computeBoxMetrics(
      ['d1'],
      metric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({
      value: 2,
      lifecycleId: 'deprecated',
      sourceCount: 3,
      populatedCount: 2
    });
  });

  it('assessment-rating source reads from the responses map and ignores unpopulated entities', () => {
    const entities = [makeDomain('d1'), makeService('s1', 'd1'), makeService('s2', 'd1')];
    const responsesByEntity = new Map<string, Record<string, string | number>>([
      ['s1', { rating1: 4 }]
    ]);
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'assessmentRating', fieldId: 'rating1' },
      aggregation: 'average'
    };
    const result = computeBoxMetrics(
      ['d1'],
      metric,
      entities,
      schemas,
      lifecycleStates,
      responsesByEntity,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({ value: 4, sourceCount: 2, populatedCount: 1 });
  });

  it('treats a missing responses map (no joined assessment) as entirely unpopulated', () => {
    const entities = [makeDomain('d1'), makeService('s1', 'd1')];
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'assessmentRating', fieldId: 'rating1' },
      aggregation: 'average'
    };
    const result = computeBoxMetrics(
      ['d1'],
      metric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({ value: null, sourceCount: 1, populatedCount: 0 });
  });

  it('excludes entities missing from the entity pool, as if permission-filtered out', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 } })
      // s2 deliberately omitted, simulating a caller that already dropped an inaccessible entity
    ];
    const result = computeBoxMetrics(
      ['d1'],
      numericMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.results[0]).toMatchObject({ value: 10, sourceCount: 1, populatedCount: 1 });
  });

  it('excludes descendants that fail the current filter predicate from aggregation', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 }, owner: 'team-a' }),
      makeService('s2', 'd1', { data: { parent: 'd1', score: 20 }, owner: 'team-b' })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      numericMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      entity => entity.owner === 'team-a'
    );
    expect(result.results[0]).toMatchObject({ value: 10, sourceCount: 1, populatedCount: 1 });
  });

  it('computes legend min/max across all requested boxes, ignoring nulls', () => {
    const entities = [
      makeDomain('d1'),
      makeDomain('d2'),
      makeDomain('d3'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10 } }),
      makeService('s2', 'd2', { data: { parent: 'd2', score: 50 } })
      // d3 has no descendants -> null value, excluded from legend
    ];
    const result = computeBoxMetrics(
      ['d1', 'd2', 'd3'],
      numericMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch
    );
    expect(result.legend).toEqual({ min: 10, max: 50 });
  });
});

describe('computeBoxMetrics - enum sources', () => {
  const enumMetric: MetricConfig = {
    sourceSchemaId: 'service',
    source: { kind: 'enum', fieldId: 'tier' },
    aggregation: 'count'
  };

  it('picks the dominant option with a clear majority and reports the full distribution', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s3', 'd1', { data: { parent: 'd1', tier: 'silver' } }),
      makeService('s4', 'd1', { data: { parent: 'd1' } }) // unpopulated, ignored
    ];
    const result = computeBoxMetrics(
      ['d1'],
      enumMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]).toMatchObject({
      value: 4,
      sourceCount: 4,
      populatedCount: 3,
      dominantValue: 'gold',
      dominantLabel: 'Gold'
    });
    expect(result.results[0]?.distribution).toEqual(
      expect.arrayContaining([
        { value: 'gold', label: 'Gold', count: 2 },
        { value: 'silver', label: 'Silver', count: 1 }
      ])
    );
    expect(result.results[0]?.distribution).toHaveLength(2);
  });

  it('breaks an exact tie deterministically toward the option listed first in the enum', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'bronze' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    // bronze and silver are tied at 1 each; silver is listed before bronze in tierEnumOptions.
    const result = computeBoxMetrics(
      ['d1'],
      enumMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]?.dominantValue).toBe('silver');
  });

  it('is deterministic across repeated calls regardless of insertion order', () => {
    const entitiesA = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'bronze' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    const entitiesB = [
      makeDomain('d1'),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } }),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'bronze' } })
    ];
    const resultA = computeBoxMetrics(
      ['d1'],
      enumMetric,
      entitiesA,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    const resultB = computeBoxMetrics(
      ['d1'],
      enumMetric,
      entitiesB,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(resultA.results[0]?.dominantValue).toBe(resultB.results[0]?.dominantValue);
    expect(resultA.results[0]?.dominantValue).toBe('silver');
  });

  it('returns a null dominant option when there is no populated data', () => {
    const entities = [makeDomain('d1'), makeService('s1', 'd1', { data: { parent: 'd1' } })];
    const result = computeBoxMetrics(
      ['d1'],
      enumMetric,
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]).toMatchObject({
      dominantValue: null,
      dominantLabel: null,
      distribution: []
    });
  });

  it('worst picks the first-listed populated option when direction is "low"', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } }),
      makeService('s3', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    // tierEnumOptions order is gold, silver, bronze; "low" means the first-listed option
    // (gold) is worst, even though it's not the most common value.
    const result = computeBoxMetrics(
      ['d1'],
      { ...enumMetric, aggregation: 'worst', worstDirection: 'low' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]).toMatchObject({ dominantValue: 'gold', dominantLabel: 'Gold' });
  });

  it('worst picks the last-listed populated option when direction is "high"', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    // "high" means the last-listed option present (silver) is worst.
    const result = computeBoxMetrics(
      ['d1'],
      { ...enumMetric, aggregation: 'worst', worstDirection: 'high' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]).toMatchObject({ dominantValue: 'silver', dominantLabel: 'Silver' });
  });

  it('worst ignores values not present in the enum options', () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'unknown-tier' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    const result = computeBoxMetrics(
      ['d1'],
      { ...enumMetric, aggregation: 'worst', worstDirection: 'high' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]).toMatchObject({ dominantValue: 'silver', dominantLabel: 'Silver' });
  });

  it('worst returns a null dominant option when there is no populated data', () => {
    const entities = [makeDomain('d1'), makeService('s1', 'd1', { data: { parent: 'd1' } })];
    const result = computeBoxMetrics(
      ['d1'],
      { ...enumMetric, aggregation: 'worst', worstDirection: 'high' },
      entities,
      schemas,
      lifecycleStates,
      null,
      alwaysMatch,
      tierEnumOptions
    );
    expect(result.results[0]).toMatchObject({ dominantValue: null, dominantLabel: null });
  });

  it('aggregates an assessment-enum source from the joined responses map', () => {
    const entities = [makeDomain('d1'), makeService('s1', 'd1'), makeService('s2', 'd1')];
    const responsesByEntity = new Map<string, Record<string, string | number>>([
      ['s1', { risk: 'high' }],
      ['s2', { risk: 'high' }]
    ]);
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'assessmentEnum', fieldId: 'risk' },
      aggregation: 'count'
    };
    const riskOptions = [
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' }
    ];
    const result = computeBoxMetrics(
      ['d1'],
      metric,
      entities,
      schemas,
      lifecycleStates,
      responsesByEntity,
      alwaysMatch,
      riskOptions
    );
    expect(result.results[0]).toMatchObject({
      dominantValue: 'high',
      dominantLabel: 'High',
      populatedCount: 2
    });
  });
});

describe('getBoxMetrics', () => {
  const permissiveAuthCtx = buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: ['global_admin'],
    workspaceRole: null,
    schemas: [],
    entities: [],
    grants: []
  });

  const noRoleAuthCtx = buildAuthorizationContext({
    userId: 'user-2',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: [{ teamId: 'team-visible', role: 'team_admin' }],
    teams: [],
    schemas: [],
    entities: [],
    grants: []
  });

  const makeDb = (
    entities: EntityDbResult[],
    options: {
      assessment?: AssessmentDbResult | null;
      responses?: AssessmentResponseDbResult[];
      enums?: Record<string, { value: string; label: string }[]>;
    } = {}
  ) => {
    const listEntitiesPaginated = vi.fn(
      async (
        _workspace: string,
        _filters?: unknown,
        pagination?: { limit?: number; offset?: number }
      ) =>
        entities.slice(
          pagination?.offset ?? 0,
          (pagination?.offset ?? 0) + (pagination?.limit ?? entities.length)
        )
    );
    return {
      core: { driver: 'sqlite' },
      catalog: {
        listSchemas: vi.fn(async () => schemas),
        listEntitiesPaginated,
        // Real filtering is exercised end-to-end by the contract-test suite
        // (`entityQueryIRCompiler.contract.test.ts`/`seededEntityQuery.contract.test.ts`); here
        // this stands in for the compiled-SQL result set, returning every entity by default and
        // overridden per test (via `vi.mocked(db.catalog.runCompiledEntityQuery).mockResolvedValue`)
        // wherever a test asserts on which entities the query actually matched.
        runCompiledEntityQuery: vi.fn(async () =>
          entities.map(entity => ({ ...entity, projections: {} }))
        ),
        getEnum: vi.fn(async (_workspace: string, id: string) => {
          const enumOptions = options.enums?.[id];
          return enumOptions
            ? {
                id,
                workspace: 'ws-1',
                name: id,
                options: enumOptions,
                sort_order: 0,
                created_at: now,
                updated_at: now
              }
            : null;
        })
      },
      workspace: {
        listLifecycleStates: vi.fn(async () => lifecycleStates)
      },
      project: {
        listProjectEntities: vi.fn(async () => []),
        getAssessmentById: vi.fn(async () => options.assessment ?? null),
        getProject: vi.fn(async () => ({ id: 'proj-1', workspace: 'ws-1', owner: 'team-1' })),
        listAssessmentResponses: vi.fn(async () => options.responses ?? [])
      }
    } as unknown as DatabaseAdapter;
  };

  it('rejects worst aggregation without a worstDirection', async () => {
    const db = makeDb([makeDomain('d1')]);
    await expect(
      getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
        boxEntityIds: ['d1'],
        metric: { ...numericMetric, aggregation: 'worst' }
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an assessment-rating metric when no assessment is joined', async () => {
    const db = makeDb([makeDomain('d1')]);
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'assessmentRating', fieldId: 'rating1' },
      aggregation: 'average'
    };
    await expect(
      getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
        boxEntityIds: ['d1'],
        metric
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('excludes entities the caller cannot view from the aggregation', async () => {
    const entities = [
      makeDomain('d1', { owner: 'team-visible' }),
      makeService('s1', 'd1', {
        data: { parent: 'd1', score: 10 },
        owner: 'team-visible'
      }),
      makeService('s2', 'd1', {
        data: { parent: 'd1', score: 100 }
      })
    ];
    const db = makeDb(entities);

    const result = await getBoxMetrics(db, 'ws-1', noRoleAuthCtx, {
      boxEntityIds: ['d1'],
      metric: numericMetric
    });

    expect(result.results[0]).toMatchObject({ value: 10, sourceCount: 1, populatedCount: 1 });
  });

  it('applies the current browser filters (owner) to roll-up inputs', async () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', {
        data: { parent: 'd1', score: 10 },
        owner: 'team-a'
      }),
      makeService('s2', 'd1', {
        data: { parent: 'd1', score: 20 },
        owner: 'team-b'
      })
    ];
    const db = makeDb(entities);
    // The legacy `owner` filter is now folded into the compiled EntityQuery (see
    // `buildEntityQueryForExecution`) rather than applied in JS, so the compiled-SQL result set
    // is what determines the match set here — simulate what real SQL would return for `owner:
    // 'team-a'`.
    vi.mocked(db.catalog.runCompiledEntityQuery).mockResolvedValue(
      entities
        .filter(entity => entity.owner === 'team-a')
        .map(entity => ({ ...entity, projections: {} }))
    );

    const result = await getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
      boxEntityIds: ['d1'],
      metric: numericMetric,
      owner: 'team-a'
    });

    expect(result.results[0]).toMatchObject({ value: 10, sourceCount: 1, populatedCount: 1 });
  });

  it('routes an explicit entityQuery through the IR compiler', async () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', score: 10, tier: 'gold' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', score: 20, tier: 'silver' } })
    ];
    const db = makeDb(entities);
    vi.mocked(db.catalog.runCompiledEntityQuery).mockResolvedValue(
      entities
        .filter(entity => entity.data.tier === 'gold')
        .map(entity => ({ ...entity, projections: {} }))
    );

    const result = await getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
      boxEntityIds: ['d1'],
      metric: numericMetric,
      entityQuery: {
        root: { kind: 'predicate', path: [], fieldId: 'tier', op: 'equals', value: 'gold' }
      }
    });

    expect(result.results[0]).toMatchObject({ value: 10, sourceCount: 1, populatedCount: 1 });
  });

  it('rejects an entityQuery with an unknown fieldId with a 400', async () => {
    const db = makeDb([makeDomain('d1'), makeService('s1', 'd1', { data: { parent: 'd1' } })]);

    await expect(
      getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
        boxEntityIds: ['d1'],
        metric: numericMetric,
        entityQuery: {
          root: { kind: 'predicate', path: [], fieldId: 'notAField', op: 'equals', value: 'x' }
        }
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('combines an explicit entityQuery with legacy owner/conditions as an additional AND-gate', async () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', {
        data: { parent: 'd1', score: 10, tier: 'gold' },
        owner: 'team-a'
      }),
      makeService('s2', 'd1', {
        data: { parent: 'd1', score: 20, tier: 'gold' },
        owner: 'team-b'
      })
    ];
    const db = makeDb(entities);
    // buildEntityQueryForExecution ANDs the explicit entityQuery with owner/lifecycle/q, so the
    // compiled SQL is expected to already reflect both — simulate that combined result here.
    vi.mocked(db.catalog.runCompiledEntityQuery).mockResolvedValue(
      entities
        .filter(entity => entity.data.tier === 'gold' && entity.owner === 'team-a')
        .map(entity => ({ ...entity, projections: {} }))
    );

    const result = await getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
      boxEntityIds: ['d1'],
      metric: numericMetric,
      owner: 'team-a',
      entityQuery: {
        root: { kind: 'predicate', path: [], fieldId: 'tier', op: 'equals', value: 'gold' }
      }
    });

    expect(result.results[0]).toMatchObject({ value: 10, sourceCount: 1, populatedCount: 1 });
  });

  it('accepts a "worst" aggregation for an enum source', async () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    const db = makeDb(entities, { enums: { 'enum-tier': tierEnumOptions } });
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'enum', fieldId: 'tier' },
      aggregation: 'worst',
      worstDirection: 'high'
    };
    const result = await getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
      boxEntityIds: ['d1'],
      metric
    });
    expect(result.results[0]).toMatchObject({ dominantValue: 'silver', dominantLabel: 'Silver' });
  });

  it('rejects a non-count, non-worst aggregation for an enum source', async () => {
    const db = makeDb([makeDomain('d1')], { enums: { 'enum-tier': tierEnumOptions } });
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'enum', fieldId: 'tier' },
      aggregation: 'sum'
    };
    await expect(
      getBoxMetrics(db, 'ws-1', permissiveAuthCtx, { boxEntityIds: ['d1'], metric })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('resolves the enum options for a schema select field and computes the dominant option', async () => {
    const entities = [
      makeDomain('d1'),
      makeService('s1', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s2', 'd1', { data: { parent: 'd1', tier: 'gold' } }),
      makeService('s3', 'd1', { data: { parent: 'd1', tier: 'silver' } })
    ];
    const db = makeDb(entities, { enums: { 'enum-tier': tierEnumOptions } });
    const metric: MetricConfig = {
      sourceSchemaId: 'service',
      source: { kind: 'enum', fieldId: 'tier' },
      aggregation: 'count'
    };

    const result = await getBoxMetrics(db, 'ws-1', permissiveAuthCtx, {
      boxEntityIds: ['d1'],
      metric
    });

    expect(result.results[0]).toMatchObject({ dominantValue: 'gold', dominantLabel: 'Gold' });
    expect(result.legend.categories).toEqual(tierEnumOptions);
  });
});
