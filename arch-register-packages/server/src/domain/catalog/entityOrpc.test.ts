import { describe, expect, it } from 'vitest';
import { getWorkspaceEntityOpenAPISpec } from './entityOrpc';

describe('workspace entity oRPC OpenAPI spec', () => {
  it('publishes the entity POC paths', async () => {
    const spec = (await getWorkspaceEntityOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Entity POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/data': expect.any(Object),
      '/{workspace}/data/facets': expect.any(Object),
      '/{workspace}/data/tree': expect.any(Object),
      '/{workspace}/data/{id}': expect.any(Object),
      '/{workspace}/data/{id}/relations': expect.any(Object)
    });
  });
});
