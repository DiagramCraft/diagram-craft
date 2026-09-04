import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWorkspace } from './searchOperations';
import type { DatabaseAdapter } from '../../db/database';
import { buildApiEntityAuthCtx } from '../auth/authorization';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({
    userId: 'user-1',
    globalPermissions: new Set(['admin_platform']),
    workspaceRole: null,
    workspaceRoles: new Map(),
    teamRolesByTeam: new Map(),
    schemas: new Map(),
    entities: new Map(),
    grants: []
  })),
  buildApiEntityAuthCtx: vi.fn(async () => ({
    userId: 'user-1',
    globalPermissions: new Set(['admin_platform']),
    workspaceRole: null,
    workspaceRoles: new Map(),
    teamRolesByTeam: new Map(),
    schemas: new Map(),
    entities: new Map(),
    grants: []
  })),
  canAccessProject: vi.fn((_: unknown, owner: string | null) => owner !== 'hidden-team')
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

const makeDb = (): DatabaseAdapter =>
  ({
    catalog: {
      listSchemas: vi.fn(async () => []),
      listEntities: vi.fn(async () => [
        {
          id: 'visible-entity',
          public_id: 'ENT-1',
          schema_id: 'schema-1',
          schema_name: 'Component',
          name: 'Visible Entity',
          slug: 'visible-entity',
          description: '',
          owner: 'visible-team',
          owner_name: 'Visible Team',
          lifecycle: null,
          lifecycle_label: null,
          target_lifecycle: null,
          target_lifecycle_label: null,
          tags: [],
          links: [],
          data: {},
          namespace: '',
          workspace: 'ws-1',
          visibility_mode: null,
          created_at: new Date(),
          updated_at: new Date(),
          target_lifecycle_date: null
        }
      ]),
      listEntitiesPaginated: vi.fn(
        async (
          _ws: string,
          _filters: unknown,
          { limit, offset }: { limit: number; offset: number }
        ) => {
          const all = [
            {
              id: 'visible-entity',
              public_id: 'ENT-1',
              schema_id: 'schema-1',
              schema_name: 'Component',
              name: 'Visible Entity',
              slug: 'visible-entity',
              description: '',
              owner: 'visible-team',
              owner_name: 'Visible Team',
              lifecycle: null,
              lifecycle_label: null,
              target_lifecycle: null,
              target_lifecycle_label: null,
              tags: [],
              links: [],
              data: {},
              namespace: '',
              workspace: 'ws-1',
              visibility_mode: null,
              created_at: new Date(),
              updated_at: new Date(),
              target_lifecycle_date: null
            }
          ];
          return all.slice(offset, offset + limit);
        }
      ),
      resolveWorkspaceSlug: vi.fn(async () => 'ws-1')
    },
    project: {
      projects: {
        listProjects: vi.fn(async () => [
          {
            id: 'visible-project',
            public_id: 'PRJ-1',
            name: 'Visible Project',
            description: '',
            owner: 'visible-team'
          },
          {
            id: 'hidden-project',
            name: 'Hidden Project',
            description: '',
            owner: 'hidden-team'
          }
        ])
      },
      contentNodes: {
        listContentNodes: vi.fn(async (_ws: string, projectId: string) =>
          projectId === 'visible-project'
            ? [
                {
                  id: 'visible-file',
                  project_id: 'visible-project',
                  path: 'diagrams/customer-portal.dgc',
                  name: 'Customer Portal',
                  comment_count: 0,
                  unresolved_comment_count: 0,
                  metadata_title: 'Customer experience blueprint',
                  metadata_description: 'Portal onboarding and navigation flow',
                  metadata_company: null,
                  metadata_category: 'Experience',
                  metadata_keywords: ['journey', 'onboarding']
                }
              ]
            : [
                {
                  id: 'hidden-file',
                  project_id: 'hidden-project',
                  path: 'diagrams/auth-hardening.dgc',
                  name: 'Auth Hardening',
                  comment_count: 0,
                  unresolved_comment_count: 0,
                  metadata_title: 'Zero trust login flow',
                  metadata_description: 'Restricted sign-in hardening review',
                  metadata_company: null,
                  metadata_category: 'Security',
                  metadata_keywords: ['boundary-review']
                }
              ]
        ),
        listEntityContentNodes: vi.fn(async (_ws: string, entityId: string) =>
          entityId === 'visible-entity'
            ? [
                {
                  id: 'entity-file',
                  entity_id: 'visible-entity',
                  project_id: null,
                  path: 'overview/platform-map.dgc',
                  name: 'Platform Map',
                  comment_count: 0,
                  unresolved_comment_count: 0,
                  metadata_title: 'Magnus platform map',
                  metadata_description: 'Entity-owned overview diagram',
                  metadata_company: null,
                  metadata_category: 'Architecture',
                  metadata_keywords: ['entity-owned']
                }
              ]
            : []
        ),
        listWorkspaceContentNodes: vi.fn(async () => [
          {
            id: 'workspace-file',
            entity_id: null,
            project_id: null,
            path: 'shared/magnus-overview.dgc',
            name: 'Shared Overview',
            comment_count: 0,
            unresolved_comment_count: 0,
            metadata_title: 'Workspace Magnus overview',
            metadata_description: 'Workspace-level architecture overview',
            metadata_company: null,
            metadata_category: 'Reference',
            metadata_keywords: ['workspace-shared']
          }
        ])
      }
    }
  }) as unknown as DatabaseAdapter;

describe('searchWorkspace file metadata matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['title', 'blueprint'],
    ['description', 'navigation flow'],
    ['category', 'experience'],
    ['keyword', 'onboarding']
  ])('matches files by metadata %s', async (_field, query) => {
    const result = await searchWorkspace(makeDb(), 'default', { q: query, types: 'files' }, {
      context: { user: { id: 'user-1' } }
    } as never);

    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: 'visible-project',
        fileId: 'visible-file',
        name: 'Customer Portal',
        content_metadata: expect.objectContaining({
          title: 'Customer experience blueprint',
          category: 'Experience',
          keywords: expect.arrayContaining(['journey', 'onboarding'])
        })
      })
    ]);
  });

  it('does not leak hidden files through metadata matches', async () => {
    const result = await searchWorkspace(
      makeDb(),
      'default',
      { q: 'boundary-review', types: 'files' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.files).toEqual([]);
  });

  it('matches entity and workspace files by metadata', async () => {
    const entityResult = await searchWorkspace(
      makeDb(),
      'default',
      { q: 'entity-owned', types: 'files' },
      { context: { user: { id: 'user-1' } } } as never
    );
    const workspaceResult = await searchWorkspace(
      makeDb(),
      'default',
      { q: 'workspace-shared', types: 'files' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(entityResult.files).toEqual([
      expect.objectContaining({
        scope: 'entity',
        entityId: 'visible-entity',
        entityPublicId: 'ENT-1',
        entityName: 'Visible Entity',
        fileId: 'entity-file'
      })
    ]);
    expect(workspaceResult.files).toEqual([
      expect.objectContaining({
        scope: 'workspace',
        projectId: null,
        entityId: null,
        fileId: 'workspace-file'
      })
    ]);
  });
});

describe('searchWorkspace entity field-group redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const restrictedSchema = {
    id: 'schema-1',
    workspace: 'ws-1',
    name: 'Component',
    description: '',
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'CMP',
    created_at: new Date(),
    updated_at: new Date(),
    fields: [
      { id: 'note', name: 'Note', requirementLevel: null, type: 'text' },
      {
        id: 'secret',
        name: 'Secret',
        requirementLevel: null,
        type: 'text',
        groupId: 'restricted'
      }
    ],
    groups: [
      { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
    ]
  };

  const makeEntityDb = (): DatabaseAdapter =>
    ({
      catalog: {
        listSchemas: vi.fn(async () => [restrictedSchema]),
        listEntitiesPaginated: vi.fn(
          async (
            _ws: string,
            _filters: unknown,
            { limit, offset }: { limit: number; offset: number }
          ) => {
            const all = [
              {
                id: 'entity-1',
                public_id: 'ENT-1',
                schema_id: 'schema-1',
                schema_name: 'Component',
                name: 'Entity One',
                slug: 'entity-one',
                description: '',
                owner: 'team-a',
                owner_name: 'Team A',
                lifecycle: null,
                lifecycle_label: null,
                target_lifecycle: null,
                target_lifecycle_label: null,
                tags: [],
                links: [],
                data: { note: 'alpha-value', secret: 'salary-42' },
                namespace: '',
                workspace: 'ws-1',
                visibility_mode: null,
                created_at: new Date(),
                updated_at: new Date(),
                target_lifecycle_date: null
              }
            ];
            return all.slice(offset, offset + limit);
          }
        ),
        resolveWorkspaceSlug: vi.fn(async () => 'ws-1')
      },
      project: {
        projects: {
          listProjects: vi.fn(async () => [])
        },
        contentNodes: {
          listContentNodes: vi.fn(async () => []),
          listEntityContentNodes: vi.fn(async () => []),
          listWorkspaceContentNodes: vi.fn(async () => [])
        }
      }
    }) as unknown as DatabaseAdapter;

  const noAccessCtx = {
    userId: 'user-1',
    globalPermissions: new Set<string>(),
    workspaceRole: null,
    workspaceRoles: new Map(),
    workspaceCapabilityCeiling: new Set(['content.view']),
    teamRolesByTeam: new Map(),
    schemas: new Map(),
    entities: new Map(),
    grants: []
  };

  const viewAccessCtx = {
    ...noAccessCtx,
    teamRolesByTeam: new Map([['team-restricted', new Set(['team_reviewer'])]])
  };

  it('excludes a restricted field from matchedFields and does not match on its value', async () => {
    vi.mocked(buildApiEntityAuthCtx).mockResolvedValueOnce(noAccessCtx as never);

    const result = await searchWorkspace(
      makeEntityDb(),
      'default',
      { q: 'salary-42', types: 'entities' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.entities).toEqual([]);
  });

  it('still matches on unrestricted fields while omitting the restricted field id', async () => {
    vi.mocked(buildApiEntityAuthCtx).mockResolvedValueOnce(noAccessCtx as never);

    const result = await searchWorkspace(
      makeEntityDb(),
      'default',
      { q: 'alpha-value', types: 'entities' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.entities).toEqual([
      expect.objectContaining({ entityId: 'entity-1', matchedFields: ['note'] })
    ]);
  });

  it('includes the restricted field once the caller has group access', async () => {
    vi.mocked(buildApiEntityAuthCtx).mockResolvedValueOnce(viewAccessCtx as never);

    const result = await searchWorkspace(
      makeEntityDb(),
      'default',
      { q: 'salary-42', types: 'entities' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.entities).toEqual([
      expect.objectContaining({ entityId: 'entity-1', matchedFields: ['secret'] })
    ]);
  });

  it('does not match stale entity values when the entity schema is missing', async () => {
    const db = makeEntityDb();
    vi.mocked(db.catalog.listSchemas).mockResolvedValue([]);
    vi.mocked(buildApiEntityAuthCtx).mockResolvedValueOnce(noAccessCtx as never);

    const result = await searchWorkspace(db, 'default', { q: 'salary-42', types: 'entities' }, {
      context: { user: { id: 'user-1' } }
    } as never);

    expect(result.entities).toEqual([]);
  });
});

describe('searchWorkspace relations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const inEntity = {
    id: 'in-entity',
    public_id: 'ENT-IN',
    schema_id: 'schema-1',
    schema_name: 'Component',
    name: 'In Entity',
    slug: 'in-entity',
    description: '',
    owner: null,
    owner_name: null,
    lifecycle: null,
    lifecycle_label: null,
    target_lifecycle: null,
    target_lifecycle_label: null,
    tags: [],
    links: [],
    data: {},
    namespace: '',
    workspace: 'ws-1',
    visibility_mode: null,
    created_at: new Date(),
    updated_at: new Date(),
    target_lifecycle_date: null
  };
  const outEntity = { ...inEntity, id: 'out-entity', public_id: 'ENT-OUT', name: 'Out Entity' };

  const entitySchema = {
    id: 'schema-1',
    workspace: 'ws-1',
    name: 'Component',
    description: '',
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: 'CMP',
    created_at: new Date(),
    updated_at: new Date(),
    fields: [],
    groups: []
  };

  const relationSchema = {
    id: 'rel-schema-1',
    workspace: 'ws-1',
    name: 'Depends On',
    description: '',
    in_schema_ids: ['schema-1'],
    out_schema_ids: ['schema-1'],
    fields: [{ id: 'note', name: 'Note', type: 'text' }],
    groups: [],
    color: null,
    icon: null
  };

  const relation = {
    id: 'relation-1',
    workspace: 'ws-1',
    schema_id: 'rel-schema-1',
    schema_name: 'Depends On',
    in_entity_id: 'in-entity',
    in_entity_name: 'In Entity',
    out_entity_id: 'out-entity',
    out_entity_name: 'Out Entity',
    data: { note: 'critical-dependency' },
    version: 1,
    approval_policy_override: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  const makeRelationDb = (relationSchemaName = 'Depends On'): DatabaseAdapter =>
    ({
      catalog: {
        listSchemas: vi.fn(async () => [entitySchema]),
        listEntities: vi.fn(async () => [inEntity, outEntity]),
        listEntitiesPaginated: vi.fn(
          async (_ws: string, _filters: unknown, { offset }: { limit: number; offset: number }) =>
            offset === 0 ? [inEntity, outEntity] : []
        )
      },
      project: {
        projects: {
          listProjects: vi.fn(async () => [])
        },
        contentNodes: {
          listContentNodes: vi.fn(async () => []),
          listEntityContentNodes: vi.fn(async () => []),
          listWorkspaceContentNodes: vi.fn(async () => [])
        }
      },
      relation: {
        listRelationSchemas: vi.fn(async () => [{ ...relationSchema, name: relationSchemaName }]),
        listRelations: vi.fn(
          async (_ws: string, _filters: unknown, { offset }: { offset: number }) =>
            offset === 0
              ? { items: [{ ...relation, schema_name: relationSchemaName }], total: 1 }
              : { items: [], total: 1 }
        )
      }
    }) as unknown as DatabaseAdapter;

  it('matches relations by schema field data and includes endpoint public ids', async () => {
    const result = await searchWorkspace(
      makeRelationDb(),
      'default',
      { q: 'critical-dependency', types: 'relations' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.relations).toEqual([
      expect.objectContaining({
        relationId: 'relation-1',
        schemaName: 'Depends On',
        inEntityPublicId: 'ENT-IN',
        outEntityPublicId: 'ENT-OUT',
        matchedFields: ['note']
      })
    ]);
  });

  it('matches relations by endpoint entity name metadata', async () => {
    const result = await searchWorkspace(
      makeRelationDb(),
      'default',
      { q: 'Out Entity', types: 'relations' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.relations).toEqual([
      expect.objectContaining({ relationId: 'relation-1', matchedMetadata: ['outEntity'] })
    ]);
  });

  it('matches API participation relation schema names', async () => {
    const result = await searchWorkspace(
      makeRelationDb('Provides API'),
      'default',
      { q: 'Provides API', types: 'relations' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.relations).toEqual([
      expect.objectContaining({ relationId: 'relation-1', schemaName: 'Provides API' })
    ]);
  });

  it('does not return relations when types excludes relations', async () => {
    const result = await searchWorkspace(
      makeRelationDb(),
      'default',
      { q: 'critical-dependency', types: 'entities' },
      { context: { user: { id: 'user-1' } } } as never
    );

    expect(result.relations).toEqual([]);
  });
});
