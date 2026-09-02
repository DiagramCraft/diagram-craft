import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import {
  filterRelationFieldData,
  normalizeRelationEntityFields,
  toApiRelation,
  toRedactedApiRelation,
  validateRelationEndpoints,
  assertTypedRelationCardinality,
  assertRelationEndpointPairUniqueness
} from './relationHelpers';
import type { DatabaseAdapter } from '../../db/database';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import type { Entity, SchemaDbResult } from './db/catalogDatabase';

const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
      teamRoles.map(role => ({ teamId, role }))
    ),
    schemas: [],
    entities: [],
    grants: []
  });

const now = new Date('2026-06-01T12:00:00.000Z');

const schema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'workspace-1',
  name: 'Depends on',
  description: '',
  in_schema_ids: ['entity-schema-1'],
  out_schema_ids: ['entity-schema-2'],
  fields: [{ id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' }],
  groups: [],
  shared_field_group_links: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  version: 1,
  created_at: now,
  updated_at: now
};

const relation: RelationDbResult = {
  id: 'relation-1',
  workspace: 'workspace-1',
  schema_id: 'relation-schema-1',
  schema_name: 'Depends on',
  in_entity_id: 'entity-1',
  in_entity_name: 'Entity 1',
  out_entity_id: 'entity-2',
  out_entity_name: 'Entity 2',
  data: { note: 'known', removed: 'sensitive historical value' },
  owner: null,
  owner_name: null,
  lifecycle: null,
  lifecycle_label: null,
  version: 1,
  approval_policy_override: null,
  created_at: now,
  updated_at: now
};

describe('relation response redaction', () => {
  it('includes endpoint schema metadata when available', () => {
    expect(
      toApiRelation(
        {
          ...relation,
          in_entity_schema_id: 'entity-schema-1',
          out_entity_schema_id: 'entity-schema-2'
        },
        null,
        null
      )
    ).toMatchObject({
      _in: { id: 'entity-1', schemaId: 'entity-schema-1' },
      _out: { id: 'entity-2', schemaId: 'entity-schema-2' }
    });
  });

  it('keeps declared fields and drops unknown fields', () => {
    expect(filterRelationFieldData(null, schema, relation.data)).toEqual({ note: 'known' });
  });

  it('fails closed when the relation schema is missing', () => {
    expect(filterRelationFieldData(null, null, relation.data)).toEqual({});
  });

  it('preserves relation metadata while redacting its field values', () => {
    expect(toRedactedApiRelation(relation, null, null)).toMatchObject({
      _uid: 'relation-1',
      _schema: { id: 'relation-schema-1', name: 'Depends on' },
      _in: { id: 'entity-1', name: 'Entity 1' },
      _out: { id: 'entity-2', name: 'Entity 2' }
    });
    expect(toRedactedApiRelation(relation, null, null)).not.toHaveProperty('removed');
    expect(toRedactedApiRelation(relation, null, null)).not.toHaveProperty('note');
  });

  it('redacts a restricted entityRelation field entirely, not just its individual ids (#2670)', () => {
    const restrictedSchema: RelationSchemaDbResult = {
      ...schema,
      fields: [
        { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' },
        {
          id: 'data',
          name: 'Data',
          type: 'entityRelation',
          requirementLevel: 'optional',
          schemaId: 'entity-schema-data',
          minCount: 0,
          maxCount: -1,
          groupId: 'restricted'
        }
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    };
    const relationWithData: RelationDbResult = {
      ...relation,
      data: { note: 'known', data: ['data-1', 'data-2'] }
    };
    const noAccess = authCtxWithTeamRoles({});
    const viewer = authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] });

    expect(filterRelationFieldData(noAccess, restrictedSchema, relationWithData.data)).toEqual({
      note: 'known'
    });
    expect(filterRelationFieldData(viewer, restrictedSchema, relationWithData.data)).toEqual({
      note: 'known',
      data: ['data-1', 'data-2']
    });
  });

  it('redacts a derived field whose group cannot be resolved (#3091)', () => {
    const derivedSchema: RelationSchemaDbResult = {
      ...schema,
      fields: [
        { id: 'note', name: 'Note', type: 'text', requirementLevel: 'optional' },
        {
          id: 'note_copy',
          name: 'Note copy',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'relation.note',
          resultType: 'text',
          groupId: 'missing-group'
        }
      ],
      groups: []
    };
    const relationWithDerived: RelationDbResult = {
      ...relation,
      data: { note: 'known', note_copy: 'known' }
    };
    const viewer = authCtxWithTeamRoles({});

    expect(filterRelationFieldData(viewer, derivedSchema, relationWithDerived.data)).toEqual({
      note: 'known'
    });
  });
});

const makeEntity = (overrides: Partial<Entity> & { id: string; schema_id: string }): Entity => ({
  workspace: 'workspace-1',
  public_id: `PID-${overrides.id}`,
  slug: overrides.id,
  namespace: 'default',
  name: overrides.id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  completeness: 0,
  ...overrides
});

describe('normalizeRelationEntityFields', () => {
  const entityRelationSchema: RelationSchemaDbResult = {
    ...schema,
    fields: [
      {
        id: 'data_entity',
        name: 'Data Entity',
        type: 'entityRelation',
        requirementLevel: 'optional',
        schemaId: 'entity-schema-data',
        minCount: 0,
        maxCount: -1
      }
    ]
  };

  const target1 = makeEntity({ id: 'data-1', schema_id: 'entity-schema-data' });
  const target2 = makeEntity({ id: 'data-2', schema_id: 'entity-schema-data' });
  const wrongSchemaTarget = makeEntity({ id: 'data-3', schema_id: 'entity-schema-other' });
  const otherWorkspaceTarget = makeEntity({
    id: 'data-4',
    schema_id: 'entity-schema-data',
    workspace: 'workspace-2'
  });

  it('normalizes a valid array of target entity ids', () => {
    const result = normalizeRelationEntityFields({
      schema: entityRelationSchema,
      workspace: 'workspace-1',
      data: { data_entity: ['data-1', 'data-2'] },
      entities: [target1, target2]
    });
    expect(result.data_entity).toEqual(['data-1', 'data-2']);
  });

  it('defaults a missing value to an empty array', () => {
    const result = normalizeRelationEntityFields({
      schema: entityRelationSchema,
      workspace: 'workspace-1',
      data: {},
      entities: [target1]
    });
    expect(result.data_entity).toEqual([]);
  });

  it('rejects a value below minCount', () => {
    const requiredSchema: RelationSchemaDbResult = {
      ...entityRelationSchema,
      fields: [{ ...entityRelationSchema.fields[0]!, minCount: 1 } as never]
    };
    expect(() =>
      normalizeRelationEntityFields({
        schema: requiredSchema,
        workspace: 'workspace-1',
        data: { data_entity: [] },
        entities: [target1]
      })
    ).toThrow();
  });

  it('rejects a value above maxCount', () => {
    const boundedSchema: RelationSchemaDbResult = {
      ...entityRelationSchema,
      fields: [{ ...entityRelationSchema.fields[0]!, maxCount: 1 } as never]
    };
    expect(() =>
      normalizeRelationEntityFields({
        schema: boundedSchema,
        workspace: 'workspace-1',
        data: { data_entity: ['data-1', 'data-2'] },
        entities: [target1, target2]
      })
    ).toThrow();
  });

  it('rejects a reference to an unknown entity', () => {
    expect(() =>
      normalizeRelationEntityFields({
        schema: entityRelationSchema,
        workspace: 'workspace-1',
        data: { data_entity: ['missing'] },
        entities: [target1]
      })
    ).toThrow();
  });

  it('rejects a reference to an entity in a different workspace', () => {
    expect(() =>
      normalizeRelationEntityFields({
        schema: entityRelationSchema,
        workspace: 'workspace-1',
        data: { data_entity: ['data-4'] },
        entities: [otherWorkspaceTarget]
      })
    ).toThrow();
  });

  it('rejects a reference to an entity of the wrong schema', () => {
    expect(() =>
      normalizeRelationEntityFields({
        schema: entityRelationSchema,
        workspace: 'workspace-1',
        data: { data_entity: ['data-3'] },
        entities: [wrongSchemaTarget]
      })
    ).toThrow();
  });
});

describe('assertTypedRelationCardinality', () => {
  const typedField = {
    id: 'dependencies',
    name: 'Dependencies',
    type: 'typedRelation' as const,
    relationSchemaId: 'relation-schema-1',
    direction: 'out' as const,
    minCount: 0,
    maxCount: 1
  };
  const ownerSchema: SchemaDbResult = {
    id: 'owner-schema',
    workspace: 'workspace-1',
    name: 'Owner',
    description: '',
    fields: [typedField],
    groups: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'OWN',
    created_at: now,
    updated_at: now
  };
  const targetSchema: SchemaDbResult = { ...ownerSchema, id: 'target-schema', fields: [] };
  const owner = makeEntity({ id: 'owner', schema_id: 'owner-schema' });
  const target = makeEntity({ id: 'target', schema_id: 'target-schema' });
  const existingRelation = {
    ...relation,
    id: 'existing-relation',
    in_entity_id: 'target',
    out_entity_id: 'owner',
    schema_id: 'relation-schema-1'
  };

  const makeCardinalityDb = (rows: RelationDbResult[] = []): DatabaseAdapter =>
    ({
      catalog: {
        getEntity: vi.fn(async (_workspace: string, id: string) =>
          id === owner.id ? owner : id === target.id ? target : null
        ),
        getSchema: vi.fn(async (_workspace: string, id: string) =>
          id === ownerSchema.id ? ownerSchema : id === targetSchema.id ? targetSchema : null
        )
      },
      relation: {
        listRelationsForEntity: vi.fn(async (_workspace: string, entityId: string) => ({
          outgoing: entityId === target.id ? rows : [],
          incoming: entityId === owner.id ? rows : []
        }))
      }
    }) as unknown as DatabaseAdapter;

  it('uses incoming relations for an out-endpoint binding and rejects a projected maximum', async () => {
    const db = makeCardinalityDb([existingRelation]);

    await expect(
      assertTypedRelationCardinality(db, 'workspace-1', [
        {
          relationSchemaId: 'relation-schema-1',
          inEntityId: 'target',
          outEntityId: 'owner',
          delta: 1
        }
      ])
    ).rejects.toThrow('allows at most 1 relation');
  });

  it('checks every duplicate binding on the endpoint schema', async () => {
    const duplicateField = {
      ...typedField,
      id: 'single-dependency',
      name: 'Single dependency',
      maxCount: 0
    };
    const db = makeCardinalityDb();
    (db.catalog.getSchema as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ownerSchema,
      fields: [typedField, duplicateField]
    });

    await expect(
      assertTypedRelationCardinality(db, 'workspace-1', [
        {
          relationSchemaId: 'relation-schema-1',
          inEntityId: 'target',
          outEntityId: 'owner',
          delta: 1
        }
      ])
    ).rejects.toThrow('Single dependency allows at most 0 relation');
  });

  it('rejects deleting the last relation when the binding has a minimum', async () => {
    const requiredField = { ...typedField, minCount: 1 };
    const db = makeCardinalityDb([existingRelation]);
    (db.catalog.getSchema as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ownerSchema,
      fields: [requiredField]
    });

    await expect(
      assertTypedRelationCardinality(db, 'workspace-1', [
        {
          relationSchemaId: 'relation-schema-1',
          inEntityId: 'target',
          outEntityId: 'owner',
          delta: -1
        }
      ])
    ).rejects.toThrow('requires at least 1 relation');
  });
});

describe('assertRelationEndpointPairUniqueness', () => {
  const makePairDb = (rows: RelationDbResult[] = []): DatabaseAdapter =>
    ({
      relation: {
        getRelationSchema: vi.fn(async () => ({ ...schema, unique_endpoint_pair: true })),
        listRelations: vi.fn(async (_workspace, filters) => {
          const items = rows.filter(
            row =>
              row.schema_id === filters.schemaId &&
              row.in_entity_id === filters.inEntityId &&
              row.out_entity_id === filters.outEntityId
          );
          return { items, total: items.length };
        })
      }
    }) as unknown as DatabaseAdapter;

  it('rejects duplicate ordered endpoint pairs with a structural diagnostic', async () => {
    const db = makePairDb([relation]);

    await expect(
      assertRelationEndpointPairUniqueness(db, 'workspace-1', [
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          delta: 1
        }
      ])
    ).rejects.toMatchObject({
      status: 409,
      data: {
        code: 'RELATION_CONSTRAINT_VIOLATION',
        violations: [
          {
            kind: 'endpoint_pair_unique',
            relation_schema_id: relation.schema_id,
            in_entity_id: relation.in_entity_id,
            out_entity_id: relation.out_entity_id,
            existing_count: 1,
            projected_count: 2
          }
        ],
        total_violation_count: 1,
        hidden_violation_count: 0,
        truncated: false
      }
    });

    await expect(
      assertRelationEndpointPairUniqueness(db, 'workspace-1', [
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          delta: 1
        }
      ])
    ).rejects.not.toThrow('sensitive historical value');
  });

  it('treats the endpoint pair as ordered', async () => {
    const db = makePairDb([relation]);

    await expect(
      assertRelationEndpointPairUniqueness(db, 'workspace-1', [
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.out_entity_id,
          outEntityId: relation.in_entity_id,
          delta: 1
        }
      ])
    ).resolves.toBeUndefined();
  });

  it('allows a same-pair replacement when the existing relation is removed in the batch', async () => {
    const db = makePairDb([relation]);

    await expect(
      assertRelationEndpointPairUniqueness(db, 'workspace-1', [
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          delta: -1,
          relationId: relation.id
        },
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          delta: 1
        }
      ])
    ).resolves.toBeUndefined();
  });

  it('rejects duplicate additions in one batch even when no row exists yet', async () => {
    const db = makePairDb();

    await expect(
      assertRelationEndpointPairUniqueness(db, 'workspace-1', [
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          delta: 1
        },
        {
          relationSchemaId: relation.schema_id,
          inEntityId: relation.in_entity_id,
          outEntityId: relation.out_entity_id,
          delta: 1
        }
      ])
    ).rejects.toMatchObject({
      data: {
        violations: [expect.objectContaining({ projected_count: 2 })]
      }
    });
  });
});

describe('toApiRelation — _externalMetadata', () => {
  it('surfaces external metadata when no schema/ACL restricts it', () => {
    const relationWithMetadata: RelationDbResult = {
      ...relation,
      generated_metadata: {
        note: {
          fieldId: 'note',
          external_kind: 'integration',
          status: 'success',
          source: 'backstage',
          timestamp: now.toISOString()
        } as never
      }
    };

    const result = toApiRelation(relationWithMetadata, null, schema);
    expect(result._externalMetadata?.note).toBeDefined();
  });

  it('omits external metadata for fields in a restricted group the caller cannot view', () => {
    const restrictedSchema: RelationSchemaDbResult = {
      ...schema,
      fields: [
        { id: 'note', name: 'Note', requirementLevel: null, type: 'text' } as never,
        {
          id: 'secret',
          name: 'Secret',
          requirementLevel: null,
          type: 'text',
          groupId: 'restricted'
        } as never
      ],
      groups: [
        { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
      ]
    };
    const relationWithMetadata: RelationDbResult = {
      ...relation,
      generated_metadata: {
        note: {
          fieldId: 'note',
          external_kind: 'integration',
          status: 'success',
          source: 'backstage',
          timestamp: now.toISOString()
        } as never,
        secret: {
          fieldId: 'secret',
          external_kind: 'integration',
          status: 'success',
          source: 'backstage',
          timestamp: now.toISOString()
        } as never
      }
    };
    const authCtx = authCtxWithTeamRoles({});

    const result = toApiRelation(relationWithMetadata, authCtx, restrictedSchema);
    expect(result._externalMetadata?.note).toBeDefined();
    expect(result._externalMetadata?.secret).toBeUndefined();
  });
});

describe('validateRelationEndpoints', () => {
  const inEntity = { id: 'entity-1', schema_id: 'entity-schema-1' };
  const outEntity = { id: 'entity-2', schema_id: 'entity-schema-2' };

  it('allows entities matching the explicit endpoint schema ids', () => {
    expect(() => validateRelationEndpoints(schema, inEntity, outEntity)).not.toThrow();
  });

  it('rejects an entity whose schema is not in the explicit list', () => {
    expect(() =>
      validateRelationEndpoints(schema, { id: 'entity-3', schema_id: 'other-schema' }, outEntity)
    ).toThrow();
  });

  it('allows any entity schema when the "in" endpoint is wildcard', () => {
    const wildcardInSchema: RelationSchemaDbResult = { ...schema, in_schema_ids: 'any' };

    expect(() =>
      validateRelationEndpoints(
        wildcardInSchema,
        { id: 'entity-3', schema_id: 'some-other-schema' },
        outEntity
      )
    ).not.toThrow();
  });

  it('allows any entity schema on both endpoints when both are wildcard', () => {
    const wildcardSchema: RelationSchemaDbResult = {
      ...schema,
      in_schema_ids: 'any',
      out_schema_ids: 'any'
    };

    expect(() =>
      validateRelationEndpoints(
        wildcardSchema,
        { id: 'entity-3', schema_id: 'some-schema' },
        { id: 'entity-4', schema_id: 'some-other-schema' }
      )
    ).not.toThrow();
  });

  it('still rejects a mismatched explicit endpoint when only the other side is wildcard', () => {
    const mixedSchema: RelationSchemaDbResult = { ...schema, in_schema_ids: 'any' };

    expect(() =>
      validateRelationEndpoints(mixedSchema, inEntity, {
        id: 'entity-3',
        schema_id: 'wrong-schema'
      })
    ).toThrow();
  });
});
