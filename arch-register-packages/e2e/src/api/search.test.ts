import { test as baseTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';

const now = new Date('2026-06-06T12:00:00.000Z');

const test = baseTest.extend<{ seeded: true }>({
  seeded: [
    async ({ server }, use) => {
      await seedCatalogEntities(server.db);

      await server.db.project.createProject({
        id: 'search-proj-alpha',
        workspace: seedIds.workspace.default,
        name: 'Alpha Search Project',
        description: 'Portal redesign diagrams and architecture notes.',
        owner: seedIds.teams.design,
        status: 'active',
        color: null,
        created_at: now,
        updated_at: now
      });

      await server.db.project.createProject({
        id: 'search-proj-beta',
        workspace: seedIds.workspace.default,
        name: 'Beta Search Project',
        description: 'Authentication migration workstream.',
        owner: seedIds.teams.security,
        status: 'pinned',
        color: null,
        created_at: now,
        updated_at: now
      });

      await server.db.project.upsertProjectFile({
        workspace: seedIds.workspace.default,
        project_id: 'search-proj-alpha',
        path: 'wireframes/portal-diagram.dgc',
        name: 'Portal Diagram',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      await server.db.project.upsertProjectFile({
        workspace: seedIds.workspace.default,
        project_id: 'search-proj-beta',
        path: 'flows/auth-diagram.dgc',
        name: 'Auth Diagram',
        size_bytes: 0,
        comment_count: 0,
        unresolved_comment_count: 0,
        updated_at: now,
        created_atIfNew: now
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

test.describe('search routes', () => {
  test('GET /api/:workspace/search returns empty results when q is blank', async ({ orpc, seeded: _ }) => {
    const result = await orpc.search.query({ params: { workspace: 'default' }, query: { q: '  ' } });
    expect(result).toEqual({ query: '', projects: [], files: [], entities: [], schemas: [] });
  });

  test('GET /api/:workspace/search finds matching projects and files', async ({ orpc, seeded: _ }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'portal', types: 'projects,files' }
    });
    expect(result).toMatchObject({ query: 'portal', entities: [], schemas: [] });
    expect(result.projects).toEqual([
      expect.objectContaining({ id: 'search-proj-alpha', name: 'Alpha Search Project' })
    ]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: 'search-proj-alpha',
        projectName: 'Alpha Search Project',
        path: 'wireframes/portal-diagram.dgc',
        name: 'Portal Diagram'
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
        matchedFields: ['technology'],
        matchedMetadata: expect.arrayContaining(['description', 'tags'])
      })
    ]);
  });

  test('GET /api/:workspace/search finds matching schemas by field name', async ({ orpc, seeded: _ }) => {
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
        fieldMatches: [{ fieldId: 'technology', fieldName: 'Technology' }]
      }
    ]);
  });

  test('GET /api/:workspace/search applies limitPerType after sorting', async ({ orpc, seeded: _ }) => {
    const result = await orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'diagram', types: 'files', limitPerType: 1 }
    });
    expect(result.projects).toEqual([]);
    expect(result.entities).toEqual([]);
    expect(result.schemas).toEqual([]);
    expect(result.files).toEqual([
      expect.objectContaining({
        projectId: 'search-proj-alpha',
        projectName: 'Alpha Search Project',
        path: 'wireframes/portal-diagram.dgc'
      })
    ]);
  });

  test('GET /api/:workspace/search returns 400 for invalid types', async ({ orpc, seeded: _ }) => {
    await expect(
      orpc.search.query({ params: { workspace: 'default' }, query: { q: 'portal', types: 'files,invalid' } })
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'types must be a comma-separated list of: projects, files, entities, schemas'
    });
  });

  test('GET /api/:workspace/search returns 401 without authentication', async ({ server, seeded: _ }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.search.query({ params: { workspace: 'default' }, query: { q: 'portal' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('GET /api/:workspace/search returns 404 for an unknown workspace', async ({ orpc, seeded: _ }) => {
    await expect(
      orpc.search.query({ params: { workspace: 'nonexistent' }, query: { q: 'portal' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
