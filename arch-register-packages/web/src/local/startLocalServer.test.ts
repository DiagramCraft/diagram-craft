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

describe('withBearerAuth session', () => {
  const memoryStore = (initial: string | null = null) => {
    let value = initial;
    return { read: () => value, write: (v: string | null) => void (value = v), get: () => value };
  };
  const loginResponse = () => new Response(JSON.stringify({ access_token: 'user-tok' }));

  test('stays signed out after logout, also across reloads', async () => {
    const store = memoryStore();
    const inner = vi.fn(async () => new Response('ok'));
    const autoLogin = vi.fn(async () => 'auto');
    const first = withBearerAuth(inner as unknown as typeof fetch, autoLogin, store);

    await first('http://localhost/api/auth/logout', { method: 'POST' });
    expect(store.get()).toBe('signed-out');

    // "Reload": a new transport reads the stored state
    const second = withBearerAuth(inner as unknown as typeof fetch, autoLogin, store);
    await second('http://localhost/api/auth/me');

    expect(autoLogin).not.toHaveBeenCalled();
    const init = (inner.mock.calls.at(-1) as unknown as [unknown, RequestInit | undefined])[1];
    expect(new Headers(init?.headers).get('Authorization')).toBeNull();
  });

  test('keeps an explicit login across reloads and does not auto-renew it', async () => {
    const store = memoryStore('signed-out');
    const inner = vi
      .fn()
      .mockResolvedValueOnce(loginResponse())
      .mockResolvedValue(new Response(null, { status: 401 }));
    const autoLogin = vi.fn(async () => 'auto');

    const first = withBearerAuth(inner as unknown as typeof fetch, autoLogin, store);
    await first('http://localhost/api/auth/login', { method: 'POST' });
    expect(store.get()).toBe('user-tok');

    const second = withBearerAuth(inner as unknown as typeof fetch, autoLogin, store);
    const res = await second('http://localhost/api/a');

    expect(res.status).toBe(401);
    expect(autoLogin).not.toHaveBeenCalled();
    const init = (inner.mock.calls.at(-1) as unknown as [unknown, RequestInit])[1];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer user-tok');
  });
});
