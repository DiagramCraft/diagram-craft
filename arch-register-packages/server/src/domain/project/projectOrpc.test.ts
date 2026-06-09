import { describe, expect, it } from 'vitest';
import { getProjectOpenAPISpec } from './projectOrpc';

describe('project oRPC OpenAPI spec', () => {
  it('publishes the project POC paths', async () => {
    const spec = (await getProjectOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Project POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/projects': expect.any(Object),
      '/{workspace}/projects/{id}': expect.any(Object),
      '/{workspace}/projects/{id}/files': expect.any(Object)
    });
  });
});
