import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { getEntityFacetsORPC, listEntitiesORPC } from './entityORPCClient';

describe('entityORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC list route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await listEntitiesORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/data',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('uses the POC oRPC facets route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 0,
          lifecycle: [],
          owner: [],
          schema: [],
          completeness: { below50: 0, below80: 0, above80: 0 }
        }),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )
    );

    await getEntityFacetsORPC('default');

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      '/api/poc-orpc/default/data/facets',
      expect.objectContaining({
        method: 'GET'
      })
    );
  });
});
