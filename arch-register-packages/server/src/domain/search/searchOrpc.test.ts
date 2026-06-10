import { describe, expect, it } from 'vitest';
import { getSearchOpenAPISpec } from './searchOrpc';

describe('search oRPC OpenAPI spec', () => {
  it('publishes the search POC path', async () => {
    const spec = (await getSearchOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Search POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/search': expect.any(Object)
    });
  });
});
