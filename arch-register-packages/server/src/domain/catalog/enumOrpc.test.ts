import { describe, expect, it } from 'vitest';
import { getWorkspaceEnumOpenAPISpec } from './enumOrpc';

describe('workspace enum oRPC OpenAPI spec', () => {
  it('publishes the enum POC paths', async () => {
    const spec = (await getWorkspaceEnumOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Enum POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/enums': expect.any(Object),
      '/{workspace}/enums/{id}': expect.any(Object)
    });
  });
});
