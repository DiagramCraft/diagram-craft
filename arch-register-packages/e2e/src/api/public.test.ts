import { seedEntities } from '@arch-register/server/db/seedData';
import { test as baseTest, expect } from '../helpers/fixtures';

const test = baseTest.extend<{ seeded: true }>({
  seeded: [
    async ({ server }, use) => {
      for (const entity of seedEntities) {
        await server.db.catalog.createEntity(entity);
      }
      await use(true);
    },
    { scope: 'file' }
  ]
});

const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const frontendAppId = '00000000-0000-0000-0003-000000000002';

test.describe('public routes', () => {
  test('GET /api/public/:workspace/schemas returns public schema shapes', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/public/default/schemas`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: componentSchemaId,
          name: 'Component',
          fields: expect.arrayContaining([
            expect.objectContaining({ id: 'name', type: 'text' }),
            expect.objectContaining({ id: 'description', type: 'longtext' }),
            expect.objectContaining({ id: 'system', type: 'containment' }),
            expect.objectContaining({ id: 'depends_on', type: 'reference' })
          ])
        })
      ])
    );
  });

  test('GET /api/public/:workspace/data returns diagram-craft entity data', async ({
    server,
    auth,
    seeded: _
  }) => {
    const res = await fetch(`${server.baseUrl}/api/public/default/data`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _uid: frontendAppId,
          _schemaId: componentSchemaId,
          _name: 'Frontend App',
          _owner: 'Design Systems',
          name: 'Frontend App',
          description: 'React single-page application served to end users.',
          technology: 'React',
          system: '00000000-0000-0000-0002-000000000001'
        })
      ])
    );
  });

  test('returns 401 without authentication', async ({ server, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/public/default/schemas`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown workspace', async ({ server, auth, seeded: _ }) => {
    const res = await fetch(`${server.baseUrl}/api/public/nonexistent/data`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(404);
  });
});
