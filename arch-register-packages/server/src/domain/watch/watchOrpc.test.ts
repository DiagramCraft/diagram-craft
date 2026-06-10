import { describe, expect, it } from 'vitest';
import { getWatchOpenAPISpec } from './watchOrpc';

describe('watch oRPC OpenAPI spec', () => {
  it('publishes the watch POC paths', async () => {
    const spec = (await getWatchOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Watch POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/watching': expect.any(Object),
      '/{workspace}/watching/{entityId}': expect.any(Object),
      '/{workspace}/notifications': expect.any(Object),
      '/{workspace}/notifications/count': expect.any(Object),
      '/{workspace}/notifications/{notificationId}': expect.any(Object)
    });
  });
});
