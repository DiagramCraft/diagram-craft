process.env['DEV_TRACING_ENABLED'] = 'true';

import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contractSurfaceManifest } from '@arch-register/api-types/contractSurfaceManifest';
import { test, expect } from '../helpers/fixtures';

const TRACE_ID = 'e2e-trace-0001';

test.describe('dev request tracing (enabled)', () => {
  test('captures the API request and its SQL statements for a trace id', async ({
    server,
    auth,
    orpc
  }) => {
    const { application } = contractSurfaceManifest.surfaces;
    const tracedClient = createORPCClient(
      new OpenAPILink(application.contracts, {
        url: `${server.baseUrl}/api/application/v1`,
        fetch: (request: Request, init?: RequestInit) => {
          const headers = new Headers(request.headers);
          headers.set('Authorization', auth);
          headers.set('x-dev-trace-id', TRACE_ID);
          headers.set('x-dev-span-id', 'e2e-span-0001');
          headers.set('x-dev-interaction', encodeURIComponent('click: Load workspaces'));
          return fetch(request.url, { ...init, method: request.method, headers });
        }
      })
      // biome-ignore lint/suspicious/noExplicitAny: test-only client shape
    ) as any;

    await tracedClient.workspaces.list(undefined);

    const trace = await orpc.dev.trace({ params: { traceId: TRACE_ID } });

    expect(trace).not.toBeNull();
    expect(trace?.interaction).toBe('click: Load workspaces');
    expect(trace?.requests).toHaveLength(1);
    const request = trace!.requests[0]!;
    expect(request.method).toBe('GET');
    expect(request.status).toBe(200);
    expect(request.sql.length).toBeGreaterThan(0);
    expect(request.sql.some(s => /select/i.test(s.sql))).toBe(true);
  });

  test('dev.trace returns null for an unknown trace id', async ({ orpc }) => {
    expect(await orpc.dev.trace({ params: { traceId: 'does-not-exist' } })).toBeNull();
  });
});
