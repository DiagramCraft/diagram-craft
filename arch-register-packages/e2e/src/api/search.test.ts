import { test as baseTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';
import { SEARCH_PROJ_ALPHA_ID, SEARCH_PROJ_BETA_ID } from '../helpers/testIds';

const now = new Date('2026-06-06T12:00:00.000Z');

const test = baseTest.extend<{ seeded: true }>({
  seeded: [
    async ({ server }, use) => {
      await seedCatalogEntities(server.db);

      await server.db.project.createProject({
        id: SEARCH_PROJ_ALPHA_ID,
        workspace: seedIds.workspace.default,
        name: 'Alpha Search Project',
        description: 'Portal redesign diagrams and architecture notes.',
        owner: seedIds.teams.design,
        status: 'active',
        color: null,
        target_date: null,
        pinned: false,
        created_at: now,
        updated_at: now
      });

      await server.db.project.createProject({
        id: SEARCH_PROJ_BETA_ID,
        workspace: seedIds.workspace.default,
        name: 'Beta Search Project',
        description: 'Authentication migration workstream.',
        owner: seedIds.teams.security,
        status: 'active',
        color: null,
        target_date: null,
        pinned: true,
        created_at: now,
        updated_at: now
      });

      const portalDiagram = await server.db.project.upsertContentNode({
        workspace: seedIds.workspace.default,
        project_id: SEARCH_PROJ_ALPHA_ID,
        path: 'wireframes/portal-diagram.dgc',
        name: 'Portal Diagram',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      const authDiagram = await server.db.project.upsertContentNode({
        workspace: seedIds.workspace.default,
        project_id: SEARCH_PROJ_BETA_ID,
        path: 'flows/auth-diagram.dgc',
        name: 'Auth Diagram',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      await server.db.project.upsertContentMetadata({
        workspace: seedIds.workspace.default,
        node_id: portalDiagram.id,
        title: 'Customer experience blueprint',
        description: 'Maps the onboarding journey and portal navigation.',
        company: null,
        category: 'Experience',
        keywords: ['journey', 'onboarding'],
        updated_at: now
      });

      await server.db.project.upsertContentMetadata({
        workspace: seedIds.workspace.default,
        node_id: authDiagram.id,
        title: 'Identity boundary overview',
        description: 'Documents token exchange between the client app and auth service.',
        company: null,
        category: 'Security',
        keywords: ['jwt', 'sso'],
        updated_at: now
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

test.describe('search routes', () => {
  test('GET /api/:workspace/search returns empty results when q is blank', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: '  ' }
    });
    expect(result).toEqual({ query: '', projects: [], files: [], entities: [], schemas: [] });
  });

  test('GET /api/:workspace/search finds matching projects and files', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'portal', types: 'projects,files' }
    });
    expect(result).toMatchObject({ query: 'portal', entities: [], schemas: [] });
    expect(result.projects).toEqual([
      expect.objectContaining({ id: SEARCH_PROJ_ALPHA_ID, name: 'Alpha Search Project' })
    ]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: SEARCH_PROJ_ALPHA_ID,
        projectName: 'Alpha Search Project',
        path: 'wireframes/portal-diagram.dgc',
        name: 'Portal Diagram'
      })
    ]);
  });

  test('GET /api/:workspace/search finds files by metadata title', async ({ orpc, seeded: _ }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'blueprint', types: 'files' }
    });

    expect(result.projects).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: SEARCH_PROJ_ALPHA_ID,
        name: 'Portal Diagram',
        content_metadata: expect.objectContaining({
          title: 'Customer experience blueprint'
        })
      })
    ]);
  });

  test('GET /api/:workspace/search finds files by metadata description', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'token exchange', types: 'files' }
    });

    expect(result.projects).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: SEARCH_PROJ_BETA_ID,
        name: 'Auth Diagram',
        content_metadata: expect.objectContaining({
          description: 'Documents token exchange between the client app and auth service.'
        })
      })
    ]);
  });

  test('GET /api/:workspace/search finds files by metadata category', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'security', types: 'files' }
    });

    expect(result.projects).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: SEARCH_PROJ_BETA_ID,
        name: 'Auth Diagram',
        content_metadata: expect.objectContaining({
          category: 'Security'
        })
      })
    ]);
  });

  test('GET /api/:workspace/search finds files by metadata keywords', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'onboarding', types: 'files' }
    });

    expect(result.projects).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: SEARCH_PROJ_ALPHA_ID,
        name: 'Portal Diagram',
        content_metadata: expect.objectContaining({
          keywords: expect.arrayContaining(['journey', 'onboarding'])
        })
      })
    ]);
  });

  test('GET /api/:workspace/search finds matching entities with matched metadata and fields', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'react', types: 'entities' }
    });
    expect(result.projects).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.entities).toEqual([
      expect.objectContaining({
        entityId: '00000000-0000-0000-0003-000000000002',
        schemaName: 'Component',
        _name: 'Frontend App',
        matchedFields: [],
        matchedMetadata: expect.arrayContaining(['description', 'tags'])
      }),
      expect.objectContaining({
        entityId: '00000000-0000-0000-0006-000000000002',
        schemaName: 'Technology Release',
        _name: 'React 18',
        matchedFields: ['product', 'provider_product', 'source_url'],
        matchedMetadata: expect.arrayContaining(['name', 'slug', 'description', 'links'])
      }),
      expect.objectContaining({
        entityId: '00000000-0000-0000-0003-000000000008',
        schemaName: 'Component',
        _name: 'Reporting Dashboard',
        matchedFields: [],
        matchedMetadata: ['tags']
      })
    ]);
  });

  test('GET /api/:workspace/search finds matching schemas by field name', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'technology', types: 'schemas' }
    });
    expect(result.projects).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([
      {
        schemaId: '00000000-0000-0000-0000-000000000003',
        name: 'Component',
        fieldMatches: [{ fieldId: 'technology_releases', fieldName: 'Technology Releases' }]
      },
      {
        schemaId: '00000000-0000-0000-0000-000000000005',
        name: 'Resource',
        fieldMatches: [{ fieldId: 'technology_releases', fieldName: 'Technology Releases' }]
      },
      {
        schemaId: '00000000-0000-0000-0000-000000000006',
        name: 'Technology Release',
        fieldMatches: []
      }
    ]);
  });

  test('GET /api/:workspace/search applies limitPerType after sorting', async ({
    orpc,
    seeded: _
  }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'diagram', types: 'files', limitPerType: 1 }
    });
    expect(result.projects).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: SEARCH_PROJ_ALPHA_ID,
        projectName: 'Alpha Search Project',
        path: 'wireframes/portal-diagram.dgc'
      })
    ]);
  });

  test('GET /api/:workspace/search returns 400 for invalid types', async ({ orpc, seeded: _ }) => {
    await expect(
      orpc.search.query({
        params: { workspace: 'default' },
        query: { q: 'portal', types: 'files,invalid' }
      })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'types must be a comma-separated list of: projects, files, entities, schemas'
    });
  });

  test('GET /api/:workspace/search returns 401 without authentication', async ({
    server,
    seeded: _
  }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.search.query({ params: { workspace: 'default' }, query: { q: 'portal' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('GET /api/:workspace/search returns 404 for an unknown workspace', async ({
    orpc,
    seeded: _
  }) => {
    await expect(
      orpc.search.query({ params: { workspace: 'nonexistent' }, query: { q: 'portal' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
