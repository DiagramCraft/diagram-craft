import { describe, expect, it, vi } from 'vitest';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { DatabaseAdapter } from '../../db/database';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { savedViewUsesRestrictedField, createSavedView } from './viewOperations';

const now = new Date('2026-08-03T00:00:00.000Z');

const makeSchema = (
  id: string,
  field: SchemaDbResult['fields'][number],
  groups?: SchemaDbResult['groups']
): SchemaDbResult => ({
  id,
  workspace: 'ws-1',
  name: id,
  description: '',
  fields: [field],
  groups,
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: id.slice(0, 3).toUpperCase(),
  created_at: now,
  updated_at: now
});

const relationSchema: RelationSchemaDbResult = {
  id: 'relation-1',
  workspace: 'ws-1',
  name: 'Depends On',
  description: '',
  in_schema_ids: ['target'],
  out_schema_ids: ['open-owner', 'locked-owner'],
  fields: [{ id: 'note', name: 'Note', type: 'text' }],
  groups: [],
  color: null,
  icon: null,
  created_at: now,
  updated_at: now
};

const openOwner = makeSchema('open-owner', {
  id: 'depends_on',
  name: 'Depends On',
  type: 'typedRelation',
  relationSchemaId: relationSchema.id,
  direction: 'out'
});
const lockedOwner = makeSchema(
  'locked-owner',
  {
    id: 'depends_on',
    name: 'Depends On',
    type: 'typedRelation',
    relationSchemaId: relationSchema.id,
    direction: 'out',
    groupId: 'locked'
  },
  [{ id: 'locked', name: 'Locked', accessControl: { teamIds: ['team-locked'] } }]
);

const authWithoutAccess = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: null,
  schemas: [openOwner, lockedOwner],
  entities: [],
  grants: []
});

const queryFor = (ownerSchemaIds: string[]): EntityQuery => {
  const path = [
    {
      kind: 'typedRelation' as const,
      fieldId: 'depends_on',
      relationSchemaId: relationSchema.id,
      direction: 'out' as const,
      ownerSchemaIds
    }
  ];
  return {
    root: { kind: 'relationExists', path },
    projections: [
      { path, fieldId: '_name', alias: 'target_name' },
      { path, fieldId: 'note', source: 'relation', alias: 'relation_note' }
    ]
  };
};

describe('savedViewUsesRestrictedField typed-relation owner access', () => {
  it('rejects a saved view retaining a restricted owner schema binding', () => {
    expect(
      savedViewUsesRestrictedField(
        queryFor([openOwner.id, lockedOwner.id]),
        null,
        [openOwner, lockedOwner],
        authWithoutAccess,
        [relationSchema]
      )
    ).toBe(true);
  });

  it('allows a saved view scoped to the accessible owner schema', () => {
    expect(
      savedViewUsesRestrictedField(
        queryFor([openOwner.id]),
        null,
        [openOwner, lockedOwner],
        authWithoutAccess,
        [relationSchema]
      )
    ).toBe(false);
  });

  it('fails closed when owner-schema provenance is missing', () => {
    const query = queryFor([openOwner.id]);
    const step = (query.root as Extract<EntityQuery['root'], { kind: 'relationExists' }>).path[0]!;
    delete (step as { ownerSchemaIds?: string[] }).ownerSchemaIds;
    expect(
      savedViewUsesRestrictedField(query, null, [openOwner, lockedOwner], authWithoutAccess, [
        relationSchema
      ])
    ).toBe(true);
  });

  it('resolves a relation-rooted root-level predicate against the relation schema, not entity schemas', () => {
    const relationRootQuery: EntityQuery = {
      schemaId: relationSchema.id,
      root: { kind: 'predicate', path: [], fieldId: 'note', op: 'equals', value: 'x' }
    };
    // 'note' is a relation field, unrestricted on relationSchema — not restricted.
    expect(
      savedViewUsesRestrictedField(
        relationRootQuery,
        null,
        [openOwner, lockedOwner],
        authWithoutAccess,
        [relationSchema]
      )
    ).toBe(false);
  });
});

describe('createSavedView relation-rooted viewMode restriction', () => {
  const makeDb = () =>
    ({
      relation: { listRelationSchemas: vi.fn(async () => [relationSchema]) },
      catalog: { listSchemas: vi.fn(async () => [openOwner, lockedOwner]) },
      view: { createSavedView: vi.fn(async (input: unknown) => input) }
    }) as unknown as DatabaseAdapter;

  it('rejects a non-table viewMode for a relation-rooted saved view', async () => {
    const db = makeDb();
    await expect(
      createSavedView(db, 'ws-1', {
        name: 'My relations',
        viewMode: 'cards',
        filters: { schemaId: relationSchema.id, root: { kind: 'and', children: [] } }
      } as never)
    ).rejects.toThrow();
  });

  it('allows the table viewMode for a relation-rooted saved view', async () => {
    const db = makeDb();
    await expect(
      createSavedView(db, 'ws-1', {
        name: 'My relations',
        viewMode: 'table',
        filters: { schemaId: relationSchema.id, root: { kind: 'and', children: [] } }
      } as never)
    ).resolves.toBeDefined();
  });

  it('allows the graph viewMode for a relation-rooted saved view', async () => {
    const db = makeDb();
    await expect(
      createSavedView(db, 'ws-1', {
        name: 'My relation graph',
        viewMode: 'graph',
        filters: { schemaId: relationSchema.id, root: { kind: 'and', children: [] } }
      } as never)
    ).resolves.toBeDefined();
  });
});
