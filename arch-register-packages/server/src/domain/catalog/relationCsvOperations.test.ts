import { buildAuthorizationContext } from '@arch-register/permissions';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';

const collectRelationsFromIRMock = vi.hoisted(() => vi.fn());

vi.mock('./entityQueryOperations', async importActual => ({
  ...(await importActual<typeof import('./entityQueryOperations')>()),
  collectRelationsFromIR: collectRelationsFromIRMock
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async (_catalog: unknown, workspace: string) => workspace)
}));

vi.mock('../audit/db/auditLogging', async () => ({
  ...(await vi.importActual<typeof import('../audit/db/auditLogging')>('../audit/db/auditLogging')),
  logAudit: vi.fn(async () => {})
}));

const authorizationMocks = vi.hoisted(() => ({
  buildApiAuthCtx: vi.fn()
}));

vi.mock('../auth/authorization', async () => ({
  ...(await vi.importActual<typeof import('../auth/authorization')>('../auth/authorization')),
  buildApiAuthCtx: authorizationMocks.buildApiAuthCtx
}));

import {
  commitRelationsImport,
  downloadRelationImportTemplate,
  exportRelationsCsv,
  parseRelationsImport
} from './relationCsvOperations';

const now = new Date('2026-08-04T12:00:00.000Z');

const authCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: ['global_admin'],
  workspaceRole: null,
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const entitySchema: SchemaDbResult = {
  id: 'entity-schema',
  workspace: 'ws-1',
  name: 'Application',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'APP',
  created_at: now,
  updated_at: now
};

const makeEntity = (id: string): EntityDbResult =>
  ({
    id,
    workspace: 'ws-1',
    public_id: id,
    slug: id,
    namespace: 'default',
    name: id,
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    schema_id: entitySchema.id,
    data: {},
    project_id: null,
    created_at: now,
    updated_at: now,
    owner_name: null,
    lifecycle_label: null,
    target_lifecycle_label: null,
    schema_name: entitySchema.name,
    completeness: 0
  }) as EntityDbResult;

const makeRelationSchema = (
  id: string,
  name: string,
  fields: RelationSchemaDbResult['fields'] = []
): RelationSchemaDbResult => ({
  id,
  workspace: 'ws-1',
  name,
  description: '',
  in_schema_ids: [entitySchema.id],
  out_schema_ids: [entitySchema.id],
  fields,
  groups: [],
  shared_field_group_links: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  created_at: now,
  updated_at: now
});

const makeRelation = (
  schemaId: string,
  inEntityId: string,
  outEntityId: string,
  data: Record<string, unknown> = {}
): RelationDbResult => ({
  id: `${schemaId}-${inEntityId}-${outEntityId}`,
  workspace: 'ws-1',
  schema_id: schemaId,
  schema_name: schemaId,
  in_entity_id: inEntityId,
  in_entity_name: inEntityId,
  out_entity_id: outEntityId,
  out_entity_name: outEntityId,
  data,
  owner: null,
  owner_name: null,
  lifecycle: null,
  lifecycle_label: null,
  version: 1,
  approval_policy_override: null,
  created_at: now,
  updated_at: now
});

const event = {} as AuthenticatedEvent;
const eventForAuthCtx = () => {
  authorizationMocks.buildApiAuthCtx.mockResolvedValue(authCtx);
  return event;
};

type MockDb = DatabaseAdapter & {
  core: { transaction: ReturnType<typeof vi.fn> };
  relation: { createRelation: ReturnType<typeof vi.fn>; updateRelation: ReturnType<typeof vi.fn> };
};

const makeDb = ({
  relationSchemas,
  entities,
  existingRelations = []
}: {
  relationSchemas: RelationSchemaDbResult[];
  entities: EntityDbResult[];
  existingRelations?: RelationDbResult[];
}) => {
  const db = {
    core: {
      transaction: vi.fn(async (callback: (tx: DatabaseAdapter) => unknown) => callback(db))
    },
    catalog: {
      listSchemas: vi.fn(async () => [entitySchema]),
      listEntities: vi.fn(async () => entities),
      listEnums: vi.fn(async () => []),
      getEntity: vi.fn(
        async (_workspace: string, id: string) => entities.find(entity => entity.id === id) ?? null
      ),
      createEntityVersion: vi.fn(async () => ({})),
      pruneAutosaveVersions: vi.fn(async () => {})
    },
    relation: {
      listRelationSchemas: vi.fn(async () => relationSchemas),
      getRelationSchema: vi.fn(
        async (_workspace: string, id: string) =>
          relationSchemas.find(schema => schema.id === id) ?? null
      ),
      listRelations: vi.fn(async () => ({
        items: existingRelations,
        total: existingRelations.length
      })),
      getRelation: vi.fn(
        async (_workspace: string, id: string) =>
          existingRelations.find(relation => relation.id === id) ?? null
      ),
      createRelation: vi.fn(
        async (input: {
          id: string;
          schema_id: string;
          in_entity_id: string;
          out_entity_id: string;
        }) => makeRelation(input.schema_id, input.in_entity_id, input.out_entity_id)
      ),
      updateRelation: vi.fn(
        async (
          _ws: string,
          id: string,
          input: { version: number; data: Record<string, unknown> }
        ) => {
          const existing = existingRelations.find(relation => relation.id === id);
          return {
            ...(existing ?? makeRelation('relation-schema', 'in-1', 'out-1')),
            version: input.version,
            data: input.data,
            updated_at: now
          };
        }
      )
    }
  } as unknown as MockDb;
  return db;
};

describe('exportRelationsCsv', () => {
  it('exports relation fields when the result contains one relation type', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }
    ]);
    const relation = {
      _uid: 'relation-1',
      _schema: { id: relationSchema.id, name: relationSchema.name },
      _in: { id: 'in-1', name: 'In' },
      _out: { id: 'out-1', name: 'Out' },
      _version: 1,
      _createdAt: now.toISOString(),
      _updatedAt: now.toISOString(),
      canView: true,
      canEdit: true,
      canDelete: true,
      note: 'Important'
    };
    collectRelationsFromIRMock.mockResolvedValueOnce([relation]);

    const response = await exportRelationsCsv(
      makeDb({
        relationSchemas: [relationSchema],
        entities: [makeEntity('in-1'), makeEntity('out-1')]
      }),
      'ws-1',
      authCtx,
      { root_kind: 'relation', root: { kind: 'and', children: [] } },
      now
    );

    expect(await response.body.text()).toBe(
      '_schemaId;_inEntityId;_outEntityId;Note\nrelation-schema;in-1;out-1;Important'
    );
    expect(response.headers['content-disposition']).toContain('depends-on-2026-08-04.csv');
  });

  it('exports only relation identifiers when the result contains multiple types', async () => {
    const relationSchemas = [
      makeRelationSchema('relation-schema-1', 'Depends On', [
        { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }
      ]),
      makeRelationSchema('relation-schema-2', 'Owns', [
        { id: 'since', name: 'Since', type: 'date', requirementLevel: 'optional' }
      ])
    ];
    collectRelationsFromIRMock.mockResolvedValueOnce([
      {
        _schema: { id: 'relation-schema-1', name: 'Depends On' },
        _in: { id: 'in-1', name: 'In' },
        _out: { id: 'out-1', name: 'Out' }
      },
      {
        _schema: { id: 'relation-schema-2', name: 'Owns' },
        _in: { id: 'in-2', name: 'In 2' },
        _out: { id: 'out-2', name: 'Out 2' }
      }
    ]);

    const response = await exportRelationsCsv(
      makeDb({ relationSchemas, entities: [] }),
      'ws-1',
      authCtx,
      { root_kind: 'relation', root: { kind: 'and', children: [] } },
      now
    );

    const csv = await response.body.text();
    expect(csv.split('\n')[0]).toBe('_schemaId;_inEntityId;_outEntityId');
    expect(csv).not.toContain('Note');
    expect(csv).not.toContain('Since');
  });
});

describe('exportRelationsCsv — entityRelation fields', () => {
  it('resolves entity ids to names for entityRelation field values', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Data Flow', [
      {
        id: 'data',
        name: 'Data',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: 'entity-schema',
        minCount: 0,
        maxCount: -1
      }
    ]);
    const relation = {
      _uid: 'relation-1',
      _schema: { id: relationSchema.id, name: relationSchema.name },
      _in: { id: 'in-1', name: 'In' },
      _out: { id: 'out-1', name: 'Out' },
      _version: 1,
      _createdAt: now.toISOString(),
      _updatedAt: now.toISOString(),
      canView: true,
      canEdit: true,
      canDelete: true,
      data: ['data-1', 'data-2']
    };
    collectRelationsFromIRMock.mockResolvedValueOnce([relation]);

    const dataEntity1 = { ...makeEntity('data-1'), name: 'Address' };
    const dataEntity2 = { ...makeEntity('data-2'), name: 'Order' };

    const response = await exportRelationsCsv(
      makeDb({
        relationSchemas: [relationSchema],
        entities: [makeEntity('in-1'), makeEntity('out-1'), dataEntity1, dataEntity2]
      }),
      'ws-1',
      authCtx,
      { root_kind: 'relation', root: { kind: 'and', children: [] } },
      now
    );

    expect(await response.body.text()).toBe(
      '_schemaId;_inEntityId;_outEntityId;Data\nrelation-schema;in-1;out-1;Address, Order'
    );
  });
});

describe('parseRelationsImport', () => {
  it('parses typed relation fields and matches an existing natural key', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' },
      { id: 'weight', name: 'Weight', type: 'number', min: 1, max: 5, requirementLevel: 'optional' }
    ]);
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const existing = makeRelation('relation-schema', 'in-1', 'out-1', { note: 'Old' });
    const result = await parseRelationsImport(
      makeDb({ relationSchemas: [relationSchema], entities, existingRelations: [existing] }),
      'ws-1',
      authCtx,
      '_schemaId;_inEntityId;_outEntityId;Note;Weight\nrelation-schema;in-1;out-1;New;3'
    );

    expect(result.validRows).toBe(1);
    expect(result.relations[0]).toMatchObject({
      isUpdate: true,
      existingId: existing.id,
      matchType: 'natural-key',
      relation: {
        _schemaId: 'relation-schema',
        _inEntityId: 'in-1',
        _outEntityId: 'out-1',
        note: 'New',
        weight: 3
      }
    });
  });

  it('supports identifier-only rows from multiple relation types', async () => {
    const relationSchemas = [
      makeRelationSchema('relation-1', 'Depends On'),
      makeRelationSchema('relation-2', 'Owns')
    ];
    const result = await parseRelationsImport(
      makeDb({
        relationSchemas,
        entities: [makeEntity('in-1'), makeEntity('out-1'), makeEntity('in-2'), makeEntity('out-2')]
      }),
      'ws-1',
      authCtx,
      '_schemaId;_inEntityId;_outEntityId\nrelation-1;in-1;out-1\nrelation-2;in-2;out-2'
    );

    expect(result.validRows).toBe(2);
    expect(result.relations.every(row => row.errors.length === 0)).toBe(true);
  });

  it('reports invalid endpoints and field values as row errors', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'weight', name: 'Weight', type: 'number', min: 1, max: 5, requirementLevel: 'optional' }
    ]);
    const result = await parseRelationsImport(
      makeDb({ relationSchemas: [relationSchema], entities: [makeEntity('in-1')] }),
      'ws-1',
      authCtx,
      '_schemaId;_inEntityId;_outEntityId;Weight\nrelation-schema;in-1;missing;7'
    );

    expect(result.validRows).toBe(0);
    expect(result.relations[0]?.errors).toEqual(
      expect.arrayContaining(['Out endpoint entity was not found', 'Weight must be at most 5'])
    );
  });

  it('flags an existing relation that requires an approved change proposal', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On');
    relationSchema.relation_approval_policy = 'required';
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const existing = makeRelation('relation-schema', 'in-1', 'out-1');
    const result = await parseRelationsImport(
      makeDb({ relationSchemas: [relationSchema], entities, existingRelations: [existing] }),
      'ws-1',
      authCtx,
      '_schemaId;_inEntityId;_outEntityId\nrelation-schema;in-1;out-1'
    );

    expect(result.validRows).toBe(0);
    expect(result.relations[0]?.errors).toEqual(
      expect.arrayContaining([
        `Relation '${existing.id}' requires an approved change proposal before it can be edited`
      ])
    );
  });
});

describe('parseRelationsImport — entityRelation fields', () => {
  it('resolves entity names to ids for an entityRelation field', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Data Flow', [
      {
        id: 'data',
        name: 'Data',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: 'entity-schema',
        minCount: 0,
        maxCount: -1
      }
    ]);
    const dataEntity = { ...makeEntity('data-1'), name: 'Address' };
    const entities = [makeEntity('in-1'), makeEntity('out-1'), dataEntity];
    const result = await parseRelationsImport(
      makeDb({ relationSchemas: [relationSchema], entities }),
      'ws-1',
      authCtx,
      '_schemaId;_inEntityId;_outEntityId;Data\nrelation-schema;in-1;out-1;Address'
    );

    expect(result.validRows).toBe(1);
    expect(result.relations[0]?.relation).toMatchObject({ data: ['data-1'] });
  });

  it('reports an error when an entityRelation field references an unknown entity name', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Data Flow', [
      {
        id: 'data',
        name: 'Data',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: 'entity-schema',
        minCount: 0,
        maxCount: -1
      }
    ]);
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const result = await parseRelationsImport(
      makeDb({ relationSchemas: [relationSchema], entities }),
      'ws-1',
      authCtx,
      '_schemaId;_inEntityId;_outEntityId;Data\nrelation-schema;in-1;out-1;Unknown Entity'
    );

    expect(result.validRows).toBe(0);
    expect(result.relations[0]?.errors).toEqual(
      expect.arrayContaining(['Data references one or more unknown entities'])
    );
  });
});

describe('commitRelationsImport', () => {
  it('never gates creating a new relation, even under a required-approval schema', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On');
    relationSchema.relation_approval_policy = 'required';
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const db = makeDb({ relationSchemas: [relationSchema], entities });

    const result = await commitRelationsImport(db, 'ws-1', authCtx, eventForAuthCtx(), [
      { _schemaId: 'relation-schema', _inEntityId: 'in-1', _outEntityId: 'out-1' }
    ]);

    expect(result).toMatchObject({ created: 1, updated: 0 });
  });

  it('blocks updating an existing relation when the schema requires approval and there is no override', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }
    ]);
    relationSchema.relation_approval_policy = 'required';
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const existing = makeRelation('relation-schema', 'in-1', 'out-1');
    const db = makeDb({
      relationSchemas: [relationSchema],
      entities,
      existingRelations: [existing]
    });

    await expect(
      commitRelationsImport(db, 'ws-1', authCtx, eventForAuthCtx(), [
        { _schemaId: 'relation-schema', _inEntityId: 'in-1', _outEntityId: 'out-1', note: 'after' }
      ])
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining(
        `Relation '${existing.id}' requires an approved change proposal before it can be edited`
      )
    });
    expect(
      (db as unknown as { core: { transaction: ReturnType<typeof vi.fn> } }).core.transaction
    ).not.toHaveBeenCalled();
  });

  it('blocks updating an existing relation when an instance override requires approval despite a disabled schema policy', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On');
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const existing = makeRelation('relation-schema', 'in-1', 'out-1');
    existing.approval_policy_override = 'required';
    const db = makeDb({
      relationSchemas: [relationSchema],
      entities,
      existingRelations: [existing]
    });

    await expect(
      commitRelationsImport(db, 'ws-1', authCtx, eventForAuthCtx(), [
        { _schemaId: 'relation-schema', _inEntityId: 'in-1', _outEntityId: 'out-1' }
      ])
    ).rejects.toMatchObject({ status: 400 });
  });

  it('allows updating an existing relation when an instance override disables approval despite a required schema policy', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }
    ]);
    relationSchema.relation_approval_policy = 'required';
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const existing = makeRelation('relation-schema', 'in-1', 'out-1');
    existing.approval_policy_override = 'disabled';
    const db = makeDb({
      relationSchemas: [relationSchema],
      entities,
      existingRelations: [existing]
    });

    const result = await commitRelationsImport(db, 'ws-1', authCtx, eventForAuthCtx(), [
      { _schemaId: 'relation-schema', _inEntityId: 'in-1', _outEntityId: 'out-1', note: 'after' }
    ]);

    expect(result).toMatchObject({ created: 0, updated: 1 });
  });

  it('allows updating an existing relation under a disabled schema policy with no override', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }
    ]);
    const entities = [makeEntity('in-1'), makeEntity('out-1')];
    const existing = makeRelation('relation-schema', 'in-1', 'out-1');
    const db = makeDb({
      relationSchemas: [relationSchema],
      entities,
      existingRelations: [existing]
    });

    const result = await commitRelationsImport(db, 'ws-1', authCtx, eventForAuthCtx(), [
      { _schemaId: 'relation-schema', _inEntityId: 'in-1', _outEntityId: 'out-1', note: 'after' }
    ]);

    expect(result).toMatchObject({ created: 0, updated: 1 });
  });
});

describe('commitRelationsImport — entityRelation fields', () => {
  it('commits a resolved entityRelation array of ids from the parse-preview shape', async () => {
    const relationSchema = makeRelationSchema('relation-schema', 'Data Flow', [
      {
        id: 'data',
        name: 'Data',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: 'entity-schema',
        minCount: 0,
        maxCount: -1
      }
    ]);
    const dataEntity = { ...makeEntity('data-1'), name: 'Address' };
    const entities = [makeEntity('in-1'), makeEntity('out-1'), dataEntity];
    const db = makeDb({ relationSchemas: [relationSchema], entities });

    const result = await commitRelationsImport(db, 'ws-1', authCtx, eventForAuthCtx(), [
      { _schemaId: 'relation-schema', _inEntityId: 'in-1', _outEntityId: 'out-1', data: ['data-1'] }
    ]);

    expect(result).toMatchObject({ created: 1, updated: 0 });
    expect(
      (db as unknown as { relation: { createRelation: ReturnType<typeof vi.fn> } }).relation
        .createRelation
    ).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ data: ['data-1'] }) })
    );
  });
});

describe('downloadRelationImportTemplate', () => {
  it('includes identifier and visible relation field columns', async () => {
    const schema = makeRelationSchema('relation-schema', 'Depends On', [
      { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }
    ]);
    const response = await downloadRelationImportTemplate(
      makeDb({ relationSchemas: [schema], entities: [] }),
      'ws-1',
      authCtx,
      schema.id
    );

    expect(await response.body.text()).toBe('"_schemaId";"_inEntityId";"_outEntityId";"Note"');
  });
});
