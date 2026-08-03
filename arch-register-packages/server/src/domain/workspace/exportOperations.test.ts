import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';

const hasWorkspaceCapability = vi.fn();

vi.mock('@arch-register/permissions', async importOriginal => {
  const actual = await importOriginal<typeof import('@arch-register/permissions')>();
  return {
    ...actual,
    PermissionChecker: class {
      hasWorkspaceCapability(...args: Parameters<typeof hasWorkspaceCapability>) {
        return hasWorkspaceCapability(...args);
      }
    }
  };
});

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

import { exportWorkspace } from './exportOperations';

const schemaWithRestrictedGroup = {
  id: 'schema-1',
  workspace: 'workspace-1',
  name: 'Schema 1',
  fields: [
    { id: 'name', name: 'Name', requirementLevel: null, type: 'text' },
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    }
  ],
  groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-1'] } }],
  templates: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: null,
  created_at: new Date(),
  updated_at: new Date()
} as any;

const makeEntity = () =>
  ({
    id: 'entity-1',
    public_id: 1,
    schema_id: 'schema-1',
    name: 'Entity 1',
    slug: 'entity-1',
    namespace: null,
    description: null,
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    data: { name: 'x', secret: 'y' },
    project_id: null
  }) as any;

const makeDb = () =>
  ({
    workspace: {
      getWorkspace: vi.fn(async () => ({
        id: 'workspace-1',
        name: 'Workspace',
        url_slug: 'workspace',
        short_code: 'WS',
        color: '',
        description: '',
        created_at: new Date(),
        updated_at: new Date()
      }))
    },
    auth: {
      getUser: vi.fn(async () => ({ email: 'user@example.com', display_name: 'User' }))
    },
    catalog: {
      listSchemas: vi.fn(async () => [schemaWithRestrictedGroup]),
      listSharedFieldGroups: vi.fn(async () => []),
      listEntities: vi.fn(async () => [makeEntity()])
    }
  }) as any;

describe('exportEntities field-group redaction', () => {
  beforeEach(() => {
    hasWorkspaceCapability.mockReset();
    hasWorkspaceCapability.mockImplementation((_ctx, capability) => capability === 'ws.settings');
  });

  it('omits restricted fields for a caller without the field-group admin bypass', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const { data } = await exportWorkspace(makeDb(), undefined, authCtx, 'workspace-1', {
      include: ['entities']
    });

    expect(data.entities).toEqual([expect.objectContaining({ data: { name: 'x' } })]);
  });

  it('keeps restricted fields for a caller with edit access to the field group', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_editor' }],
      schemas: [],
      entities: [],
      grants: []
    });

    const { data } = await exportWorkspace(makeDb(), undefined, authCtx, 'workspace-1', {
      include: ['entities']
    });

    expect(data.entities).toEqual([expect.objectContaining({ data: { name: 'x', secret: 'y' } })]);
  });

  it('keeps restricted fields for the built-in owner role (full field-group bypass)', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'owner',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const { data } = await exportWorkspace(makeDb(), undefined, authCtx, 'workspace-1', {
      include: ['entities']
    });

    expect(data.entities).toEqual([expect.objectContaining({ data: { name: 'x', secret: 'y' } })]);
  });

  it('exports unchanged data for an entity whose schema has no restricted groups', async () => {
    const db = makeDb();
    db.catalog.listSchemas.mockResolvedValue([
      { ...schemaWithRestrictedGroup, id: 'schema-2', groups: [] }
    ]);
    db.catalog.listEntities.mockResolvedValue([{ ...makeEntity(), schema_id: 'schema-2' }]);

    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const { data } = await exportWorkspace(db, undefined, authCtx, 'workspace-1', {
      include: ['entities']
    });

    expect(data.entities).toEqual([expect.objectContaining({ data: { name: 'x', secret: 'y' } })]);
  });
});

describe('exportSchemas field-group metadata', () => {
  it('exports local ACLs, shared links, and shared group definitions', async () => {
    const db = makeDb();
    db.catalog.listSharedFieldGroups.mockResolvedValue([
      {
        id: 'shared-1',
        workspace: 'workspace-1',
        name: 'Shared restricted',
        description: 'Restricted fields',
        fields: [{ id: 'secret', name: 'Secret', type: 'text' }],
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
    db.catalog.listSchemas.mockResolvedValue([
      {
        ...schemaWithRestrictedGroup,
        shared_field_group_links: [{ groupId: 'shared-1', teamIds: ['team-1'] }]
      }
    ]);
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'owner',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const { data } = await exportWorkspace(db, undefined, authCtx, 'workspace-1', {
      include: ['schemas']
    });

    expect(data.schemas).toEqual([
      expect.objectContaining({
        groups: schemaWithRestrictedGroup.groups,
        shared_field_group_links: [{ groupId: 'shared-1', teamIds: ['team-1'] }],
        shared_field_groups: [
          expect.objectContaining({ id: 'shared-1', name: 'Shared restricted' })
        ]
      })
    ]);
  });
});
