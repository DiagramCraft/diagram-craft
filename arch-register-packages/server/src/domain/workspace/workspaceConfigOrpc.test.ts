import { describe, expect, it } from 'vitest';
import { getWorkspaceConfigOpenAPISpec } from './workspaceConfigOrpc';

describe('workspace config oRPC OpenAPI spec', () => {
  it('publishes the workspace config POC paths', async () => {
    const spec = (await getWorkspaceConfigOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Workspace Config POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/config/lifecycle-states': expect.any(Object),
      '/{workspace}/config/teams': expect.any(Object),
      '/{workspace}/config/team-assignments': expect.any(Object),
      '/{workspace}/config/roles': expect.any(Object),
      '/{workspace}/config/roles/{roleId}': expect.any(Object),
      '/{workspace}/config/members': expect.any(Object),
      '/{workspace}/config/members/{userId}/role': expect.any(Object),
      '/{workspace}/config/members/{userId}': expect.any(Object),
      '/{workspace}/config/users': expect.any(Object)
    });
  });
});
