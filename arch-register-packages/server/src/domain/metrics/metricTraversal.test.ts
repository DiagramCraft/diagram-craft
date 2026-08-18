import { describe, expect, it, vi } from 'vitest';
import type { MetricConfig } from '@arch-register/api-types/metricContract';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from '../catalog/db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import { collectMetricTerminals } from './metricTraversal';

const now = new Date('2026-01-01T00:00:00.000Z');

const entity = (id: string, schemaId: string, data: Record<string, unknown> = {}): EntityDbResult =>
  ({
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
    schema_id: schemaId,
    data,
    project_id: null,
    created_at: now,
    updated_at: now,
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: schemaId,
    completeness: 0
  }) as EntityDbResult;

const schema = (id: string, fields: SchemaDbResult['fields']): SchemaDbResult =>
  ({
    id,
    workspace: 'ws-1',
    name: id,
    description: '',
    fields,
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.toUpperCase(),
    created_at: now,
    updated_at: now
  }) as SchemaDbResult;

const relationSchema: RelationSchemaDbResult = {
  id: 'system-contract',
  workspace: 'ws-1',
  name: 'System Contract',
  description: '',
  in_schema_ids: ['system'],
  out_schema_ids: ['contract'],
  fields: [],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now
};

const fieldlessRelationSchema: RelationSchemaDbResult = {
  ...relationSchema,
  id: 'system-contract-fieldless',
  name: 'System Contract (fieldless)',
  fields: []
};

const selfLoopRelationSchema: RelationSchemaDbResult = {
  ...relationSchema,
  id: 'system-links',
  name: 'System Links',
  in_schema_ids: ['system'],
  out_schema_ids: ['system'],
  fields: []
};

const relation = (
  id: string,
  inEntityId: string,
  outEntityId: string,
  schemaId = relationSchema.id,
  schemaName = relationSchema.name
): RelationDbResult =>
  ({
    id,
    workspace: 'ws-1',
    schema_id: schemaId,
    schema_name: schemaName,
    in_entity_id: inEntityId,
    in_entity_name: inEntityId,
    out_entity_id: outEntityId,
    out_entity_name: outEntityId,
    data: {},
    owner: null,
    owner_name: null,
    lifecycle: null,
    lifecycle_label: null,
    version: 1,
    approval_policy_override: null,
    created_at: now,
    updated_at: now
  }) as RelationDbResult;

const makeDb = (relations: RelationDbResult[]) =>
  ({
    relation: {
      listRelationsForEntities: vi.fn(async (_workspace: string, ids: string[]) => ({
        outgoing: relations.filter(row => ids.includes(row.in_entity_id)),
        incoming: relations.filter(row => ids.includes(row.out_entity_id))
      }))
    }
  }) as unknown as DatabaseAdapter;

const path = [
  {
    kind: 'relation' as const,
    fieldId: 'domain',
    direction: 'backward' as const,
    ownerSchemaId: 'system'
  },
  {
    kind: 'typedRelation' as const,
    fieldId: 'contracts',
    relationSchemaId: relationSchema.id,
    direction: 'in' as const
  }
];

describe('collectMetricTerminals', () => {
  const entities = [
    entity('d1', 'domain'),
    entity('s1', 'system', { domain: 'd1' }),
    entity('s2', 'system', { domain: 'd1' }),
    entity('c1', 'contract', { cost: 10 })
  ];
  const schemas = [
    schema('domain', []),
    schema('system', [
      {
        id: 'domain',
        name: 'Domain',
        type: 'containment',
        schemaId: 'domain',
        minCount: 0,
        maxCount: 1,
        requirementLevel: 'optional'
      },
      {
        id: 'contracts',
        name: 'Contracts',
        type: 'typedRelation',
        relationSchemaId: relationSchema.id,
        direction: 'in',
        minCount: 0,
        maxCount: -1,
        requirementLevel: 'optional'
      }
    ]),
    schema('contract', [{ id: 'cost', name: 'Cost', type: 'number', requirementLevel: 'optional' }])
  ];
  const relations = [relation('r1', 's1', 'c1'), relation('r2', 's2', 'c1')];

  it('follows containment and typed relations, then deduplicates repeated entities', async () => {
    const metric: MetricConfig = {
      sourceSchemaId: 'contract',
      path,
      source: { kind: 'field', fieldId: 'cost' },
      aggregation: 'sum'
    };
    const results = await collectMetricTerminals({
      db: makeDb(relations),
      workspace: 'ws-1',
      boxEntityIds: ['d1'],
      metric,
      entities,
      schemas,
      relationSchemas: [relationSchema],
      authCtx: null
    });

    expect(results.get('d1')).toMatchObject({
      terminals: [{ kind: 'entity', entity: { id: 'c1' } }],
      duplicateCount: 1
    });
  });

  it('supports the typed-relation suffix for a System box', async () => {
    const metric: MetricConfig = {
      sourceSchemaId: 'contract',
      path: [path[1]!],
      source: { kind: 'field', fieldId: 'cost' },
      aggregation: 'sum'
    };
    const results = await collectMetricTerminals({
      db: makeDb(relations),
      workspace: 'ws-1',
      boxEntityIds: ['s1'],
      metric,
      entities,
      schemas,
      relationSchemas: [relationSchema],
      authCtx: null
    });

    expect(results.get('s1')).toMatchObject({
      terminals: [{ kind: 'entity', entity: { id: 'c1' } }],
      duplicateCount: 0
    });
  });

  it('can aggregate typed relation instances as the terminal source', async () => {
    const metric: MetricConfig = {
      sourceSchemaId: relationSchema.id,
      sourceContext: 'relation',
      path,
      source: { kind: 'lifecycle' },
      aggregation: 'count'
    };
    const results = await collectMetricTerminals({
      db: makeDb(relations),
      workspace: 'ws-1',
      boxEntityIds: ['d1'],
      metric,
      entities,
      schemas,
      relationSchemas: [relationSchema],
      authCtx: null
    });

    expect(results.get('d1')).toMatchObject({ duplicateCount: 0 });
    expect(results.get('d1')?.terminals).toHaveLength(2);
    expect(results.get('d1')?.terminals[0]).toMatchObject({
      kind: 'relation',
      relation: { id: 'r1' }
    });
  });

  it('follows a field-less typed relation with endpoint constraints', async () => {
    const metric: MetricConfig = {
      sourceSchemaId: 'contract',
      path: [
        {
          kind: 'unboundTypedRelation',
          relationSchemaId: fieldlessRelationSchema.id,
          direction: 'in'
        }
      ],
      source: { kind: 'lifecycle' },
      aggregation: 'count'
    };
    const results = await collectMetricTerminals({
      db: makeDb([
        relation(
          'r-fieldless',
          's1',
          'c1',
          fieldlessRelationSchema.id,
          fieldlessRelationSchema.name
        )
      ]),
      workspace: 'ws-1',
      boxEntityIds: ['s1'],
      metric,
      entities,
      schemas,
      relationSchemas: [fieldlessRelationSchema],
      authCtx: null
    });
    expect(results.get('s1')?.terminals).toEqual([{ kind: 'entity', entity: entities[3] }]);
  });

  it('traverses both directions of a field-less self-loop once per relation', async () => {
    const selfLoopRows = [
      relation('r-link-1', 's1', 's2', selfLoopRelationSchema.id, selfLoopRelationSchema.name)
    ];
    const metric: MetricConfig = {
      sourceSchemaId: 'system',
      path: [
        {
          kind: 'unboundTypedRelation',
          relationSchemaId: selfLoopRelationSchema.id,
          direction: 'both'
        }
      ],
      source: { kind: 'lifecycle' },
      aggregation: 'count'
    };
    const results = await collectMetricTerminals({
      db: makeDb(selfLoopRows),
      workspace: 'ws-1',
      boxEntityIds: ['s1'],
      metric,
      entities: [...entities, entity('s2', 'system')],
      schemas,
      relationSchemas: [selfLoopRelationSchema],
      authCtx: null
    });
    expect(results.get('s1')?.terminals).toMatchObject([{ kind: 'entity', entity: { id: 's2' } }]);
  });
});
