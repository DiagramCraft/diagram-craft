import { describe, expect, it } from 'vitest';
import { getAuditOpenAPISpec } from './auditOrpc';

describe('audit oRPC OpenAPI spec', () => {
  it('publishes the audit POC paths', async () => {
    const spec = (await getAuditOpenAPISpec()) as {
      paths?: Record<string, unknown>;
      info?: { title?: string };
    };

    expect(spec.info?.title).toBe('Arch Register Audit POC API');
    expect(spec.paths).toMatchObject({
      '/{workspace}/audit': expect.any(Object),
      '/{workspace}/audit/stats': expect.any(Object)
    });
  });
});
