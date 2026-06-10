import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { listWatchingORPC, listNotificationsORPC, getNotificationCountORPC } from './watchORPCClient';

describe('watchORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC watching list route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listWatchingORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/default/watching',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses the POC oRPC notifications list route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listNotificationsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/default/notifications',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses the POC oRPC notification count route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify({ count: 0 }), { headers: { 'Content-Type': 'application/json' } })
    );

    await getNotificationCountORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/default/notifications/count',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
