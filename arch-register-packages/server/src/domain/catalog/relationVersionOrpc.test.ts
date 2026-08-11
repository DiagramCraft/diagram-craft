import { call } from '@orpc/server';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildApiAuthCtx, buildApiEntityAuthCtx } from '../auth/authorization';
import type {
  EntityVersionDbResult,
  SchemaDbResult,
  SchemaVersionDbResult
} from './db/catalogDatabase';
import type {
  RelationDbResult,
  RelationSchemaDbResult,
  RelationSchemaVersionDbResult
} from './db/relationDatabase';
import { relationVersionORPCRouter } from './relationVersionOrpc';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(),
  buildApiEntityAuthCtx: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const authCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: 'editor',
  teamAssignments: [],
  schemas: [],
  entities: [],
  grants: []
});

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeOwnerSchema = (restricted: boolean, createdAt: string): SchemaDbResult => ({
  id: 'owner-schema-1',
  workspace: 'ws-1',
  name: 'Owner schema',
  description: '',
  fields: (['in', 'out'] as const).map(direction => ({
    id: `relation-${direction}`,
    name: 'Relation',
    type: 'typedRelation',
    relationSchemaId: 'relation-schema-1',
    direction,
    requirementLevel: null,
    ...(restricted ? { groupId: 'restricted' } : {})
  })) as never,
  groups: restricted
    ? [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-reviewers'] } }]
    : [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'OWN',
  created_at: new Date(createdAt),
  updated_at: new Date(createdAt)
});

const makeOwnerSchemaVersion = (schema: SchemaDbResult, createdAt: string): SchemaVersionDbResult =>
  ({
    id: `owner-schema-version-${createdAt}`,
    workspace: schema.workspace,
    schema_id: schema.id,
    version: 1,
    name: schema.name,
    description: schema.description,
    fields: schema.fields,
    templates: [],
    groups: schema.groups ?? [],
    shared_field_group_links: [],
    color: schema.color,
    icon: schema.icon,
    change_summary: {},
    created_by: null,
    created_at: new Date(createdAt)
  }) as SchemaVersionDbResult;

const relationSchema: RelationSchemaDbResult = {
  id: 'relation-schema-1',
  workspace: 'ws-1',
  name: 'Depends on',
  description: '',
  in_schema_ids: ['owner-schema-1'],
  out_schema_ids: ['owner-schema-1'],
  fields: [{ id: 'secret', name: 'Secret', type: 'text', requirementLevel: null } as never],
  groups: [],
  color: null,
  icon: null,
  relation_approval_policy: 'disabled',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const relationSchemaVersion: RelationSchemaVersionDbResult = {
  id: 'relation-schema-version-1',
  workspace: 'ws-1',
  schema_id: relationSchema.id,
  version: 1,
  name: relationSchema.name,
  description: relationSchema.description,
  in_schema_ids: relationSchema.in_schema_ids,
  out_schema_ids: relationSchema.out_schema_ids,
  fields: relationSchema.fields,
  groups: relationSchema.groups ?? [],
  color: relationSchema.color,
  icon: relationSchema.icon,
  change_summary: {},
  created_by: null,
  created_at: relationSchema.created_at
};

const relation: RelationDbResult = {
  id: 'relation-1',
  workspace: 'ws-1',
  schema_id: relationSchema.id,
  schema_name: relationSchema.name,
  in_entity_id: 'entity-in',
  in_entity_name: 'Entity in',
  out_entity_id: 'entity-out',
  out_entity_name: 'Entity out',
  data: { secret: 'current' },
  owner: null,
  owner_name: null,
  lifecycle: null,
  lifecycle_label: null,
  version: 2,
  approval_policy_override: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-07-01T00:00:00.000Z')
};

const makeVersion = (id: string, createdAt: string, value: string): EntityVersionDbResult => ({
  id,
  workspace: 'ws-1',
  record_id: relation.id,
  schema_version_id: null,
  version_number: id === 'version-old' ? 1 : 2,
  kind: 'autosave',
  commit_message: null,
  created_at: new Date(createdAt),
  created_by: null,
  created_by_name: null,
  state: {
    id: relation.id,
    workspace: relation.workspace,
    schema_id: relation.schema_id,
    in_entity_id: relation.in_entity_id,
    out_entity_id: relation.out_entity_id,
    data: { secret: value },
    owner: relation.owner,
    lifecycle: relation.lifecycle
  },
  applied_case_revision_id: null
});

const makeDb = ({
  currentOwnerSchema,
  ownerSchemaVersions,
  versions
}: {
  currentOwnerSchema: SchemaDbResult | null;
  ownerSchemaVersions: SchemaVersionDbResult[];
  versions: EntityVersionDbResult[];
}) => {
  const versionsById = new Map(versions.map(version => [version.id, version]));
  const endpointEntity = (id: string) => ({ id, schema_id: 'owner-schema-1' });

  return {
    catalog: {
      getEntity: vi.fn(async (_workspace: string, id: string) =>
        id === relation.in_entity_id || id === relation.out_entity_id ? endpointEntity(id) : null
      ),
      getSchema: vi.fn(async () => currentOwnerSchema),
      listSchemaVersions: vi.fn(async () => ownerSchemaVersions),
      listEntityVersions: vi.fn(async () => versions),
      getEntityVersionById: vi.fn(
        async (_workspace: string, id: string) => versionsById.get(id) ?? null
      )
    },
    relation: {
      getRelation: vi.fn(async () => relation),
      getRelationSchema: vi.fn(async () => relationSchema),
      listRelationSchemaVersions: vi.fn(async () => [relationSchemaVersion])
    }
  } as unknown as DatabaseAdapter;
};

const listVersions = (db: DatabaseAdapter) =>
  call(
    relationVersionORPCRouter.relationVersions.list,
    { params: { workspace: 'ws-1', id: relation.id } },
    { context: { db, event } }
  );

const getVersion = (db: DatabaseAdapter, versionId: string) =>
  call(
    relationVersionORPCRouter.relationVersions.get,
    { params: { workspace: 'ws-1', id: relation.id, versionId } },
    { context: { db, event } }
  );

describe('relation version owner-field authorization', () => {
  beforeEach(() => {
    vi.mocked(buildApiAuthCtx).mockResolvedValue(authCtx);
    vi.mocked(buildApiEntityAuthCtx).mockResolvedValue(authCtx as never);
  });

  it('filters versions using the owner schemas active at each version timestamp', async () => {
    const historicalRestricted = makeOwnerSchema(true, '2026-01-01T00:00:00.000Z');
    const currentUnrestricted = makeOwnerSchema(false, '2026-06-01T00:00:00.000Z');
    const db = makeDb({
      currentOwnerSchema: currentUnrestricted,
      ownerSchemaVersions: [
        makeOwnerSchemaVersion(historicalRestricted, historicalRestricted.created_at.toISOString()),
        makeOwnerSchemaVersion(currentUnrestricted, currentUnrestricted.created_at.toISOString())
      ],
      versions: [
        makeVersion('version-old', '2026-05-01T00:00:00.000Z', 'old-secret'),
        makeVersion('version-new', '2026-07-01T00:00:00.000Z', 'new-secret')
      ]
    });

    const result = await listVersions(db);

    expect(result.map(version => version.id)).toEqual(['version-new']);
    expect(result[0]?.state.data).toEqual({ secret: 'new-secret' });
  });

  it('returns not-found for a version denied by its historical owner schema', async () => {
    const historicalRestricted = makeOwnerSchema(true, '2026-01-01T00:00:00.000Z');
    const db = makeDb({
      currentOwnerSchema: makeOwnerSchema(false, '2026-06-01T00:00:00.000Z'),
      ownerSchemaVersions: [
        makeOwnerSchemaVersion(historicalRestricted, historicalRestricted.created_at.toISOString()),
        makeOwnerSchemaVersion(
          makeOwnerSchema(false, '2026-06-01T00:00:00.000Z'),
          '2026-06-01T00:00:00.000Z'
        )
      ],
      versions: [makeVersion('version-old', '2026-05-01T00:00:00.000Z', 'old-secret')]
    });

    await expect(getVersion(db, 'version-old')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('fails closed when no owner schema existed at the version timestamp', async () => {
    const db = makeDb({
      currentOwnerSchema: makeOwnerSchema(false, '2026-06-01T00:00:00.000Z'),
      ownerSchemaVersions: [],
      versions: [makeVersion('version-old', '2026-05-01T00:00:00.000Z', 'old-secret')]
    });

    await expect(listVersions(db)).resolves.toEqual([]);
    await expect(getVersion(db, 'version-old')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
