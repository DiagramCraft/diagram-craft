import { describe, expect, it } from 'vitest';
import { getWorkspaceSchemaOpenAPISpec } from './schemaOrpc';

describe('workspace schema oRPC OpenAPI spec', () => {
  it('publishes the schema POC paths', async () => {
    const spec = (await getWorkspaceSchemaOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Schema POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/schemas': expect.any(Object),
      '/{workspace}/schemas/{id}': expect.any(Object)
    });
  });
});
