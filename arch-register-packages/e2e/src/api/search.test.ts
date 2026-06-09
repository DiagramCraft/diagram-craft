import { test as baseTest, expect } from '../helpers/fixtures';
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
  test('GET /api/:workspace/search returns empty results when q is blank', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=%20%20`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      query: '',
      projects: [],
      files: [],
      entities: [],
      schemas: []
    });
  });

  test('GET /api/:workspace/search finds matching projects and files', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=portal&types=projects,files`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      query: 'portal',
      entities: [],
      schemas: []
    });
    expect(body['projects']).toEqual([
      expect.objectContaining({
        id: 'search-proj-alpha',
        name: 'Alpha Search Project'
      })
    ]);
    expect(body['files']).toEqual([
      expect.objectContaining({
        projectId: 'search-proj-alpha',
        projectName: 'Alpha Search Project',
        path: 'wireframes/portal-diagram.dgc',
        name: 'Portal Diagram'
      })
    ]);
  });

  test('GET /api/:workspace/search finds matching entities with matched metadata and fields', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=react&types=entities`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entities: Array<Record<string, unknown>>;
      projects: unknown[];
      files: unknown[];
      schemas: unknown[];
    };
    expect(body.projects).toEqual([]);
    expect(body.files).toEqual([]);
    expect(body.schemas).toEqual([]);
    expect(body.entities).toEqual([
      expect.objectContaining({
        entityId: '00000000-0000-0000-0003-000000000002',
        schemaName: 'Component',
        _name: 'Frontend App',
        matchedFields: ['technology'],
        matchedMetadata: expect.arrayContaining(['description', 'tags'])
      })
    ]);
  });

  test('GET /api/:workspace/search finds matching schemas by field name', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=technology&types=schemas`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      schemas: Array<Record<string, unknown>>;
      projects: unknown[];
      files: unknown[];
      entities: unknown[];
    };
    expect(body.projects).toEqual([]);
    expect(body.files).toEqual([]);
    expect(body.entities).toEqual([]);
    expect(body.schemas).toEqual([
      {
        schemaId: '00000000-0000-0000-0000-000000000003',
        name: 'Component',
        fieldMatches: [{ fieldId: 'technology', fieldName: 'Technology' }]
      }
    ]);
  });

  test('GET /api/:workspace/search applies limitPerType after sorting', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=diagram&types=files&limitPerType=1`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      files: Array<Record<string, unknown>>;
      projects: unknown[];
      entities: unknown[];
      schemas: unknown[];
    };
    expect(body.projects).toEqual([]);
    expect(body.entities).toEqual([]);
    expect(body.schemas).toEqual([]);
    expect(body.files).toEqual([
      expect.objectContaining({
        projectId: 'search-proj-alpha',
        projectName: 'Alpha Search Project',
        path: 'wireframes/portal-diagram.dgc'
      })
    ]);
  });

  test('GET /api/:workspace/search returns 400 for invalid types', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=portal&types=files,invalid`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: 'types must be a comma-separated list of: projects, files, entities, schemas'
    });
  });

  test('GET /api/:workspace/search returns 401 without authentication', async ({
    server,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/default/search?q=portal`);
    expect(res.status).toBe(401);
  });

  test('GET /api/:workspace/search returns 404 for an unknown workspace', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/search?q=portal`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });
});
