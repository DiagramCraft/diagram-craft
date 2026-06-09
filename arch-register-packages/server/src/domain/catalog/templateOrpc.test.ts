import { describe, expect, it } from 'vitest';
import { getWorkspaceTemplateOpenAPISpec } from './templateOrpc';

describe('workspace template oRPC OpenAPI spec', () => {
  it('publishes the template POC paths', async () => {
    const spec = (await getWorkspaceTemplateOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Template POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/templates': expect.any(Object),
      '/{workspace}/projects/{projectId}/templates': expect.any(Object)
    });
  });
});
