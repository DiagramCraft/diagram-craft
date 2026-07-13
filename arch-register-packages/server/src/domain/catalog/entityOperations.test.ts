import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { AssessmentDbResult, AssessmentResponseDbResult } from '../project/db/projectDatabase';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { countEntities, listEntities } from './entityOperations';

const now = new Date('2026-06-29T12:00:00.000Z');

const makeEntity = (index: number): EntityDbResult => ({
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
  visibility_mode: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service'
});

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: now,
  updated_at: now
};

const makeDb = (entities: EntityDbResult[]) => {
  const listEntitiesPaginated = vi.fn(
    async (_workspace: string, _filters?: unknown, pagination?: { limit?: number; offset?: number }) =>
      entities.slice(
        pagination?.offset ?? 0,
        (pagination?.offset ?? 0) + (pagination?.limit ?? entities.length)
      )
  );

  return {
    catalog: {
      listSchemas: vi.fn(async () => [schema]),
      listEntitiesPaginated,
      listEntities: vi.fn(async () => entities)
    },
    project: {
      listProjectEntities: vi.fn(async () => [])
    }
  } as unknown as DatabaseAdapter;
};

describe('listEntities', () => {
  it('uses paginated catalog reads to satisfy offset and limit requests', async () => {
    const entities = Array.from({ length: 201 }, (_, index) => makeEntity(index));
    const db = makeDb(entities);

    const result = await listEntities(db, 'ws-1', null, {
      view: 'summary',
      limit: 1,
      offset: 200
    });

    expect(result).toHaveLength(1);
    expect(result[0]?._uid).toBe('entity-200');
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(1, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 0
    });
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(2, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 200
    });
  });

  it('continues paging until the final partial page is exhausted', async () => {
    const entities = Array.from({ length: 250 }, (_, index) => makeEntity(index));
    const db = makeDb(entities);

    const result = await listEntities(db, 'ws-1', null, {
      view: 'summary'
    });

    expect(result).toHaveLength(250);
    expect(db.catalog.listEntitiesPaginated).toHaveBeenCalledTimes(2);
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(1, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 0
    });
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(2, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 200
    });
  });
});

describe('countEntities', () => {
  it('returns the total number of matching entities without slicing', async () => {
    const entities = Array.from({ length: 47 }, (_, index) => makeEntity(index));
    const db = makeDb(entities);

    const total = await countEntities(db, 'ws-1', null, {
    });

    expect(total).toBe(47);
  });
});

describe('listEntities with asOf', () => {
  const makeAsOfDb = (
    snapshots: Array<{
      entity_id: string;
      status: 'autosave' | 'saved_version' | 'future_update' | 'applied' | 'deleted';
      created_at: Date;
      target_date?: string | null;
      base_state: Record<string, unknown>;
      proposed_state?: Record<string, unknown> | null;
    }>,
    projectLinks: Array<{ entity_id: string; created_at: Date }> = []
  ) => {
    const listSnapshotsAsOf = vi.fn(
      async (_workspace: string, asOf: Date, entityIds?: string[]) =>
        snapshots
          .filter(s => (entityIds ? entityIds.includes(s.entity_id) : true))
          .filter(s =>
            s.status === 'future_update'
              ? s.target_date != null && new Date(s.target_date) <= asOf && s.created_at <= asOf
              : s.created_at <= asOf
          )
          .map((s, i) => ({
            id: `snap-${i}`,
            workspace: 'ws-1',
            project_id: null,
            commit_message: null,
            created_by: 'user-1',
            created_by_name: 'User',
            target_date: s.target_date ?? null,
            proposed_state: s.proposed_state ?? null,
            ...s
          }))
          .sort(
            (a, b) => a.entity_id.localeCompare(b.entity_id) || a.created_at.getTime() - b.created_at.getTime()
          )
    );

    return {
      catalog: {
        listSchemas: vi.fn(async () => [schema]),
        listSnapshotsAsOf,
        listEntityIdsWithAnySnapshot: vi.fn(async () => []),
        getEntity: vi.fn(async () => null)
      },
      project: {
        listProjectEntities: vi.fn(async () => []),
        listProjectEntityLinks: vi.fn(async () => projectLinks)
      },
      workspace: {
        listTeams: vi.fn(async () => []),
        listLifecycleStates: vi.fn(async () => [])
      }
    } as unknown as DatabaseAdapter;
  };

  it('excludes entities linked to the project after the selected asOf date', async () => {
    const db = makeAsOfDb(
      [
        {
          entity_id: 'entity-1',
          status: 'autosave',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          base_state: { id: 'entity-1', name: 'Early Link', schema_id: 'schema-1', data: {} }
        },
        {
          entity_id: 'entity-2',
          status: 'autosave',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          base_state: { id: 'entity-2', name: 'Late Link', schema_id: 'schema-1', data: {} }
        }
      ],
      [
        { entity_id: 'entity-1', created_at: new Date('2026-01-05T00:00:00.000Z') },
        { entity_id: 'entity-2', created_at: new Date('2026-03-01T00:00:00.000Z') }
      ]
    );

    const result = await listEntities(db, 'ws-1', null, {
      projectId: 'proj-1',
      projectScope: 'project',
      asOf: new Date('2026-02-01T00:00:00.000Z')
    });

    expect(result.map(r => r._uid)).toEqual(['entity-1']);
  });
});

describe('listEntities / countEntities with joined assessment', () => {
  const assessment: AssessmentDbResult = {
    id: 'assessment-1',
    workspace: 'ws-1',
    project_id: 'proj-1',
    name: 'Security review',
    description: '',
    status: 'open',
    scope: ['schema-1'],
    scope_conditions: [],
    fields: [
      { id: 'rating1', label: 'Rating', requirementLevel: 'required', type: 'rating' },
      { id: 'enum1', label: 'Enum', requirementLevel: 'optional', type: 'enum', enumId: 'e1' }
    ],
    created_at: now,
    updated_at: now
  };

  const permissiveAuthCtx = buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: ['global_admin'],
    workspaceRole: null,
    schemas: [],
    entities: [],
    grants: []
  });

  const restrictedAuthCtx = buildAuthorizationContext({
    userId: 'user-2',
    globalRoles: [],
    workspaceRole: null,
    schemas: [],
    entities: [],
    grants: []
  });

  const makeAssessmentDb = (
    entities: EntityDbResult[],
    responses: AssessmentResponseDbResult[],
    options: { assessment?: AssessmentDbResult | null } = {}
  ) => {
    const listAssessmentResponses = vi.fn(async () => responses);
    const listEntitiesPaginated = vi.fn(
      async (_workspace: string, _filters?: unknown, pagination?: { limit?: number; offset?: number }) =>
        entities.slice(
          pagination?.offset ?? 0,
          (pagination?.offset ?? 0) + (pagination?.limit ?? entities.length)
        )
    );
    return {
      catalog: {
        listSchemas: vi.fn(async () => [schema]),
        listEntitiesPaginated,
        listEntities: vi.fn(async () => entities)
      },
      project: {
        listProjectEntities: vi.fn(async () => []),
        getAssessmentById: vi.fn(async () => (options.assessment === undefined ? assessment : options.assessment)),
        getProject: vi.fn(async () => ({ id: 'proj-1', workspace: 'ws-1', owner: 'team-1' })),
        listAssessmentResponses
      }
    } as unknown as DatabaseAdapter;
  };

  it('never narrows the entity list when joined without assessment conditions', async () => {
    const entities = [makeEntity(1), makeEntity(2)];
    const db = makeAssessmentDb(entities, [{ id: 'r1', workspace: 'ws-1', assessment_id: 'assessment-1', entity_id: 'entity-1', values: { rating1: 5 }, created_at: now, updated_at: now, updated_by: null, updated_by_name: null }]);

    const result = await listEntities(db, 'ws-1', null, { assessmentId: 'assessment-1' });

    expect(result).toHaveLength(2);
    expect(db.project.listAssessmentResponses).not.toHaveBeenCalled();
  });

  it('matches presence has/has-not conditions', async () => {
    const entities = [makeEntity(1), makeEntity(2)];
    const responses: AssessmentResponseDbResult[] = [
      { id: 'r1', workspace: 'ws-1', assessment_id: 'assessment-1', entity_id: 'entity-1', values: { rating1: 5 }, created_at: now, updated_at: now, updated_by: null, updated_by_name: null }
    ];
    const db = makeAssessmentDb(entities, responses);

    const has = await listEntities(db, 'ws-1', null, {
      assessmentId: 'assessment-1',
      conditions: [{ fieldId: '_assessment', op: 'not_empty', value: undefined }]
    });
    expect(has.map(r => r._uid)).toEqual(['entity-1']);

    const hasNot = await listEntities(db, 'ws-1', null, {
      assessmentId: 'assessment-1',
      conditions: [{ fieldId: '_assessment', op: 'empty', value: undefined }]
    });
    expect(hasNot.map(r => r._uid)).toEqual(['entity-2']);

    expect(db.project.listAssessmentResponses).toHaveBeenCalledTimes(2);
  });

  it('matches rating conditions with inclusive gte/lte bounds and fails entities without a response', async () => {
    const entities = [makeEntity(1), makeEntity(2), makeEntity(3)];
    const responses: AssessmentResponseDbResult[] = [
      { id: 'r1', workspace: 'ws-1', assessment_id: 'assessment-1', entity_id: 'entity-1', values: { rating1: 3 }, created_at: now, updated_at: now, updated_by: null, updated_by_name: null },
      { id: 'r2', workspace: 'ws-1', assessment_id: 'assessment-1', entity_id: 'entity-2', values: { rating1: 5 }, created_at: now, updated_at: now, updated_by: null, updated_by_name: null }
    ];
    const db = makeAssessmentDb(entities, responses);

    const result = await listEntities(db, 'ws-1', null, {
      assessmentId: 'assessment-1',
      conditions: [
        { fieldId: '_assessment:rating1', op: 'gte', value: 3 },
        { fieldId: '_assessment:rating1', op: 'lte', value: 4 }
      ]
    });

    expect(result.map(r => r._uid)).toEqual(['entity-1']);
  });

  it('keeps pagination and count consistent under assessment filters', async () => {
    const entities = Array.from({ length: 10 }, (_, i) => makeEntity(i + 1));
    const responses: AssessmentResponseDbResult[] = entities
      .filter((_, i) => i % 2 === 0)
      .map((e, i) => ({
        id: `r${i}`,
        workspace: 'ws-1',
        assessment_id: 'assessment-1',
        entity_id: e.id,
        values: { rating1: 5 },
        created_at: now,
        updated_at: now,
        updated_by: null, updated_by_name: null
      }));
    const conditions = [{ fieldId: '_assessment', op: 'not_empty' as const, value: undefined }];

    const listDb = makeAssessmentDb(entities, responses);
    const list = await listEntities(listDb, 'ws-1', null, { assessmentId: 'assessment-1', conditions });

    const countDb = makeAssessmentDb(entities, responses);
    const total = await countEntities(countDb, 'ws-1', null, { assessmentId: 'assessment-1', conditions });

    expect(list).toHaveLength(5);
    expect(total).toBe(5);
    expect(listDb.project.listAssessmentResponses).toHaveBeenCalledTimes(1);
    expect(countDb.project.listAssessmentResponses).toHaveBeenCalledTimes(1);
  });

  it('rejects assessment conditions without an assessmentId', async () => {
    const db = makeAssessmentDb([makeEntity(1)], []);
    await expect(
      listEntities(db, 'ws-1', null, {
        conditions: [{ fieldId: '_assessment', op: 'not_empty', value: undefined }]
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an unknown assessment with 404', async () => {
    const db = makeAssessmentDb([makeEntity(1)], [], { assessment: null });
    await expect(
      listEntities(db, 'ws-1', null, {
        assessmentId: 'missing',
        conditions: [{ fieldId: '_assessment', op: 'not_empty', value: undefined }]
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects joining an assessment in a project the caller cannot access', async () => {
    const db = makeAssessmentDb([makeEntity(1)], []);
    await expect(
      listEntities(db, 'ws-1', restrictedAuthCtx, {
        assessmentId: 'assessment-1',
        conditions: [{ fieldId: '_assessment', op: 'not_empty', value: undefined }]
      })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows the join when the caller can access the assessment project', async () => {
    const entities = [makeEntity(1)];
    const responses: AssessmentResponseDbResult[] = [
      { id: 'r1', workspace: 'ws-1', assessment_id: 'assessment-1', entity_id: 'entity-1', values: { rating1: 5 }, created_at: now, updated_at: now, updated_by: null, updated_by_name: null }
    ];
    const db = makeAssessmentDb(entities, responses);
    const result = await listEntities(db, 'ws-1', permissiveAuthCtx, {
      assessmentId: 'assessment-1',
      conditions: [{ fieldId: '_assessment', op: 'not_empty', value: undefined }]
    });
    expect(result.map(r => r._uid)).toEqual(['entity-1']);
  });
});
