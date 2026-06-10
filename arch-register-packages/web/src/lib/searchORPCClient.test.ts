import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchWithAuthResponse } = vi.hoisted(() => ({
  fetchWithAuthResponse: vi.fn()
}));

vi.mock('../auth/authClient', () => ({
  fetchWithAuthResponse
}));

import { searchArchRegisterORPC } from './searchORPCClient';

describe('searchORPCClient', () => {
  beforeEach(() => {
    fetchWithAuthResponse.mockReset();
  });

  it('uses the POC oRPC search route', async () => {
    fetchWithAuthResponse.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ query: 'test', projects: [], files: [], entities: [], schemas: [] }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    );

    await searchArchRegisterORPC('default', { q: 'test' });

    expect(fetchWithAuthResponse).toHaveBeenCalledWith(
      expect.stringContaining('/api/default/search'),
      expect.objectContaining({ method: 'GET' })
    );
  });
});
