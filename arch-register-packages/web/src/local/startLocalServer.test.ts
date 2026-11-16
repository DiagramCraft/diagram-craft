import { describe, expect, test, vi } from 'vitest';
import { withBearerAuth } from './startLocalServer';

describe('withBearerAuth', () => {
  test('logs in once and attaches the bearer token', async () => {
    const inner = vi.fn(async () => new Response('ok'));
    const login = vi.fn(async () => 'tok-1');
    const fetchLike = withBearerAuth(inner as unknown as typeof fetch, login);

    await fetchLike('http://localhost/api/a');
    await fetchLike('http://localhost/api/b');

    expect(login).toHaveBeenCalledTimes(1);
    const init = (inner.mock.calls[1] as unknown as [unknown, RequestInit])[1];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-1');
  });

  test('re-logs in and retries once on 401', async () => {
    const inner = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response('ok'));
    const login = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    const fetchLike = withBearerAuth(inner as unknown as typeof fetch, login);

    const res = await fetchLike('http://localhost/api/a');

    expect(res.status).toBe(200);
    expect(login).toHaveBeenCalledTimes(2);
    const init = (inner.mock.calls[1] as unknown as [unknown, RequestInit])[1];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer new');
  });
});
