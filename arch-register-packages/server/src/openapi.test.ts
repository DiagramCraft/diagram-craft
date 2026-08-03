import { describe, expect, it } from 'vitest';
import { getIntegrationOpenAPISpec, getUnifiedOpenAPISpec } from './openapi';

describe('core OpenAPI spec', () => {
  it('publishes core auth and development paths only', async () => {
    const spec = (await getUnifiedOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register API');
    expect(spec.paths).toMatchObject({
      '/auth/me': expect.any(Object),
      '/auth/login': expect.any(Object),
      '/auth/refresh': expect.any(Object),
      '/dev/config': expect.any(Object),
      '/dev/users': expect.any(Object),
      '/dev/switch-user': expect.any(Object)
    });
    expect(spec.paths?.['/{workspace}/schemas']).toBeUndefined();
    expect(spec.paths?.['/integrations/v1/{workspace}/entities/{id}']).toBeUndefined();
    expect(spec.paths?.['/adapters/diagram-craft/{workspace}/schemas']).toBeUndefined();
  });
});

describe('integration OpenAPI spec', () => {
  it('publishes typed relation metadata, reads, traversal, and mutation paths', async () => {
    const spec = (await getIntegrationOpenAPISpec()) as {
      paths?: Record<string, unknown>;
    };

    expect(spec.paths).toMatchObject({
      '/integrations/v1/{workspace}/relation-schemas': expect.any(Object),
      '/integrations/v1/{workspace}/relation-schemas/{id}': expect.any(Object),
      '/integrations/v1/{workspace}/relations': expect.any(Object),
      '/integrations/v1/{workspace}/relations/{id}': expect.any(Object),
      '/integrations/v1/{workspace}/data/{id}/typed-relations': expect.any(Object)
    });
  });
});
