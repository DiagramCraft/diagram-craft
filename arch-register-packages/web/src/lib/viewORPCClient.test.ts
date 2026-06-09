import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { listSavedViewsORPC, listPinnedEntitiesORPC } from './viewORPCClient';

describe('viewORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC list views route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listSavedViewsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/views',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses the POC oRPC list pinned-entities route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } })
    );

    await listPinnedEntitiesORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/pinned-entities',
      expect.objectContaining({ method: 'GET' })
    );
  });
});
