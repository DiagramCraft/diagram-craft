import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWithAuthResponse,
  getAccessTokenExpiresAt,
  registerSessionExpiredHandler
} from './authClient';

const setWindowLocation = (
  pathname = '/workspace/demo',
  search = '?tab=projects',
  hash = '#section'
) => {
  vi.stubGlobal('window', {
    location: {
      origin: 'http://localhost',
      pathname,
      search,
      hash
    }
  });
};

describe('authClient', () => {
  beforeEach(() => {
    vi.resetModules();
    setWindowLocation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a successful authenticated response without refreshing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithAuthResponse('/api/workspaces');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost/api/workspaces', {
      credentials: 'include'
    });
  });

  it('refreshes once and retries the original request after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const onExpired = vi.fn();
    registerSessionExpiredHandler(onExpired);

    const response = await fetchWithAuthResponse('/api/workspaces');

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://localhost/api/workspaces',
      'http://localhost/api/auth/refresh',
      'http://localhost/api/workspaces'
    ]);
    expect(getAccessTokenExpiresAt()).not.toBeNull();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('shares a single refresh request across concurrent 401 responses', async () => {
    let refreshResolved = false;
    let releaseRefresh!: () => void;
    const refreshPromise = new Promise<Response>(resolve => {
      releaseRefresh = () => {
        refreshResolved = true;
        resolve(new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 }));
      };
    });

    const fetchMock = vi.fn().mockImplementation((input: string) => {
      if (input === 'http://localhost/api/auth/refresh') {
        return refreshPromise;
      }

      if (!refreshResolved) {
        return Promise.resolve(new Response('Unauthorized', { status: 401 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const requestA = fetchWithAuthResponse('/api/projects');
    const requestB = fetchWithAuthResponse('/api/projects');

    await Promise.resolve();
    releaseRefresh();

    const [responseA, responseB] = await Promise.all([requestA, requestB]);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);
    expect(
      fetchMock.mock.calls.filter(call => call[0] === 'http://localhost/api/auth/refresh')
    ).toHaveLength(1);
  });

  it('forwards an abort signal to the initial request and its retry', async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithAuthResponse('/api/workspaces', {
      method: 'POST',
      body: 'request body',
      signal: controller.signal
    });

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty('signal');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ signal: controller.signal });
  });

  it('stops waiting for refresh and does not retry after cancellation', async () => {
    let releaseRefresh!: () => void;
    const refreshPromise = new Promise<Response>(resolve => {
      releaseRefresh = () =>
        resolve(new Response(JSON.stringify({ expires_in: 3600 }), { status: 200 }));
    });
    const fetchMock = vi.fn().mockImplementation((input: string) => {
      if (input === 'http://localhost/api/auth/refresh') return refreshPromise;
      return Promise.resolve(new Response('Unauthorized', { status: 401 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const onExpired = vi.fn();
    registerSessionExpiredHandler(onExpired);
    const controller = new AbortController();
    const request = fetchWithAuthResponse('/api/workspaces', { signal: controller.signal });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    controller.abort(new DOMException('Cancelled by test', 'AbortError'));

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onExpired).not.toHaveBeenCalled();

    releaseRefresh();
    await refreshPromise;
  });

  it('notifies session expiration when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const onExpired = vi.fn();
    registerSessionExpiredHandler(onExpired);

    const response = await fetchWithAuthResponse('/api/workspaces');

    expect(response.status).toBe(401);
    expect(onExpired).toHaveBeenCalledWith({
      reason: 'session-expired',
      redirectTo: '/workspace/demo?tab=projects#section'
    });
  });

  it('does not recurse when the refresh endpoint itself returns 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchWithAuthResponse('/api/auth/refresh', {
      method: 'POST'
    });

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
