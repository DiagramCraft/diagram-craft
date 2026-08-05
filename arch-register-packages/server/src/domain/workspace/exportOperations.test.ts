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
      hasRelationOwnerAction() {
        return false;
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
      {
        ...schemaWithRestrictedGroup,
        id: 'schema-2',
        fields: schemaWithRestrictedGroup.fields.map((field: Record<string, unknown>) => ({
          ...field,
          groupId: undefined
        })),
        groups: []
      }
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

  it('fails closed for an entity whose schema is missing', async () => {
    const db = makeDb();
    db.catalog.listSchemas.mockResolvedValue([]);

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

    expect(data.entities).toEqual([expect.objectContaining({ data: {} })]);
  });

  it('fails closed for an entity field whose group reference is dangling', async () => {
    const db = makeDb();
    db.catalog.listSchemas.mockResolvedValue([
      {
        ...schemaWithRestrictedGroup,
        fields: [
          { id: 'name', name: 'Name', requirementLevel: null, type: 'text' },
          {
            id: 'secret',
            name: 'Secret',
            requirementLevel: null,
            type: 'text',
            groupId: 'deleted-group'
          }
        ],
        groups: undefined
      }
    ]);

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

    expect(data.entities).toEqual([expect.objectContaining({ data: { name: 'x' } })]);
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
      workspaceRole: 'editor',
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

describe('typed relation export', () => {
  const relationSchema = {
    id: 'relation-schema-1',
    workspace: 'workspace-1',
    name: 'Depends on',
    description: 'Dependency relation',
    in_schema_ids: ['schema-1'],
    out_schema_ids: ['schema-2'],
    fields: [{ id: 'strength', name: 'Strength', type: 'text' }],
    groups: [],
    shared_field_group_links: [],
    color: '#123456',
    icon: 'link',
    relation_approval_policy: 'disabled' as const,
    version: 1,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z')
  };

  const relation = {
    id: 'relation-1',
    workspace: 'workspace-1',
    schema_id: relationSchema.id,
    schema_name: relationSchema.name,
    in_entity_id: 'entity-in',
    in_entity_name: 'Entity in',
    out_entity_id: 'entity-out',
    out_entity_name: 'Entity out',
    data: { strength: 'strong' },
    version: 2,
    approval_policy_override: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z')
  };

  const makeRelationDb = () => {
    const db = makeDb();
    db.catalog.listSchemas.mockResolvedValue([
      schemaWithRestrictedGroup,
      { ...schemaWithRestrictedGroup, id: 'schema-2', name: 'Schema 2' }
    ]);
    db.catalog.listEntities.mockResolvedValue([
      { ...makeEntity(), id: 'entity-in', schema_id: 'schema-1', name: 'Entity in' },
      { ...makeEntity(), id: 'entity-out', schema_id: 'schema-2', name: 'Entity out' }
    ]);
    db.relation = {
      listRelationSchemas: vi.fn(async () => [relationSchema]),
      listRelations: vi
        .fn()
        .mockResolvedValueOnce({ items: [relation], total: 1 })
        .mockResolvedValueOnce({ items: [], total: 1 })
    };
    return db;
  };

  it('exports relation schemas and instances with manifest statistics', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'owner',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const { manifest, data } = await exportWorkspace(
      makeRelationDb(),
      undefined,
      authCtx,
      'workspace-1',
      { include: ['schemas', 'relation_schemas', 'entities', 'relations'] }
    );

    expect(manifest.version).toBe('1.0');
    expect(manifest.statistics).toEqual(
      expect.objectContaining({ relation_schema_count: 1, relation_count: 1 })
    );
    expect(manifest.files).toEqual(
      expect.objectContaining({
        relation_schemas: 'relation-schemas.json',
        relations: 'relations.json'
      })
    );
    expect(data.relations).toEqual([
      expect.objectContaining({
        schema_id: relationSchema.id,
        in_entity_id: 'entity-in',
        out_entity_id: 'entity-out',
        data: { strength: 'strong' }
      })
    ]);
  });

  it('omits relations whose endpoints are filtered out and records a diagnostic', async () => {
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'owner',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const { manifest, data } = await exportWorkspace(
      makeRelationDb(),
      undefined,
      authCtx,
      'workspace-1',
      {
        include: ['schemas', 'relation_schemas', 'entities', 'relations'],
        entity_filters: { schema_ids: ['schema-1'] }
      }
    );

    expect(data.relations).toEqual([]);
    expect(manifest.export_diagnostics).toEqual([
      expect.objectContaining({ code: 'filtered_reference', item_id: relation.id })
    ]);
  });

  it('omits relations hidden by owner-field ACLs, while allowing an accessible binding', async () => {
    const db = makeRelationDb();
    const restrictedOwnerField = {
      id: 'relation-owner',
      name: 'Relation owner',
      type: 'typedRelation',
      relationSchemaId: relationSchema.id,
      direction: 'in',
      requirementLevel: null,
      groupId: 'owner-restricted'
    };
    const restrictedOtherField = {
      ...restrictedOwnerField,
      id: 'relation-other-owner',
      direction: 'out'
    };
    db.catalog.listSchemas.mockResolvedValue([
      {
        ...schemaWithRestrictedGroup,
        id: 'schema-1',
        fields: [restrictedOwnerField],
        groups: [
          {
            id: 'owner-restricted',
            name: 'Owner restricted',
            accessControl: { teamIds: ['team-1'] }
          }
        ]
      },
      {
        ...schemaWithRestrictedGroup,
        id: 'schema-2',
        fields: [restrictedOtherField],
        groups: [
          {
            id: 'owner-restricted',
            name: 'Owner restricted',
            accessControl: { teamIds: ['team-1'] }
          }
        ]
      }
    ]);

    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });

    const hidden = await exportWorkspace(db, undefined, authCtx, 'workspace-1', {
      include: ['schemas', 'relation_schemas', 'entities', 'relations']
    });
    expect(hidden.data.relations).toEqual([]);
    expect(hidden.manifest.export_diagnostics).toEqual([
      expect.objectContaining({ code: 'filtered_reference', item_id: relation.id })
    ]);

    db.catalog.listSchemas.mockResolvedValue([
      {
        ...schemaWithRestrictedGroup,
        id: 'schema-1',
        fields: [restrictedOwnerField],
        groups: [
          {
            id: 'owner-restricted',
            name: 'Owner restricted',
            accessControl: { teamIds: ['team-1'] }
          }
        ]
      },
      { ...schemaWithRestrictedGroup, id: 'schema-2', fields: [], groups: [] }
    ]);
    db.relation.listRelations
      .mockReset()
      .mockResolvedValueOnce({ items: [relation], total: 1 })
      .mockResolvedValueOnce({ items: [], total: 1 });
    const visible = await exportWorkspace(db, undefined, authCtx, 'workspace-1', {
      include: ['schemas', 'relation_schemas', 'entities', 'relations']
    });
    expect(visible.data.relations).toHaveLength(1);
  });
});
