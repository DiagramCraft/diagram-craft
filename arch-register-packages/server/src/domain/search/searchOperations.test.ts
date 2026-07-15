import { beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWorkspace } from './searchOperations';
import type { DatabaseAdapter } from '../../db/database';

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
      ]),
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
