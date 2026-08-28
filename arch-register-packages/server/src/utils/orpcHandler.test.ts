import { implement } from '@orpc/server';
import { H3 } from 'h3';
import { describe, expect, it, vi } from 'vitest';
import { devContract } from '@arch-register/api-types/devContract';
import { API_PREFIXES } from '../constants';
import { createOrpcHandler } from './orpcHandler';

const createTestRouter = () => {
  const router = implement(devContract).$context<{ marker: string }>();
  return router.router({
    dev: {
      config: router.dev.config.handler(({ context }) => ({
        enabled: context.marker === 'enabled',
        tracingEnabled: false
      })),
      trace: router.dev.trace.handler(() => null),
      listUsers: router.dev.listUsers.handler(() => []),
      switchUser: router.dev.switchUser.handler(() => ({ ok: true }))
    }
  });
};

describe('createOrpcHandler', () => {
  it('uses the application prefix and passes request context to the router', async () => {
    const handler = createOrpcHandler(createTestRouter(), {
      context: () => ({ marker: 'enabled' })
    });

    const response = await handler.fetch(`${API_PREFIXES.application}/dev/config`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: true, tracingEnabled: false });
  });

  it('supports custom prefixes and leaves unmatched requests unhandled', async () => {
    const handler = createOrpcHandler(createTestRouter(), {
      prefix: API_PREFIXES.root,
      context: () => ({ marker: 'root' })
    });

    const app = new H3();
    app.use(handler);
    app.use(() => new Response('fallback', { status: 418 }));

    const matched = await app.fetch(new Request(`http://localhost${API_PREFIXES.root}/dev/config`));
    const unmatched = await app.fetch(
      new Request(`http://localhost${API_PREFIXES.application}/dev/config`)
    );

    expect(matched.status).toBe(200);
    expect(unmatched.status).toBe(418);
  });

  it('supports request mapping, route predicates, and pre-handler hooks', async () => {
    const beforeHandle = vi.fn();
    const handler = createOrpcHandler(createTestRouter(), {
      prefix: API_PREFIXES.root,
      context: () => ({ marker: 'mapped' }),
      shouldHandle: event => new URL(event.req.url).pathname === '/alias/dev/config',
      request: event => new Request(new URL(`${API_PREFIXES.root}/dev/config`, event.req.url)),
      beforeHandle
    });

    const app = new H3();
    app.use(handler);
    app.use(() => new Response('fallback', { status: 418 }));

    const response = await app.fetch(new Request('http://localhost/alias/dev/config'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false, tracingEnabled: false });
    expect(beforeHandle).toHaveBeenCalledOnce();

    const skipped = await app.fetch(new Request('http://localhost/other'));
    expect(skipped.status).toBe(418);
    expect(beforeHandle).toHaveBeenCalledOnce();
  });

  it('records a dev trace request span when trace headers are present', async () => {
    const previous = process.env['DEV_TRACING_ENABLED'];
    process.env['DEV_TRACING_ENABLED'] = 'true';
    try {
      const { getTrace, clearTraces } = await import('../dev/devTrace');
      clearTraces();

      const handler = createOrpcHandler(createTestRouter(), {
        context: () => ({ marker: 'enabled' })
      });

      const response = await handler.fetch(
        new Request(`http://localhost${API_PREFIXES.application}/dev/config`, {
          headers: {
            'x-dev-trace-id': 'trace-http',
            'x-dev-span-id': 'span-http',
            'x-dev-interaction': encodeURIComponent('click: Refresh')
          }
        })
      );

      expect(response.status).toBe(200);
      const trace = getTrace('trace-http');
      expect(trace?.interaction).toBe('click: Refresh');
      expect(trace?.requests).toMatchObject([{ spanId: 'span-http', status: 200 }]);
      expect(trace?.requests[0]?.path).toContain('/dev/config');
    } finally {
      if (previous === undefined) delete process.env['DEV_TRACING_ENABLED'];
      else process.env['DEV_TRACING_ENABLED'] = previous;
    }
  });
});
