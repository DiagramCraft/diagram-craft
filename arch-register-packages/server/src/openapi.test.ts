import { describe, expect, it } from 'vitest';
import { getUnifiedOpenAPISpec } from './openapi';

describe('unified OpenAPI spec', () => {
  it('publishes the combined oRPC paths', async () => {
    const spec = (await getUnifiedOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/enums': expect.any(Object),
      '/{workspace}/schemas': expect.any(Object),
      '/{workspace}/data': expect.any(Object),
      '/{workspace}/templates': expect.any(Object),
      '/{workspace}/views': expect.any(Object),
      '/workspaces': expect.any(Object),
      '/{workspace}/config/teams': expect.any(Object),
      '/{workspace}/projects': expect.any(Object),
      '/{workspace}/audit': expect.any(Object),
      '/{workspace}/analytics': expect.any(Object),
      '/{workspace}/jobs/schedules': expect.any(Object),
      '/{workspace}/jobs/runs': expect.any(Object),
      '/{workspace}/jobs/runs/{id}/cancel': expect.any(Object),
      '/{workspace}/webhooks': expect.any(Object),
      '/{workspace}/watching': expect.any(Object),
      '/{workspace}/search': expect.any(Object)
    });
  });
});
