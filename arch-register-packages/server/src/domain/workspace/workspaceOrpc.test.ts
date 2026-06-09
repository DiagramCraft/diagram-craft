import { describe, expect, it } from 'vitest';
import { getWorkspaceManagementOpenAPISpec } from './workspaceOrpc';

describe('workspace management oRPC OpenAPI spec', () => {
  it('publishes the workspace POC paths', async () => {
    const spec = (await getWorkspaceManagementOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Workspace POC API');
    expect(spec.paths).toMatchObject({
      '/workspaces': expect.any(Object),
      '/workspaces/{id}': expect.any(Object)
    });
  });
});
