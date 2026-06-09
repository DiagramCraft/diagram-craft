import { describe, expect, it } from 'vitest';
import { getWorkspaceViewOpenAPISpec } from './viewOrpc';

describe('workspace view oRPC OpenAPI spec', () => {
  it('publishes the view POC paths', async () => {
    const spec = (await getWorkspaceViewOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register View POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/views': expect.any(Object),
      '/{workspace}/views/{id}': expect.any(Object),
      '/{workspace}/pinned-entities': expect.any(Object),
      '/{workspace}/pinned-entities/{entityId}': expect.any(Object)
    });
  });
});
