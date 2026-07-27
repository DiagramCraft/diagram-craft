import { createApiTest, expect } from '../helpers/fixtures';

const test = createApiTest();

test.describe('versioned API surface aliases', () => {
  test('exposes catalog schemas and entities through application and integration surfaces', async ({
    server,
    auth
  }) => {
    const [legacySchemas, applicationSchemas, integrationSchemas] = await Promise.all([
      fetch(`${server.baseUrl}/api/default/schemas`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/application/v1/default/schemas`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/integrations/v1/default/schemas`, {
        headers: { Authorization: auth }
      })
    ]);

    expect(applicationSchemas.status).toBe(200);
    expect(integrationSchemas.status).toBe(200);
    const legacySchemaBody = await legacySchemas.json();
    expect(await applicationSchemas.json()).toEqual(legacySchemaBody);
    expect(await integrationSchemas.json()).toEqual(legacySchemaBody);

    const [legacyEntities, applicationEntities] = await Promise.all([
      fetch(`${server.baseUrl}/api/default/data`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/application/v1/default/data`, {
        headers: { Authorization: auth }
      })
    ]);

    expect(applicationEntities.status).toBe(200);
    expect(await applicationEntities.json()).toEqual(await legacyEntities.json());
  });

  test('exposes Diagram Craft data through the named adapter surface', async ({ server, auth }) => {
    const [legacySchemas, adapterSchemas] = await Promise.all([
      fetch(`${server.baseUrl}/api/public/default/schemas`, {
        headers: { Authorization: auth }
      }),
      fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/schemas`, {
        headers: { Authorization: auth }
      })
    ]);

    expect(adapterSchemas.status).toBe(200);
    expect(await adapterSchemas.json()).toEqual(await legacySchemas.json());
  });

  test('keeps the new surfaces behind the existing authentication boundary', async ({ server }) => {
    const applicationRes = await fetch(`${server.baseUrl}/api/application/v1/default/schemas`);
    const integrationRes = await fetch(`${server.baseUrl}/api/integrations/v1/default/schemas`);
    const adapterRes = await fetch(`${server.baseUrl}/api/adapters/diagram-craft/default/schemas`);

    expect(applicationRes.status).toBe(401);
    expect(integrationRes.status).toBe(401);
    expect(adapterRes.status).toBe(401);
  });

  test('keeps integration schema access read-only', async ({ server, auth }) => {
    const response = await fetch(`${server.baseUrl}/api/integrations/v1/default/schemas`, {
      method: 'POST',
      headers: { Authorization: auth, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Not an integration schema' })
    });

    expect(response.status).toBe(404);
  });

  test('publishes surface-specific OpenAPI documents', async ({ server }) => {
    const [applicationRes, integrationRes, adapterRes] = await Promise.all([
      fetch(`${server.baseUrl}/openapi/application-v1.json`),
      fetch(`${server.baseUrl}/openapi/integrations-v1.json`),
      fetch(`${server.baseUrl}/openapi/adapters/diagram-craft.json`)
    ]);

    expect(applicationRes.status).toBe(200);
    expect(integrationRes.status).toBe(200);
    expect(adapterRes.status).toBe(200);

    const applicationSpec = (await applicationRes.json()) as {
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
    };
    const integrationSpec = (await integrationRes.json()) as {
      paths: Record<string, unknown>;
    };
    const adapterSpec = (await adapterRes.json()) as {
      paths: Record<string, unknown>;
    };

    expect(applicationSpec.servers[0]?.url).toBe('/api/application/v1');
    expect(applicationSpec.paths['/{workspace}/schemas']).toBeDefined();
    expect(integrationSpec.paths['/integrations/v1/{workspace}/schemas']).toBeDefined();
    expect(integrationSpec.paths['/integrations/v1/{workspace}/schemas/{id}']).toBeUndefined();
    expect(integrationSpec.paths['/integrations/v1/{workspace}/entities/{id}']).toBeDefined();
    expect(adapterSpec.paths['/adapters/diagram-craft/{workspace}/schemas']).toBeDefined();
  });
});
